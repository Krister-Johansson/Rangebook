// Rule-based pattern finder. Every card states what happened, how often, and a
// question for the care team. Cards never suggest a setting value or a
// direction of change (see docs/research/llm-agents.md and clinical-rules.md).

import {
  TARGETS,
  addDays,
  dayOf,
  hourOf,
  inDays,
  isWeekend,
  lowEpisodes,
  median,
  sensorHighRuns,
  stats,
  timeOfDay,
} from './core'
import type { Band, Dataset } from './core'
import { hourlyProfile } from './analysis'
import { about, hm, shortDate } from './format'

export type PatternChart =
  | {
      type: 'hourBars'
      band: Band
      metric: string
      refLine?: { value: number; label: string }
      data: { hour: number; value: number; highlight: boolean }[]
    }
  | {
      type: 'pairedBars'
      band: Band
      metric: string
      aLabel: string
      bLabel: string
      data: { hour: number; a: number; b: number }[]
    }
  | {
      type: 'unitDots'
      band: Band
      total: number
      filled: number
      filledLabel: string
      emptyLabel: string
    }

export interface Pattern {
  id: string
  kind: 'low' | 'high' | 'routine'
  strength: 1 | 2 | 3
  title: string
  when: string
  evidence: string
  extra?: string
  strengthNote: string
  chart: PatternChart
  caption: string
  topics: string[]
  topicsNote?: string
  question: string
  exampleDay: string | null
}

export interface PatternsResult {
  from: string
  to: string
  days: number
  below39: number
  lowsOverTarget: boolean
  patterns: Pattern[]
}

const MEALS = [
  { id: 'breakfast', name: 'breakfast', after: 'breakfast', from: 5, to: 10 },
  { id: 'lunch', name: 'lunch', after: 'lunch', from: 10, to: 15 },
  { id: 'afternoon', name: 'afternoon snack', after: 'an afternoon snack', from: 15, to: 17 },
  { id: 'dinner', name: 'dinner', after: 'dinner', from: 17, to: 21 },
  { id: 'evening', name: 'evening snack', after: 'an evening snack', from: 21, to: 24 },
] as const

