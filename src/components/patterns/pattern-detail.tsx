import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'

import { KindBadge } from '#/components/glucose/band'
import { BackHead } from '#/components/more/page-head'
import { Button } from '#/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { patternsQuery } from '#/lib/queries'

import { PatternMain, PatternQuestion, PatternTopics } from './pattern-card'
import { orderPatterns } from './patterns-view'

export function PatternDetail({ patternId }: { patternId: string }) {
  const { data } = useSuspenseQuery(patternsQuery)
  if (!data) return null
  const list = orderPatterns(data.patterns)
  const idx = list.findIndex((p) => p.id === patternId)
  const p = list[idx]

  if (!p) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <BackHead back="Patterns" backTo={{ to: '/patterns' }} title="Pattern not found" />
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>This pattern is not in the latest data</h2>
            </CardTitle>
            <CardDescription>
              Patterns are found again after each import, so this one may no longer show up. The
              list has the patterns found now.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const prev = list[idx - 1]
  const next = list[idx + 1]

  return (
    <div className="@container mx-auto flex w-full max-w-4xl flex-col gap-4">
      <BackHead
        back="Patterns"
        backTo={{ to: '/patterns' }}
        title={p.title}
        sub={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <KindBadge kind={p.kind} />
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Clock aria-hidden="true" className="size-3.5 shrink-0" />
              {p.when}
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 @3xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <PatternMain pattern={p} days={data.days} />
        <div className="flex flex-col gap-4">
          <PatternQuestion pattern={p} />
          <PatternTopics pattern={p} />
          <nav aria-label="Other patterns" className="flex items-center justify-between gap-2">
            {prev ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/patterns/$patternId" params={{ patternId: prev.id }}>
                  <ChevronLeft aria-hidden="true" />
                  Previous
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft aria-hidden="true" />
                Previous
              </Button>
            )}
            <span className="text-sm text-muted-foreground tabular-nums">
              {idx + 1} of {list.length}
            </span>
            {next ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/patterns/$patternId" params={{ patternId: next.id }}>
                  Next
                  <ChevronRight aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Next
                <ChevronRight aria-hidden="true" />
              </Button>
            )}
          </nav>
        </div>
      </div>

      <p className="max-w-prose text-sm text-muted-foreground">
        These are patterns from your data, not instructions. Nothing here changes your pump. Your
        care team decides if any setting changes.
      </p>
    </div>
  )
}
