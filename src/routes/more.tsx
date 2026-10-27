import { createFileRoute } from '@tanstack/react-router'

import { MoreView } from '#/components/more/more-view'
import { dataRangeQuery, prefsQuery, systemCheckQuery } from '#/lib/queries'

export const Route = createFileRoute('/more')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(prefsQuery),
      context.queryClient.ensureQueryData(dataRangeQuery),
      context.queryClient.ensureQueryData(systemCheckQuery(14)),
    ]),
  component: MoreView,
})
