import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Link, getRouteApi } from '@tanstack/react-router'
import { ArrowDown, ChevronLeft, Info, SlidersHorizontal, Stethoscope, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { BandSwatch } from '#/components/glucose/band'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import type { CompareSide } from '#/lib/glucose/changes'
import { BANDS } from '#/lib/glucose/core'
import { f1, shortDate } from '#/lib/glucose/format'
import { notNormalDays } from '#/lib/glucose/lifelog'
import { changeComparisonQuery, lifeLogQuery, prefsQuery, settingsTimelineQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'
import { setPref } from '#/server/preferences'

import { CompareAgp } from './compare-agp'
import { RangeBar } from './range-bar'
import { SaveForClinicButton } from './save-question'
import { AuthorChip, ExportChip, WhatChangedTable, changeSummary } from './what-changed'

const routeApi = getRouteApi('/trends_/changes/$changeId')

const pct1 = (v: number) => `${v.toFixed(1)}%`
// Lows first, like at clinic.
const BANDS_LOW_FIRST = [...BANDS].reverse()

function BackLink() {
  return (
    <Button variant="ghost" size="sm" asChild className="-ml-2 justify-self-start">
      <Link to="/trends" search={{ tab: 'changes' }}>
        <ChevronLeft aria-hidden="true" />
        Changes
      </Link>
    </Button>
  )
}

export function ChangeView() {
  const { changeId } = routeApi.useParams()
  const { days } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const { data } = useSuspenseQuery(changeComparisonQuery(changeId, days))
  const { data: timeline } = useSuspenseQuery(settingsTimelineQuery)
  const { data: prefs } = useSuspenseQuery(prefsQuery)
  const { data: log } = useSuspenseQuery(lifeLogQuery)
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  if (!data) {
    return (
      <div className="mx-auto grid w-full max-w-4xl min-w-0 gap-4">
        <BackLink />
        <Card>
          <CardHeader>
            <CardTitle>This change is not in the data</CardTitle>
            <CardDescription>
              It may belong to another person, or a newer import found the changes in a different way.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const { change, comparison: cmp } = data
  const B = cmp.before
  const A = cmp.after
  const item = timeline.find((t) => t.id === change.id)
  const tagged = [...notNormalDays(log)].filter((d) => d >= B.from && d <= A.to).length
  const leftOut = B.daysLeftOut + A.daysLeftOut
  const wentDown = A.below39 < B.below39 - 0.5

  const setExclude = async (v: boolean) => {
    setSaving(true)
    try {
      await setPref({ data: { excludeNotNormal: v } })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['prefs'] }),
        queryClient.invalidateQueries({ queryKey: ['glucose'] }),
      ])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change this setting')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl min-w-0 gap-4">
      <div className="grid gap-1">
        <BackLink />
        <h1 className="text-2xl font-bold tracking-tight">Before and after {shortDate(change.day)}</h1>
        <p className="text-sm text-muted-foreground">
          {changeSummary(change.rows)}, found in the export at {change.ts.slice(11, 16)}.
        </p>
      </div>

      <div className="grid min-w-0 items-start gap-4 md:grid-cols-2">
        <div className="grid min-w-0 gap-4">
          <Card>
            <CardContent className="grid gap-4">
              <div className="grid gap-1.5">
                <span id="cmp-days" className="text-sm font-medium">
                  Days on each side
                </span>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  aria-labelledby="cmp-days"
                  value={String(days)}
                  onValueChange={(v) => {
                    if (v) navigate({ search: { days: +v as 7 | 14 | 21 }, replace: true })
                  }}
                  className="justify-self-start"
                >
                  {[7, 14, 21].map((n) => (
                    <ToggleGroupItem key={n} value={String(n)}>
                      {n} days
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="font-semibold">Before</dt>
                <dd className="text-muted-foreground">
                  {B.label}, {B.days} {B.days === 1 ? 'day' : 'days'}
                </dd>
                <dt className="font-semibold">After</dt>
                <dd className="text-muted-foreground">
                  {A.label}, {A.days} {A.days === 1 ? 'day' : 'days'}
                </dd>
              </dl>
              <div className="flex items-start gap-3 border-t pt-4">
                <Switch
                  id="cmp-exclude"
                  checked={prefs.excludeNotNormal}
                  disabled={saving}
                  onCheckedChange={setExclude}
                  className="mt-0.5"
                />
                <div className="grid gap-1">
                  <Label htmlFor="cmp-exclude">Leave out not-normal days</Label>
                  <p className="text-xs text-muted-foreground">
                    {prefs.excludeNotNormal
                      ? leftOut
                        ? `${leftOut} tagged ${leftOut === 1 ? 'day is' : 'days are'} left out. This also applies to patterns.`
                        : 'No tagged days in these days. This also applies to patterns.'
                      : tagged
                        ? `${tagged} ${tagged === 1 ? 'day' : 'days'} in these windows ${tagged === 1 ? 'is' : 'are'} tagged in your life log.`
                        : 'No tagged days in these windows.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {cmp.warnings.length ? (
            <ul aria-label="Things to keep in mind" className="grid gap-2">
              {cmp.warnings.map((w) => (
                <li
                  key={w}
                  className="flex items-start gap-2 rounded-lg border border-warn-line bg-warn-bg px-3 py-2 text-sm text-warn-ink"
                >
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDown className="size-4" aria-hidden="true" />
                Lows
              </CardTitle>
              <CardDescription>Lows first, like at clinic.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <CompareTable>
                <CompareRow label={<BandLabel band="low" text="Low, 3.0 to 3.8" />} a={pct1(B.pct.low)} b={pct1(A.pct.low)} />
                <CompareRow
                  label={<BandLabel band="vlow" text="Very low, below 3.0" />}
                  a={pct1(B.pct.vlow)}
                  b={pct1(A.pct.vlow)}
                />
                <CompareRow label="Lows per week" a={f1(B.lowsPerWeek)} b={f1(A.lowsPerWeek)} />
              </CompareTable>
              <p className={cn('text-sm', cmp.lowsUp && 'font-semibold')}>
                {cmp.lowsUp
                  ? `Lows went up after this change. Time below 3.9 went from ${pct1(B.below39)} to ${pct1(A.below39)}.`
                  : wentDown
                    ? `Time below 3.9 went down after this change, from ${pct1(B.below39)} to ${pct1(A.below39)}.`
                    : `Time below 3.9 was about the same on both sides, ${pct1(B.below39)} and ${pct1(A.below39)}.`}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-3 rounded-xl border bg-card p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Stethoscope className="size-3.5" aria-hidden="true" />
              Question for the care team
            </div>
            <p className="text-[14.5px] leading-normal font-medium">{cmp.question}</p>
            <div>
              <SaveForClinicButton patternId={`change-${change.id}`} question={cmp.question} />
            </div>
          </div>

          <Alert>
            <Info />
            <AlertTitle>Other things change at the same time</AlertTitle>
            <AlertDescription>
              {cmp.otherChanges ??
                'Growth, school, sport, illness and sensor gaps also move these numbers. A before and after shows what happened, not what caused it.'}
            </AlertDescription>
          </Alert>
        </div>

        <div className="grid min-w-0 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>All ranges</CardTitle>
              <CardDescription>Share of readings on each side.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-[3.25rem_1fr] items-center gap-x-3 gap-y-2 text-sm">
                <span className="text-muted-foreground">Before</span>
                <RangeBar pct={B.pct} label="Before" />
                <span className="font-semibold">After</span>
                <RangeBar pct={A.pct} label="After" />
              </div>
              <CompareTable>
                {BANDS_LOW_FIRST.map((b) => (
                  <CompareRow
                    key={b.key}
                    strong={b.key === 'in'}
                    label={
                      <BandLabel
                        band={b.key}
                        text={
                          <>
                            {b.label} <span className="text-xs text-muted-foreground">{b.range}</span>
                          </>
                        }
                      />
                    }
                    a={pct1(B.pct[b.key])}
                    b={pct1(A.pct[b.key])}
                  />
                ))}
                <CompareRow label="Average, mmol/L" a={f1(B.mean)} b={f1(A.mean)} />
                <CompareRow label="Sensor worn" a={<Wear side={B} />} b={<Wear side={A} />} />
              </CompareTable>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Typical day, before and after</CardTitle>
              <CardDescription>Median and middle half of readings, by hour. mmol/L.</CardDescription>
            </CardHeader>
            <CardContent>
              <CompareAgp before={B.profile} after={A.profile} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                What changed
              </CardTitle>
              <CardDescription>
                {shortDate(change.day)}, {change.ts.slice(11, 16)}. A record of what was set, not advice.
              </CardDescription>
              <CardAction>
                <ExportChip />
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-3">
              <WhatChangedTable rows={change.rows} />
              {item?.note ? (
                <div className="flex flex-wrap items-start gap-2 rounded-md bg-muted/60 px-2.5 py-2 text-sm">
                  <AuthorChip author={item.note.author} />
                  <span className="min-w-0 flex-1">{item.note.text}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Wear({ side }: { side: CompareSide }) {
  const low = side.wear < 70
  return (
    <span className={cn(low && 'font-semibold text-warn-ink')}>
      {pct1(Math.min(100, side.wear))}
      {low ? <span className="sr-only">, under 70%</span> : null}
    </span>
  )
}

function BandLabel({ band, text }: { band: (typeof BANDS)[number]['key']; text: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <BandSwatch band={band} />
      <span>{text}</span>
    </span>
  )
}

function CompareTable({ children }: { children: ReactNode }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th scope="col" className="py-1 text-left font-medium">
            <span className="sr-only">Measure</span>
          </th>
          <th scope="col" className="w-20 py-1 text-right font-medium">
            Before
          </th>
          <th scope="col" className="w-20 py-1 text-right font-medium">
            After
          </th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

function CompareRow({ label, a, b, strong }: { label: ReactNode; a: ReactNode; b: ReactNode; strong?: boolean }) {
  return (
    <tr className={cn('border-t', strong && 'bg-muted/50')}>
      <th scope="row" className="py-1.5 pr-2 text-left font-normal">
        {label}
      </th>
      <td className="py-1.5 text-right tabular-nums text-muted-foreground">{a}</td>
      <td className="py-1.5 text-right font-semibold tabular-nums">{b}</td>
    </tr>
  )
}
