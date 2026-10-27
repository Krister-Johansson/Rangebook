import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  Activity,
  ChartSpline,
  Ellipsis,
  House,
  Lightbulb,
  Moon,
  PenLine,
  Sun,
  Trophy,
  Upload,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { CompanionSvg } from '#/components/companion/companion-svg'
import { BandPatternDefs } from '#/components/glucose/band'
import { PersonSwitcher } from '#/components/person-switcher'
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
import { dataRangeQuery, patternsQuery, prefsQuery, progressQuery } from '#/lib/queries'
import { setTheme } from '#/lib/ui-store'
import { cn } from '#/lib/utils'

const NAV = [
  { to: '/', label: 'Home', icon: House },
  { to: '/progress', label: 'Progress', icon: Trophy },
  { to: '/trends', label: 'Trends', icon: ChartSpline },
  { to: '/patterns', label: 'Patterns', icon: Lightbulb },
  { to: '/more', label: 'More', icon: Ellipsis },
] as const

type Section = (typeof NAV)[number]['to']

/** Which of the five tabs a page belongs to. */
function sectionOf(pathname: string): Section {
  if (pathname === '/') return '/'
  if (pathname.startsWith('/progress')) return '/progress'
  if (pathname.startsWith('/trends') || pathname.startsWith('/day')) return '/trends'
  if (pathname.startsWith('/patterns')) return '/patterns'
  return '/more'
}

const TITLES: [string, string][] = [
  ['/progress', 'Progress'],
  ['/trends/changes', 'Settings change'],
  ['/trends', 'Trends'],
  ['/day', 'Day'],
  ['/patterns', 'Patterns'],
  ['/log', 'Life log'],
  ['/more/sharing', 'What your parent sees'],
  ['/more/system', 'System check'],
  ['/more/look', 'Look'],
  ['/more', 'More'],
  ['/import', 'Import data'],
  ['/people', 'People'],
  ['/ask-claude', 'Ask Claude'],
]

const titleOf = (pathname: string) =>
  pathname === '/' ? 'This week' : (TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? 'Rangebook')

/** Companion, level and XP left, at the bottom of the desktop sidebar. */
function SidebarCompanion() {
  const { data: progress } = useQuery(progressQuery)
  const { data: prefs } = useQuery(prefsQuery)
  if (!progress || !prefs) return null
  const name = prefs.pet.name.trim() || 'Pip'
  return (
    <Link
      to="/progress"
      className="mx-2 flex items-center gap-2.5 rounded-xl bg-muted p-2.5 text-sm no-underline hover:bg-accent"
    >
      <CompanionSvg stage={progress.stage} mood={progress.mood} color={prefs.pet.color} size={44} still />
      <span className="min-w-0">
        <span className="block truncate font-semibold">
          {name}, level {progress.level.level}
        </span>
        <span className="block text-xs text-muted-foreground">
          {progress.level.left} XP to level {progress.level.level + 1}
        </span>
      </span>
    </Link>
  )
}

function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const section = sectionOf(pathname)
  const { data: patterns } = useQuery(patternsQuery)
  const { data: range } = useQuery(dataRangeQuery)
  const { data: progress } = useQuery(progressQuery)

  return (
    <Sidebar>
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2 px-2 py-1.5 font-semibold">
          <Activity className="size-5" />
          Rangebook
        </Link>
        <PersonSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.slice(0, 4).map((n) => (
                <SidebarMenuItem key={n.to}>
                  <SidebarMenuButton asChild isActive={section === n.to}>
                    <Link to={n.to}>
                      <n.icon />
                      {n.label}
                    </Link>
                  </SidebarMenuButton>
                  {n.to === '/patterns' && patterns?.patterns.length ? (
                    <SidebarMenuBadge>{patterns.patterns.length}</SidebarMenuBadge>
                  ) : null}
                  {n.to === '/progress' && progress ? (
                    <SidebarMenuBadge>L{progress.level.level}</SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Yours</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/log')}>
                  <Link to="/log">
                    <PenLine />
                    Life log
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={section === '/more' && !pathname.startsWith('/log') && pathname !== '/import'}
                >
                  <Link to="/more">
                    <Ellipsis />
                    More
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
      <SidebarFooter className="gap-3 px-2 pb-4">
        <SidebarCompanion />
        {range ? (
          <div className="px-2 text-xs text-muted-foreground">
            Last reading {shortDate(range.lastDay)}, {range.lastTs.slice(11, 16)}
          </div>
        ) : null}
      </SidebarFooter>
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
  const section = sectionOf(pathname)
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {NAV.map((n) => {
        const active = section === n.to
        return (
          <Link
            key={n.to}
            to={n.to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium text-muted-foreground no-underline transition-[color,transform] duration-(--dur-press) ease-out active:scale-[0.96] motion-reduce:active:scale-100',
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

/**
 * A thin bar under the header while the next page loads. It fades in after
 * 150 ms, so quick navigations show nothing.
 */
function PendingBar() {
  const pending = useRouterState({ select: (s) => s.status === 'pending' })
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden opacity-0 transition-opacity duration-(--dur-pop) ease-out',
        pending && 'opacity-100 delay-150',
      )}
    >
      <div className="pending-bar h-full w-1/3 bg-primary" />
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <SidebarProvider>
      <BandPatternDefs />
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-2 px-[max(1rem,env(safe-area-inset-left))]">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground md:hidden">
              <Activity className="size-4" />
            </span>
            <div className="min-w-0 flex-1 font-semibold">{titleOf(pathname)}</div>
            <div className="md:hidden">
              <PersonSwitcher compact />
            </div>
            <ThemeButton />
            <Button variant="ghost" size="icon" asChild aria-label="Import data">
              <Link to="/import">
                <Upload className="size-4" />
              </Link>
            </Button>
          </div>
          <PendingBar />
        </header>
        <main className="mx-auto w-full max-w-6xl px-[max(1rem,env(safe-area-inset-left))] pt-4 pb-28 md:pb-10">
          {children}
        </main>
      </SidebarInset>
      <TabBar />
    </SidebarProvider>
  )
}
