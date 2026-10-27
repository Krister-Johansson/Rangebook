// Pump settings changes found in the export, and before/after comparisons.
//
// The export has no settings file (docs/export-format.md). Two traces of the
// programmed profile remain: basal segments of 30 minutes or more run at the
// profile rate (Control-IQ adjusts in 5-minute segments), and the Carbs Ratio
// column on boluses entered without a glucose value. A change is reported
// when the new value shows up again later, so one odd segment is not enough.
// Values are shown as a record of what was set, never as advice.

import { addDays, dayOf, hourOf, inDays, lowEpisodes, stats } from './core'
import type { Band, Dataset, Reading } from './core'
import { hourlyProfile } from './analysis'
import { rangeLabel, shortDate } from './format'

export interface SettingsChange {
  id: string
  ts: string
  day: string
  rows: { setting: 'Basal' | 'Carb ratio'; before: string; after: string }[]
}

const isProfileRate = (rate: number) => rate > 0 && Math.abs(rate * 100 - Math.round(rate * 100)) < 1e-6

function describeBasal(byHour: (number | undefined)[]) {
  const vals = byHour.filter((v): v is number => v !== undefined)
  if (!vals.length) return 'Unknown'
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  return lo === hi ? `${lo} U/h all day` : `${lo} to ${hi} U/h by time block`
}

type RatioBlocks = { night?: number; morning?: number; day?: number }
const ratioBlock = (ts: string): keyof RatioBlocks => {
  const h = hourOf(ts)
  return h < 5 ? 'night' : h < 10 ? 'morning' : 'day'
}

function describeRatio(r: RatioBlocks) {
  const main = r.day ?? r.morning ?? r.night
  if (main === undefined) return 'Unknown'
  const parts = [main.toFixed(1)]
  if (r.morning !== undefined && r.morning !== main) parts.push(`morning ${r.morning.toFixed(1)}`)
  if (r.night !== undefined && r.night !== main) parts.push(`night ${r.night.toFixed(1)}`)
  return parts.join(', ')
}

// Basal: the hourly profile is rebuilt from long segments. A change point is
// a long segment whose rate differs from the profile at that hour and is
// confirmed by the next long segment in the same hour.
function basalChangePoints(ds: Dataset) {
  const long = ds.basal.filter((b) => !b.suspend && b.durationMin >= 30 && isProfileRate(b.rate))
  const profile: (number | undefined)[] = Array(24).fill(undefined)
  const points: { ts: string; before: string }[] = []
  for (let i = 0; i < long.length; i++) {
    const seg = long[i]
    const h = hourOf(seg.ts)
    const was = profile[h]
    if (was !== undefined && was !== seg.rate) {
      const again = long.slice(i + 1).find((x) => hourOf(x.ts) === h)
      if (again && again.rate !== seg.rate) continue
      points.push({ ts: seg.ts, before: describeBasal(profile) })
      // Other hours are unknown until segments of the new profile show them.
      profile.fill(undefined)
    }
    const hours = Math.max(1, Math.round(seg.durationMin / 60))
    for (let k = 0; k < hours; k++) profile[(h + k) % 24] = seg.rate
  }
  // Describe each new profile from the long segments in the two days after it.
  return points.map((p, i) => {
    const until = points[i + 1]?.ts ?? '9999'
    const end = new Date(Date.parse(p.ts.replace(' ', 'T')) + 48 * 3600_000).toISOString().slice(0, 16).replace('T', ' ')
    const after: (number | undefined)[] = Array(24).fill(undefined)
    for (const seg of long) {
      if (seg.ts < p.ts || seg.ts >= until || seg.ts > end) continue
      const hours = Math.max(1, Math.round(seg.durationMin / 60))
      for (let k = 0; k < hours; k++) after[(hourOf(seg.ts) + k) % 24] ??= seg.rate
    }
    return { ts: p.ts, before: p.before, after: describeBasal(after) }
  })
}

// Carb ratio: three blocks of the day. A block's first value after a change
// belongs to that change when the block was not seen in between, because
// the export only shows a ratio when a bolus used it.
function ratioObservations(ds: Dataset) {
  return ds.boluses
    .filter((b) => b.ratio !== null && b.ratio > 0)
    .map((b) => ({ ts: b.ts, block: ratioBlock(b.ts), ratio: b.ratio! }))
}

const hoursBetween = (a: string, b: string) => (Date.parse(b.replace(' ', 'T')) - Date.parse(a.replace(' ', 'T'))) / 3600_000

