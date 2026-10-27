import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { EmptyState } from '#/components/glucose/empty-state'
import { DayView } from '#/components/day/day-view'
import { dayQuery, daysQuery } from '#/lib/queries'

const search = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  insulin: z.boolean().default(false),
})

export const Route = createFileRoute('/day')({
  validateSearch: search,
  loaderDeps: ({ search }) => ({ date: search.date }),
  loader: async ({ context, deps }) => {
    const [day] = await Promise.all([
      context.queryClient.ensureQueryData(dayQuery(deps.date)),
      context.queryClient.ensureQueryData(daysQuery(14)),
    ])
    return day
  },
  component: DayRoute,
})

function DayRoute() {
  const day = Route.useLoaderData()
  return day ? <DayView /> : <EmptyState />
}
