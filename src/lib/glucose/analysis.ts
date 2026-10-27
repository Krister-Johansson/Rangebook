import {
  TARGETS,
  addDays,
  dayOf,
  daysBetween,
  hourOf,
  inDays,
  isWeekend,
  lowEpisodes,
  percentile,
  stats,
  timeOfDay,
  toMin,
  weekdayOf,
} from './core'
import type { Dataset, Reading, Stats } from './core'
import { hm, perDay, rangeLabel, shortDate } from './format'

export type DayType = 'all' | 'school' | 'weekend'

function matchesDayType(day: string, type: DayType) {
  if (type === 'all') return true
  return type === 'weekend' ? isWeekend(day) : !isWeekend(day)
}

const share = (part: number, total: number) => (total ? (part / total) * 100 : 0)

// ---------------------------------------------------------------- profile

export interface HourProfile {
  hour: number
  n: number
  p5: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  p95: number
  below39: number
  below30: number
  above10: number
  above139: number
}

/** AGP-style hourly percentiles and band shares. */
export function hourlyProfile(readings: Reading[], type: DayType = 'all'): HourProfile[] {
  const byHour: number[][] = Array.from({ length: 24 }, () => [])
  for (const r of readings) {
    if (matchesDayType(dayOf(r.ts), type)) byHour[hourOf(r.ts)].push(r.v)
  }
  return byHour.map((vals, hour) => {
    const s = [...vals].sort((a, b) => a - b)
    const n = s.length
    const count = (f: (v: number) => boolean) => share(s.filter(f).length, n)
    return {
      hour,
      n,
      p5: percentile(s, 0.05),
      p10: percentile(s, 0.1),
      p25: percentile(s, 0.25),
      p50: percentile(s, 0.5),
      p75: percentile(s, 0.75),
      p90: percentile(s, 0.9),
      p95: percentile(s, 0.95),
      below39: count((v) => v < 3.9),
      below30: count((v) => v < 3.0),
      above10: count((v) => v > 10.0),
      above139: count((v) => v > 13.9),
    }
  })
}

// ---------------------------------------------------------------- heatmap

export interface HeatCell {
  n: number
  below39: number
  above10: number
  above139: number
  mean: number
}

/** Weekday (Mon..Sun) by hour grid of band shares. */
export function weekHeatmap(readings: Reading[]): HeatCell[][] {
  const acc = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ n: 0, below: 0, a10: 0, a139: 0, sum: 0 })),
  )
  for (const r of readings) {
    const c = acc[weekdayOf(dayOf(r.ts))][hourOf(r.ts)]
    c.n++
    c.sum += r.v
    if (r.v < 3.9) c.below++
    if (r.v > 10) c.a10++
    if (r.v > 13.9) c.a139++
  }
  return acc.map((row) =>
    row.map((c) => ({
      n: c.n,
      below39: share(c.below, c.n),
      above10: share(c.a10, c.n),
      above139: share(c.a139, c.n),
      mean: c.n ? c.sum / c.n : 0,
    })),
  )
}

// ---------------------------------------------------------------- days

export interface DaySummary {
  day: string
  label: string
  weekend: boolean
  readings: number
  wear: number
  inRange: number
  below39: number
  above10: number
  mean: number
  lows: number
  carbBoluses: number
  lunchCarbs: boolean
}

export function daySummaries(ds: Dataset, from: string, to: string): DaySummary[] {
  const out: DaySummary[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const rs = ds.readings.filter((r) => dayOf(r.ts) === d)
    const carb = ds.boluses.filter((b) => b.kind === 'carb' && dayOf(b.ts) === d)
    const s = stats(rs)
    out.push({
      day: d,
      label: shortDate(d),
      weekend: isWeekend(d),
      readings: rs.length,
      wear: share(rs.length, expectedSlots(ds, d, d)),
      inRange: s.pct.in,
      below39: s.below39,
      above10: s.above10,
      mean: s.mean,
      lows: lowEpisodes(rs).length,
      carbBoluses: carb.length,
      lunchCarbs: carb.some((b) => timeOfDay(b.ts) >= 10 && timeOfDay(b.ts) < 15),
    })
  }
  return out
}

/** 5-minute slots in the period, stopping at the last reading of the export. */
export function expectedSlots(ds: Dataset, from: string, to: string) {
  const start = toMin(`${from} 00:00`)
  const end = Math.min(toMin(`${addDays(to, 1)} 00:00`), toMin(ds.lastTs) + 5)
  return Math.max(0, Math.round((end - start) / 5))
}

// ---------------------------------------------------------------- week

export interface PeriodSummary {
  from: string
  to: string
  label: string
  stats: Stats
  wear: number
  lows: number
  lowsBelow30: number
  carbBoluses: number
  daysWithData: number
}

