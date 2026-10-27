import { useSuspenseQuery } from '@tanstack/react-query'
import { ClientOnly, Link } from '@tanstack/react-router'
import { ChevronRight, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Suspense } from 'react'

import { KindBadge } from '#/components/glucose/band'
import { BADGE_ICONS, Medal, NewDot } from '#/components/progress/parts'
import { Card } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import type { GameState } from '#/lib/glucose/game'
import { patternsQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'

const ROW =
  'flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left no-underline transition-colors duration-(--dur-press) hover:bg-accent active:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'

function RowText({ title, sub }: { title: ReactNode; sub: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </span>
  )
}

const Chevron = () => <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />

function TopPatternRow() {
  const { data } = useSuspenseQuery(patternsQuery)
  const top = data?.patterns[0]
  if (!top) {
    return (
      <Link to="/patterns" className={ROW}>
        <RowText
          title="No patterns right now"
          sub={data ? `Nothing stood out in the last ${data.days} days.` : 'Patterns need more data.'}
        />
        <Chevron />
      </Link>
    )
  }
  return (
    <Link to="/patterns/$patternId" params={{ patternId: top.id }} className={ROW}>
      <KindBadge kind={top.kind} />
      <RowText title={top.title} sub={`Top pattern. ${top.when}`} />
      <Chevron />
    </Link>
  )
}

// Client only: fetching patterns during SSR would stream them into the cache
// before the sidebar (which reads the same query) hydrates.
function PatternRow() {
  const fallback = (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-4 flex-1" />
    </div>
  )
  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <TopPatternRow />
      </Suspense>
    </ClientOnly>
  )
}

/** The newest badge, or a new personal best, or the latest badge earned. */
function RewardRow({ progress }: { progress: GameState }) {
  const earned = progress.badges
    .flatMap((b) => b.earned.map((e, i) => ({ b, e, i })))
    .sort((x, y) => x.e.weekStart.localeCompare(y.e.weekStart) || x.i - y.i)
  const freshBadge = earned.filter((x) => x.e.fresh).at(-1)
  const freshBest = progress.bests.find((b) => b.fresh)
  const latest = freshBadge ?? (freshBest ? null : earned.at(-1))

  if (latest) {
    const { b, e, i } = latest
    return (
      <Link to="/progress" search={{ tab: 'badges' }} className={ROW}>
        <Medal tier={e.tier} state="earned" icon={BADGE_ICONS[b.id]} size={32} />
        <RowText
          title={
            <>
              {b.name}, {e.tier}
            </>
          }
          sub={`${e.fresh ? 'New badge' : 'Latest badge'}. ${b.tiers[i]} ${b.what.toLowerCase()}.`}
        />
        {e.fresh ? <NewDot /> : <Chevron />}
      </Link>
    )
  }
  if (freshBest) {
    return (
      <Link to="/progress" search={{ tab: 'bests' }} className={ROW}>
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-xp-soft text-xp"
        >
          <Sparkles className="size-4" />
        </span>
        <RowText title={`${freshBest.label}: ${freshBest.value}`} sub={`New personal best. ${freshBest.date}.`} />
        <NewDot />
      </Link>
    )
  }
  return null
}

export function HomeTeasers({ progress, className }: { progress: GameState | null; className?: string }) {
  return (
    <Card className={cn('gap-0 divide-y overflow-hidden py-0', className)}>
      <h2 className="sr-only">Highlights</h2>
      <PatternRow />
      {progress ? <RewardRow progress={progress} /> : null}
    </Card>
  )
}
