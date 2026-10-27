import { useId } from 'react'
import type { ReactNode } from 'react'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '#/components/ui/tooltip'
import type { DayDetail } from '#/lib/glucose/analysis'
import { BANDS, bandOf } from '#/lib/glucose/core'
import { clock, f1, hm } from '#/lib/glucose/format'

// Every lane uses the same margins and y axis width so the hours line up.
const MARGIN = { top: 14, right: 8, bottom: 0, left: 0 }
const Y_WIDTH = 34
const TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24]
const Y_MIN = 2
const Y_MAX = 23
const GAP_BREAK = 0.2 // hours without a reading before the line breaks

const tickLabel = (h: number) => (h === 24 ? '24:00' : clock(h))

const xAxisProps = {
  dataKey: 't',
  type: 'number' as const,
  domain: [0, 24],
  ticks: TICKS,
  interval: 'preserveStartEnd' as const,
  minTickGap: 12,
  tickFormatter: tickLabel,
  tickLine: false,
  axisLine: false,
  tickMargin: 6,
  allowDataOverflow: true,
}

const config = {
  v: { label: 'Glucose', color: 'var(--foreground)' },
  rate: { label: 'Basal', color: 'var(--basal)' },
  units: { label: 'Bolus', color: 'var(--foreground)' },
} satisfies ChartConfig

type Reading = DayDetail['readings'][number]
type Bolus = DayDetail['boluses'][number]
type Basal = DayDetail['basal'][number]

interface Point {
  t: number
  v: number | null
  limit: Reading['limit']
}

const BAND_WORD: Record<string, string> = Object.fromEntries(BANDS.map((b) => [b.key, b.label.toLowerCase()]))

function suspendsOf(basal: Basal[]) {
  return basal.filter((b) => b.suspend && b.end - b.t >= 5 / 60)
}

function limitRuns(readings: Reading[], kind: 'low' | 'high') {
  const runs: { from: number; to: number }[] = []
  let cur: { from: number; to: number } | null = null
  for (const r of readings) {
    if (r.limit === kind) {
      if (cur && r.t - cur.to <= GAP_BREAK) cur.to = r.t
      else {
        if (cur) runs.push(cur)
        cur = { from: r.t, to: r.t }
      }
    }
  }
  if (cur) runs.push(cur)
  // Give single readings some width so they stay visible.
  return runs.map((r) => ({ from: Math.max(0, r.from - 0.1), to: Math.min(24, r.to + 0.1) }))
}

function toPoints(readings: Reading[]): Point[] {
  const out: Point[] = []
  readings.forEach((r, i) => {
    const prev = readings[i - 1]
    if (prev && r.t - prev.t > GAP_BREAK) out.push({ t: (prev.t + r.t) / 2, v: null, limit: null })
    out.push({ t: r.t, v: r.v, limit: r.limit })
  })
  return out
}

/** Hard color stops so the line takes the band color of each reading. */
function GlucoseGradient({ id, min, max }: { id: string; min: number; max: number }) {
  const span = max - min
  const at = (v: number) => Math.min(1, Math.max(0, (max - v) / span))
  const stops: [number, string][] = [
    [0, 'vhigh'],
    [at(13.9), 'vhigh'],
    [at(13.9), 'high'],
    [at(10), 'high'],
    [at(10), 'in'],
    [at(3.9), 'in'],
    [at(3.9), 'low'],
    [at(3.0), 'low'],
    [at(3.0), 'vlow'],
    [1, 'vlow'],
  ]
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      {stops.map(([o, b], i) => (
        <stop key={i} offset={o} stopColor={`var(--band-${b})`} />
      ))}
    </linearGradient>
  )
}

/** Draws the first text that fits inside a shaded area, or nothing. */
function FitLabel({
  viewBox,
  texts,
  at,
  muted,
}: {
  viewBox?: unknown
  texts: string[]
  at: 'center' | 'bottom'
  muted?: boolean
}) {
  const box = viewBox as { x?: number; y?: number; width?: number; height?: number } | undefined
  if (!box || box.x == null || box.y == null || !box.width || !box.height) return null
  const text = texts.find((t) => t.length * 6.4 + 8 <= box.width!)
  if (!text) return null
  return (
    <text
      x={box.x + box.width / 2}
      y={at === 'center' ? box.y + box.height / 2 : box.y + box.height - 6}
      textAnchor="middle"
      dominantBaseline={at === 'center' ? 'middle' : 'auto'}
      fill={muted ? 'var(--muted-foreground)' : 'var(--foreground)'}
      fontSize={11}
      fontWeight={muted ? 400 : 700}
    >
      {text}
    </text>
  )
}

function TipBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-w-36 gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{title}</div>
      {children}
    </div>
  )
}

export function GlucoseChart({ day }: { day: DayDetail }) {
  const uid = useId().replace(/:/g, '')
  const points = toPoints(day.readings)
  const values = day.readings.map((r) => r.v)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 0
  const flat = max - min < 0.05
  const stops = suspendsOf(day.basal)
  const hiRuns = limitRuns(day.readings, 'high')
  const loRuns = limitRuns(day.readings, 'low')
  const noData = day.readings.length === 0

  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-56 w-full sm:h-64"
      role="figure"
      aria-label={`Glucose readings for ${day.label}. Use the arrow keys to move between readings.`}
    >
      <ComposedChart data={noData ? [{ t: 0, v: null, limit: null }, { t: 24, v: null, limit: null }] : points} margin={MARGIN}>
        <defs>
          <GlucoseGradient id={`${uid}-g`} min={min} max={max} />
          <pattern id={`${uid}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--muted)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted-foreground)" strokeOpacity={0.5} strokeWidth={1.5} />
          </pattern>
        </defs>
        <ReferenceArea y1={3.9} y2={10} fill="var(--target-wash)" fillOpacity={1} zIndex={10} />
        {day.gaps.map((g) => (
          <ReferenceArea
            key={`gap-${g.from}`}
            x1={g.from}
            x2={g.to}
            fill="var(--muted)"
            fillOpacity={0.8}
            zIndex={15}
            label={(p: { viewBox?: unknown }) => (
              <FitLabel viewBox={p.viewBox} texts={['No sensor data', 'No data']} at="center" muted />
            )}
          />
        ))}
        {stops.map((s) => (
          <ReferenceArea
            key={`stop-${s.t}`}
            x1={s.t}
            x2={s.end}
            fill={`url(#${uid}-hatch)`}
            fillOpacity={1}
            stroke="var(--muted-foreground)"
            strokeOpacity={0.6}
            zIndex={20}
            label={(p: { viewBox?: unknown }) => (
              <FitLabel viewBox={p.viewBox} texts={['Pump stopped', 'Stopped']} at="bottom" />
            )}
          />
        ))}
        <ReferenceLine y={3.9} stroke="var(--band-in)" strokeWidth={1.5} zIndex={30} />
        <ReferenceLine y={10} stroke="var(--band-in)" strokeWidth={1.5} zIndex={30} />
        <ReferenceLine y={13.9} stroke="var(--border)" zIndex={30} />
        <ReferenceLine y={22.2} stroke="var(--border)" zIndex={30} />
        {hiRuns.map((r) => (
          <ReferenceArea
            key={`hi-${r.from}`}
            x1={r.from}
            x2={r.to}
            y1={22.2}
            y2={Y_MAX}
            fill="var(--band-vhigh)"
            fillOpacity={0.35}
            zIndex={35}
            label={{ value: 'HI', position: 'insideTop', fill: 'var(--foreground)', fontSize: 10, fontWeight: 700, offset: 1 }}
          />
        ))}
        {loRuns.map((r) => (
          <ReferenceArea
            key={`lo-${r.from}`}
            x1={r.from}
            x2={r.to}
            y1={Y_MIN}
            y2={2.6}
            fill="var(--band-vlow)"
            fillOpacity={0.35}
            zIndex={35}
            label={{ value: 'LO', position: 'insideBottom', fill: 'var(--foreground)', fontSize: 10, fontWeight: 700, offset: 1 }}
          />
        ))}
        <Line
          dataKey="v"
          type="linear"
          stroke={flat ? `var(--band-${bandOf(max)})` : `url(#${uid}-g)`}
          strokeWidth={2.25}
          strokeLinejoin="round"
          strokeLinecap="round"
          dot={false}
          activeDot={{ r: 4.5, fill: 'var(--foreground)', stroke: 'var(--card)', strokeWidth: 2 }}
          connectNulls={false}
          isAnimationActive={false}
          zIndex={50}
        />
        <XAxis {...xAxisProps} />
        <YAxis
          type="number"
          domain={[Y_MIN, Y_MAX]}
          ticks={[3.9, 10, 13.9, 22.2]}
          tickFormatter={(v: number) => v.toFixed(1)}
          width={Y_WIDTH}
          tickLine={false}
          axisLine={false}
          allowDataOverflow
        />
        {noData ? null : (
          <ChartTooltip
            cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
            content={(p) => <GlucoseTip {...p} stops={stops} />}
          />
        )}
      </ComposedChart>
    </ChartContainer>
  )
}

