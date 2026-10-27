import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight, GitCompareArrows, Info, Repeat, Stethoscope } from 'lucide-react'

import { BandSwatch } from '#/components/glucose/band'
import { SectionCard } from '#/components/home/section-card'
import { BackHead } from '#/components/more/page-head'
import { PatternChart } from '#/components/patterns/pattern-chart'
import { SaveQuestionButton } from '#/components/patterns/saved-questions'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { WEEKDAY_LONG, WEEKDAY_SHORT, f1, shortDate } from '#/lib/glucose/format'
import { activityDays } from '#/lib/glucose/lifelog'
import type { ActivityComparison, LogEntry } from '#/lib/glucose/lifelog'
import { activityComparisonQuery, dataRangeQuery, prefsQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'

import { ExcludeSwitch } from './exclude-switch'
import { ByChip, DeleteEntry, activitySchedule } from './parts'

const fmtPct = (v: number) => `${v < 10 ? v.toFixed(1) : Math.round(v)}%`

/** Two horizontal bars: the activity days in the low color, other days muted. */
function RowBars({ row, name }: { row: ActivityComparison['rows'][number]; name: string }) {
  const max = Math.max(row.withPct, row.withoutPct, 1)
  const bar = (label: string, value: number, low: boolean) => (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_3.25rem] items-center gap-2 text-sm">
      <span className={cn('truncate', !low && 'text-muted-foreground')}>{label}</span>
      <span className="h-3 overflow-hidden rounded-sm bg-muted" aria-hidden="true">
        <span
          className={cn('block h-full rounded-sm', low ? 'band-fill-low' : '')}
          style={{
            width: `${(value / max) * 100}%`,
            backgroundColor: low ? 'var(--band-low)' : 'var(--agp-iqr)',
          }}
        />
      </span>
      <span className={cn('text-right tabular-nums', low && 'font-semibold')}>{fmtPct(value)}</span>
    </div>
  )
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-sm font-medium">{row.label}</div>
      {bar(name, row.withPct, true)}
      {bar('Other days', row.withoutPct, false)}
    </div>
  )
}

function Comparison({ a, c }: { a: LogEntry; c: ActivityComparison }) {
  const name = a.text
  const lower = name.toLowerCase()
  const few = c.daysWith < 4

  return (
    <SectionCard
      title="Compared with other days"
      icon={GitCompareArrows}
      description={`The same hours on ${c.daysWith} ${c.daysWith === 1 ? 'day' : 'days'} with ${lower} and ${c.daysWithout} other days.`}
      contentClassName="flex flex-col gap-5"
    >
      <ExcludeSwitch id="activity-exclude" />

      {c.daysWith === 0 ? (
        <p className="text-sm text-muted-foreground">
          There is no sensor data yet on days with {lower}. The comparison shows up after the next
          import that covers those days.
        </p>
      ) : (
        <>
          <section aria-label="Time below 3.9" className="flex flex-col gap-4">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <BandSwatch band="low" />
              Time below 3.9
            </h3>
            {c.rows.map((r) => (
              <RowBars key={r.label} row={r} name={name} />
            ))}
          </section>

          <p className="text-sm">
            {c.lowsMoreCommon
              ? `Lows are more common on ${lower} days, during ${lower} or the night after.`
              : `Lows are not more common on ${lower} days than on other days, during ${lower} or the night after.`}
          </p>

          <figure className="m-0 flex min-w-0 flex-col gap-1.5 rounded-lg bg-muted/55 p-3">
            <PatternChart
              chart={{
                type: 'pairedBars',
                band: 'low',
                metric: 'below 3.9',
                aLabel: 'Other nights',
                bLabel: `After ${lower}`,
                data: c.night.map((n) => ({ hour: n.hour, a: n.withoutPct, b: n.withPct })),
              }}
            />
            <figcaption className="text-[13px]">The night after, time below 3.9 by hour.</figcaption>
          </figure>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th scope="col" className="text-left font-medium">
                  <span className="sr-only">Measure</span>
                </th>
                <th scope="col" className="px-2 text-right font-medium">
                  {name}
                </th>
                <th scope="col" className="text-right font-medium">
                  Other days
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="py-1 text-left font-normal text-muted-foreground">
                  Median overnight, mmol/L
                </th>
                <td className="px-2 text-right font-semibold tabular-nums">
                  {c.medianWith === null ? 'No data' : f1(c.medianWith)}
                </td>
                <td className="text-right tabular-nums">
                  {c.medianWithout === null ? 'No data' : f1(c.medianWithout)}
                </td>
              </tr>
            </tbody>
          </table>

          {few ? (
            <p className="text-sm text-muted-foreground">
              Only {c.daysWith} {c.daysWith === 1 ? 'day' : 'days'} with {lower} so far. One or two
              unusual days can move this a lot.
            </p>
          ) : null}
        </>
      )}
    </SectionCard>
  )
}

