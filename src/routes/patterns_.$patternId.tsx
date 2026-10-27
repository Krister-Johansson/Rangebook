import { createFileRoute } from '@tanstack/react-router'

import { EmptyState } from '#/components/glucose/empty-state'
import { PatternDetail } from '#/components/patterns/pattern-detail'
import { patternsQuery } from '#/lib/queries'

export const Route = createFileRoute('/patterns_/$patternId')({
  loader: ({ context }) => context.queryClient.ensureQueryData(patternsQuery),
  component: PatternRoute,
})

function PatternRoute() {
  const data = Route.useLoaderData()
  const { patternId } = Route.useParams()
  return data ? <PatternDetail patternId={patternId} /> : <EmptyState />
}
