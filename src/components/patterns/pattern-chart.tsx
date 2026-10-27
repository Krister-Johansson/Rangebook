import { Bar, BarChart, Cell, LabelList, ReferenceLine, XAxis, YAxis } from 'recharts'

import { BandSwatch, bandVar } from '#/components/glucose/band'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '#/components/ui/chart'
import type { ChartConfig } from '#/components/ui/chart'
import { clock } from '#/lib/glucose/format'
import type { PatternChart as PatternChartData } from '#/lib/glucose/patterns'
import { cn } from '#/lib/utils'

// Neutral fill for bars that are not the point of the chart.
const MUTED = 'var(--agp-iqr)'

type HourBars = Extract<PatternChartData, { type: 'hourBars' }>
type PairedBars = Extract<PatternChartData, { type: 'pairedBars' }>
type UnitDots = Extract<PatternChartData, { type: 'unitDots' }>

const hourLabel = (h: number) => String(h).padStart(2, '0')
const hourRange = (h: number) => `${clock(h)} to ${clock(h + 1)}`
const fmtPct = (v: number) => `${v < 10 ? v.toFixed(1) : Math.round(v)}%`

function hourFromPayload(payload: unknown): number | null {
  const first = Array.isArray(payload) ? payload[0] : undefined
  const hour = first?.payload?.hour
  return typeof hour === 'number' ? hour : null
}

export function PatternChart({ chart }: { chart: PatternChartData }) {
  if (chart.type === 'hourBars') return <HourBarsChart chart={chart} />
  if (chart.type === 'pairedBars') return <PairedBarsChart chart={chart} />
  return <UnitDotsChart chart={chart} />
}

function HourBarsChart({ chart }: { chart: HourBars }) {
  const config = {
    value: { label: chart.metric, color: bandVar(chart.band) },
  } satisfies ChartConfig
  const data = chart.data.map((d) => ({
    ...d,
    label: hourLabel(d.hour),
    top: d.highlight ? fmtPct(d.value) : '',
  }))
  const max = Math.max(...data.map((d) => d.value), chart.refLine?.value ?? 0, 1)

  return (
    <>
      <ChartContainer config={config} className="aspect-auto h-36 w-full">
        <BarChart
          data={data}
          margin={{ top: 18, right: chart.refLine ? 64 : 4, bottom: 0, left: 4 }}
          accessibilityLayer
        >
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            tickMargin={6}
            interval={0}
          />
          <YAxis hide domain={[0, max * 1.15]} />
          <ChartTooltip
isAnimationActive={false}
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const h = hourFromPayload(payload)
                  return h === null ? null : hourRange(h)
                }}
                formatter={(value, _name, item) => (
                  <div className="flex items-center gap-2">
                    {item.payload?.highlight ? <BandSwatch band={chart.band} /> : null}
                    <span className="font-mono font-medium tabular-nums">
                      {fmtPct(Number(value))}
                    </span>
                    <span className="text-muted-foreground">{chart.metric}</span>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="value" radius={4} maxBarSize={24} isAnimationActive={false}>
            {data.map((d) => (
              <Cell
                key={d.hour}
                fill={d.highlight ? 'var(--color-value)' : MUTED}
                className={d.highlight ? `band-fill-${chart.band}` : undefined}
              />
            ))}
            <LabelList
              dataKey="top"
              position="top"
              className="fill-foreground font-medium"
              fontSize={11}
            />
          </Bar>
          {chart.refLine ? (
            <ReferenceLine
              y={chart.refLine.value}
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              ifOverflow="extendDomain"
              label={{
                value: chart.refLine.label,
                position: 'right',
                fill: 'var(--muted-foreground)',
                fontSize: 11,
              }}
            />
          ) : null}
        </BarChart>
      </ChartContainer>
      <p className="sr-only">
        {data.map((d) => `${hourRange(d.hour)}: ${fmtPct(d.value)}`).join('. ')}
      </p>
    </>
  )
}

function PairedBarsChart({ chart }: { chart: PairedBars }) {
  const config = {
    a: { label: chart.aLabel, color: MUTED },
    b: { label: chart.bLabel, color: bandVar(chart.band) },
  } satisfies ChartConfig
  const data = chart.data.map((d) => ({ ...d, label: hourLabel(d.hour) }))
  const max = Math.max(...data.flatMap((d) => [d.a, d.b]), 1)

  return (
    <>
      <ChartContainer config={config} className="aspect-auto h-44 w-full">
        <BarChart data={data} margin={{ top: 0, right: 4, bottom: 0, left: 4 }} barGap={2} accessibilityLayer>
          <ChartLegend
            verticalAlign="top"
            content={<ChartLegendContent className="justify-start" />}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            tickMargin={6}
            interval={0}
          />
          <YAxis hide domain={[0, max * 1.1]} />
          <ChartTooltip
isAnimationActive={false}
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const h = hourFromPayload(payload)
                  return h === null ? null : hourRange(h)
                }}
                formatter={(value, name, item) => (
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-mono font-medium tabular-nums">
                      {fmtPct(Number(value))}
                    </span>
                    <span className="text-muted-foreground">
                      {name === 'a' ? chart.aLabel : chart.bLabel}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="a" fill="var(--color-a)" radius={3} maxBarSize={14} isAnimationActive={false} />
          <Bar
            dataKey="b"
            fill="var(--color-b)"
            radius={3}
            maxBarSize={14}
            isAnimationActive={false}
            className={`band-fill-${chart.band}`}
          />
        </BarChart>
      </ChartContainer>
      <p className="sr-only">
        {data
          .map(
            (d) =>
              `${hourRange(d.hour)}: ${chart.aLabel} ${fmtPct(d.a)}, ${chart.bLabel} ${fmtPct(d.b)}`,
          )
          .join('. ')}
      </p>
    </>
  )
}

function UnitDotsChart({ chart }: { chart: UnitDots }) {
  const small = chart.total > 40
  const dot = small ? 'size-2.5' : 'size-4'
  return (
    <div>
      <div
        role="img"
        aria-label={`${chart.filledLabel}. ${chart.emptyLabel}.`}
        className={cn('flex flex-wrap py-2', small ? 'gap-1' : 'gap-1.5')}
      >
        {Array.from({ length: chart.total }, (_, i) =>
          i < chart.filled ? (
            <span
              key={i}
              className={cn(dot, 'rounded-full', `band-fill-${chart.band}`)}
              style={{ backgroundColor: bandVar(chart.band) }}
            />
          ) : (
            <span
              key={i}
              className={cn(dot, 'rounded-full')}
              style={{ boxShadow: `inset 0 0 0 2px ${MUTED}` }}
            />
          ),
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <BandSwatch band={chart.band} className="rounded-full" />
          {chart.filledLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full"
            style={{ boxShadow: `inset 0 0 0 2px ${MUTED}` }}
          />
          {chart.emptyLabel}
        </span>
      </div>
    </div>
  )
}
