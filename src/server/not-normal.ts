import { and, eq } from 'drizzle-orm'

import { db } from '#/db'
import { lifeLog, preferences } from '#/db/schema'
import { notNormalDays } from '#/lib/glucose/lifelog'
import type { LogEntry } from '#/lib/glucose/lifelog'

// Server-only: the days to leave out of patterns and comparisons, when the
// person has switched on "leave out not-normal days".
export async function leaveOutDays(personId: number, force?: boolean): Promise<Set<string>> {
  if (force === undefined) {
    const [pref] = await db
      .select({ value: preferences.value })
      .from(preferences)
      .where(and(eq(preferences.personId, personId), eq(preferences.key, 'excludeNotNormal')))
    if (pref?.value !== true) return new Set()
  } else if (!force) return new Set()
  const tags = await db
    .select()
    .from(lifeLog)
    .where(and(eq(lifeLog.personId, personId), eq(lifeLog.kind, 'tag')))
  return notNormalDays(tags as unknown as LogEntry[])
}