export function periodSummary(ds: Dataset, from: string, to: string): PeriodSummary {
  const rs = inDays(ds.readings, from, to)
  const lows = lowEpisodes(rs)
  return {
    from,
    to,
    label: rangeLabel(from, to),
    stats: stats(rs),
    wear: share(rs.length, expectedSlots(ds, from, to)),
    lows: lows.length,
    lowsBelow30: lows.filter((e) => e.extreme < 3.0).length,
    carbBoluses: inDays(ds.boluses, from, to).filter((b) => b.kind === 'carb').length,
    daysWithData: new Set(rs.map((r) => dayOf(r.ts))).size,
  }
}

export interface Win {
  id: string
  title: string
  detail: string
}

export interface Goal {
  id: string
  text: string
  target: number
  done: number
  unit: string
}

export interface HomeData {
  thisWeek: PeriodSummary
  lastWeek: PeriodSummary
  days: DaySummary[]
  wins: Win[]
  goals: Goal[]
  lowsOverTarget: boolean
}

export function homeData(ds: Dataset): HomeData {
  const to = ds.lastDay
  const from = addDays(to, -6)
  const thisWeek = periodSummary(ds, from, to)
  const lastWeek = periodSummary(ds, addDays(from, -7), addDays(from, -1))
  const days = daySummaries(ds, from, to)

  const wins: Win[] = []
  const tirDiff = thisWeek.stats.pct.in - lastWeek.stats.pct.in
  if (lastWeek.stats.n && tirDiff >= 1) {
    wins.push({
      id: 'more-in-range',
      title: `About ${perDay(tirDiff)} more in range per day`,
      detail: `In range ${thisWeek.stats.pct.in.toFixed(0)}% of the time, up from ${lastWeek.stats.pct.in.toFixed(0)}% last week.`,
    })
  }
  const best = days
    .filter((d) => d.wear >= 70)
    .reduce<DaySummary | null>((a, d) => (!a || d.inRange > a.inRange ? d : a), null)
  if (best) {
    wins.push({
      id: 'best-day',
      title: `Best day: ${best.label}`,
      detail: `${best.inRange.toFixed(0)}% in range, about ${perDay(best.inRange)}.`,
    })
  }
  if (lastWeek.stats.n && thisWeek.stats.pct.vlow < lastWeek.stats.pct.vlow) {
    wins.push({
      id: 'fewer-very-low',
      title: 'Less time very low',
      detail: `Below 3.0 for ${thisWeek.stats.pct.vlow.toFixed(1)}% of the time, down from ${lastWeek.stats.pct.vlow.toFixed(1)}%.`,
    })
  }
  if (thisWeek.wear >= TARGETS.wear) {
    wins.push({
      id: 'sensor-on',
      title: 'Sensor on most of the week',
      detail: `Readings for ${thisWeek.wear.toFixed(0)}% of the time. Enough for the numbers to count.`,
    })
  }

  const schoolDays = days.filter((d) => !d.weekend)
  const goals: Goal[] = [
    {
      id: 'lunch',
      text: `Enter carbs at lunch on ${schoolDays.length} school days`,
      target: schoolDays.length,
      done: schoolDays.filter((d) => d.lunchCarbs).length,
      unit: 'school days',
    },
    {
      id: 'meals',
      text: 'Enter carbs for 3 meals a day on 4 days',
      target: 4,
      done: days.filter((d) => d.carbBoluses >= 3).length,
      unit: 'days',
    },
    {
      id: 'sensor',
      text: 'Keep the sensor on for 6 of 7 days',
      target: 6,
      done: days.filter((d) => d.wear >= 70).length,
      unit: 'days',
    },
  ]

  return {
    thisWeek,
    lastWeek,
    days,
    wins,
    goals,
    lowsOverTarget: thisWeek.stats.below39 > TARGETS.below39,
  }
}

// ---------------------------------------------------------------- day detail

export interface DayDetail {
  day: string
  label: string
  weekend: boolean
  prev: string | null
  next: string | null
  readings: { t: number; v: number; limit: 'low' | 'high' | null }[]
  boluses: { t: number; kind: 'carb' | 'auto' | 'manual'; units: number; carbs: number }[]
  basal: { t: number; end: number; rate: number; suspend: boolean }[]
  alarms: { t: number; event: string; label: string }[]
  gaps: { from: number; to: number }[]
  summary: DaySummary
  notes: string[]
}

const ALARM_LABELS: Record<string, string> = {
  tandem_controliq_low: 'Control-IQ low alert',
  tandem_controliq_high: 'Control-IQ high alert',
  tandem_cgm_unavailable: 'CGM unavailable',
  'Cartridge Loaded': 'Cartridge loaded',
  'Empty Cartridge Alarm (8A)': 'Empty cartridge alarm',
  'Resume Pump Alarm (18A)': 'Resume pump alarm',
  'Low Power Alert (2T)': 'Low battery',
  'Low Power Alert (3T)': 'Low battery',
}

