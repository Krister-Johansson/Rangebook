import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, getRouteApi } from '@tanstack/react-router'
import { ArrowDown, ChevronRight, Info, Lightbulb, NotebookPen, Stethoscope } from 'lucide-react'

import { KindBadge } from '#/components/glucose/band'
import { ExcludeSwitch } from '#/components/log/exclude-switch'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { TARGETS } from '#/lib/glucose/core'
import type { Pattern } from '#/lib/glucose/patterns'
import { patternsQuery, prefsQuery } from '#/lib/queries'

import { StrengthMeter } from './pattern-card'
import { SavedCount, SavedMark, SavedQuestionsCard } from './saved-questions'

const routeApi = getRouteApi('/patterns')

/** Lows first, then highs and routines, keeping the order within each group. */
export function orderPatterns(patterns: Pattern[]) {
  return [...patterns.filter((p) => p.kind === 'low'), ...patterns.filter((p) => p.kind !== 'low')]
}

function PatternRow({ p }: { p: Pattern }) {
  return (
    <li>
      <Link
        to="/patterns/$patternId"
        params={{ patternId: p.id }}
        className="flex items-center gap-3 rounded-lg px-2 py-3 text-foreground no-underline transition-colors duration-(--dur-press) hover:bg-accent active:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <KindBadge kind={p.kind} />
            <StrengthMeter level={p.strength} compact />
            <SavedMark patternId={p.id} />
          </span>
          <span className="font-semibold leading-snug">{p.title}</span>
          <span className="text-sm text-muted-foreground">{p.when}</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  )
}

function Group({ label, items }: { label: string; items: Pattern[] }) {
  if (!items.length) return null
  return (
    <section aria-label={label} className="flex flex-col gap-1">
      <h2 className="px-2 text-xs font-bold text-muted-foreground">{label}</h2>
      <ul className="flex flex-col divide-y">
        {items.map((p) => (
          <PatternRow key={p.id} p={p} />
        ))}
      </ul>
    </section>
  )
}

function PatternList() {
  const { data } = useSuspenseQuery(patternsQuery)
  const { data: prefs } = useSuspenseQuery(prefsQuery)
  if (!data) return null
  const lows = data.patterns.filter((p) => p.kind === 'low')
  const rest = data.patterns.filter((p) => p.kind !== 'low')

  return (
    <div className="flex flex-col gap-4">
      {data.lowsOverTarget ? (
        <Alert role="note">
          <ArrowDown aria-hidden="true" />
          <AlertTitle>Lows are listed first</AlertTitle>
          <AlertDescription>
            Time below 3.9 is {data.below39.toFixed(1)}%, over the {TARGETS.below39}% target, so
            lows come before highs. Clinics usually look at it in the same order.
          </AlertDescription>
        </Alert>
      ) : null}

      {prefs.excludeNotNormal && data.leftOutDays > 0 ? (
        <Alert role="note">
          <Info aria-hidden="true" />
          <AlertTitle>
            {data.leftOutDays} not-normal {data.leftOutDays === 1 ? 'day is' : 'days are'} left out
          </AlertTitle>
          <AlertDescription>
            <p>
              Days tagged in your life log are skipped here.{' '}
              <Link to="/log" className="font-medium text-foreground underline underline-offset-2">
                Open the life log
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {data.patterns.length ? (
        <Card className="py-3">
          <CardContent className="flex flex-col gap-4 px-2 sm:px-4">
            <Group label="Lows" items={lows} />
            <Group label="Highs and routines" items={rest} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>No repeating patterns found</h2>
            </CardTitle>
            <CardDescription>
              Nothing happened at the same time on enough days in the last {data.days} days to
              show here.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card className="py-4">
        <CardContent className="flex flex-col gap-3 px-4 sm:px-6">
          <ExcludeSwitch />
          <Link
            to="/log"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium underline underline-offset-2"
          >
            <NotebookPen aria-hidden="true" className="size-4" />
            Life log
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

function ClinicTab() {
  return (
    <div className="flex flex-col gap-4">
      <SavedQuestionsCard />
      <Alert role="note">
        <Stethoscope aria-hidden="true" />
        <AlertTitle>Your care team decides changes</AlertTitle>
        <AlertDescription>
          These questions come from patterns in your data. They are not instructions, and nothing
          here changes your pump.
        </AlertDescription>
      </Alert>
    </div>
  )
}

export function PatternsView() {
  const { data } = useSuspenseQuery(patternsQuery)
  const { tab } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  if (!data) return null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-[22px] leading-tight font-bold tracking-tight">Patterns</h1>
      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { tab: v as 'list' | 'clinic' }, replace: true })}
        className="gap-3"
      >
        <TabsList aria-label="Patterns view">
          <TabsTrigger value="list">
            <Lightbulb aria-hidden="true" />
            Patterns ({data.patterns.length})
          </TabsTrigger>
          <TabsTrigger value="clinic">
            <Stethoscope aria-hidden="true" />
            For clinic <SavedCount />
          </TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="flex flex-col gap-4">
          <p className="max-w-[62ch] text-muted-foreground">
            Things that happen at the same time on many days, from the last {data.days} days. Tap
            one for the chart and a question for your care team.
          </p>
          <PatternList />
        </TabsContent>
        <TabsContent value="clinic">
          <ClinicTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
