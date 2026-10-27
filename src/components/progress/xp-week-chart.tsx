import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '#/components/ui/chart'
import type { ChartConfig } from '#/components/ui/chart'
import type { WeekXp } from '#/lib/glucose/game'

// One violet hue in four strengths (from the design), darkest first in light
// mode and lightest first in dark mode. The legend and tooltip name each
// source, so color is not the only signal.
const config = {
  sensor: { label: 'Sensor days', theme: { light: 'oklch(0.42 0.14 285)', dark: 'oklch(0.84 0.09 285)' } },
  carbs: { label: 'Boluses with carbs', theme: { light: 'oklch(0.58 0.15 285)', dark: 'oklch(0.7 0.13 285)' } },
  challenge: { label: 'Challenges', theme: { light: 'oklch(0.73 0.11 285)', dark: 'oklch(0.56 0.13 285)' } },
  bonus: { label: 'Badges and questions', theme: { light: 'oklch(0.86 0.06 285)', dark: 'oklch(0.42 0.09 285)' } },
} satisfies ChartConfig

const KEYS = ['sensor', 'carbs', 'challenge', 'bonus'] as const

interface Row {
  label: string
  tick: string
  title: string
  current: boolean
  sensorDays: number
  total: number
  sensor: number
  carbs: number
  challenge: number
  bonus: number
}

export const XP_WEEKS_SHOWN = 13

export function XpWeekChart({ weeks }: { weeks: WeekXp[] }) {
  const shown = weeks.slice(-XP_WEEKS_SHOWN)
  const rows: Row[] = shown.map((w, i) => {
    const month = w.label.split(' ')[1]
    const firstOfMonth = i === 0 || shown[i - 1].label.split(' ')[1] !== month
    return {
      label: w.label,
      tick: w.current ? 'Now' : firstOfMonth ? month : '',
      title: `Week of ${w.label}${w.current ? ', so far' : ''}`,
      current: w.current,
      sensorDays: w.sensorDays,
      total: w.total,
      sensor: w.sensor,
      carbs: w.carbs,
      challenge: w.challenge,
      bonus: w.badge + w.question,
    }
  })

  return (
    <>
      <ChartContainer
        config={config}
        className="aspect-auto h-48 w-full"
        role="figure"
        aria-label={`XP per week, last ${rows.length} weeks. The list after the chart has the numbers.`}
      >
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            interval={0}
            tickFormatter={(_, i) => rows[i]?.tick ?? ''}
          />
          <YAxis width={34} tickLine={false} axisLine={false} allowDecimals={false} />
          <ChartTooltip
isAnimationActive={false}
            cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const row = (payload?.[0]?.payload ?? null) as Row | null
                  if (!row) return null
                  return (
                    <div className="flex flex-col">
                      <span>{row.title}</span>
                      <span className="font-normal text-muted-foreground">
                        {row.total} XP, {row.sensorDays} of 7 sensor days
                      </span>
                    </div>
                  )
                }}
                formatter={(value, name, item) =>
                  Number(value) > 0 ? (
                    <div className="flex w-full items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 rounded-[2px]"
                        style={{ background: item.color }}
                      />
                      <span className="text-muted-foreground">
                        {config[name as keyof typeof config]?.label}
                      </span>
                      <span className="ml-auto font-mono font-medium tabular-nums">+{String(value)}</span>
                    </div>
                  ) : null
                }
              />
            }
          />
          <ChartLegend
            itemSorter={(item) => KEYS.indexOf(item.dataKey as (typeof KEYS)[number])}
            content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-1" />}
          />
          {KEYS.map((k) => (
            <Bar
              key={k}
              dataKey={k}
              stackId="xp"
              fill={`var(--color-${k})`}
              maxBarSize={26}
              isAnimationActive={false}
              stroke="var(--card)"
              strokeWidth={1}
            >
              {rows.map((r) => (
                <Cell
                  key={r.label}
                  fillOpacity={r.current ? 0.55 : 1}
                  strokeDasharray={r.current ? '3 2' : undefined}
                  stroke={r.current ? 'var(--xp)' : 'var(--card)'}
                />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ChartContainer>
      <ul className="sr-only">
        {rows.map((r) => (
          <li key={r.label}>
            {r.title}: {r.total} XP. Sensor days {r.sensor}, boluses with carbs {r.carbs}, challenges{' '}
            {r.challenge}, badges and questions {r.bonus}.
          </li>
        ))}
      </ul>
    </>
  )
}
