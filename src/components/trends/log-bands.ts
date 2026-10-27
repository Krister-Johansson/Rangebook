// Life log entries turned into shaded hour bands for the charts. Hours run
// 0 to 24 on the same scale as the typical day and the day chart.

import { TAG_KINDS } from '#/lib/glucose/lifelog'
import type { LogEntry } from '#/lib/glucose/lifelog'
import { weekdayOf } from '#/lib/glucose/core'
import { WEEKDAY_SHORT, clock } from '#/lib/glucose/format'

export interface LogBand {
  key: string
  from: number
  to: number
  label: string
  kind: 'act' | 'tag' | 'note'
}

const TAG_LABEL: Record<string, string> = Object.fromEntries(TAG_KINDS.map((t) => [t.id, t.label]))

export function tagLabel(e: LogEntry) {
  const kind = e.tag ? (TAG_LABEL[e.tag] ?? 'Not normal') : 'Not normal'
  return e.text ? `${kind}: ${e.text}` : kind
}

/** "Tue and Thu", "Mon, Wed and Fri" */
export function weekdayList(days: number[]) {
  const names = [...days].sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d])
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function minuteLabel(min: number) {
  return clock(min / 60)
}

const isActivity = (e: LogEntry) =>
  e.kind === 'activity' && e.weekdays?.length && e.startMin !== null && e.endMin !== null

/** Weekly activities that ran some time between `from` and `to` (either may be left open). */
export function weeklyActivities(entries: LogEntry[], from?: string, to?: string) {
  return entries.filter(
    (e) => isActivity(e) && (!from || !e.endDate || e.endDate >= from) && (!to || e.startDate <= to),
  )
}

/** Activity bands for the typical day, limited to the chosen kind of day. */
export function typicalActivityBands(
  entries: LogEntry[],
  dayType: 'all' | 'school' | 'weekend',
  from?: string,
  to?: string,
): LogBand[] {
  return weeklyActivities(entries, from, to)
    .filter((e) => {
      if (dayType === 'all') return true
      return e.weekdays!.some((d) => (dayType === 'weekend' ? d >= 5 : d < 5))
    })
    .map((e) => ({
      key: `act-${e.id}`,
      from: e.startMin! / 60,
      to: e.endMin! / 60,
      label: e.text,
      kind: 'act' as const,
    }))
}

/** Tags covering the day. */
export function tagsOn(entries: LogEntry[], day: string) {
  return entries.filter((e) => e.kind === 'tag' && e.startDate <= day && (e.endDate ?? e.startDate) >= day)
}

/** Weekly activities on the schedule that day. */
export function activitiesOn(entries: LogEntry[], day: string) {
  const wd = weekdayOf(day)
  return entries.filter(
    (e) => isActivity(e) && e.weekdays!.includes(wd) && e.startDate <= day && (!e.endDate || e.endDate >= day),
  )
}

/** Notes logged for the day, earliest first; notes without a time go last. */
export function notesOn(entries: LogEntry[], day: string) {
  return entries
    .filter((e) => e.kind === 'note' && e.startDate === day)
    .sort((a, b) => (a.atMin ?? 1e9) - (b.atMin ?? 1e9) || a.id - b.id)
}

/** Every band for the day chart: tags across the day, activities, notes. */
export function dayBands(entries: LogEntry[], day: string): LogBand[] {
  return [
    ...tagsOn(entries, day).map((e) => ({ key: `tag-${e.id}`, from: 0, to: 24, label: tagLabel(e), kind: 'tag' as const })),
    ...activitiesOn(entries, day).map((e) => ({
      key: `act-${e.id}`,
      from: e.startMin! / 60,
      to: e.endMin! / 60,
      label: e.text,
      kind: 'act' as const,
    })),
    ...notesOn(entries, day)
      .filter((e) => e.atMin !== null)
      .map((e) => ({ key: `note-${e.id}`, from: e.atMin! / 60, to: e.atMin! / 60, label: e.text, kind: 'note' as const })),
  ]
}

/** Hours touched by each weekly activity, keyed "weekday-hour", with the activity names. */
export function activityHourMarks(entries: LogEntry[], from?: string, to?: string) {
  const marks = new Map<string, string[]>()
  for (const e of weeklyActivities(entries, from, to)) {
    const first = Math.floor(e.startMin! / 60)
    const last = Math.ceil(e.endMin! / 60) - 1
    for (const d of e.weekdays!) {
      for (let h = first; h <= last && h < 24; h++) {
        const key = `${d}-${h}`
        marks.set(key, [...(marks.get(key) ?? []), e.text])
      }
    }
  }
  return marks
}

/** "Badminton, Tue and Thu, 17:00 to 19:00" */
export function activityLine(e: LogEntry) {
  return `${e.text}, ${weekdayList(e.weekdays ?? [])}, ${minuteLabel(e.startMin ?? 0)} to ${minuteLabel(e.endMin ?? 0)}`
}
