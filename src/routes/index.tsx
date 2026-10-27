import { createFileRoute } from '@tanstack/react-router'

import { EmptyState } from '#/components/glucose/empty-state'
import { HomeView } from '#/components/home/home-view'
import { homeQuery, prefsQuery } from '#/lib/queries'

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    const [home] = await Promise.all([
      context.queryClient.ensureQueryData(homeQuery),
      context.queryClient.ensureQueryData(prefsQuery),
    ])
    return home
  },
  component: HomeRoute,
})

function HomeRoute() {
  const data = Route.useLoaderData()
  return data ? <HomeView /> : <EmptyState />
}
