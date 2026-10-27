import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'

import { Legend, LegendItem } from '#/components/trends/legend'
import { ChartContainer, ChartTooltip } from '#/components/ui/chart'
import type { ChartConfig } from '#/components/ui/chart'
import type { CompareSide } from '#/lib/glucose/changes'
import { clock, f1 } from '#/lib/glucose/format'

const config = {
  beforeMid: { label: 'Before, median', color: 'var(--act)' },
  beforeBand: { label: 'Before, middle half', color: 'var(--act-wash)' },
  afterMid: { label: 'After, median', color: 'var(--foreground)' },
  afterBand: { label: 'After, middle half', color: 'var(--agp-iqr)' },
} satisfies ChartConfig

type Hour = CompareSide['profile'][number]

interface Row {
  x: number
  hour: number
  beforeMid: number | null
  beforeBand: [number, number] | null
  afterMid: number | null
  afterBand: [number, number] | null
}

const ok = (h: Hour | undefined): h is Hour => !!h && Number.isFinite(h.p50) && h.p50 > 0

function point(hs: (Hour | undefined)[]) {
  const good = hs.filter(ok)
  if (!good.length) return { mid: null, band: null }
  const avg = (k: 'p25' | 'p50' | 'p75') => good.reduce((n, h) => n + h[k], 0) / good.length
  return { mid: avg('p50'), band: [avg('p25'), avg('p75')] as [number, number] }
}

function toRows(before: Hour[], after: Hour[]): Row[] {
  const at = (x: number, hour: number, b: (Hour | undefined)[], a: (Hour | undefined)[]): Row => {
    const pb = point(b)
    const pa = point(a)
    return { x, hour, beforeMid: pb.mid, beforeBand: pb.band, afterMid: pa.mid, afterBand: pa.band }
  }
  const byHour = (hs: Hour[], h: number) => hs.find((x) => x.hour === h)
  const edge = (hs: Hour[]) => [byHour(hs, 23), byHour(hs, 0)]
  return [
    at(0, 0, edge(before), edge(after)),
    ...Array.from({ length: 24 }, (_, h) => at(h + 0.5, h, [byHour(before, h)], [byHour(after, h)])),
    at(24, 23, edge(before), edge(after)),
  ]
}

const TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24]

/** Typical day before and after a change: medians as lines, middle halves as bands. */
export function CompareAgp({ before, after }: { before: Hour[]; after: Hour[] }) {
  const rows = toRows(before, after)
  const highs = [...before, ...after].filter(ok).map((h) => h.p75)
  const top = Math.max(16, Math.ceil(Math.max(0, ...highs) + 1))

  return (
    <div className="grid gap-3">
      <ChartContainer
        config={config}
        className="aspect-auto h-56 w-full sm:h-68"
        role="figure"
        aria-label="Typical day before and after the change: median and middle half of readings by hour. Use the arrow keys for each hour."
      >
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <ReferenceArea y1={3.9} y2={10} fill="var(--target-wash)" fillOpacity={1} zIndex={10} ifOverflow="hidden" />
          <Area
            dataKey="beforeBand"
            type="monotone"
            stroke="var(--act)"
            strokeOpacity={0.5}
            strokeDasharray="4 3"
            fill="var(--color-beforeBand)"
            fillOpacity={1}
            isAnimationActive={false}
            activeDot={false}
            zIndex={30}
          />
          <Area
            dataKey="afterBand"
            type="monotone"
            stroke="none"
            fill="var(--color-afterBand)"
            fillOpacity={0.55}
            isAnimationActive={false}
            activeDot={false}
            zIndex={40}
          />
          <ReferenceLine y={3.9} stroke="var(--band-in)" strokeWidth={1.5} zIndex={50} />
          <ReferenceLine y={10} stroke="var(--band-in)" strokeWidth={1.5} zIndex={50} />
          <Line
            dataKey="beforeMid"
            type="monotone"
            stroke="var(--color-beforeMid)"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            activeDot={{ r: 4, fill: 'var(--act)', stroke: 'var(--card)', strokeWidth: 2 }}
            isAnimationActive={false}
            zIndex={60}
          />
          <Line
            dataKey="afterMid"
            type="monotone"
            stroke="var(--color-afterMid)"
            strokeWidth={2.25}
            dot={false}
            activeDot={{ r: 4.5, fill: 'var(--foreground)', stroke: 'var(--card)', strokeWidth: 2 }}
            isAnimationActive={false}
            zIndex={61}
          />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, 24]}
            ticks={TICKS}
            interval="preserveStartEnd"
            minTickGap={12}
            tickFormatter={(h: number) => (h === 24 ? '24:00' : clock(h))}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
          />
          <YAxis
            type="number"
            domain={[2, top]}
            ticks={[3.9, 10, 13.9]}
            tickFormatter={(v: number) => v.toFixed(1)}
            width={34}
            tickLine={false}
            axisLine={false}
            allowDataOverflow
          />
          <ChartTooltip
isAnimationActive={false}
            cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
            content={(p) => <CompareTip {...p} />}
          />
        </ComposedChart>
      </ChartContainer>
      <Legend>
        <LegendItem
          shape="line"
          swatch={{ background: 'repeating-linear-gradient(90deg, var(--act) 0 5px, transparent 5px 8px)' }}
        >
          Before, median (dashed)
        </LegendItem>
        <LegendItem swatch={{ background: 'var(--act-wash)', boxShadow: 'inset 0 0 0 1px var(--act)' }}>
          Before, middle half
        </LegendItem>
        <LegendItem shape="line" swatch={{ background: 'var(--foreground)' }}>
          After, median
        </LegendItem>
        <LegendItem swatch={{ background: 'var(--agp-iqr)' }}>After, middle half</LegendItem>
        <LegendItem swatch={{ background: 'var(--target-wash)', boxShadow: 'inset 0 0 0 1.5px var(--band-in)' }}>
          Target 3.9 to 10.0
        </LegendItem>
      </Legend>
    </div>
  )
}

function CompareTip({ active, payload }: Pick<TooltipContentProps, 'active' | 'payload'>) {
  const row = payload?.[0]?.payload as Row | undefined
  if (!active || !row) return null
  return (
    <div className="grid min-w-40 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">
        {clock(row.hour)} to {clock(row.hour + 1)}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Median before</dt>
        <dd className="text-right font-mono tabular-nums">{row.beforeMid === null ? 'none' : f1(row.beforeMid)}</dd>
        <dt className="text-muted-foreground">Median after</dt>
        <dd className="text-right font-mono tabular-nums">{row.afterMid === null ? 'none' : f1(row.afterMid)}</dd>
      </dl>
    </div>
  )
}
