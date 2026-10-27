import { useSuspenseQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useState } from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Label } from '#/components/ui/label'
import { ScrollArea, ScrollBar } from '#/components/ui/scroll-area'
import { Separator } from '#/components/ui/separator'
import { Switch } from '#/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '#/components/ui/tooltip'
import type { HeatCell } from '#/lib/glucose/analysis'
import { WEEKDAY_LONG, WEEKDAY_SHORT, shortDate } from '#/lib/glucose/format'
import { heatmapQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'

import { hourLabel } from './clusters'
import { Legend, LegendItem } from './legend'

type Mode = 'below' | 'above'

const MODES: Record<
  Mode,
  { key: 'below39' | 'above10'; word: string; prefix: 'hb' | 'ha'; labels: string[]; step: (v: number) => number }
> = {
  below: {
    key: 'below39',
    word: 'below 3.9',
    prefix: 'hb',
    labels: ['0%', 'under 5%', '5 to 9%', '10 to 19%', '20% or more'],
    step: (v) => (v === 0 ? 0 : v < 5 ? 1 : v < 10 ? 2 : v < 20 ? 3 : 4),
  },
  above: {
    key: 'above10',
    word: 'above 10.0',
    prefix: 'ha',
    labels: ['under 20%', '20 to 34%', '35 to 49%', '50 to 64%', '65% or more'],
    step: (v) => (v < 20 ? 0 : v < 35 ? 1 : v < 50 ? 2 : v < 65 ? 3 : 4),
  },
}

const HOURS = Array.from({ length: 24 }, (_, h) => h)

function stepStyle(mode: Mode, step: number) {
  if (step === 0) return { background: 'var(--muted)', color: 'var(--foreground)' }
  return {
    background: `var(--${MODES[mode].prefix}-${step})`,
    color: step >= 3 ? 'var(--hink-hi)' : 'var(--foreground)',
  }
}

const pctText = (v: number) => `${Math.round(v)}%`

export function WeekMapCard() {
  const { data } = useSuspenseQuery(heatmapQuery)
  const [mode, setMode] = useState<Mode>('below')
  const [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useState<{ d: number; h: number } | null>(null)

  const m = MODES[mode]
  const cells = data?.cells ?? []
  const sel = selected ? cells[selected.d]?.[selected.h] : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Week map</CardTitle>
        <CardDescription>
          Each square is one hour on one weekday
          {data ? `, ${shortDate(data.from)} to ${shortDate(data.to)}` : ''}. Tap a square for the number.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={mode}
          aria-label="Show"
          onValueChange={(v) => {
            if (v) setMode(v as Mode)
          }}
        >
          <ToggleGroupItem value="below">
            <ArrowDown />
            Below 3.9
          </ToggleGroupItem>
          <ToggleGroupItem value="above">
            <ArrowUp />
            Above 10.0
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="@container min-w-0">
          <ScrollArea className="w-full">
            <div
              role="group"
              aria-label={`Share of readings ${m.word} by weekday and hour`}
              className={cn(
                'grid gap-px pb-3 sm:gap-0.5',
                showAll ? 'min-w-[720px] grid-cols-[2.25rem_repeat(24,minmax(1.5rem,1fr))]' : 'grid-cols-[2.25rem_repeat(24,minmax(0.6rem,1fr))]',
              )}
            >
              <div aria-hidden="true" className="sticky left-0 z-10 bg-card" />
              {HOURS.map((h) => (
                <div key={h} aria-hidden="true" className="overflow-visible text-[10px] whitespace-nowrap text-muted-foreground tabular-nums">
                  {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
                </div>
              ))}
              {WEEKDAY_SHORT.map((day, d) => (
                <Row
                  key={day}
                  d={d}
                  row={cells[d] ?? []}
                  mode={mode}
                  showAll={showAll}
                  selected={selected?.d === d ? selected.h : null}
                  onSelect={(h) => setSelected({ d, h })}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        <p aria-live="polite" className="min-h-5 text-sm">
          {selected && sel ? (
            <>
              <span className="font-semibold">
                {WEEKDAY_LONG[selected.d]}, {hourLabel(selected.h)} to {hourLabel(selected.h + 1)}:
              </span>{' '}
              {sel.n ? `${pctText(sel[m.key])} of readings ${m.word} (${sel.n} readings).` : 'no readings.'}
            </>
          ) : (
            <span className="text-muted-foreground">Tap or hover a square to see its number.</span>
          )}
        </p>

        <Legend>
          {m.labels.map((l, i) => (
            <LegendItem key={l} swatch={stepStyle(mode, i)}>
              {l}
            </LegendItem>
          ))}
          <LegendItem swatch={{}} className="border border-dashed border-muted-foreground/40">
            No readings
          </LegendItem>
        </Legend>

        <p className="text-sm">{mapCaption(cells, mode)}</p>

        <Separator />
        <div className="flex items-start gap-3">
          <Switch id="heat-nums" checked={showAll} onCheckedChange={setShowAll} className="mt-0.5" />
          <div className="grid gap-1">
            <Label htmlFor="heat-nums">Show numbers in all squares</Label>
            <p className="text-xs text-muted-foreground">Wider squares with the percentage in each one.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Row({
  d,
  row,
  mode,
  showAll,
  selected,
  onSelect,
}: {
  d: number
  row: HeatCell[]
  mode: Mode
  showAll: boolean
  selected: number | null
  onSelect: (h: number) => void
}) {
  const m = MODES[mode]
  return (
    <>
      <div
        className={cn(
          'sticky left-0 z-10 flex items-center bg-card text-xs font-semibold',
          d >= 5 && 'underline decoration-border underline-offset-3',
        )}
      >
        {WEEKDAY_SHORT[d]}
      </div>
      {HOURS.map((h) => {
        const c = row[h]
        const empty = !c || c.n === 0
        const v = empty ? 0 : c[m.key]
        const label = `${WEEKDAY_LONG[d]}, ${hourLabel(h)} to ${hourLabel(h + 1)}`
        const text = empty ? 'No readings' : `${pctText(v)} of readings ${m.word}`
        const isSel = selected === h
        return (
          <Tooltip key={h}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`${label}: ${text}`}
                aria-pressed={isSel}
                onClick={() => onSelect(h)}
                className={cn(
                  'grid h-6 min-w-0 place-items-center rounded-[3px] text-[9.5px] font-bold tabular-nums outline-none',
                  'hover:ring-2 hover:ring-foreground focus-visible:ring-2 focus-visible:ring-foreground',
                  isSel && 'ring-2 ring-foreground',
                  empty && 'border border-dashed border-muted-foreground/40',
                )}
                style={empty ? undefined : stepStyle(mode, m.step(v))}
              >
                {empty ? null : (
                  <span aria-hidden="true" className={cn(showAll || isSel ? 'inline' : 'hidden @2xl:inline')}>
                    {Math.round(v)}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="font-medium">{label}</div>
              <div>{text}</div>
              {empty ? null : <div className="opacity-80">{c.n} readings</div>}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </>
  )
}

function mapCaption(cells: HeatCell[][], mode: Mode) {
  const m = MODES[mode]
  let best: { d: number; h: number; v: number } | null = null
  cells.forEach((row, d) =>
    row.forEach((c, h) => {
      if (c.n && (!best || c[m.key] > best.v)) best = { d, h, v: c[m.key] }
    }),
  )
  const b = best as { d: number; h: number; v: number } | null
  if (!b) return 'There are no readings for these days yet.'
  if (b.v === 0) return `No readings were ${m.word} in these days.`
  return `The most time ${m.word} is on ${WEEKDAY_LONG[b.d]}s from ${hourLabel(b.h)} to ${hourLabel(b.h + 1)}, with ${pctText(b.v)} of readings.`
}
