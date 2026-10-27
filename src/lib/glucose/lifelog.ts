// Life log helpers: days tagged as not normal, the days a weekly activity
// happened, and how glucose looked during and after an activity compared
// with the same hours on other days.

import { addDays, dayOf, timeOfDay, weekdayOf } from './core'
import type { Dataset, Reading } from './core'
import { median } from './core'

export const TAG_KINDS = [
  { id: 'sick', label: 'Sick' },
  { id: 'vacation', label: 'Vacation' },
  { id: 'period', label: 'Period' },
  { id: 'break', label: 'School break' },
  { id: 'other', label: 'Other' },
] as const

export type TagKind = (typeof TAG_KINDS)[number]['id']

export interface LogEntry {
  id: number
  kind: 'tag' | 'activity' | 'note'
  tag: TagKind | null
  text: string
  startDate: string
  endDate: string | null
  weekdays: number[] | null // 0 Monday to 6 Sunday
  startMin: number | null
  endMin: number | null
  atMin: number | null
  author: 'you' | 'parent'
}

/** Every day covered by a not-normal tag. */
export function notNormalDays(entries: LogEntry[]): Set<string> {
  const out = new Set<string>()
  for (const e of entries) {
    if (e.kind !== 'tag') continue
    const end = e.endDate ?? e.startDate
    for (let d = e.startDate; d <= end; d = addDays(d, 1)) out.add(d)
  }
  return out
}

/** Days in [from, to] when a weekly activity was on the schedule. */
export function activityDays(a: LogEntry, from: string, to: string): string[] {
  const days: string[] = []
  const start = a.startDate > from ? a.startDate : from
  const end = a.endDate && a.endDate < to ? a.endDate : to
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (a.weekdays?.includes(weekdayOf(d))) days.push(d)
  }
  return days
}

const share = (rs: Reading[], f: (v: number) => boolean) => (rs.length ? (rs.filter((r) => f(r.v)).length / rs.length) * 100 : 0)

export interface ActivityComparison {
  daysWith: number
  daysWithout: number
  rows: { label: string; withPct: number; withoutPct: number }[]
  night: { hour: number; withPct: number; withoutPct: number }[]
  medianWith: number | null
  medianWithout: number | null
  lowsMoreCommon: boolean
  question: string | null
}

const NIGHT_HOURS = [22, 23, 0, 1, 2, 3, 4, 5, 6]

function pad(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

/**
 * Lows (below 3.9) during the activity and the night after (22:00 to 07:00),
 * on activity days against all other days with data. Days tagged as not
 * normal can be left out.
 */
export function compareActivity(ds: Dataset, a: LogEntry, leaveOut: Set<string>): ActivityComparison {
  const start = a.startMin ?? 0
  const end = a.endMin ?? start + 60
  const dataDays = new Set(ds.readings.map((r) => dayOf(r.ts)))
  const withDays = new Set(activityDays(a, ds.firstDay, ds.lastDay).filter((d) => dataDays.has(d) && !leaveOut.has(d)))
  const withoutDays = new Set([...dataDays].filter((d) => !withDays.has(d) && !leaveOut.has(d)))

  // The night after day D runs from 22:00 on D to 07:00 on D+1.
  const nightOf = (r: Reading) => {
    const h = timeOfDay(r.ts)
    if (h >= 22) return dayOf(r.ts)
    if (h < 7) return addDays(dayOf(r.ts), -1)
    return null
  }
  const during = (days: Set<string>) =>
    ds.readings.filter((r) => {
      const m = timeOfDay(r.ts) * 60
      return days.has(dayOf(r.ts)) && m >= start && m < end
    })
  const night = (days: Set<string>) => ds.readings.filter((r) => {
    const d = nightOf(r)
    return d !== null && days.has(d)
  })

  const dWith = during(withDays)
  const dWithout = during(withoutDays)
  const nWith = night(withDays)
  const nWithout = night(withoutDays)
  const low = (v: number) => v < 3.9
  const rows = [
    { label: `During, ${pad(start)} to ${pad(end)}`, withPct: share(dWith, low), withoutPct: share(dWithout, low) },
    { label: 'Night after, 22:00 to 07:00', withPct: share(nWith, low), withoutPct: share(nWithout, low) },
  ]
  const byHour = (rs: Reading[], h: number) => rs.filter((r) => Math.floor(timeOfDay(r.ts)) === h)
  const lowsMoreCommon = rows.some((r) => r.withPct > r.withoutPct + 2)
  return {
    daysWith: withDays.size,
    daysWithout: withoutDays.size,
    rows,
    night: NIGHT_HOURS.map((h) => ({ hour: h, withPct: share(byHour(nWith, h), low), withoutPct: share(byHour(nWithout, h), low) })),
    medianWith: nWith.length ? median(nWith.map((r) => r.v)) : null,
    medianWithout: nWithout.length ? median(nWithout.map((r) => r.v)) : null,
    lowsMoreCommon,
    question: lowsMoreCommon
      ? `Lows look more common during ${a.text.toLowerCase()} and the night after. How should we plan for those days?`
      : null,
  }
}

/** Removes readings, boluses, basal and alarms on the given days. */
export function withoutDays(ds: Dataset, leaveOut: Set<string>): Dataset {
  if (!leaveOut.size) return ds
  const keep = <T extends { ts: string }>(rows: T[]) => rows.filter((r) => !leaveOut.has(dayOf(r.ts)))
  return { ...ds, readings: keep(ds.readings), boluses: keep(ds.boluses), basal: keep(ds.basal), alarms: keep(ds.alarms) }
}
