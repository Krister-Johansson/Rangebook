import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { ChangeView } from '#/components/changes/change-view'
import { changeComparisonQuery, lifeLogQuery, prefsQuery, settingsTimelineQuery } from '#/lib/queries'

const search = z.object({
  days: z
    .union([z.literal(7), z.literal(14), z.literal(21)])
    .catch(14)
    .default(14),
})

export const Route = createFileRoute('/trends_/changes/$changeId')({
  validateSearch: search,
  loaderDeps: ({ search }) => ({ days: search.days }),
  loader: async ({ context, params, deps }) => {
    const qc = context.queryClient
    await Promise.all([
      qc.ensureQueryData(changeComparisonQuery(params.changeId, deps.days)),
      qc.ensureQueryData(settingsTimelineQuery),
      qc.ensureQueryData(prefsQuery),
      qc.ensureQueryData(lifeLogQuery),
    ])
  },
  component: ChangeRoute,
})

function ChangeRoute() {
  return <ChangeView />
}
