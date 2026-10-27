import { BandSwatch, bandVar } from '#/components/glucose/band'
import { Badge } from '#/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '#/components/ui/tooltip'
import type { PeriodSummary } from '#/lib/glucose/analysis'
import { BANDS, TARGETS } from '#/lib/glucose/core'
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
  return (
    <SectionCard
      title="Time in ranges"
      description={`This week, ${thisWeek.label}`}
      action={<Badge variant="outline">mmol/L</Badge>}
      className={className}
      contentClassName="flex flex-col gap-4"
    >
      {W.n === 0 ? (
        <p className="text-sm text-muted-foreground">
          There are no sensor readings from this week yet.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-0.5">
            <div className="text-[34px] leading-none font-extrabold tracking-tight sm:text-[40px]">
              {perDay(W.pct.in)}
            </div>
            <div className="text-sm text-muted-foreground">
              in range per day ({W.pct.in.toFixed(1)}% of readings, 3.9 to 10.0)
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[74px_minmax(0,1fr)] items-center gap-2.5">
              <span className="text-xs font-semibold">This week</span>
              <TirBar pct={W.pct} label="This week" size="lg" />
            </div>
            {hasLast ? (
              <div className="grid grid-cols-[74px_minmax(0,1fr)] items-center gap-2.5">
                <span className="text-xs font-semibold text-muted-foreground">Last week</span>
                <TirBar pct={L.pct} label="Last week" size="sm" />
              </div>
            ) : null}
            <div
              aria-hidden="true"
              className="ml-[84px] flex justify-between text-[11px] text-muted-foreground"
            >
              <span>Below range</span>
              <span>Above range</span>
            </div>
          </div>

          <p className="text-sm">{compareSentence(thisWeek, lastWeek)}</p>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-0">Range</TableHead>
                <TableHead className="text-right">This week</TableHead>
                <TableHead className="pr-0 text-right">Last week</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BANDS.map((b) => (
                <TableRow key={b.key} className={cn(b.key === 'in' && 'font-bold')}>
                  <TableCell className="pl-0">
                    <div className="flex items-center gap-2.5 leading-tight">
                      <BandSwatch band={b.key} className="size-3" />
                      <div>
                        <div>{b.label}</div>
                        <div className="text-xs font-normal text-muted-foreground">{b.range}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <div>{W.pct[b.key].toFixed(1)}%</div>
                    <div className="text-xs font-medium text-muted-foreground">
                      {perDay(W.pct[b.key])} a day
                    </div>
                  </TableCell>
                  <TableCell className="pr-0 text-right text-muted-foreground tabular-nums">
                    {hasLast ? `${L.pct[b.key].toFixed(1)}%` : 'No data'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <p className="text-xs text-muted-foreground">
            Each 1% is about 15 minutes a day. Clinic targets: over {TARGETS.inRange}% in range,
            under {TARGETS.below39}% below 3.9, under {TARGETS.below30}% below 3.0.
          </p>
        </>
      )}
    </SectionCard>
  )
}
