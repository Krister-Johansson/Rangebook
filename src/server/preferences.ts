import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db'
import { preferences, savedQuestions } from '#/db/schema'
import { DOSE_VALUE_MESSAGE, hasDoseValue } from '#/lib/dose-guard'
import { activePersonId, requirePersonId } from './active-person'

export const SHARE_KEYS = ['home', 'typical', 'map', 'patterns', 'days', 'progress'] as const

export const prefsSchema = z.object({
  goalId: z.string().default('lunch'),
  // Each key has its own default, so sharing saved before a key existed still parses.
  sharing: z
    .object({
      home: z.boolean().default(true),
      typical: z.boolean().default(true),
      map: z.boolean().default(true),
      patterns: z.boolean().default(false),
      days: z.boolean().default(false),
      progress: z.boolean().default(false),
    })
    .default({ home: true, typical: true, map: true, patterns: false, days: false, progress: false }),
  // The companion's name and color (see src/components/companion).
  pet: z
    .object({ name: z.string().max(24), color: z.string() })
    .default({ name: 'Pip', color: 'sky' }),
  // Leave days tagged as not normal out of patterns and comparisons.
  excludeNotNormal: z.boolean().default(false),
  // In-app chat: the OpenRouter model, and whether it may read single days.
  chatModel: z.string().default('anthropic/claude-sonnet-5.5'),
  chatDayDetail: z.boolean().default(true),
})

export type Prefs = z.infer<typeof prefsSchema>

/**
 * What setPref accepts: the same fields with no defaults, so saving one
 * setting never writes defaults over the person's other settings. (In Zod 4,
 * `.partial()` keeps field defaults, so it cannot be used here.)
 */
export const prefsUpdateSchema = z
  .object({
    goalId: z.string(),
    sharing: z.object(Object.fromEntries(SHARE_KEYS.map((k) => [k, z.boolean()])) as Record<(typeof SHARE_KEYS)[number], z.ZodBoolean>),
    pet: z.object({ name: z.string().max(24), color: z.string() }),
    excludeNotNormal: z.boolean(),
    chatModel: z.string(),
    chatDayDetail: z.boolean(),
  })
  .partial()

export const getPrefs = createServerFn({ method: 'GET' }).handler(async () => {
  const personId = await activePersonId()
  const rows = personId === null ? [] : await db.select().from(preferences).where(eq(preferences.personId, personId))
  return prefsSchema.parse(Object.fromEntries(rows.map((r) => [r.key, r.value])))
})

export const setPref = createServerFn({ method: 'POST' })
  .validator(prefsUpdateSchema)
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
    .where(and(eq(savedQuestions.personId, personId), isNull(savedQuestions.removedAt)))
    .orderBy(asc(savedQuestions.createdAt))
})

export const saveQuestion = createServerFn({ method: 'POST' })
  .validator(z.object({ patternId: z.string(), question: z.string().trim().min(1).max(500) }))
  .handler(async ({ data }) => {
    if (hasDoseValue(data.question)) throw new Error(DOSE_VALUE_MESSAGE)
    await db
      .insert(savedQuestions)
      .values({ ...data, personId: await requirePersonId() })
      .onConflictDoUpdate({
        target: [savedQuestions.personId, savedQuestions.patternId],
        set: { removedAt: null, question: data.question },
      })
    return { ok: true }
  })

export const removeQuestion = createServerFn({ method: 'POST' })
  .validator(z.object({ patternId: z.string() }))
  .handler(async ({ data }) => {
    const personId = await requirePersonId()
    await db
      .update(savedQuestions)
      .set({ removedAt: new Date() })
      .where(and(eq(savedQuestions.personId, personId), eq(savedQuestions.patternId, data.patternId)))
    return { ok: true }
  })
