import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { EmptyState } from '#/components/glucose/empty-state'
import { ProgressView } from '#/components/progress/progress-view'
import { homeQuery, prefsQuery, progressQuery } from '#/lib/queries'

const search = z.object({
  tab: z.enum(['overview', 'badges', 'challenges', 'bests']).default('overview'),
})

export const Route = createFileRoute('/progress')({
  validateSearch: search,
  loader: async ({ context }) => {
    const [progress] = await Promise.all([
      context.queryClient.ensureQueryData(progressQuery),
      context.queryClient.ensureQueryData(prefsQuery),
      context.queryClient.ensureQueryData(homeQuery),
    ])
    return progress
  },
  component: ProgressRoute,
})

function ProgressRoute() {
  const progress = Route.useLoaderData()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  if (!progress) return <EmptyState />
  return (
    <ProgressView
      tab={tab}
      onTab={(next) => navigate({ search: (s) => ({ ...s, tab: next }), replace: true })}
    />
  )
}
