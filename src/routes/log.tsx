import { createFileRoute } from '@tanstack/react-router'

import { LogView } from '#/components/log/log-view'
import { lifeLogQuery, prefsQuery } from '#/lib/queries'

export const Route = createFileRoute('/log')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(lifeLogQuery),
      context.queryClient.ensureQueryData(prefsQuery),
    ]),
  component: LogView,
})
