import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import { AppShell } from '#/components/app-shell'
import { Toaster } from '#/components/ui/sonner'
import { TooltipProvider } from '#/components/ui/tooltip'
import { dataRangeQuery, patternsQuery, peopleQuery } from '#/lib/queries'
import { themeBootScript } from '#/lib/ui-store'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'Rangebook' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
    scripts: [{ children: themeBootScript }],
  }),
  // The sidebar shows the person, pattern count and last reading on every
  // page, so they are loaded here to keep server and client renders identical.
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(peopleQuery),
      context.queryClient.ensureQueryData(patternsQuery),
      context.queryClient.ensureQueryData(dataRangeQuery),
    ]),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background antialiased">
        <TooltipProvider>
          <AppShell>{children}</AppShell>
          <Toaster richColors />
        </TooltipProvider>
        <TanStackDevtools
          config={{ position: 'middle-right' }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