function Schedule({ a }: { a: LogEntry }) {
  const navigate = useNavigate()
  const { data: range } = useQuery(dataRangeQuery)
  const lastDay = range
    ? activityDays(a, a.startDate, range.lastDay).filter((d) => d >= range.firstDay).at(-1)
    : undefined
  const on = new Set(a.weekdays ?? [])

  return (
    <SectionCard title="Schedule" icon={Repeat} action={<ByChip author={a.author} />} contentClassName="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-1.5" aria-label="Weekdays">
        {WEEKDAY_SHORT.map((d, i) => (
          <li
            key={d}
            className={cn(
              'grid h-8 min-w-11 place-items-center rounded-md border px-1.5 text-xs font-semibold',
              on.has(i) ? 'border-act bg-act-wash text-foreground' : 'text-muted-foreground',
            )}
          >
            <span aria-hidden="true">{d}</span>
            <span className="sr-only">
              {WEEKDAY_LONG[i]}: {on.has(i) ? 'yes' : 'no'}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        Shown as a shaded band on the day chart and the typical day, and as outlined squares on the
        week map.
      </p>
      <div className="flex flex-wrap gap-2">
        {lastDay ? (
          <Button variant="outline" size="sm" asChild>
            <Link to="/day" search={{ date: lastDay }}>
              See {shortDate(lastDay)}
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
        <DeleteEntry
          id={a.id}
          what={`the activity ${a.text}`}
          withLabel
          onDeleted={() => navigate({ to: '/log' })}
        />
      </div>
    </SectionCard>
  )
}

export function ActivityView({ id }: { id: number }) {
  const { data: prefs } = useSuspenseQuery(prefsQuery)
  const { data } = useSuspenseQuery(activityComparisonQuery(id, prefs.excludeNotNormal))

  if (!data) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <BackHead back="Life log" backTo={{ to: '/log' }} title="Activity not found" />
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>This activity is not in the life log</h2>
            </CardTitle>
            <CardDescription>It may have been deleted, or there is no data imported yet.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const { activity: a, comparison: c } = data
  return (
    <div className="@container mx-auto flex w-full max-w-5xl flex-col gap-4">
      <BackHead
        back="Life log"
        backTo={{ to: '/log' }}
        title={a.text}
        sub={`${activitySchedule(a)}. Every week from ${shortDate(a.startDate)}${a.endDate ? ` to ${shortDate(a.endDate)}` : ''}.`}
      />
      <div className="grid grid-cols-1 items-start gap-4 @3xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Comparison a={a} c={c} />
        <div className="flex flex-col gap-4">
          {c.question ? (
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <Stethoscope aria-hidden="true" className="size-3.5" />
                Question for the care team
              </div>
              <p className="mb-3 text-[15px] leading-normal font-medium">{c.question}</p>
              <SaveQuestionButton patternId={`activity-${a.id}`} question={c.question} />
            </div>
          ) : (
            <Alert role="note">
              <Info aria-hidden="true" />
              <AlertTitle>No question for now</AlertTitle>
              <AlertDescription>
                A question for your care team shows up here when lows look more common on these days.
              </AlertDescription>
            </Alert>
          )}
          <Schedule a={a} />
        </div>
      </div>
    </div>
  )
}
