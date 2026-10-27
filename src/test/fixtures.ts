// Small synthetic datasets for tests. Times are local wall-clock strings like
// the pump export ("2026-01-05 09:30:00").

import { addDays, toMin } from '#/lib/glucose/core'
import type { BasalSegment, Bolus, Dataset, Reading } from '#/lib/glucose/core'

export const ts = (day: string, hhmm: string) => `${day} ${hhmm}:00`

export function reading(day: string, hhmm: string, v: number): Reading {
  const t = ts(day, hhmm)
  return { min: toMin(t), ts: t, v, limit: null }
}

/** One reading every 5 minutes for the whole day, from a value function of the hour. */
export function dayOfReadings(day: string, value: (hour: number) => number): Reading[] {
  const out: Reading[] = []
  for (let m = 0; m < 1440; m += 5) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0')
    const mm = String(m % 60).padStart(2, '0')
    out.push(reading(day, `${hh}:${mm}`, value(m / 60)))
  }
  return out
}

export function bolus(day: string, hhmm: string, b: Partial<Bolus> = {}): Bolus {
  const t = ts(day, hhmm)
  return { min: toMin(t), ts: t, kind: 'carb', units: 4, carbs: 40, bg: null, ratio: null, ...b }
}

export function basal(day: string, hhmm: string, rate: number, durationMin: number, suspend = false): BasalSegment {
  const t = ts(day, hhmm)
  return { min: toMin(t), ts: t, suspend, durationMin, rate }
}

export function days(from: string, count: number) {
  return Array.from({ length: count }, (_, i) => addDays(from, i))
}

export function dataset(parts: Partial<Dataset>): Dataset {
  const readings = [...(parts.readings ?? [])].sort((a, b) => a.min - b.min)
  const all = [
    ...readings.map((r) => r.ts),
    ...(parts.boluses ?? []).map((b) => b.ts),
    ...(parts.basal ?? []).map((b) => b.ts),
  ].sort()
  const first = all[0] ?? '2026-01-05 00:00:00'
  const last = all.at(-1) ?? first
  return {
    readings,
    boluses: [...(parts.boluses ?? [])].sort((a, b) => a.min - b.min),
    basal: [...(parts.basal ?? [])].sort((a, b) => a.min - b.min),
    alarms: parts.alarms ?? [],
    firstDay: parts.firstDay ?? first.slice(0, 10),
    lastDay: parts.lastDay ?? last.slice(0, 10),
    lastTs: parts.lastTs ?? last,
  }
}
