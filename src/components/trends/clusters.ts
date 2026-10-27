import type { DayType, HourProfile } from '#/lib/glucose/analysis'
import { clock, f1 } from '#/lib/glucose/format'

// Hours where lows or highs pile up on the typical day chart.
export const LOW_CLUSTER_MIN = 8 // more than 8% of readings below 3.9
export const HIGH_CLUSTER_MIN = 55 // 55% or more of readings above 10.0

export interface Cluster {
  kind: 'low' | 'high'
  from: number
  to: number
  label: string
}

export function hourLabel(h: number) {
  return h === 24 ? '24:00' : clock(h)
}

function runs(hours: HourProfile[], hit: (h: HourProfile) => boolean) {
  const out: { from: number; to: number }[] = []
  let start: number | null = null
  for (let i = 0; i <= 24; i++) {
    const on = i < 24 && hours[i].n > 0 && hit(hours[i])
    if (on && start === null) start = i
    if (!on && start !== null) {
      out.push({ from: start, to: i })
      start = null
    }
  }
  return out
}

export function findClusters(hours: HourProfile[]): Cluster[] {
  const lows = runs(hours, (h) => h.below39 > LOW_CLUSTER_MIN).map((r) => ({
    kind: 'low' as const,
    ...r,
    label: `Lows ${hourLabel(r.from)} to ${hourLabel(r.to)}`,
  }))
  const highs = runs(hours, (h) => h.above10 >= HIGH_CLUSTER_MIN).map((r) => ({
    kind: 'high' as const,
    ...r,
    label: `Highs ${hourLabel(r.from)} to ${hourLabel(r.to)}`,
  }))
  return [...lows, ...highs].sort((a, b) => a.from - b.from)
}

const PREFIX: Record<DayType, string> = {
  all: 'Readings are',
  school: 'On school days, readings are',
  weekend: 'On weekends, readings are',
}

/** One sentence naming the hours with the highest and lowest median. */
export function profileCaption(hours: HourProfile[], type: DayType) {
  const withData = hours.filter((h) => h.n > 0)
  if (!withData.length) return 'There are no readings for these days yet.'
  const hi = withData.reduce((a, h) => (h.p50 > a.p50 ? h : a))
  const lo = withData.reduce((a, h) => (h.p50 < a.p50 ? h : a))
  return `${PREFIX[type]} usually highest between ${hourLabel(hi.hour)} and ${hourLabel(hi.hour + 1)} (median ${f1(hi.p50)}) and lowest between ${hourLabel(lo.hour)} and ${hourLabel(lo.hour + 1)} (median ${f1(lo.p50)}).`
}
