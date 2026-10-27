import { createFileRoute } from '@tanstack/react-router'

import { SharingPage } from '#/components/more/sub-pages'
import { prefsQuery } from '#/lib/queries'

export const Route = createFileRoute('/more_/sharing')({
  loader: ({ context }) => context.queryClient.ensureQueryData(prefsQuery),
  component: SharingPage,
})
