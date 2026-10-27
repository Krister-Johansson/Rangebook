import { Link } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import { CalendarDays, ChartSpline, ChevronRight, GitCompareArrows, Lightbulb } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { RangeBar } from '#/components/changes/range-bar'
import { BandSwatch, KindBadge } from '#/components/glucose/band'
import { StrengthMeter } from '#/components/patterns/pattern-card'
import { PatternChart } from '#/components/patterns/pattern-chart'
import { SaveQuestionButton } from '#/components/patterns/saved-questions'
import type { Band } from '#/lib/glucose/core'
import { longDate, perDay, rangeLabel } from '#/lib/glucose/format'
import type { PatternChart as PatternChartData } from '#/lib/glucose/patterns'

import { MiniDayChart, MiniTypicalDay } from './mini-charts'
import type { DayPoint, ProfileHour } from './mini-charts'
import type { CardKind } from './tool-info'
import { dayMonth } from './tool-info'

// Cards inside answers, drawn from tool results the app computed. The model
// never supplies these numbers.

function CardShell({
  icon: Icon,
  label,
  open,
  openLabel = 'Open',
  children,
}: {
  icon: LucideIcon
  label: string
  open?: LinkProps
  openLabel?: string
  children: ReactNode
}) {
  return (
    <section
      aria-label={label}
      className="flex min-w-0 flex-col gap-2.5 rounded-xl border bg-background p-3 text-sm leading-normal dark:bg-[color-mix(in_oklab,var(--background)_55%,var(--card))]"
    >
      <div className="-mt-0.5 -mr-1 flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-bold text-muted-foreground">
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
        {open ? (
          <Link
            {...open}
            className="inline-flex min-h-7 shrink-0 items-center gap-0.5 rounded-md py-1 pr-1 pl-2 text-xs font-semibold text-foreground no-underline transition-colors duration-(--dur-press) hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {openLabel}
            <ChevronRight aria-hidden="true" className="size-3.5" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  )
}

interface SummaryPct {
  very_low_below_3_0: number
  low_3_0_to_3_8: number
  in_range_3_9_to_10_0: number
  high_10_1_to_13_9: number
  very_high_above_13_9: number
}

interface Summary {
  from: string
  to: string
  pct: SummaryPct
  sensor_wear_pct: number
}

const bands = (p: SummaryPct): Record<Band, number> => ({
  vlow: p.very_low_below_3_0 ?? 0,
  low: p.low_3_0_to_3_8 ?? 0,
  in: p.in_range_3_9_to_10_0 ?? 0,
  high: p.high_10_1_to_13_9 ?? 0,
  vhigh: p.very_high_above_13_9 ?? 0,
})

function MiniStat({ band, value, label }: { band: Band; value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <BandSwatch band={band} />
      <span className="font-semibold tabular-nums">{value.toFixed(1)}%</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  )
}

function PeriodCard({ s }: { s: Summary }) {
  const p = bands(s.pct)
  const label = rangeLabel(s.from, s.to)
  return (
    <CardShell icon={CalendarDays} label={label} open={{ to: '/trends' }} openLabel="Trends">
      <div className="flex items-end gap-3">
        <span className="text-[32px] leading-none font-extrabold tracking-tight tabular-nums">{Math.round(p.in)}%</span>
        <span className="text-xs leading-snug text-muted-foreground">
          in range, 3.9 to 10.0
          <br />
          about {perDay(p.in)} a day
        </span>
      </div>
      <RangeBar pct={p} label={label} className="h-[22px]" />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <MiniStat band="low" value={p.vlow + p.low} label="below 3.9" />
        <MiniStat band="high" value={p.high + p.vhigh} label="above 10.0" />
        <span className="text-muted-foreground">Sensor worn {s.sensor_wear_pct.toFixed(1)}%</span>
      </div>
    </CardShell>
  )
}

function BarRow({ title, sub, pct }: { title: string; sub?: string; pct: Record<Band, number> }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2.5">
      <span className="flex min-w-0 flex-col text-xs leading-tight font-semibold">
        {title}
        {sub ? <span className="text-[10.5px] font-medium text-muted-foreground">{sub}</span> : null}
      </span>
      <RangeBar pct={pct} label={sub ? `${title}, ${sub}` : title} className="h-5" />
    </div>
  )
}

function CompareCard({ a, b }: { a: Summary; b: Summary }) {
  const [first, second] = a.from <= b.from ? [a, b] : [b, a]
  const below = (s: Summary) => s.pct.very_low_below_3_0 + s.pct.low_3_0_to_3_8
  return (
    <CardShell icon={GitCompareArrows} label="Two periods side by side" open={{ to: '/trends' }} openLabel="Trends">
      <div className="flex flex-col gap-2">
        <BarRow title="Earlier" sub={rangeLabel(first.from, first.to)} pct={bands(first.pct)} />
        <BarRow title="Later" sub={rangeLabel(second.from, second.to)} pct={bands(second.pct)} />
      </div>
      <p className="text-xs text-muted-foreground">
        Lows first: below 3.9 was {below(first).toFixed(1)}% earlier and {below(second).toFixed(1)}% later.
      </p>
    </CardShell>
  )
}

function TypicalCard({ out }: { out: { from?: string; to?: string; hours: ProfileHour[] } }) {
  const label = out.from && out.to ? `Typical day, ${rangeLabel(out.from, out.to)}` : 'Typical day'
  return (
    <CardShell icon={ChartSpline} label={label} open={{ to: '/trends' }} openLabel="Trends">
      <MiniTypicalDay hours={out.hours} />
    </CardShell>
  )
}

interface ToolPattern {
  id: string
  kind: 'low' | 'high' | 'routine'
  evidence_strength: 1 | 2 | 3
  title: string
  evidence: string
  question_for_care_team: string
  chart: PatternChartData
}

function PatternCard({ p, days }: { p: ToolPattern; days: number }) {
  return (
    <CardShell
      icon={Lightbulb}
      label={`Pattern, last ${days} days`}
      open={{ to: '/patterns/$patternId', params: { patternId: p.id } }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <KindBadge kind={p.kind} />
        <StrengthMeter level={p.evidence_strength} compact />
      </div>
      <p className="-mt-0.5 text-[14.5px] leading-snug font-bold">{p.title}</p>
      <p className="text-[13px] text-muted-foreground">{p.evidence}</p>
      {p.chart ? (
        <div className="min-w-0 rounded-lg bg-muted/55 p-2.5">
          <PatternChart chart={p.chart} />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <SaveQuestionButton patternId={p.id} question={p.question_for_care_team} />
      </div>
    </CardShell>
  )
}

function PatternsCards({ out }: { out: { from?: string; to?: string; patterns: ToolPattern[] } }) {
  const days =
    out.from && out.to ? Math.round((Date.parse(out.to) - Date.parse(out.from)) / 86_400_000) + 1 : 90
  const shown = out.patterns.slice(0, 2)
  const more = out.patterns.length - shown.length
  return (
    <>
      {shown.map((p) => (
        <PatternCard key={p.id} p={p} days={days} />
      ))}
      {more > 0 ? (
        <Link
          to="/patterns"
          className="-mt-1 inline-flex w-fit items-center gap-0.5 rounded-md text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {more} more {more === 1 ? 'pattern' : 'patterns'} in Patterns
        </Link>
      ) : null}
    </>
  )
}

interface ChangeSide {
  from: string
  to: string
  label: string
  pct: Record<Band, number>
  below39: number
  wear: number
  lowsPerWeek: number
}

interface ChangeOut {
  change: { id: string; day: string }
  before: ChangeSide
  after: ChangeSide
  days: 7 | 14 | 21
  warnings?: string[]
  otherChanges?: string | null
}

function ChangeCard({ out }: { out: ChangeOut }) {
  const { before, after } = out
  const days = [7, 14, 21].includes(out.days) ? out.days : 14
  return (
    <CardShell
      icon={GitCompareArrows}
      label={`${dayMonth(out.change.day)} change, ${days} days on each side`}
      open={{ to: '/trends/changes/$changeId', params: { changeId: out.change.id }, search: { days } }}
    >
      <p className="font-semibold">
        Lows first: below 3.9 was {before.below39.toFixed(1)}% before and {after.below39.toFixed(1)}% after.
      </p>
      <div className="flex flex-col gap-2">
        <BarRow title="Before" sub={before.label} pct={before.pct} />
        <BarRow title="After" sub={after.label} pct={after.pct} />
      </div>
      <p className="text-xs text-muted-foreground">
        Lows per week {before.lowsPerWeek.toFixed(1)} before, {after.lowsPerWeek.toFixed(1)} after. Sensor worn{' '}
        {before.wear.toFixed(1)}% before, {after.wear.toFixed(1)}% after.
      </p>
      {out.otherChanges || out.warnings?.length ? (
        <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-muted-foreground">
          {out.otherChanges ? <li>{out.otherChanges}</li> : null}
          {(out.warnings ?? []).slice(0, 2).map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
    </CardShell>
  )
}

interface DayOut {
  date: string
  glucose_every_15_min: DayPoint[]
  pump_stops?: { from: string; to: string }[]
}

function DayCard({ out }: { out: DayOut }) {
  return (
    <CardShell icon={CalendarDays} label={longDate(out.date)} open={{ to: '/day', search: { date: out.date } }}>
      <MiniDayChart points={out.glucose_every_15_min} stops={out.pump_stops ?? []} />
    </CardShell>
  )
}

/** The card for one tool result. `kind` comes from cardFor, which checked the shape. */
export function ResultCard({ kind, output }: { kind: CardKind; output: unknown }) {
  // Shapes were checked by cardFor; these casts only name them.
  const out = output as never
  switch (kind) {
    case 'period':
      return <PeriodCard s={out} />
    case 'compare': {
      const { a, b } = output as { a: Summary; b: Summary }
      return <CompareCard a={a} b={b} />
    }
    case 'typical':
      return <TypicalCard out={out} />
    case 'patterns':
      return <PatternsCards out={out} />
    case 'change':
      return <ChangeCard out={out} />
    case 'day':
      return <DayCard out={out} />
  }
}
