import { createServerFn } from '@tanstack/react-start'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db'
import { lifeLog, settingsNotes } from '#/db/schema'
import { TAG_KINDS, compareActivity, notNormalDays } from '#/lib/glucose/lifelog'
import type { LogEntry } from '#/lib/glucose/lifelog'
import { activePersonId, requirePersonId } from './active-person'
import { loadDataset } from './dataset'

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const minuteOfDay = z.number().int().min(0).max(1440)
const author = z.enum(['you', 'parent'])

export const listLifeLog = createServerFn({ method: 'GET' }).handler(async (): Promise<LogEntry[]> => {
  const personId = await activePersonId()
  if (personId === null) return []
  const rows = await db
    .select()
    .from(lifeLog)
    .where(eq(lifeLog.personId, personId))
    .orderBy(desc(lifeLog.startDate), desc(lifeLog.id))
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    tag: (r.tag as LogEntry['tag']) ?? null,
    text: r.text,
    startDate: r.startDate,
    endDate: r.endDate,
    weekdays: r.weekdays,
    startMin: r.startMin,
    endMin: r.endMin,
    atMin: r.atMin,
    author: r.author,
  }))
})

const newEntry = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('tag'),
    tag: z.enum(TAG_KINDS.map((t) => t.id) as [string, ...string[]]),
    text: z.string().max(200).default(''),
    startDate: day,
    endDate: day,
    author,
  }),
  z.object({
    kind: z.literal('activity'),
    text: z.string().trim().min(1).max(60),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1),
    startMin: minuteOfDay,
    endMin: minuteOfDay,
    startDate: day,
    endDate: day.nullable().default(null),
    author,
  }),
  z.object({
    kind: z.literal('note'),
    text: z.string().trim().min(1).max(500),
    startDate: day,
    atMin: minuteOfDay.nullable().default(null),
    author,
  }),
])

export const addLifeLogEntry = createServerFn({ method: 'POST' })
  .validator(newEntry)
  .handler(async ({ data }) => {
    const personId = await requirePersonId()
    if (data.kind === 'tag' && data.endDate < data.startDate) throw new Error('The last day is before the first day.')
    if (data.kind === 'activity' && data.endMin <= data.startMin) throw new Error('The end time is before the start time.')
    const [row] = await db
      .insert(lifeLog)
      .values({ personId, ...data, weekdays: data.kind === 'activity' ? [...new Set(data.weekdays)].sort() : null })
      .returning({ id: lifeLog.id })
    return row
  })

export const deleteLifeLogEntry = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const personId = await requirePersonId()
    await db.delete(lifeLog).where(and(eq(lifeLog.personId, personId), eq(lifeLog.id, data.id)))
    return { ok: true }
  })

/** An activity compared with the same hours on days without it. */
export const getActivityComparison = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.number().int(), leaveOutNotNormal: z.boolean().default(false) }))
  .handler(async ({ data }) => {
    const personId = await activePersonId()
    if (personId === null) return null
    const [ds, rows] = await Promise.all([
      loadDataset(personId),
      db.select().from(lifeLog).where(eq(lifeLog.personId, personId)).orderBy(asc(lifeLog.id)),
    ])
    const entries = rows.map((r) => ({ ...r, tag: r.tag as LogEntry['tag'] })) as LogEntry[]
    const activity = entries.find((e) => e.id === data.id && e.kind === 'activity')
    if (!ds || !activity) return null
    const leaveOut = data.leaveOutNotNormal ? notNormalDays(entries) : new Set<string>()
    return { activity, comparison: compareActivity(ds, activity, leaveOut) }
  })

export const addSettingsNote = createServerFn({ method: 'POST' })
  .validator(z.object({ day, atMin: minuteOfDay.nullable().default(null), note: z.string().trim().min(1).max(500), author }))
  .handler(async ({ data }) => {
    const personId = await requirePersonId()
    const [row] = await db.insert(settingsNotes).values({ personId, ...data }).returning({ id: settingsNotes.id })
    return row
  })

export const deleteSettingsNote = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const personId = await requirePersonId()
    await db.delete(settingsNotes).where(and(eq(settingsNotes.personId, personId), eq(settingsNotes.id, data.id)))
    return { ok: true }
  })
