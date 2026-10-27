import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { EmptyState } from '#/components/glucose/empty-state'
import { DayView } from '#/components/day/day-view'
import { dayQuery, daysQuery, lifeLogQuery } from '#/lib/queries'

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

// `date` is the canonical key. `day` is accepted too, so /day?day=YYYY-MM-DD
// links work; it is folded into `date`.
const search = z
  .object({
    date: isoDay.optional().catch(undefined),
    day: isoDay.optional().catch(undefined),
    insulin: z.boolean().default(false),
  })
  .transform(({ day, ...rest }) => ({ ...rest, date: rest.date ?? day }))

export const Route = createFileRoute('/day')({
  validateSearch: search,
  loaderDeps: ({ search }) => ({ date: search.date }),
  loader: async ({ context, deps }) => {
    const [day] = await Promise.all([
      context.queryClient.ensureQueryData(dayQuery(deps.date)),
      context.queryClient.ensureQueryData(daysQuery(14)),
      context.queryClient.ensureQueryData(lifeLogQuery),
    ])
    return day
  },
  component: DayRoute,
})

function DayRoute() {
  const day = Route.useLoaderData()
  return day ? <DayView /> : <EmptyState />
}