function GlucoseTip({
  active,
  payload,
  stops,
}: Pick<TooltipContentProps, 'active' | 'payload'> & { stops: Basal[] }) {
  const p = payload?.[0]?.payload as Point | undefined
  if (!active || !p) return null
  const stop = stops.find((s) => p.t >= s.t && p.t < s.end)
  let value = 'No reading'
  if (p.v != null) {
    if (p.limit === 'high') value = 'HI, above 22.2 (sensor limit)'
    else if (p.limit === 'low') value = 'LO, below the sensor limit'
    else value = `${f1(p.v)} mmol/L, ${BAND_WORD[bandOf(p.v)]}`
  }
  return (
    <TipBox title={p.v == null ? `Around ${clock(p.t)}` : clock(p.t)}>
      <div>{value}</div>
      {stop ? (
        <div className="text-muted-foreground">
          Pump stopped {clock(stop.t)} to {clock(stop.end)}
        </div>
      ) : null}
    </TipBox>
  )
}

// ---------------------------------------------------------------- lanes

const BOLUS_H = 96
const BOLUS_TOP = 18

const KIND_LABEL: Record<Bolus['kind'], string> = {
  carb: 'Bolus with carbs',
  manual: 'Bolus, no carbs entered',
  auto: 'Automatic correction (estimated)',
}

