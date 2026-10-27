import { createFileRoute } from '@tanstack/react-router'

import { ActivityView } from '#/components/log/activity-view'
import { activityComparisonQuery, lifeLogQuery, prefsQuery } from '#/lib/queries'

export const Route = createFileRoute('/log_/activity/$activityId')({
  loader: async ({ context, params }) => {
    const id = Number(params.activityId)
    const [prefs] = await Promise.all([
      context.queryClient.ensureQueryData(prefsQuery),
      context.queryClient.ensureQueryData(lifeLogQuery),
    ])
    if (Number.isInteger(id)) {
      await context.queryClient.ensureQueryData(activityComparisonQuery(id, prefs.excludeNotNormal))
    }
  },
  component: ActivityRoute,
})

function ActivityRoute() {
  const { activityId } = Route.useParams()
  const id = Number(activityId)
  return <ActivityView id={Number.isInteger(id) ? id : -1} />
}
