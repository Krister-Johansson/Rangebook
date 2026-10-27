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

import { ChartContainer, ChartTooltip } from '#/components/ui/chart'
import type { ChartConfig } from '#/components/ui/chart'
import type { HourProfile } from '#/lib/glucose/analysis'
import { f1 } from '#/lib/glucose/format'

import type { Cluster } from './clusters'
import { hourLabel } from './clusters'

const config = {
  p50: { label: 'Median', color: 'var(--foreground)' },
  iqr: { label: 'Middle half (25 to 75%)', color: 'var(--agp-iqr)' },
  outer: { label: 'Most readings (5 to 95%)', color: 'var(--agp-outer)' },
} satisfies ChartConfig

interface Row {
  x: number
  hour: number
  p50: number | null
  iqr: [number, number] | null
  outer: [number, number] | null
}

function rowFrom(x: number, hour: number, hs: HourProfile[]): Row {
  const ok = hs.filter((h) => h.n > 0)
  if (!ok.length) return { x, hour, p50: null, iqr: null, outer: null }
  const avg = (k: keyof HourProfile) => ok.reduce((n, h) => n + h[k], 0) / ok.length
  return {
    x,
    hour,
    p50: avg('p50'),
    iqr: [avg('p25'), avg('p75')],
    outer: [avg('p5'), avg('p95')],
  }
}

/** One point per hour at the half hour, plus midnight edges so the bands run 00 to 24. */
function toRows(hours: HourProfile[]): Row[] {
  const edge = [hours[23], hours[0]]
  return [
    rowFrom(0, 0, edge),
    ...hours.map((h) => rowFrom(h.hour + 0.5, h.hour, [h])),
    rowFrom(24, 23, edge),
  ]
}

const TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24]
const Y_TICKS = [3.9, 10, 13.9]

export function AgpChart({
  hours,
  clusters,
  showOuter,
}: {
  hours: HourProfile[]
  clusters: Cluster[]
  showOuter: boolean
}) {
  const rows = toRows(hours)
  const top = Math.max(16, Math.ceil(Math.max(...hours.filter((h) => h.n).map((h) => h.p95), 0) + 1))

  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-60 w-full sm:h-72"
      role="figure"
      aria-label="Typical day: median glucose by hour with the spread of readings. Use the arrow keys for each hour."
    >
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <ReferenceArea y1={3.9} y2={10} fill="var(--target-wash)" fillOpacity={1} zIndex={10} ifOverflow="hidden" />
        {clusters.map((c) => (
          <ReferenceArea
            key={c.label}
            x1={c.from}
            x2={c.to}
            fill={c.kind === 'low' ? 'var(--marker-low)' : 'var(--marker-high)'}
            fillOpacity={1}
            zIndex={45}
            label={(props: { viewBox?: unknown }) => (
              <ColumnLabel viewBox={props.viewBox} text={c.kind === 'low' ? 'Lows' : 'Highs'} />
            )}
          />
        ))}
        {showOuter ? (
          <Area
            dataKey="outer"
            type="monotone"
            stroke="none"
            fill="var(--color-outer)"
            fillOpacity={1}
            isAnimationActive={false}
            activeDot={false}
            zIndex={30}
          />
        ) : null}
        <Area
          dataKey="iqr"
          type="monotone"
          stroke="none"
          fill="var(--color-iqr)"
          fillOpacity={1}
          isAnimationActive={false}
          activeDot={false}
          zIndex={40}
        />
        <ReferenceLine y={3.9} stroke="var(--band-in)" strokeWidth={1.5} zIndex={50} />
        <ReferenceLine y={10} stroke="var(--band-in)" strokeWidth={1.5} zIndex={50} />
        <Line
          dataKey="p50"
          type="monotone"
          stroke="var(--color-p50)"
          strokeWidth={2.25}
          dot={false}
          activeDot={{ r: 4.5, fill: 'var(--foreground)', stroke: 'var(--card)', strokeWidth: 2 }}
          isAnimationActive={false}
          zIndex={60}
        />
        <XAxis
          dataKey="x"
          type="number"
          domain={[0, 24]}
          ticks={TICKS}
          interval="preserveStartEnd"
          minTickGap={12}
          tickFormatter={(h: number) => hourLabel(h)}
          tickLine={false}
          axisLine={false}
          tickMargin={6}
        />
        <YAxis
          type="number"
          domain={[2, top]}
          ticks={Y_TICKS}
          tickFormatter={(v: number) => v.toFixed(1)}
          width={34}
          tickLine={false}
          axisLine={false}
          allowDataOverflow
        />
        <ChartTooltip
          cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
          content={(props) => <AgpTooltip {...props} hours={hours} />}
        />
      </ComposedChart>
    </ChartContainer>
  )
}

/** Label a shaded column only when it is wide enough to hold the word. */
function ColumnLabel({ viewBox, text }: { viewBox?: unknown; text: string }) {
  const box = viewBox as { x?: number; y?: number; width?: number } | undefined
  if (!box || box.x == null || box.y == null || !box.width || box.width < 34) return null
  return (
    <text
      x={box.x + box.width / 2}
      y={box.y + 14}
      textAnchor="middle"
      fill="var(--foreground)"
      fontSize={11}
      fontWeight={700}
    >
      {text}
    </text>
  )
}

function AgpTooltip({
  active,
  payload,
  hours,
}: Pick<TooltipContentProps, 'active' | 'payload'> & { hours: HourProfile[] }) {
  const row = payload?.[0]?.payload as Row | undefined
  if (!active || !row) return null
  const h = hours[row.hour]
  return (
    <div className="grid min-w-44 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">
        {hourLabel(h.hour)} to {hourLabel(h.hour + 1)}
      </div>
      {h.n === 0 ? (
        <div className="text-muted-foreground">No readings in this hour</div>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <TipRow label="Median" value={`${f1(h.p50)} mmol/L`} />
          <TipRow label="Middle half" value={`${f1(h.p25)} to ${f1(h.p75)}`} />
          <TipRow label="Most readings" value={`${f1(h.p5)} to ${f1(h.p95)}`} />
          <TipRow label="Below 3.9" value={`${h.below39.toFixed(1)}%`} />
          <TipRow label="Above 10.0" value={`${h.above10.toFixed(1)}%`} />
          <TipRow label="Readings" value={h.n.toLocaleString('en')} />
        </dl>
      )}
    </div>
  )
}

function TipRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono font-medium tabular-nums">{value}</dd>
    </>
  )
}