export function dayDetail(ds: Dataset, day: string): DayDetail {
  const dayStart = toMin(`${day} 00:00`)
  const t = (min: number) => (min - dayStart) / 60
  const rs = ds.readings.filter((r) => dayOf(r.ts) === day)
  const readings = rs.map((r) => ({ t: t(r.min), v: r.v, limit: r.limit }))

  const gaps: { from: number; to: number }[] = []
  let last = 0
  for (const r of readings) {
    if (r.t - last > 0.5) gaps.push({ from: last, to: r.t })
    last = r.t
  }
  const dayEnd = day === ds.lastDay ? t(toMin(ds.lastTs)) : 24
  if (dayEnd - last > 0.5) gaps.push({ from: last, to: dayEnd })

  const basal = ds.basal
    .filter((b) => b.min < dayStart + 1440 && b.min + b.durationMin > dayStart)
    .map((b) => ({
      t: Math.max(0, t(b.min)),
      end: Math.min(24, t(b.min + b.durationMin)),
      rate: b.rate,
      suspend: b.suspend,
    }))

  const alarms = ds.alarms
    .filter((a) => dayOf(a.ts) === day)
    .map((a) => ({ t: t(a.min), event: a.event, label: ALARM_LABELS[a.event] ?? a.event }))

  const notes: string[] = []
  for (const s of basal.filter((b) => b.suspend && b.end - b.t >= 0.5)) {
    notes.push(`Insulin was stopped for ${hm(s.end - s.t)} from ${clockOf(s.t)}.`)
  }
  const hi = rs.filter((r) => r.limit === 'high').length
  if (hi) notes.push(`${hi} readings were above 22.2, shown as HI on the sensor.`)
  if (!rs.length) notes.push('No sensor readings this day. This usually means a sensor change or a gap in the export.')
  for (const g of gaps.filter((g) => g.to - g.from >= 2 && rs.length)) {
    notes.push(`No sensor readings from ${clockOf(g.from)} to ${clockOf(g.to)}.`)
  }

  const prev = day > ds.firstDay ? addDays(day, -1) : null
  const next = day < ds.lastDay ? addDays(day, 1) : null

  return {
    day,
    label: shortDate(day),
    weekend: isWeekend(day),
    prev,
    next,
    readings,
    boluses: ds.boluses
      .filter((b) => dayOf(b.ts) === day)
      .map((b) => ({ t: t(b.min), kind: b.kind, units: b.units, carbs: b.carbs })),
    basal,
    alarms,
    gaps,
    summary: daySummaries(ds, day, day)[0],
    notes,
  }
}

function clockOf(hours: number) {
  const m = Math.round(hours * 60)
  if (m >= 1440) return '24:00'
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

// ---------------------------------------------------------------- system check

export interface SystemItem {
  id: string
  label: string
  value: string
  detail: string
  status: 'ok' | 'check' | 'unknown'
}

export function systemCheck(ds: Dataset, from: string, to: string): SystemItem[] {
  const p = periodSummary(ds, from, to)
  const days = daysBetween(from, to) + 1
  const bol = inDays(ds.boluses, from, to)
  const insulin = (k: string) => bol.filter((b) => b.kind === k).reduce((n, b) => n + b.units, 0)
  const total = insulin('carb') + insulin('auto') + insulin('manual')
  const autoShare = share(insulin('auto'), total)
  const carbPerDay = p.carbBoluses / days
  const stops = inDays(ds.basal, from, to).filter((b) => b.suspend && b.durationMin >= 30)
  const stopHours = stops.reduce((n, b) => n + b.durationMin, 0) / 60
  const empty = inDays(ds.alarms, from, to).filter((a) => a.event.startsWith('Empty Cartridge')).length

  return [
    {
      id: 'wear',
      label: 'Sensor wear',
      value: `${p.wear.toFixed(0)}%`,
      detail: `Clinics want 70% or more so the numbers count. ${p.daysWithData} of ${days} days had readings.`,
      status: p.wear >= TARGETS.wear ? 'ok' : 'check',
    },
    {
      id: 'carbs',
      label: 'Carbs entered',
      value: `${carbPerDay.toFixed(1)} a day`,
      detail: `${p.carbBoluses} boluses with carbs in ${days} days.`,
      status: carbPerDay >= 2 ? 'ok' : 'check',
    },
    {
      id: 'auto',
      label: 'Automatic corrections',
      value: `${autoShare.toFixed(0)}% of bolus insulin`,
      detail: 'Estimated, because the export does not mark automatic boluses.',
      status: autoShare < 50 ? 'ok' : 'check',
    },
    {
      id: 'stops',
      label: 'Pump stops of 30 min or more',
      value: `${stops.length}`,
      detail: stops.length
        ? `${hm(stopHours)} in total. ${empty} empty cartridge alarm${empty === 1 ? '' : 's'}.`
        : 'No long stops.',
      status: stops.length === 0 ? 'ok' : 'check',
    },
    {
      id: 'controliq',
      label: 'Control-IQ active time',
      value: 'Not in export',
      detail: 'The export does not say when Control-IQ, Sleep or Exercise was on.',
      status: 'unknown',
    },
  ]
}
