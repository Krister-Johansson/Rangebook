import { and, asc, eq, isNull } from 'drizzle-orm'

import { db } from '#/db'
import { savedQuestions } from '#/db/schema'
import { loadDataset } from '../dataset'
import { leaveOutDays } from '../not-normal'
import type { ChatDeps } from './tools'

// Server-only: the chat tools' data access for one person, from Postgres.
export function databaseDeps(personId: number, allowDayDetail: boolean): ChatDeps {
  return {
    dataset: () => loadDataset(personId),
    leaveOutDays: () => leaveOutDays(personId),
    savedQuestions: () =>
      db
        .select({ patternId: savedQuestions.patternId, question: savedQuestions.question })
        .from(savedQuestions)
        .where(and(eq(savedQuestions.personId, personId), isNull(savedQuestions.removedAt)))
        .orderBy(asc(savedQuestions.createdAt)),
    saveQuestion: async (patternId, question) => {
      await db
        .insert(savedQuestions)
        .values({ personId, patternId, question })
        .onConflictDoUpdate({
          target: [savedQuestions.personId, savedQuestions.patternId],
          set: { removedAt: null, question },
        })
    },
    allowDayDetail,
  }
}
