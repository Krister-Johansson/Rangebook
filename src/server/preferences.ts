import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db'
import { preferences, savedQuestions } from '#/db/schema'
import { activePersonId, requirePersonId } from './active-person'

export const SHARE_KEYS = ['home', 'typical', 'map', 'patterns', 'days'] as const

export const prefsSchema = z.object({
  goalId: z.string().default('lunch'),
  sharing: z
    .record(z.enum(SHARE_KEYS), z.boolean())
    .default({ home: true, typical: true, map: true, patterns: false, days: false }),
})

export type Prefs = z.infer<typeof prefsSchema>

export const getPrefs = createServerFn({ method: 'GET' }).handler(async () => {
  const personId = await activePersonId()
  const rows = personId === null ? [] : await db.select().from(preferences).where(eq(preferences.personId, personId))
  return prefsSchema.parse(Object.fromEntries(rows.map((r) => [r.key, r.value])))
})

export const setPref = createServerFn({ method: 'POST' })
  .validator(prefsSchema.partial())
  .handler(async ({ data }) => {
    const personId = await requirePersonId()
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue
      await db
        .insert(preferences)
        .values({ personId, key, value })
        .onConflictDoUpdate({
          target: [preferences.personId, preferences.key],
          set: { value, updatedAt: new Date() },
        })
    }
    return { ok: true }
  })

export const listSavedQuestions = createServerFn({ method: 'GET' }).handler(async () => {
  const personId = await activePersonId()
  if (personId === null) return []
  return db
    .select({ patternId: savedQuestions.patternId, question: savedQuestions.question, createdAt: savedQuestions.createdAt })
    .from(savedQuestions)
    .where(eq(savedQuestions.personId, personId))
    .orderBy(asc(savedQuestions.createdAt))
})

export const saveQuestion = createServerFn({ method: 'POST' })
  .validator(z.object({ patternId: z.string(), question: z.string() }))
  .handler(async ({ data }) => {
    await db
      .insert(savedQuestions)
      .values({ ...data, personId: await requirePersonId() })
      .onConflictDoNothing()
    return { ok: true }
  })

export const removeQuestion = createServerFn({ method: 'POST' })
  .validator(z.object({ patternId: z.string() }))
  .handler(async ({ data }) => {
    const personId = await requirePersonId()
    await db
      .delete(savedQuestions)
      .where(and(eq(savedQuestions.personId, personId), eq(savedQuestions.patternId, data.patternId)))
    return { ok: true }
  })
