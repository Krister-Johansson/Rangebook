import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db'
import { challengePicks, savedQuestions } from '#/db/schema'
import { CHALLENGE_IDS, computeGame, weekStartOf } from '#/lib/glucose/game'
import type { ChallengeId } from '#/lib/glucose/game'
import { activePersonId, requirePersonId } from './active-person'
import { loadHistory } from './history'

// Dates on this machine's local calendar, like the pump timestamps.
function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** XP, level, badges, challenges and personal bests for the person being viewed. */
export const getProgress = createServerFn({ method: 'GET' }).handler(async () => {
  const personId = await activePersonId()
  if (personId === null) return null
  const [history, questions, picks] = await Promise.all([
    loadHistory(personId),
    db
      .select({
        patternId: savedQuestions.patternId,
        firstSaved: sql<string>`(${savedQuestions.createdAt} at time zone current_setting('TimeZone'))::date::text`,
      })
      .from(savedQuestions)
      .where(eq(savedQuestions.personId, personId)),
    db
      .select({ weekStart: challengePicks.weekStart, challengeId: challengePicks.challengeId })
      .from(challengePicks)
      .where(eq(challengePicks.personId, personId))
      .orderBy(asc(challengePicks.weekStart)),
  ])
  if (!history.days.length) return null
  return computeGame({
    days: history.days,
    longestStretch: history.longestStretch,
    questions,
    picks: picks.map((p) => ({ weekStart: p.weekStart, challengeId: p.challengeId as ChallengeId })),
    today: localToday(),
    freshFrom: history.newSince,
  })
})

/** Picks this week's challenge. It can be changed until the end of Wednesday. */
export const pickChallenge = createServerFn({ method: 'POST' })
  .validator(z.object({ challengeId: z.enum(CHALLENGE_IDS) }))
  .handler(async ({ data }) => {
    const personId = await requirePersonId()
    const today = localToday()
    const weekStart = weekStartOf(today)
    const [existing] = await db
      .select()
      .from(challengePicks)
      .where(and(eq(challengePicks.personId, personId), eq(challengePicks.weekStart, weekStart)))
    const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7
    if (existing && weekday > 2) throw new Error("This week's challenge can only be changed until Wednesday.")
    await db
      .insert(challengePicks)
      .values({ personId, weekStart, challengeId: data.challengeId })
      .onConflictDoUpdate({
        target: [challengePicks.personId, challengePicks.weekStart],
        set: { challengeId: data.challengeId, pickedAt: new Date() },
      })
    return { ok: true }
  })