const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`
const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

function mealLows(ds: Dataset, from: string, to: string): Pattern[] {
  const readings = inDays(ds.readings, from, addDays(to, 1))
  const carb = inDays(ds.boluses, from, to).filter((b) => b.kind === 'carb')
  const recentFrom = addDays(to, -27)

  const followedByLow = (bMin: number) => {
    let startedLow = false
    for (const r of readings) {
      if (r.min < bMin - 10) continue
      if (r.min > bMin + 240) break
      if (r.min <= bMin) {
        startedLow = r.v < 3.9
        continue
      }
      if (!startedLow && r.v < 3.9) return r.min - bMin
    }
    return null
  }

  const out: Pattern[] = []
  for (const meal of MEALS) {
    const inMeal = carb.filter((b) => timeOfDay(b.ts) >= meal.from && timeOfDay(b.ts) < meal.to)
    const hits = inMeal
      .map((b) => ({ b, after: followedByLow(b.min) }))
      .filter((x): x is { b: (typeof inMeal)[number]; after: number } => x.after !== null)
    const rate = pctOf(hits.length, inMeal.length)
    if (inMeal.length < 6 || hits.length < 4 || rate < 30) continue

    const schoolHits = hits.filter((x) => !isWeekend(dayOf(x.b.ts))).length
    const mostlySchool = schoolHits / hits.length >= 0.75
    const medianAfter = median(hits.map((x) => x.after)) / 60
    // Hour each low started, so the chart and the "when" line use the same numbers.
    const startHours = hits.map((x) => Math.floor(timeOfDay(x.b.ts) + x.after / 60) % 24)
    const hours = Array.from({ length: 9 }, (_, i) => (meal.from + i) % 24)
    const startShare = (h: number) => pctOf(startHours.filter((x) => x === h).length, hits.length)
    const lowHour = hours.slice(0, -1).reduce((best, h, i) =>
      startShare(h) + startShare(hours[i + 1]) > startShare(best) + startShare((best + 1) % 24) ? h : best,
    )

    const recent = inMeal.filter((b) => dayOf(b.ts) >= recentFrom)
    const recentHits = hits.filter((x) => dayOf(x.b.ts) >= recentFrom).length
    const older = inMeal.length - recent.length
    const olderHits = hits.length - recentHits
    let extra: string | undefined
    if (recent.length >= 5 && older >= 5) {
      const diff = pctOf(recentHits, recent.length) - pctOf(olderHits, older)
      if (Math.abs(diff) >= 15) {
        extra = `In the last 4 weeks it happened after ${recentHits} of ${recent.length} ${meal.name} boluses (${pctOf(recentHits, recent.length)}%), compared with ${olderHits} of ${older} (${pctOf(olderHits, older)}%) before that.`
      }
    }

    const latestHit = hits.reduce((a, x) => (x.b.ts > a.b.ts ? x : a))
    const strength = inMeal.length >= 20 && rate >= 40 ? 3 : inMeal.length >= 10 ? 2 : 1

    out.push({
      id: `meal-low-${meal.id}`,
      kind: 'low',
      strength,
      title: `Lows often come about ${about(medianAfter)} after ${meal.after}`,
      when: `${mostlySchool ? 'School days' : 'Most days'}, ${hh(lowHour)} to ${hh(lowHour + 2)}`,
      evidence: `After ${hits.length} of ${inMeal.length} ${meal.name} boluses with carbs (${rate}%), readings went below 3.9 within 4 hours. The low came a median of ${hm(medianAfter)} after the bolus.`,
      extra,
      strengthNote: `${inMeal.length} ${meal.name} boluses in ${Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1} days.`,
      chart: {
        type: 'hourBars',
        band: 'low',
        metric: `of lows after ${meal.after}`,
        data: hours.map((h) => ({
          hour: h,
          value: startShare(h),
          highlight: h === lowHour || h === (lowHour + 1) % 24,
        })),
      },
      caption: `When the lows after ${meal.after} started, by hour.`,
      topics: [
        `${cap(meal.name)} carb ratio`,
        'Correction factor',
        `Activity after ${meal.name}`,
        'Carb estimates',
      ],
      topicsNote: 'The data cannot tell these apart. Your team can.',
      question: `Lows often show up about ${about(medianAfter)} after my ${meal.name} bolus${mostlySchool ? ', mostly on school days' : ''}. What could be causing that, and should we look at the ${meal.name} settings together?`,
      exampleDay: dayOf(latestHit.b.ts),
    })
  }
  return out.sort((a, b) => b.strength - a.strength).slice(0, 2)
}

function nightLows(ds: Dataset, from: string, to: string): Pattern | null {
  const readings = inDays(ds.readings, from, to)
  const night = readings.filter((r) => hourOf(r.ts) >= 22 || hourOf(r.ts) < 6)
  const s = stats(night)
  const events = lowEpisodes(readings).filter((e) => {
    const h = hourOf(e.startTs)
    return h >= 22 || h < 6
  })
  if (s.below39 <= TARGETS.below39 || events.length < 5) return null
  const profile = hourlyProfile(readings)
  const hours = [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6]
  const latest = events[events.length - 1]
  return {
    id: 'night-lows',
    kind: 'low',
    strength: events.length >= 12 ? 3 : 2,
    title: 'Lows at night',
    when: 'Between 22:00 and 06:00',
    evidence: `${events.length} lows started between 22:00 and 06:00. At night, ${s.below39.toFixed(1)}% of readings were below 3.9, over the 4% target.`,
    strengthNote: `${events.length} night lows over ${new Set(night.map((r) => dayOf(r.ts))).size} nights with readings.`,
    chart: {
      type: 'hourBars',
      band: 'low',
      metric: 'of readings below 3.9',
      refLine: { value: TARGETS.below39, label: '4% target' },
      data: hours.map((h) => ({ hour: h, value: profile[h].below39, highlight: profile[h].below39 > TARGETS.below39 * 1.5 })),
    },
    caption: 'Share of readings below 3.9, by hour, evening and night.',
    topics: ['Night basal', 'Evening snack and bolus', 'Activity earlier in the day', 'Sleep schedule in Control-IQ'],
    question: 'I get lows at night, mostly between 22:00 and 06:00. What could be behind that, and is there something in the evening or night settings we should look at?',
    exampleDay: dayOf(latest.startTs),
  }
}

function highsAfterPumpStops(ds: Dataset, from: string, to: string): Pattern | null {
  const runs = sensorHighRuns(inDays(ds.readings, from, to))
  if (runs.length < 3) return null
  const stops = inDays(ds.basal, addDays(from, -1), to).filter((b) => b.suspend && b.durationMin >= 30)
  const cartridge = inDays(ds.alarms, addDays(from, -1), to).filter(
    (a) => a.event.startsWith('Empty Cartridge') || a.event === 'Cartridge Loaded',
  )
  const triggers = [...stops.map((s) => s.min), ...cartridge.map((a) => a.min)]
  const linked = runs.filter((r) => triggers.some((m) => r.startMin >= m && r.startMin - m <= 8 * 60))
  if (linked.length < 3 || linked.length / runs.length < 0.4) return null

  const nightStops = stops.filter((s) => hourOf(s.ts) >= 22 || hourOf(s.ts) < 7)
  const longest = nightStops.reduce<(typeof stops)[number] | null>(
    (a, s) => (!a || s.ts > a.ts ? s : a),
    null,
  )
  const latest = linked[linked.length - 1]
  return {
    id: 'pump-stop-highs',
    kind: 'high',
    strength: linked.length >= 6 ? 3 : 2,
    title: 'Very high readings after the pump stopped',
    when: nightStops.length ? 'Mostly at night, around cartridge changes' : 'Around pump stops and cartridge changes',
    evidence: `${linked.length} of the ${runs.length} runs of readings above 22.2 started within 8 hours after a pump stop or cartridge change.${nightStops.length ? ` ${nightStops.length} stops of 30 minutes or more started at night.` : ''}${longest ? ` The latest night stop was ${shortDate(dayOf(longest.ts))}, ${hm(longest.durationMin / 60)}.` : ''}`,
    strengthNote: `Pump events and readings line up in time on ${linked.length} of ${runs.length} runs.`,
    chart: {
      type: 'unitDots',
      band: 'vhigh',
      total: runs.length,
      filled: linked.length,
      filledLabel: `${linked.length} started after a pump stop`,
      emptyLabel: `${runs.length - linked.length} other runs`,
    },
    caption: 'Runs of readings above 22.2.',
    topics: ['Cartridge changes at night', 'Empty cartridge alarms', 'Ketone checks'],
    question: 'Some of my highest readings came after the pump stopped, often at night around a cartridge change. How should we handle cartridge changes and alarms at night, and when should I check ketones?',
    exampleDay: dayOf(latest.startTs),
  }
}

function aboveRangeWindow(ds: Dataset, from: string, to: string): Pattern | null {
  const readings = inDays(ds.readings, from, to)
  const profile = hourlyProfile(readings)
  let best: { start: number; len: number; avg: number } | null = null
  for (let start = 0; start < 24; start++) {
    for (const len of [2, 3]) {
      const hrs = Array.from({ length: len }, (_, i) => profile[(start + i) % 24])
      if (hrs.some((h) => h.above10 < 55 || h.n < 100)) continue
      const avg = hrs.reduce((n, h) => n + h.above10, 0) / len
      if (!best || avg > best.avg + 2) best = { start, len, avg }
    }
  }
  if (!best) return null
  const hrs = Array.from({ length: best.len }, (_, i) => profile[(best.start + i) % 24])
  const a10 = hrs.map((h) => h.above10)
  const a139 = hrs.map((h) => h.above139)
  const n = hrs.reduce((s, h) => s + h.n, 0)
  const end = (best.start + best.len) % 24
  const range = (v: number[]) => `${Math.round(Math.min(...v))} to ${Math.round(Math.max(...v))}%`
  const afternoon = best.start >= 14 && best.start < 20
  const morning = best.start >= 5 && best.start < 11
  const chartHours = Array.from({ length: 8 }, (_, i) => (best.start - 3 + i + 24) % 24)

  const dayMeans = new Map<string, number[]>()
  for (const r of readings) {
    const h = hourOf(r.ts)
    if ((h - best.start + 24) % 24 < best.len) {
      const d = dayOf(r.ts)
      dayMeans.set(d, [...(dayMeans.get(d) ?? []), r.v])
    }
  }
  const recentDays = [...dayMeans.entries()].filter(([d]) => d >= addDays(to, -13))
  const example = recentDays.reduce<[string, number] | null>((a, [d, vs]) => {
    const m = vs.reduce((x, y) => x + y, 0) / vs.length
    return !a || m > a[1] ? [d, m] : a
  }, null)

  return {
    id: `above-range-${best.start}`,
    kind: 'high',
    strength: n >= 500 ? 3 : 2,
    title: `Above range most days from ${hh(best.start)} to ${hh(end)}`,
    when: afternoon ? 'Every day, late afternoon' : morning ? 'Every day, morning' : `Every day, ${hh(best.start)} to ${hh(end)}`,
    evidence: `Between ${hh(best.start)} and ${hh(end)}, ${range(a10)} of readings were above 10.0, and ${range(a139)} were above 13.9. That is ${n.toLocaleString('en-US')} readings.`,
    strengthNote: 'Large sample, same window across the whole period.',
    chart: {
      type: 'hourBars',
      band: 'high',
      metric: 'of readings above 10.0',
      data: chartHours.map((h) => ({
        hour: h,
        value: profile[h].above10,
        highlight: (h - best.start + 24) % 24 < best.len,
      })),
    },
    caption: 'Share of readings above 10.0, by hour.',
    topics: afternoon
      ? ['Afternoon snacks', 'Carb ratio after school', `Basal ${hh(best.start - 1)} to ${hh(end + 1)}`]
      : morning
        ? ['Breakfast bolus timing', 'Breakfast carb ratio', 'Morning basal']
        : ['Meal and snack boluses', `Basal ${hh(best.start)} to ${hh(end)}`],
    question: `My readings are above range most days between ${hh(best.start)} and ${hh(end)}. What could be behind that, and should we look at it after the lows?`,
    exampleDay: example?.[0] ?? null,
  }
}

function weekendNights(ds: Dataset, from: string, to: string): Pattern | null {
  const readings = inDays(ds.readings, from, to).filter((r) => hourOf(r.ts) >= 1 && hourOf(r.ts) < 7)
  const we = readings.filter((r) => isWeekend(dayOf(r.ts)))
  const wd = readings.filter((r) => !isWeekend(dayOf(r.ts)))
  if (we.length < 200 || wd.length < 200) return null
  const sWe = stats(we)
  const sWd = stats(wd)
  if (sWe.pct.vhigh - sWd.pct.vhigh < 10) return null

  const all = inDays(ds.readings, from, to)
  const weP = hourlyProfile(all, 'weekend')
  const wdP = hourlyProfile(all, 'school')
  const weDays = new Set(we.map((r) => dayOf(r.ts))).size
  const stops = inDays(ds.basal, addDays(from, -1), to).filter((b) => b.suspend && b.durationMin >= 30)
  const highWe = we.filter((r) => r.v > 13.9)
  const afterStop = highWe.filter((r) => stops.some((s) => r.min >= s.min && r.min - s.min <= 8 * 60)).length

  return {
    id: 'weekend-nights',
    kind: 'high',
    strength: weDays >= 30 ? 3 : 2,
    title: 'Weekend nights run higher',
    when: 'Friday and Saturday nights, 01:00 to 07:00',
    evidence: `On weekend nights, ${sWe.pct.vhigh.toFixed(0)}% of readings from 01:00 to 07:00 were above 13.9. On school nights it was ${sWd.pct.vhigh.toFixed(0)}%.${afterStop ? ` ${afterStop} of those ${highWe.length} high weekend readings came within 8 hours after a pump stop.` : ''}`,
    strengthNote:
      weDays >= 30
        ? `${weDays} weekend nights with sensor data.`
        : `Only ${weDays} weekend nights had sensor data, so one or two nights change this a lot.`,
    chart: {
      type: 'pairedBars',
      band: 'vhigh',
      metric: 'of readings above 13.9',
      aLabel: 'School nights',
      bLabel: 'Weekend nights',
      data: [0, 1, 2, 3, 4, 5, 6, 7].map((h) => ({ hour: h, a: wdP[h].above139, b: weP[h].above139 })),
    },
    caption: 'Share of readings above 13.9 from 00:00 to 08:00.',
    topics: ['Weekend evening routine', 'Sleep schedule in Control-IQ', 'Late snacks'],
    question: 'Weekend nights run higher than school nights. Is there something about weekend evenings or the Sleep schedule we should check?',
    exampleDay: null,
  }
}

function fewMealBoluses(ds: Dataset, from: string, to: string): Pattern | null {
  const bol = inDays(ds.boluses, from, to)
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1
  const carb = bol.filter((b) => b.kind === 'carb')
  const units = (k: string) => bol.filter((b) => b.kind === k).reduce((n, b) => n + b.units, 0)
  const total = units('carb') + units('auto') + units('manual')
  const autoShare = pctOf(units('auto'), total)
  const carbShare = pctOf(units('carb'), total)
  const perDay = carb.length / days
  if (perDay >= 2 && carbShare >= 50) return null

  const carbDays = new Set(carb.map((b) => dayOf(b.ts)))
  const noCarbDays = days - carbDays.size
  return {
    id: 'few-meal-boluses',
    kind: 'routine',
    strength: days >= 28 ? 3 : 2,
    title: 'Most bolus insulin comes from automatic corrections',
    when: `Last ${days} days`,
    evidence: `Carbs were entered ${perDay.toFixed(1)} times a day on average, and on ${noCarbDays} days not at all. Automatic corrections gave about ${autoShare}% of bolus insulin, and boluses with carbs ${carbShare}%.`,
    extra: 'Automatic boluses are estimated, because the export does not mark them.',
    strengthNote: `${carb.length} boluses with carbs in ${days} days.`,
    chart: {
      type: 'unitDots',
      band: 'in',
      total: days,
      filled: carbDays.size,
      filledLabel: `${carbDays.size} days with carbs entered`,
      emptyLabel: `${noCarbDays} days without`,
    },
    caption: 'Days with at least one bolus with carbs.',
    topics: ['Meal boluses', 'Bolus timing', 'Carb counting'],
    question: `Most of my bolus insulin comes from automatic corrections, and I enter carbs about ${perDay.toFixed(1)} times a day. Is that OK with Control-IQ, or should we work on meal boluses together?`,
    exampleDay: null,
  }
}

export function findPatterns(ds: Dataset, days = 90): PatternsResult {
  const to = ds.lastDay
  const from = addDays(to, -(days - 1)) < ds.firstDay ? ds.firstDay : addDays(to, -(days - 1))
  const s = stats(inDays(ds.readings, from, to))

  const found = [
    ...mealLows(ds, from, to),
    nightLows(ds, from, to),
    highsAfterPumpStops(ds, from, to),
    aboveRangeWindow(ds, from, to),
    weekendNights(ds, from, to),
    fewMealBoluses(ds, from, to),
  ].filter((p): p is Pattern => p !== null)

  const order = { low: 0, high: 1, routine: 2 }
  found.sort((a, b) => order[a.kind] - order[b.kind] || b.strength - a.strength)

  return {
    from,
    to,
    days: Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1,
    below39: s.below39,
    lowsOverTarget: s.below39 > TARGETS.below39,
    patterns: found,
  }
}
