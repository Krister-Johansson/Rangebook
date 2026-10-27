import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  Activity,
  CalendarDays,
  ChartSpline,
  Ellipsis,
  House,
  Lightbulb,
  Moon,
  Sun,
  Upload,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { BandPatternDefs } from '#/components/glucose/band'
import { Button } from '#/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '#/components/ui/sidebar'
import { shortDate } from '#/lib/glucose/format'
import { dataRangeQuery, patternsQuery } from '#/lib/queries'
import { setTheme } from '#/lib/ui-store'
import { cn } from '#/lib/utils'

const NAV = [
  { to: '/', label: 'Home', icon: House },
  { to: '/trends', label: 'Trends', icon: ChartSpline },
  { to: '/patterns', label: 'Patterns', icon: Lightbulb },
  { to: '/day', label: 'Day', icon: CalendarDays },
  { to: '/more', label: 'More', icon: Ellipsis },
] as const

const TITLES: Record<string, string> = {
  '/': 'This week',
  '/trends': 'Trends',
  '/patterns': 'Patterns',
  '/day': 'Day',
  '/more': 'More',
  '/import': 'Import data',
}

function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { data: patterns } = useQuery(patternsQuery)
  const { data: range } = useQuery(dataRangeQuery)

  return (
    <Sidebar>
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2 px-2 py-1.5 font-semibold">
          <Activity className="size-5" />
          Rangebook
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.slice(0, 4).map((n) => (
                <SidebarMenuItem key={n.to}>
                  <SidebarMenuButton asChild isActive={pathname === n.to}>
                    <Link to={n.to}>
                      <n.icon />
                      {n.label}
                    </Link>
                  </SidebarMenuButton>
                  {n.to === '/patterns' && patterns?.patterns.length ? (
                    <SidebarMenuBadge>{patterns.patterns.length}</SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Data and sharing</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/more'}>
                  <Link to="/more">
                    <Users />
                    Sharing and system
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/import'}>
                  <Link to="/import">
                    <Upload />
                    Import data
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {range ? (
        <SidebarFooter className="px-4 pb-4 text-xs text-muted-foreground">
          Last reading {shortDate(range.lastDay)}, {range.lastTs.slice(11, 16)}
        </SidebarFooter>
      ) : null}
    </Sidebar>
  )
}

// The server cannot know the browser theme, so both icons render and CSS
// picks one. Reading the store here would break hydration.
function ThemeButton() {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Switch between light and dark theme"
      onClick={() =>
        setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark')
      }
    >
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </Button>
  )
}

function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {NAV.map((n) => {
        const active = pathname === n.to || (n.to === '/more' && pathname === '/import')
        return (
          <Link
            key={n.to}
            to={n.to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium text-muted-foreground no-underline',
              active && 'font-bold text-foreground',
            )}
          >
            <n.icon className="size-5" strokeWidth={active ? 2.4 : 2} />
            {n.label}
            <span className={cn('mt-0.5 h-[3px] w-[18px] rounded-full', active && 'bg-foreground')} />
          </Link>
        )
      })}
    </nav>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <SidebarProvider>
      <BandPatternDefs />
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-2 px-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground md:hidden">
              <Activity className="size-4" />
            </span>
            <div className="min-w-0 flex-1 font-semibold">{TITLES[pathname] ?? 'Glucose'}</div>
            <ThemeButton />
            <Button variant="ghost" size="icon" asChild aria-label="Import data">
              <Link to="/import">
                <Upload className="size-4" />
              </Link>
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 pt-4 pb-28 md:pb-10">{children}</main>
      </SidebarInset>
      <TabBar />
    </SidebarProvider>
  )
}
