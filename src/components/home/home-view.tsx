import { useSuspenseQuery } from '@tanstack/react-query'
import { ClientOnly, Link } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { ArrowDown, CalendarDays, ChevronRight, PenLine, Stethoscope, Users } from 'lucide-react'
import { Suspense } from 'react'

import { CompanionCard } from '#/components/companion/companion-card'
import { EmptyState } from '#/components/glucose/empty-state'
import { SHARE_ITEMS } from '#/components/more/prefs'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import type { PeriodSummary } from '#/lib/glucose/analysis'
import { savedQuestionsCollection } from '#/lib/collections'
import { TARGETS } from '#/lib/glucose/core'
import { perDay } from '#/lib/glucose/format'
import { homeQuery, prefsQuery, progressQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'

import { ChallengeCard } from './challenge-card'
import { HomeTeasers } from './teasers'
import { TirCard } from './tir-card'

function LowsAlert({ thisWeek, className }: { thisWeek: PeriodSummary; className?: string }) {
  const below = thisWeek.stats.below39
  return (
    <Alert role="status" className={cn('border-l-4', className)} style={{ borderLeftColor: 'var(--band-low)' }}>
      <ArrowDown />
      <AlertTitle>Lows come first this week</AlertTitle>
      <AlertDescription>
        <p>
          Time below 3.9 was {below.toFixed(1)}%, about {perDay(below)} a day. The target is under{' '}
          {TARGETS.below39}%, so Patterns lists lows first.
        </p>
        <Button variant="outline" size="sm" asChild className="mt-1">
          <Link to="/patterns">
            See patterns
            <ChevronRight />
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  )
}

function SavedCount() {
  const { data, isReady } = useLiveQuery((q) => q.from({ s: savedQuestionsCollection }))
  return isReady && data.length ? <> ({data.length})</> : null
}

function QuickLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Quick links" className={cn('flex flex-wrap gap-2', className)}>
      <Button variant="outline" size="sm" asChild>
        <Link to="/log">
          <PenLine />
          Log
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link to="/trends" search={{ tab: 'days' }}>
          <CalendarDays />
          Days
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link to="/patterns" search={{ tab: 'clinic' }}>
          <Stethoscope />
          For clinic
          <ClientOnly>
            <SavedCount />
          </ClientOnly>
        </Link>
      </Button>
    </nav>
  )
}

function ShareLine() {
  const { data: prefs } = useSuspenseQuery(prefsQuery)
  const shared = SHARE_ITEMS.filter((s) => prefs.sharing[s.id]).map((s) => s.label)
  return (
    <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
      <Users aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>
        Your parent sees: {shared.length ? shared.join(', ') : 'nothing yet'}.{' '}
        <Link to="/more/sharing" className="-my-2 inline-block py-2 font-medium text-foreground underline underline-offset-4">
          Change
        </Link>
      </span>
    </p>
  )
}

export function HomeView() {
  const { data } = useSuspenseQuery(homeQuery)
  const { data: progress } = useSuspenseQuery(progressQuery)
  const { data: prefs } = useSuspenseQuery(prefsQuery)
  if (!data) return <EmptyState />
  const { thisWeek, lastWeek } = data

  // One column on phones in reading order, two columns when there is room.
  return (
    <div className="@container flex flex-col gap-4">
      <h1 className="sr-only">Home</h1>
      <div className="flex flex-col gap-4 @[880px]:grid @[880px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] @[880px]:items-start">
        <div className="flex flex-col gap-4">
          {data.lowsOverTarget ? <LowsAlert thisWeek={thisWeek} /> : null}
          {progress ? <CompanionCard progress={progress} pet={prefs.pet} /> : null}
          <TirCard thisWeek={thisWeek} lastWeek={lastWeek} />
        </div>
        <div className="flex flex-col gap-4">
          {progress ? <ChallengeCard progress={progress} /> : null}
          <HomeTeasers progress={progress} />
          <QuickLinks />
        </div>
      </div>
      <Suspense fallback={<Skeleton className="h-5 w-64" />}>
        <ShareLine />
      </Suspense>
    </div>
  )
}
