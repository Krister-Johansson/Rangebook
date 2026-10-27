import { createFileRoute } from '@tanstack/react-router'

import { LookPage } from '#/components/more/look-page'
import { prefsQuery, progressQuery } from '#/lib/queries'

export const Route = createFileRoute('/more_/look')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(prefsQuery),
      context.queryClient.ensureQueryData(progressQuery),
    ]),
  component: LookPage,
})
