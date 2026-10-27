import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { EmptyState } from '#/components/glucose/empty-state'
import { PatternsView } from '#/components/patterns/patterns-view'
import { patternsQuery } from '#/lib/queries'

const search = z.object({ focus: z.string().optional() })

export const Route = createFileRoute('/patterns')({
  validateSearch: search,
  loader: ({ context }) => context.queryClient.ensureQueryData(patternsQuery),
  component: PatternsRoute,
})

function PatternsRoute() {
  const data = Route.useLoaderData()
  return data ? <PatternsView /> : <EmptyState />
}