/** Settings changes found in the data, newest first. */
export function findSettingsChanges(ds: Dataset): SettingsChange[] {
  const basal = basalChangePoints(ds)
  const obs = ratioObservations(ds)
  const changes: (SettingsChange & { ratioBefore?: RatioBlocks; ratioAfter?: RatioBlocks })[] = basal.map((b) => ({
    id: '',
    ts: b.ts.slice(0, 16),
    day: dayOf(b.ts),
    rows: b.before !== b.after ? [{ setting: 'Basal', before: b.before, after: b.after }] : [],
  }))
  changes.sort((a, b) => a.ts.localeCompare(b.ts))

  const current: RatioBlocks = {}
  const lastSeen: Partial<Record<keyof RatioBlocks, string>> = {}
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i]
    const was = current[o.block]
    if (was !== undefined && was !== o.ratio) {
      const again = obs.slice(i + 1).find((x) => x.block === o.block)
      if (!again || again.ratio === o.ratio) {
        const before = { ...current }
        current[o.block] = o.ratio
        // Attach to the latest change if this block was not seen since it.
        const host = [...changes].reverse().find((c) => c.ts <= o.ts)
        const unseenSince = host && (!lastSeen[o.block] || lastSeen[o.block]! < host.ts)
        if (host && ((unseenSince && hoursBetween(host.ts, o.ts) <= 14 * 24) || hoursBetween(host.ts, o.ts) <= 36)) {
          host.ratioBefore ??= before
          host.ratioAfter = { ...current }
        } else {
          changes.push({ id: '', ts: o.ts.slice(0, 16), day: dayOf(o.ts), rows: [], ratioBefore: before, ratioAfter: { ...current } })
          changes.sort((a, b) => a.ts.localeCompare(b.ts))
        }
      }
    } else {
      current[o.block] = o.ratio
    }
    lastSeen[o.block] = o.ts
  }

  for (const c of changes) {
    if (c.ratioBefore && c.ratioAfter) {
      const before = describeRatio(c.ratioBefore)
      const after = describeRatio(c.ratioAfter)
      if (before !== after) c.rows.push({ setting: 'Carb ratio', before, after })
    }
    c.id = `c-${c.ts.replace(/[ :]/g, '-')}`
  }
  return changes
    .filter((c) => c.rows.length > 0)
    .map(({ id, ts, day, rows }) => ({ id, ts, day, rows }))
    .reverse()
}

export interface CompareSide {
  from: string
  to: string
  label: string
  days: number
  daysLeftOut: number
  pct: Record<Band, number>
  below39: number
  wear: number
  mean: number
  lowsPerWeek: number
  carbBolusesPerDay: number
  profile: { hour: number; p25: number; p50: number; p75: number }[]
}

export interface Comparison {
  days: number
  before: CompareSide
  after: CompareSide
  warnings: string[]
  otherChanges: string | null
  lowsUp: boolean
  question: string
}

function side(ds: Dataset, from: string, to: string, leaveOut: Set<string>): CompareSide {
  const keep = <T extends { ts: string }>(rows: T[]) => inDays(rows, from, to).filter((r) => !leaveOut.has(dayOf(r.ts)))
  const readings: Reading[] = keep(ds.readings)
  const s = stats(readings)
  const allDays: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) allDays.push(d)
  const counted = allDays.filter((d) => !leaveOut.has(d))
  const days = Math.max(1, counted.length)
  return {
    from,
    to,
    label: rangeLabel(from, to),
    days: counted.length,
    daysLeftOut: allDays.length - counted.length,
    pct: s.pct,
    below39: s.below39,
    wear: (readings.length / (days * 288)) * 100,
    mean: s.mean,
    lowsPerWeek: (lowEpisodes(readings).length / days) * 7,
    carbBolusesPerDay: keep(ds.boluses).filter((b) => b.kind === 'carb').length / days,
    profile: hourlyProfile(readings).map((h) => ({ hour: h.hour, p25: h.p25, p50: h.p50, p75: h.p75 })),
  }
}

/** Same number of days before and after a change. The change day starts the after side. */
export function compareAround(
  ds: Dataset,
  change: { day: string },
  days: number,
  leaveOut: Set<string>,
  others: { day: string }[],
): Comparison {
  const beforeFrom = addDays(change.day, -days)
  const afterTo = addDays(change.day, days - 1)
  const before = side(ds, beforeFrom < ds.firstDay ? ds.firstDay : beforeFrom, addDays(change.day, -1), leaveOut)
  const after = side(ds, change.day, afterTo > ds.lastDay ? ds.lastDay : afterTo, leaveOut)

  const warnings: string[] = []
  for (const [name, s] of [['before', before], ['after', after]] as const) {
    // Fewer days than picked because the data starts or ends there. Days left
    // out as not normal get their own warning below.
    const covered = s.days + s.daysLeftOut
    if (covered < days) {
      const short = `Only ${covered} day${covered === 1 ? '' : 's'} ${name} the change, not the ${days} you picked.`
      warnings.push(covered < 14 ? `${short} Clinics usually look at 14 days or more.` : short)
    }
    if (s.wear < 70) warnings.push(`Sensor wear ${name} the change was ${Math.round(s.wear)}%, under the 70% that makes the numbers count.`)
    if (s.daysLeftOut) warnings.push(`${s.daysLeftOut} not-normal day${s.daysLeftOut === 1 ? ' was' : 's were'} left out ${name} the change.`)
  }
  for (const o of others) {
    if (o.day !== change.day && o.day >= before.from && o.day <= after.to) {
      warnings.push(`Another change on ${shortDate(o.day)} falls inside these days, so they mix two settings.`)
    }
  }

  let otherChanges: string | null = null
  const a = before.carbBolusesPerDay
  const b = after.carbBolusesPerDay
  if ((a > 0 || b > 0) && (Math.max(a, b) >= Math.min(a, b) * 1.5 || Math.abs(a - b) >= 1)) {
    otherChanges = `Boluses with carbs went from about ${a.toFixed(1)} to ${b.toFixed(1)} a day. More than the settings changed, so this change cannot be judged on its own.`
  }

  const lowsUp = after.below39 > before.below39 + 0.5
  const question = lowsUp
    ? `In the ${days} days after the ${shortDate(change.day)} change, time below 3.9 went from ${before.below39.toFixed(1)}% to ${after.below39.toFixed(1)}%. What should we look at first?`
    : `What do you see in the ${days} days before and after the ${shortDate(change.day)} change, and is there anything we should adjust together?`

  return { days, before, after, warnings, otherChanges, lowsUp, question }
}
