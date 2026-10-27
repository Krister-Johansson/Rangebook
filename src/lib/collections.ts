import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { QueryClient } from '@tanstack/react-query'
import { createCollection } from '@tanstack/react-db'

import {
  listSavedQuestions,
  removeQuestion,
  saveQuestion,
} from '#/server/preferences'

export interface SavedQuestion {
  patternId: string
  question: string
  createdAt: string
}

// TanStack DB collections live in the browser only. Components that read them
// with useLiveQuery are wrapped in <ClientOnly>, so SSR never touches them.
const collectionClient = new QueryClient()

export const savedQuestionsCollection = createCollection(
  queryCollectionOptions({
    id: 'saved-questions',
    queryKey: ['saved-questions'],
    queryFn: async (): Promise<SavedQuestion[]> =>
      (await listSavedQuestions()).map((q) => ({
        ...q,
        createdAt: new Date(q.createdAt).toISOString(),
      })),
    queryClient: collectionClient,
    getKey: (q) => q.patternId,
    onInsert: async ({ transaction }) => {
      await Promise.all(
        transaction.mutations.map((m) =>
          saveQuestion({
            data: { patternId: m.modified.patternId, question: m.modified.question },
          }),
        ),
      )
    },
    onDelete: async ({ transaction }) => {
      await Promise.all(
        transaction.mutations.map((m) =>
          removeQuestion({ data: { patternId: String(m.key) } }),
        ),
      )
    },
  }),
)

export function toggleSavedQuestion(patternId: string, question: string, saved: boolean) {
  if (saved) savedQuestionsCollection.delete(patternId)
  else
    savedQuestionsCollection.insert({
      patternId,
      question,
      createdAt: new Date().toISOString(),
    })
}
