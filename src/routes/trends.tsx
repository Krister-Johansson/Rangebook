import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { EmptyState } from '#/components/glucose/empty-state'
import { TrendsView } from '#/components/trends/trends-view'
import { dataRangeQuery, heatmapQuery, profileQuery } from '#/lib/queries'

const search = z.object({
  tab: z.enum(['typical', 'map']).default('typical'),
  dayType: z.enum(['all', 'school', 'weekend']).default('all'),
})

export const Route = createFileRoute('/trends')({
  validateSearch: search,
  loaderDeps: ({ search }) => ({ dayType: search.dayType }),
  loader: async ({ context, deps }) => {
    const [range] = await Promise.all([
      context.queryClient.ensureQueryData(dataRangeQuery),
      context.queryClient.ensureQueryData(profileQuery(deps.dayType)),
      context.queryClient.ensureQueryData(heatmapQuery),
    ])
    return range
  },
  component: TrendsRoute,
})

function TrendsRoute() {
  const range = Route.useLoaderData()
  return range ? <TrendsView /> : <EmptyState />
}