export function BolusLane({ boluses }: { boluses: Bolus[] }) {
  const maxU = Math.max(1, ...boluses.map((b) => b.units))
  const top = Math.ceil(maxU)
  const plotH = BOLUS_H - BOLUS_TOP
  const data = [...boluses].sort((a, b) => a.t - b.t)

  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full"
      style={{ height: BOLUS_H }}
      role="figure"
      aria-label="Boluses and carbs entered. Use the arrow keys to move between boluses."
    >
      <ComposedChart data={data} margin={{ ...MARGIN, top: BOLUS_TOP }}>
        <ReferenceLine y={0} stroke="var(--border)" />
        <Line
          dataKey="units"
          stroke="none"
          isAnimationActive={false}
          activeDot={false}
          dot={(props: { cx?: number; cy?: number; payload?: Bolus; index?: number }) => {
            const { cx = 0, cy = 0, payload: b, index } = props
            if (!b) return <g key={index} />
            const real = (b.units / top) * plotH
            const h = Math.max(3, real)
            const y = cy + real - h
            if (b.kind === 'auto') {
              return <rect key={index} x={cx - 1.5} y={y} width={3} height={h} rx={1} fill="var(--muted-foreground)" />
            }
            return (
              <g key={index}>
                <rect
                  x={cx - 4}
                  y={y}
                  width={8}
                  height={h}
                  rx={2}
                  fill={b.kind === 'carb' ? 'var(--foreground)' : 'var(--background)'}
                  stroke="var(--foreground)"
                  strokeWidth={b.kind === 'carb' ? 0 : 1.5}
                />
                {b.carbs > 0 ? (
                  <text x={cx} y={y - 4} textAnchor="middle" fontSize={10} fill="var(--foreground)">
                    {b.carbs} g
                  </text>
                ) : null}
              </g>
            )
          }}
        />
        <XAxis {...xAxisProps} hide />
        <YAxis type="number" domain={[0, top]} ticks={[top]} width={Y_WIDTH} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v} U`} />
        <ChartTooltip
          cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
          content={(p) => {
            const b = p.payload?.[0]?.payload as Bolus | undefined
            if (!p.active || !b) return null
            return (
              <TipBox title={clock(b.t)}>
                <div>{KIND_LABEL[b.kind]}</div>
                <div className="font-mono tabular-nums">
                  {b.units.toFixed(2)} U{b.carbs > 0 ? `, ${b.carbs} g carbs` : ''}
                </div>
              </TipBox>
            )
          }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}

interface BasalPoint {
  t: number
  rate: number | null
  suspend: boolean
}

function basalPoints(basal: Basal[]): BasalPoint[] {
  const out: BasalPoint[] = []
  const segs = [...basal].sort((a, b) => a.t - b.t)
  segs.forEach((s, i) => {
    const prev = segs[i - 1]
    if (prev && s.t - prev.end > 1 / 60) out.push({ t: prev.end, rate: null, suspend: false })
    out.push({ t: s.t, rate: s.suspend ? 0 : s.rate, suspend: s.suspend })
  })
  const last = segs[segs.length - 1]
  if (last) out.push({ t: last.end, rate: last.suspend ? 0 : last.rate, suspend: last.suspend })
  return out
}

export function BasalLane({ basal }: { basal: Basal[] }) {
  const uid = useId().replace(/:/g, '')
  const data = basalPoints(basal)
  const top = Math.max(1, Math.ceil(Math.max(0, ...basal.map((b) => b.rate)) * 2) / 2)
  const stops = suspendsOf(basal)

  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-24 w-full"
      role="figure"
      aria-label="Basal rate in units per hour, with pump stops"
    >
      <ComposedChart data={data} margin={MARGIN}>
        <defs>
          <pattern id={`${uid}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--muted)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted-foreground)" strokeOpacity={0.5} strokeWidth={1.5} />
          </pattern>
        </defs>
        {stops.map((s) => (
          <ReferenceArea
            key={`stop-${s.t}`}
            x1={s.t}
            x2={s.end}
            fill={`url(#${uid}-hatch)`}
            fillOpacity={1}
            stroke="var(--muted-foreground)"
            strokeOpacity={0.6}
            zIndex={20}
            label={(p: { viewBox?: unknown }) => (
              <FitLabel viewBox={p.viewBox} texts={['Pump stopped', 'Stopped']} at="center" />
            )}
          />
        ))}
        <Area
          dataKey="rate"
          type="stepAfter"
          fill="var(--color-rate)"
          fillOpacity={1}
          stroke="var(--muted-foreground)"
          strokeWidth={1}
          isAnimationActive={false}
          connectNulls={false}
          activeDot={false}
          zIndex={30}
        />
        <XAxis {...xAxisProps} />
        <YAxis
          type="number"
          domain={[0, top]}
          ticks={[0, top]}
          width={Y_WIDTH}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => String(v)}
        />
        <ChartTooltip
          cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
          content={(p) => {
            const b = p.payload?.[0]?.payload as BasalPoint | undefined
            if (!p.active || !b) return null
            return (
              <TipBox title={`From ${clock(b.t)}`}>
                <div>
                  {b.rate == null ? 'No basal data' : b.suspend ? 'Pump stopped' : `${b.rate.toFixed(2)} U/h basal`}
                </div>
              </TipBox>
            )
          }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}

/** Alarms and pump events as markers on the same hour scale. */
export function EventLane({ alarms }: { alarms: DayDetail['alarms'] }) {
  return (
    <div className="relative h-7" style={{ marginLeft: Y_WIDTH + MARGIN.left, marginRight: MARGIN.right }}>
      <div aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
      {alarms.map((a, i) => (
        <Tooltip key={`${a.t}-${i}`}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`${clock(a.t)}: ${a.label}`}
              className="absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ left: `${(a.t / 24) * 100}%` }}
            >
              <span className="block size-2.5 rotate-45 border-[1.5px] border-foreground bg-background" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {clock(a.t)}: {a.label}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

export function stopSummary(basal: Basal[]) {
  return suspendsOf(basal).map((s) => ({ t: s.t, end: s.end, label: `Pump stopped for ${hm(s.end - s.t)}` }))
}
