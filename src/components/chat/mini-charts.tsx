import { Area, ComposedChart, Line, ReferenceArea, ReferenceLine, XAxis, YAxis } from 'recharts'

import { ChartContainer } from '#/components/ui/chart'
import type { ChartConfig } from '#/components/ui/chart'
import { Legend, LegendItem } from '#/components/trends/legend'
import { clock } from '#/lib/glucose/format'

// Small charts for answers in the chat. Same colors as the full charts on
// Trends and Day, smaller and without tooltips; each card links to the page.

const TICKS = [0, 6, 12, 18, 24]
const tick = (h: number) => (h === 24 ? '24:00' : clock(h))

const xAxis = {
  dataKey: 'x',
  type: 'number' as const,
  domain: [0, 24],
  ticks: TICKS,
  interval: 'preserveStartEnd' as const,
  tickFormatter: tick,
  tickLine: false,
  axisLine: false,
  tickMargin: 4,
  allowDataOverflow: true,
}

const yAxis = (top: number) => ({
  type: 'number' as const,
  domain: [2, top],
  ticks: [3.9, 10],
  tickFormatter: (v: number) => v.toFixed(1),
  width: 30,
  tickLine: false,
  axisLine: false,
  allowDataOverflow: true,
})

export interface ProfileHour {
  hour: number
  readings: number
  p25: number
  median: number
  p75: number
}

const typicalConfig = {
  median: { label: 'Median', color: 'var(--foreground)' },
  iqr: { label: 'Middle half', color: 'var(--agp-iqr)' },
} satisfies ChartConfig

/** Typical day from get_hourly_profile: the median line and the middle half of readings. */
export function MiniTypicalDay({ hours }: { hours: ProfileHour[] }) {
  const ok = hours.filter((h) => h.readings > 0)
  const row = (x: number, hs: ProfileHour[]) => {
    const good = hs.filter((h) => h && h.readings > 0)
    if (!good.length) return { x, median: null, iqr: null }
    const avg = (k: 'p25' | 'median' | 'p75') => good.reduce((n, h) => n + h[k], 0) / good.length
    return { x, median: avg('median'), iqr: [avg('p25'), avg('p75')] as [number, number] }
  }
  const at = (h: number) => hours.find((x) => x.hour === h)
  const edge = [at(23), at(0)].filter((h): h is ProfileHour => !!h)
  const data = [row(0, edge), ...hours.map((h) => row(h.hour + 0.5, [h])), row(24, edge)]
  const top = Math.max(15, Math.ceil(Math.max(0, ...ok.map((h) => h.p75)) + 1))
  const lowest = ok.reduce<ProfileHour | null>((m, h) => (!m || h.median < m.median ? h : m), null)
  const highest = ok.reduce<ProfileHour | null>((m, h) => (!m || h.median > m.median ? h : m), null)
  const summary =
    lowest && highest
      ? `Median lowest at ${clock(lowest.hour)} (${lowest.median.toFixed(1)}), highest at ${clock(highest.hour)} (${highest.median.toFixed(1)}).`
      : ''

  return (
    <div className="grid gap-2">
      <ChartContainer
        config={typicalConfig}
        className="aspect-auto h-40 w-full"
        role="img"
        aria-label={`Typical day: median glucose by hour with the middle half of readings. ${summary}`}
      >
        <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
          <ReferenceArea y1={3.9} y2={10} fill="var(--target-wash)" fillOpacity={1} ifOverflow="hidden" />
          <Area dataKey="iqr" type="monotone" stroke="none" fill="var(--color-iqr)" fillOpacity={1} isAnimationActive={false} activeDot={false} />
          <ReferenceLine y={3.9} stroke="var(--band-in)" strokeWidth={1.25} />
          <ReferenceLine y={10} stroke="var(--band-in)" strokeWidth={1.25} />
          <Line dataKey="median" type="monotone" stroke="var(--color-median)" strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false} />
          <XAxis {...xAxis} />
          <YAxis {...yAxis(top)} />
        </ComposedChart>
      </ChartContainer>
      <Legend>
        <LegendItem shape="line" swatch={{ background: 'var(--foreground)' }}>
          Median
        </LegendItem>
        <LegendItem swatch={{ background: 'var(--agp-iqr)' }}>Middle half of readings</LegendItem>
        <LegendItem swatch={{ background: 'var(--target-wash)', boxShadow: 'inset 0 0 0 1.5px var(--band-in)' }}>
          In range
        </LegendItem>
      </Legend>
    </div>
  )
}

export interface DayPoint {
  time: string
  mmol: number
}

const toHours = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) + (m || 0) / 60
}

const dayConfig = { v: { label: 'Glucose', color: 'var(--foreground)' } } satisfies ChartConfig

/** One day from get_day: glucose every 15 minutes, with pump stops shaded. */
export function MiniDayChart({ points, stops }: { points: DayPoint[]; stops: { from: string; to: string }[] }) {
  const data: { x: number; v: number | null }[] = []
  let prev: number | null = null
  for (const p of points) {
    const x = toHours(p.time)
    // Break the line where readings are missing for more than 45 minutes.
    if (prev !== null && x - prev > 0.75) data.push({ x: (x + prev) / 2, v: null })
    data.push({ x, v: p.mmol })
    prev = x
  }
  const values = points.map((p) => p.mmol)
  const top = Math.max(15, Math.ceil(Math.max(0, ...values) + 1))
  const lowest = values.length ? Math.min(...values) : null
  const highest = values.length ? Math.max(...values) : null

  return (
    <div className="grid gap-2">
      <ChartContainer
        config={dayConfig}
        className="aspect-auto h-40 w-full"
        role="img"
        aria-label={`Glucose through the day.${lowest !== null && highest !== null ? ` Lowest ${lowest.toFixed(1)}, highest ${highest.toFixed(1)}.` : ''}${stops.length ? ` ${stops.length} pump ${stops.length === 1 ? 'stop' : 'stops'}.` : ''}`}
      >
        <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
          <ReferenceArea y1={3.9} y2={10} fill="var(--target-wash)" fillOpacity={1} ifOverflow="hidden" />
          {stops.map((s) => (
            <ReferenceArea
              key={`${s.from}-${s.to}`}
              x1={toHours(s.from)}
              x2={toHours(s.to) || 24}
              fill="var(--muted-foreground)"
              fillOpacity={0.18}
              ifOverflow="hidden"
            />
          ))}
          <ReferenceLine y={3.9} stroke="var(--band-in)" strokeWidth={1.25} />
          <ReferenceLine y={10} stroke="var(--band-in)" strokeWidth={1.25} />
          <Line dataKey="v" type="monotone" stroke="var(--color-v)" strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false} connectNulls={false} />
          <XAxis {...xAxis} />
          <YAxis {...yAxis(top)} />
        </ComposedChart>
      </ChartContainer>
      <Legend>
        <LegendItem shape="line" swatch={{ background: 'var(--foreground)' }}>
          Glucose
        </LegendItem>
        {stops.length ? (
          <LegendItem swatch={{ background: 'color-mix(in oklab, var(--muted-foreground) 18%, transparent)' }}>
            Pump stopped
          </LegendItem>
        ) : null}
        <LegendItem swatch={{ background: 'var(--target-wash)', boxShadow: 'inset 0 0 0 1.5px var(--band-in)' }}>
          In range
        </LegendItem>
      </Legend>
    </div>
  )
}
