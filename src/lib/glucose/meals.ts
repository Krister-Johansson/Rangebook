// Glucose response after each bolus with carbs. Control-IQ adjusts basal and
// adds automatic corrections after meals, so these numbers describe what
// happened with the system running, not the effect of the carb ratio alone.

import { dayOf, inDays, isWeekend, median, timeOfDay } from './core'
import type { Dataset, Reading } from './core'

export const MEAL_WINDOWS = [
  { id: 'breakfast', label: 'Breakfast', from: 5, to: 10 },
  { id: 'lunch', label: 'Lunch', from: 10, to: 15 },
  { id: 'afternoon', label: 'Afternoon snack', from: 15, to: 17 },
  { id: 'dinner', label: 'Dinner', from: 17, to: 21 },
  { id: 'evening', label: 'Evening and night', from: 21, to: 29 },
] as const

export type MealId = (typeof MEAL_WINDOWS)[number]['id']

export function mealOf(ts: string): MealId {
  const t = timeOfDay(ts)
  const h = t < 5 ? t + 24 : t
  return (MEAL_WINDOWS.find((m) => h >= m.from && h < m.to) ?? MEAL_WINDOWS[4]).id
}

export interface MealResponse {
  ts: string
  meal: MealId
  weekend: boolean
  carbs: number
  units: number
  start: number | null
  at2h: number | null
  rise2h: number | null
  peak: number | null
  peakAfterMin: number | null
  nadir4h: number | null
  lowWithin4h: boolean
  minutesToLow: number | null
  autoCorrections3h: number
}

export function mealResponses(ds: Dataset, from: string, to: string): MealResponse[] {
  const readings = ds.readings
  const carb = inDays(ds.boluses, from, to).filter((b) => b.kind === 'carb')
  const auto = ds.boluses.filter((b) => b.kind === 'auto')

  // Readings are sorted by time; find the window with a moving start index.
  let i = 0
  return carb.map((b) => {
    while (i < readings.length && readings[i].min < b.min - 10) i++
    const win: Reading[] = []
    for (let j = i; j < readings.length && readings[j].min <= b.min + 240; j++) win.push(readings[j])
    const near = (target: number, tol: number) =>
      win
        .filter((r) => Math.abs(r.min - target) <= tol)
        .sort((x, y) => Math.abs(x.min - target) - Math.abs(y.min - target))[0]?.v ?? null

    const start = near(b.min, 10)
    const at2h = near(b.min + 120, 10)
    const after = win.filter((r) => r.min > b.min)
    const in3h = after.filter((r) => r.min <= b.min + 180)
    const peakR = in3h.reduce<(typeof in3h)[number] | null>((a, r) => (!a || r.v > a.v ? r : a), null)
    const nadir = after.length ? Math.min(...after.map((r) => r.v)) : null
    const firstLow = start !== null && start >= 3.9 ? after.find((r) => r.v < 3.9) : undefined

    return {
      ts: b.ts,
      meal: mealOf(b.ts),
      weekend: isWeekend(dayOf(b.ts)),
      carbs: b.carbs,
      units: b.units,
      start,
      at2h,
      rise2h: start !== null && at2h !== null ? round1(at2h - start) : null,
      peak: peakR?.v ?? null,
      peakAfterMin: peakR ? peakR.min - b.min : null,
      nadir4h: nadir,
      lowWithin4h: Boolean(firstLow),
      minutesToLow: firstLow ? firstLow.min - b.min : null,
      autoCorrections3h: auto.filter((a) => a.min > b.min && a.min <= b.min + 180).length,
    }
  })
}

export interface MealSummary {
  meal: MealId
  label: string
  boluses: number
  medianCarbs: number | null
  medianStart: number | null
  medianRise2h: number | null
  riseOver3_3: number
  riseUnder1_7: number
  withRise: number
  lowWithin4h: number
  medianMinutesToLow: number | null
  withAutoCorrection3h: number
}

/** Counts per meal window. Thresholds 3.3 and 1.7 mmol/L at 2 hours come from docs/research/clinical-rules.md. */
export function summarizeMeals(responses: MealResponse[]): MealSummary[] {
  return MEAL_WINDOWS.map((m) => {
    const rs = responses.filter((r) => r.meal === m.id)
    const rises = rs.map((r) => r.rise2h).filter((v): v is number => v !== null)
    const lows = rs.filter((r) => r.lowWithin4h)
    const med = (vs: number[]) => (vs.length ? round1(median(vs)) : null)
    return {
      meal: m.id,
      label: m.label,
      boluses: rs.length,
      medianCarbs: med(rs.map((r) => r.carbs)),
      medianStart: med(rs.map((r) => r.start).filter((v): v is number => v !== null)),
      medianRise2h: med(rises),
      riseOver3_3: rises.filter((v) => v > 3.3).length,
      riseUnder1_7: rises.filter((v) => v < 1.7).length,
      withRise: rises.length,
      lowWithin4h: lows.length,
      medianMinutesToLow: lows.length ? Math.round(median(lows.map((r) => r.minutesToLow ?? 0))) : null,
      withAutoCorrection3h: rs.filter((r) => r.autoCorrections3h > 0).length,
    }
  })
}

function round1(v: number) {
  return Math.round(v * 10) / 10
}
