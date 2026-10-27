import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowDown, Award, ChevronRight, CircleCheck, Users } from 'lucide-react'
import { Suspense } from 'react'

import { EmptyState } from '#/components/glucose/empty-state'
import { SHARE_ITEMS } from '#/components/more/prefs'
import { SystemCheckCard } from '#/components/more/system-check-card'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import type { PeriodSummary, Win } from '#/lib/glucose/analysis'
import { TARGETS } from '#/lib/glucose/core'
import { f1, perDay } from '#/lib/glucose/format'
import { homeQuery, prefsQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'

import { GoalCard } from './goal-card'
import { PatternsTeaser } from './patterns-teaser'
import { SectionCard } from './section-card'
import { TirCard } from './tir-card'

function StatTile({
  label,
  value,
  unit,
  sub,
}: {
  label: string
  value: string
  unit: string
  sub: string
}) {
  return (
    <Card className="gap-0.5 p-3">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="text-2xl leading-tight font-extrabold tracking-tight">
        {value}
        <span className="ml-px text-xs font-semibold text-muted-foreground">{unit}</span>
      </div>
      <div className="text-[11.5px] leading-snug text-muted-foreground">{sub}</div>
    </Card>
  )
}

function StatTiles({
  thisWeek,
  lastWeek,
  className,
}: {
  thisWeek: PeriodSummary
  lastWeek: PeriodSummary
  className?: string
}) {
  const W = thisWeek.stats
  const L = lastWeek.stats
  if (!W.n) return null
  const last = (text: string) => (L.n ? `Last week ${text}` : 'No data last week')
  return (
    <div className={cn('grid grid-cols-3 gap-2.5', className)}>
      <StatTile label="Average" value={f1(W.mean)} unit=" mmol/L" sub={last(f1(L.mean))} />
      <StatTile
        label="GMI"
        value={W.gmi.toFixed(1)}
        unit="%"
        sub={`Estimated A1c. ${last(`${L.gmi.toFixed(1)}%`)}`}
      />
      <StatTile
        label="Variation"
        value={String(Math.round(W.cv))}
        unit="%"
        sub={`CV. Target ${TARGETS.cv}% or less. ${last(`${Math.round(L.cv)}%`)}`}
      />
    </div>
  )
}

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

function WinsCard({ wins, className }: { wins: Win[]; className?: string }) {
  return (
    <SectionCard title="Wins this week" icon={Award} className={className}>
      {wins.length ? (
        <ul className="flex flex-col gap-3">
          {wins.map((w) => (
            <li key={w.id} className="flex items-start gap-2.5">
              <CircleCheck aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-win" />
              <div>
                <div className="text-sm font-medium">{w.title}</div>
                <div className="text-xs text-muted-foreground">{w.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Wins show up here when this week has something to point out.
        </p>
      )}
    </SectionCard>
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
        <Link to="/more" className="font-medium text-foreground underline underline-offset-4">
          Change
        </Link>
      </span>
    </p>
  )
}

export function HomeView() {
  const { data } = useSuspenseQuery(homeQuery)
  if (!data) return <EmptyState />
  const { thisWeek, lastWeek } = data

  // Single column on phones (ordered by `order`), two columns when there is room.
  return (
    <div className="@container flex flex-col gap-4">
      <h1 className="sr-only">This week</h1>
      <div className="flex flex-col gap-4 @[880px]:grid @[880px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] @[880px]:items-start">
        <div className="contents @[880px]:flex @[880px]:flex-col @[880px]:gap-4">
          <TirCard thisWeek={thisWeek} lastWeek={lastWeek} className="order-1 @[880px]:order-none" />
          {data.lowsOverTarget ? (
            <LowsAlert thisWeek={thisWeek} className="order-3 @[880px]:order-none" />
          ) : null}
          <PatternsTeaser className="order-6 @[880px]:order-none" />
        </div>
        <div className="contents @[880px]:flex @[880px]:flex-col @[880px]:gap-4">
          <StatTiles
            thisWeek={thisWeek}
            lastWeek={lastWeek}
            className="order-2 @[880px]:order-none"
          />
          <WinsCard wins={data.wins} className="order-4 @[880px]:order-none" />
          <GoalCard goals={data.goals} className="order-5 @[880px]:order-none" />
          <SystemCheckCard
            items={data.system}
            period="Last 7 days"
            compact
            className="order-7 @[880px]:order-none"
          />
        </div>
      </div>
      <Suspense fallback={<Skeleton className="h-5 w-64" />}>
        <ShareLine />
      </Suspense>
    </div>
  )
}
