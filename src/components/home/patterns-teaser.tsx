import { useSuspenseQuery } from '@tanstack/react-query'
import { ClientOnly, Link } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { ChevronRight, Lightbulb } from 'lucide-react'
import { Suspense } from 'react'

import { KindBadge } from '#/components/glucose/band'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { savedQuestionsCollection } from '#/lib/collections'
import { patternsQuery } from '#/lib/queries'

import { SectionCard } from './section-card'

function SavedCount() {
  const { data, isReady } = useLiveQuery((q) => q.from({ s: savedQuestionsCollection }))
  if (!isReady) return <Skeleton className="h-4 w-48" />
  const n = data.length
  return (
    <p className="text-xs text-muted-foreground">
      {n
        ? `${n} question${n === 1 ? '' : 's'} saved for clinic.`
        : 'No questions saved for clinic yet.'}
    </p>
  )
}

function AllLink() {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link to="/patterns">
        All
        <ChevronRight />
      </Link>
    </Button>
  )
}

function TeaserContent({ className }: { className?: string }) {
  const { data } = useSuspenseQuery(patternsQuery)
  const patterns = data?.patterns ?? []
  const top = patterns.slice(0, 3)
  const n = patterns.length
  const description = !data
    ? 'No data yet.'
    : n
      ? `${n} pattern${n === 1 ? '' : 's'} from the last ${data.days} days.${patterns.some((p) => p.kind === 'low') ? ' Lows first.' : ''}`
      : `No patterns found in the last ${data.days} days.`

  return (
    <SectionCard
      title="Patterns"
      icon={Lightbulb}
      description={description}
      className={className}
      contentClassName="flex flex-col gap-3"
      action={<AllLink />}
    >
      {top.length ? (
        <ul className="flex flex-col gap-2">
          {top.map((p) => (
            <li key={p.id}>
              <Link
                to="/patterns"
                search={{ focus: p.id }}
                className="flex min-h-13 w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left no-underline transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <KindBadge kind={p.kind} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">{p.title}</span>
                  <span className="text-xs text-muted-foreground">{p.when}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <SavedCount />
    </SectionCard>
  )
}

// Client only: fetching patterns during SSR would stream them into the cache
// before the sidebar badge (which reads the same query) hydrates.
export function PatternsTeaser({ className }: { className?: string }) {
  const fallback = (
    <SectionCard
      title="Patterns"
      icon={Lightbulb}
      description="Looking for patterns."
      className={className}
      contentClassName="flex flex-col gap-2"
      action={<AllLink />}
    >
      <Skeleton className="h-13 w-full rounded-lg" />
      <Skeleton className="h-13 w-full rounded-lg" />
    </SectionCard>
  )
  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <TeaserContent className={className} />
      </Suspense>
    </ClientOnly>
  )
}
