import { createFileRoute } from '@tanstack/react-router'

import { SystemPage } from '#/components/more/sub-pages'
import { systemCheckQuery } from '#/lib/queries'

export const Route = createFileRoute('/more_/system')({
  loader: ({ context }) => context.queryClient.ensureQueryData(systemCheckQuery(14)),
  component: SystemPage,
})
