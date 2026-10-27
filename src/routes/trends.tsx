import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { EmptyState } from '#/components/glucose/empty-state'
import { DAYS_SHOWN, TrendsView } from '#/components/trends/trends-view'
import {
  dataRangeQuery,
  daysQuery,
  heatmapQuery,
  lifeLogQuery,
  profileQuery,
  settingsTimelineQuery,
} from '#/lib/queries'

const search = z.object({
  tab: z.enum(['typical', 'map', 'days', 'changes']).default('typical'),
  dayType: z.enum(['all', 'school', 'weekend']).default('all'),
})

export const Route = createFileRoute('/trends')({
  validateSearch: search,
  loaderDeps: ({ search }) => ({ tab: search.tab, dayType: search.dayType }),
  loader: async ({ context, deps }) => {
    const qc = context.queryClient
    const [range] = await Promise.all([
      qc.ensureQueryData(dataRangeQuery),
      qc.ensureQueryData(lifeLogQuery),
      deps.tab === 'typical' ? qc.ensureQueryData(profileQuery(deps.dayType)) : null,
      deps.tab === 'map' ? qc.ensureQueryData(heatmapQuery) : null,
      deps.tab === 'days' ? qc.ensureQueryData(daysQuery(DAYS_SHOWN)) : null,
      deps.tab === 'changes' ? qc.ensureQueryData(settingsTimelineQuery) : null,
    ])
    return range
  },
  component: TrendsRoute,
})

function TrendsRoute() {
  const range = Route.useLoaderData()
  return range ? <TrendsView /> : <EmptyState />
}
