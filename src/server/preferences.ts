import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db'
import { preferences, savedQuestions } from '#/db/schema'

export const SHARE_KEYS = ['home', 'typical', 'map', 'patterns', 'days'] as const

export const prefsSchema = z.object({
  goalId: z.string().default('lunch'),
  sharing: z
    .record(z.enum(SHARE_KEYS), z.boolean())
    .default({ home: true, typical: true, map: true, patterns: false, days: false }),
})

export type Prefs = z.infer<typeof prefsSchema>

export const getPrefs = createServerFn({ method: 'GET' }).handler(async () => {
  const rows = await db.select().from(preferences)
  return prefsSchema.parse(Object.fromEntries(rows.map((r) => [r.key, r.value])))
})

export const setPref = createServerFn({ method: 'POST' })
  .validator(prefsSchema.partial())
  .handler(async ({ data }) => {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue
      await db
        .insert(preferences)
        .values({ key, value })
        .onConflictDoUpdate({ target: preferences.key, set: { value, updatedAt: new Date() } })
    }
    return { ok: true }
  })

export const listSavedQuestions = createServerFn({ method: 'GET' }).handler(() =>
  db.select().from(savedQuestions).orderBy(asc(savedQuestions.createdAt)),
)

export const saveQuestion = createServerFn({ method: 'POST' })
  .validator(z.object({ patternId: z.string(), question: z.string() }))
  .handler(async ({ data }) => {
    await db.insert(savedQuestions).values(data).onConflictDoNothing()
    return { ok: true }
  })

export const removeQuestion = createServerFn({ method: 'POST' })
  .validator(z.object({ patternId: z.string() }))
  .handler(async ({ data }) => {
    await db.delete(savedQuestions).where(eq(savedQuestions.patternId, data.patternId))
    return { ok: true }
  })
