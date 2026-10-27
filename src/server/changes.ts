import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db'
import { settingsNotes } from '#/db/schema'
import { compareAround, findSettingsChanges } from '#/lib/glucose/changes'
import type { SettingsChange } from '#/lib/glucose/changes'
import { daysBetween } from '#/lib/glucose/core'
import { shortDate } from '#/lib/glucose/format'
import { activePersonId } from './active-person'
import { loadDataset } from './dataset'
import { leaveOutDays } from './not-normal'

export interface TimelineItem {
  id: string
  day: string
  time: string | null
  label: string
  source: 'export' | 'logged'
  rows: SettingsChange['rows']
  note: { id: number; text: string; author: 'you' | 'parent' } | null
  // Days until the next change found in the export, when that is under a week.
  lastedDays: number | null
  canCompare: boolean
}

/** Settings changes found in the export plus hand-logged notes, newest first. */
export const getSettingsTimeline = createServerFn({ method: 'GET' }).handler(async (): Promise<TimelineItem[]> => {
  const personId = await activePersonId()
  if (personId === null) return []
  const [ds, notes] = await Promise.all([
    loadDataset(personId),
    db.select().from(settingsNotes).where(eq(settingsNotes.personId, personId)).orderBy(asc(settingsNotes.day)),
  ])
  const found = ds ? findSettingsChanges(ds) : []
  const items: TimelineItem[] = found.map((c, i) => {
    const newer = found[i - 1]
    const lasted = newer ? daysBetween(c.day, newer.day) : null
    return {
      id: c.id,
      day: c.day,
      time: c.ts.slice(11, 16),
      label: shortDate(c.day),
      source: 'export',
      rows: c.rows,
      note: null,
      lastedDays: lasted !== null && lasted < 7 ? lasted : null,
      canCompare: lasted === null || lasted >= 7,
    }
  })
  for (const n of notes) {
    const match = items.find((it) => it.source === 'export' && it.day === n.day && !it.note)
    const note = { id: n.id, text: n.note, author: n.author }
    if (match) match.note = note
    else
      items.push({
        id: `n-${n.id}`,
        day: n.day,
        time: n.atMin === null ? null : `${String(Math.floor(n.atMin / 60)).padStart(2, '0')}:${String(n.atMin % 60).padStart(2, '0')}`,
        label: shortDate(n.day),
        source: 'logged',
        rows: [],
        note,
        lastedDays: null,
        canCompare: false,
      })
  }
  return items.sort((a, b) => b.day.localeCompare(a.day))
})

/** Before and after one change found in the export. */
export const getChangeComparison = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string(), days: z.union([z.literal(7), z.literal(14), z.literal(21)]).default(14) }))
  .handler(async ({ data }) => {
    const personId = await activePersonId()
    if (personId === null) return null
    const ds = await loadDataset(personId)
    if (!ds) return null
    const found = findSettingsChanges(ds)
    const change = found.find((c) => c.id === data.id)
    if (!change) return null
    const leaveOut = await leaveOutDays(personId)
    return {
      change,
      leftOutNotNormal: leaveOut.size > 0,
      comparison: compareAround(ds, change, data.days, leaveOut, found),
    }
  })
