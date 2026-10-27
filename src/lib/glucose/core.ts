// Core glucose math shared by every view. Pump and CGM timestamps are local
// wall-clock strings ("YYYY-MM-DD HH:MM:SS"); they are turned into minutes on a
// zone-free clock so day boundaries never shift with the server's time zone.

export type Band = 'vlow' | 'low' | 'in' | 'high' | 'vhigh'

export const BANDS: { key: Band; label: string; range: string }[] = [
  { key: 'vhigh', label: 'Very high', range: 'above 13.9' },
  { key: 'high', label: 'High', range: '10.1 to 13.9' },
  { key: 'in', label: 'In range', range: '3.9 to 10.0' },
  { key: 'low', label: 'Low', range: '3.0 to 3.8' },
  { key: 'vlow', label: 'Very low', range: 'below 3.0' },
]

// Clinic targets from the 2019 international consensus on time in range.
export const TARGETS = {
  inRange: 70,
  below39: 4,
  below30: 1,
  above10: 25,
  above139: 5,
  cv: 36,
  wear: 70,
}

export function bandOf(v: number): Band {
  if (v < 3.0) return 'vlow'
  if (v < 3.9) return 'low'
  if (v <= 10.0) return 'in'
  if (v <= 13.9) return 'high'
  return 'vhigh'
}

export interface Reading {
  min: number
  ts: string
  v: number
  limit: 'low' | 'high' | null
}

export type BolusKind = 'carb' | 'auto' | 'manual'

export interface Bolus {
  min: number
  ts: string
  kind: BolusKind
  units: number
  carbs: number
  bg: number | null
}

export interface BasalSegment {
  min: number
  ts: string
  suspend: boolean
  durationMin: number
  rate: number
}

export interface PumpAlarm {
  min: number
  ts: string
  event: string
}

export interface Dataset {
  readings: Reading[]
  boluses: Bolus[]
  basal: BasalSegment[]
  alarms: PumpAlarm[]
  firstDay: string
  lastDay: string
  lastTs: string
}

export const SLOTS_PER_DAY = 288

export function toMin(ts: string): number {
  const y = +ts.slice(0, 4)
  const mo = +ts.slice(5, 7)
  const d = +ts.slice(8, 10)
  const h = +ts.slice(11, 13) || 0
  const mi = +ts.slice(14, 16) || 0
  return Date.UTC(y, mo - 1, d, h, mi) / 60000
}

export function dayOf(ts: string) {
  return ts.slice(0, 10)
}

export function hourOf(ts: string) {
  return +ts.slice(11, 13)
}

/** Hours since midnight as a fraction, e.g. 14.5 for 14:30. */
export function timeOfDay(ts: string) {
  return +ts.slice(11, 13) + +ts.slice(14, 16) / 60
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayOf(day: string) {
  const js = new Date(`${day}T00:00:00Z`).getUTCDay()
  return (js + 6) % 7
}

export function isWeekend(day: string) {
  return weekdayOf(day) >= 5
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string) {
  return Math.round((toMin(`${b} 00:00`) - toMin(`${a} 00:00`)) / 1440)
}

export function gmi(meanMmol: number) {
  return 3.31 + 0.02392 * meanMmol * 18.018
}

export interface Stats {
  n: number
  pct: Record<Band, number>
  below39: number
  above10: number
  mean: number
  sd: number
  cv: number
  gmi: number
}

export function stats(readings: { v: number }[]): Stats {
  const n = readings.length
  const counts: Record<Band, number> = { vlow: 0, low: 0, in: 0, high: 0, vhigh: 0 }
  let sum = 0
  for (const r of readings) {
    counts[bandOf(r.v)]++
    sum += r.v
  }
  const mean = n ? sum / n : 0
  let ss = 0
  for (const r of readings) ss += (r.v - mean) ** 2
  const sd = n > 1 ? Math.sqrt(ss / (n - 1)) : 0
  const pct = {} as Record<Band, number>
  for (const k of Object.keys(counts) as Band[]) pct[k] = n ? (counts[k] / n) * 100 : 0
  return {
    n,
    pct,
    below39: pct.vlow + pct.low,
    above10: pct.high + pct.vhigh,
    mean,
    sd,
    cv: mean ? (sd / mean) * 100 : 0,
    gmi: n ? gmi(mean) : 0,
  }
}

export function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0
  const i = (sorted.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

export function median(values: number[]) {
  return percentile([...values].sort((a, b) => a - b), 0.5)
}

export interface Episode {
  startMin: number
  endMin: number
  startTs: string
  endTs: string
  readings: number
  extreme: number
}

/**
 * Glucose episodes using the consensus rule: at least 15 minutes (3 readings)
 * matching `test`, and an episode ends after 15 minutes outside it. Gaps in
 * the sensor data longer than 15 minutes also end an episode.
 */
export function episodes(
  readings: Reading[],
  test: (r: Reading) => boolean,
  opts: { minReadings?: number; pickExtreme?: 'min' | 'max' } = {},
): Episode[] {
  const minReadings = opts.minReadings ?? 3
  const pick = opts.pickExtreme ?? 'min'
  const out: Episode[] = []
  let cur: Episode | null = null
  let lastMin = -Infinity
  for (const r of readings) {
    const gap = r.min - lastMin
    if (test(r)) {
      if (cur && r.min - cur.endMin <= 15 && gap <= 20) {
        cur.endMin = r.min
        cur.endTs = r.ts
        cur.readings++
        cur.extreme = pick === 'min' ? Math.min(cur.extreme, r.v) : Math.max(cur.extreme, r.v)
      } else {
        if (cur) out.push(cur)
        cur = { startMin: r.min, endMin: r.min, startTs: r.ts, endTs: r.ts, readings: 1, extreme: r.v }
      }
    }
    lastMin = r.min
  }
  if (cur) out.push(cur)
  return out.filter((e) => e.readings >= minReadings)
}

export const lowEpisodes = (readings: Reading[]) =>
  episodes(readings, (r) => r.v < 3.9)

/** Runs at the sensor's upper limit (shown as HI on the receiver). */
export const sensorHighRuns = (readings: Reading[]) =>
  episodes(readings, (r) => r.limit === 'high' || r.v >= 22.2, {
    minReadings: 1,
    pickExtreme: 'max',
  })

/**
 * The export has no flag for Control-IQ automatic boluses. Heuristic from
 * docs/export-format.md: carbs entered = carb bolus; no carbs, a BG input, no
 * carb ratio and no matching fingerstick row = automatic correction; anything
 * else is a manual bolus without carbs.
 */
export function classifyBolus(
  b: { ts: string; carbs: number | null; bg: number | null; carbRatio: number | null },
  fingerstickTs: Set<string>,
): BolusKind {
  if ((b.carbs ?? 0) > 0) return 'carb'
  if ((b.bg ?? 0) > 0 && b.carbRatio === null && !fingerstickTs.has(b.ts)) return 'auto'
  return 'manual'
}

export function inDays<T extends { ts: string }>(rows: T[], from: string, to: string) {
  return rows.filter((r) => {
    const d = dayOf(r.ts)
    return d >= from && d <= to
  })
}
