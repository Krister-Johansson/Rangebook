import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'

import { savedQuestionsCollection } from '#/lib/collections'
import { setActivePerson } from '#/server/people'

/**
 * Switches the person being viewed. The server reads the person from a cookie,
 * so every cached result belongs to the old person. Resetting (rather than
 * invalidating) drops the old data, so no screen shows one person's numbers
 * under another person's name while the new data loads.
 */
export function useSwitchPerson() {
  const queryClient = useQueryClient()
  const router = useRouter()
  return useCallback(
    async (id: number) => {
      await setActivePerson({ data: { id } })
      await refreshForPerson(queryClient, router)
    },
    [queryClient, router],
  )
}

export async function refreshForPerson(
  queryClient: ReturnType<typeof useQueryClient>,
  router: ReturnType<typeof useRouter>,
) {
  await Promise.all([
    queryClient.resetQueries(),
    router.invalidate(),
    savedQuestionsCollection.utils.refetch(),
  ])
}
