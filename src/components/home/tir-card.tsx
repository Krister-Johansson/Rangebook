import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'

import { BandSwatch, bandVar } from '#/components/glucose/band'
import { Button } from '#/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '#/components/ui/tooltip'
import type { PeriodSummary } from '#/lib/glucose/analysis'
import { BANDS } from '#/lib/glucose/core'
import type { Band } from '#/lib/glucose/core'
import { hm, perDay } from '#/lib/glucose/format'
import { cn } from '#/lib/utils'

import { SectionCard } from './section-card'

// Left to right: below range, in range, above range.
const LEFT_TO_RIGHT: Band[] = ['vlow', 'low', 'in', 'high', 'vhigh']
const BAND_INFO = Object.fromEntries(BANDS.map((b) => [b.key, b])) as Record<
  Band,
  (typeof BANDS)[number]
>

/** Horizontal stacked bar of the five ranges. Stripes apply through band-fill-*. */
function TirBar({
  pct,
  label,
  size,
}: {
  pct: Record<Band, number>
  label: string
  size: 'lg' | 'sm'
}) {
  const summary = LEFT_TO_RIGHT.map((k) => `${BAND_INFO[k].label} ${pct[k].toFixed(1)}%`).join(', ')
  return (
    <div
      role="img"
      aria-label={`${label}: ${summary}`}
      className={cn('flex gap-0.5 overflow-hidden rounded-md', size === 'lg' ? 'h-[30px]' : 'h-3')}
    >
      {LEFT_TO_RIGHT.filter((k) => pct[k] > 0).map((k) => (
        <Tooltip key={k}>
          <TooltipTrigger asChild>
            <div
              className={cn(
                `band-fill-${k}`,
                'flex min-w-[3px] basis-0 items-center justify-center hover:brightness-110',
              )}
              style={{ flexGrow: pct[k], backgroundColor: bandVar(k) }}
            >
              {size === 'lg' && k === 'in' && pct.in >= 10 ? (
                <span className="text-xs font-extrabold" style={{ color: 'var(--band-in-ink)' }}>
                  {Math.round(pct.in)}%
                </span>
              ) : null}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="font-semibold">{label}</div>
            <div>
              {BAND_INFO[k].label} ({BAND_INFO[k].range}): {pct[k].toFixed(1)}%, about {perDay(pct[k])} a
              day
            </div>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

function compareSentence(thisWeek: PeriodSummary, lastWeek: PeriodSummary) {
  if (!lastWeek.stats.n) return 'There are no readings from last week to compare with.'
  const diffMin = ((thisWeek.stats.pct.in - lastWeek.stats.pct.in) / 100) * 24 * 60
  const rounded = Math.round(Math.abs(diffMin) / 5) * 5
  if (diffMin >= 5) return `About ${hm(rounded / 60)} more in range per day than last week.`
  if (diffMin <= -5) return `About ${hm(rounded / 60)} less in range per day than last week.`
  return 'About the same time in range as last week.'
}

function DaysLink() {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link to="/trends" search={{ tab: 'days' }}>
        Days
        <ChevronRight />
      </Link>
    </Button>
  )
}

/** Compact time in ranges for Home: this week against last week. */
export function TirCard({
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
  const hasLast = L.n > 0
  const below = W.pct.vlow + W.pct.low
  const above = W.pct.high + W.pct.vhigh
  return (
    <SectionCard
      title="Time in ranges"
      description={`This week, ${thisWeek.label}`}
      action={<DaysLink />}
      className={className}
      contentClassName="flex flex-col gap-3"
    >
      {W.n === 0 ? (
        <p className="text-sm text-muted-foreground">
          There are no sensor readings from this week yet.
        </p>
      ) : (
        <>
          <div className="flex items-end gap-3">
            <div className="text-[34px] leading-none font-extrabold tracking-tight tabular-nums sm:text-[40px]">
              {Math.round(W.pct.in)}%
            </div>
            <div className="pb-0.5 text-xs leading-snug text-muted-foreground">
              in range, 3.9 to 10.0
              <br />
              about {perDay(W.pct.in)} a day
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[68px_minmax(0,1fr)] items-center gap-2.5">
              <span className="text-xs font-semibold">This week</span>
              <TirBar pct={W.pct} label="This week" size="lg" />
            </div>
            {hasLast ? (
              <div className="grid grid-cols-[68px_minmax(0,1fr)] items-center gap-2.5">
                <span className="text-xs font-semibold text-muted-foreground">Last week</span>
                <TirBar pct={L.pct} label="Last week" size="sm" />
              </div>
            ) : null}
          </div>

          <p className="text-sm">{compareSentence(thisWeek, lastWeek)}</p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <BandSwatch band="low" className="size-3" />
              <span className="font-semibold tabular-nums">{below.toFixed(1)}%</span>
              <span className="text-muted-foreground">below 3.9</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BandSwatch band="high" className="size-3" />
              <span className="font-semibold tabular-nums">{above.toFixed(1)}%</span>
              <span className="text-muted-foreground">above 10.0</span>
            </span>
          </div>
        </>
      )}
    </SectionCard>
  )
}
