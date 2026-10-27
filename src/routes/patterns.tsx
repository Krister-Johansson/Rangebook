import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { EmptyState } from '#/components/glucose/empty-state'
import { PatternsView } from '#/components/patterns/patterns-view'
import { lifeLogQuery, patternsQuery, prefsQuery } from '#/lib/queries'

const search = z.object({
  tab: z.enum(['list', 'clinic']).default('list'),
  // Older links pointed at a pattern in the list; it has its own page now.
  focus: z.string().optional(),
})

export const Route = createFileRoute('/patterns')({
  validateSearch: search,
  beforeLoad: ({ search }) => {
    if (search.focus) throw redirect({ to: '/patterns/$patternId', params: { patternId: search.focus } })
  },
  loader: async ({ context }) => {
    const [data] = await Promise.all([
      context.queryClient.ensureQueryData(patternsQuery),
      context.queryClient.ensureQueryData(prefsQuery),
      context.queryClient.ensureQueryData(lifeLogQuery),
    ])
    return data
  },
  component: PatternsRoute,
})

function PatternsRoute() {
  const data = Route.useLoaderData()
  return data ? <PatternsView /> : <EmptyState />
}
