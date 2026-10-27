// Read-only views of the dataset shaped for a language model: rounded values,
// explicit dates and no personal details (the patient name is never loaded).

import {
  dayDetail,
  daySummaries,
  homeData,
  hourlyProfile,
  periodSummary,
  systemCheck,
  weekHeatmap,
} from '#/lib/glucose/analysis'
import type { DayType, PeriodSummary } from '#/lib/glucose/analysis'
import {
  TARGETS,
  addDays,
  dayOf,
  inDays,
  lowEpisodes,
  sensorHighRuns,
  episodes,
} from '#/lib/glucose/core'
import type { Dataset } from '#/lib/glucose/core'
import { WEEKDAY_LONG } from '#/lib/glucose/format'
import { mealResponses, summarizeMeals } from '#/lib/glucose/meals'
import type { MealId } from '#/lib/glucose/meals'
import { findPatterns } from '#/lib/glucose/patterns'

const r1 = (v: number) => Math.round(v * 10) / 10

export function clampRange(ds: Dataset, from?: string, to?: string, days?: number) {
  const end = to && to <= ds.lastDay ? to : ds.lastDay
  let start = from ?? addDays(end, -((days ?? 14) - 1))
  if (start < ds.firstDay) start = ds.firstDay
  return { from: start, to: end < start ? start : end }
}

export function summary(p: PeriodSummary) {
  const s = p.stats
  return {
    from: p.from,
    to: p.to,
    label: p.label,
    readings: s.n,
    days_with_data: p.daysWithData,
    sensor_wear_pct: r1(p.wear),
    mean_mmol: r1(s.mean),
    gmi_pct: r1(s.gmi),
    cv_pct: r1(s.cv),
    pct: {
      very_low_below_3_0: r1(s.pct.vlow),
      low_3_0_to_3_8: r1(s.pct.low),
      in_range_3_9_to_10_0: r1(s.pct.in),
      high_10_1_to_13_9: r1(s.pct.high),
      very_high_above_13_9: r1(s.pct.vhigh),
    },
    low_episodes: p.lows,
    low_episodes_below_3_0: p.lowsBelow30,
    carb_boluses: p.carbBoluses,
    meets_targets: {
      in_range_over_70: s.pct.in > TARGETS.inRange,
      below_3_9_under_4: s.below39 < TARGETS.below39,
      below_3_0_under_1: s.pct.vlow < TARGETS.below30,
      above_10_under_25: s.above10 < TARGETS.above10,
      above_13_9_under_5: s.pct.vhigh < TARGETS.above139,
      cv_36_or_less: s.cv <= TARGETS.cv,
      wear_70_or_more: p.wear >= TARGETS.wear,
    },
  }
}

export function overview(ds: Dataset) {
  const last14 = clampRange(ds, undefined, undefined, 14)
  const all = periodSummary(ds, ds.firstDay, ds.lastDay)
  return {
    data_from: ds.firstDay,
    data_to: ds.lastDay,
    last_reading: ds.lastTs,
    units: 'mmol/L',
    targets: {
      in_range_pct_over: TARGETS.inRange,
      below_3_9_pct_under: TARGETS.below39,
      below_3_0_pct_under: TARGETS.below30,
      above_10_pct_under: TARGETS.above10,
      above_13_9_pct_under: TARGETS.above139,
      cv_pct_at_most: TARGETS.cv,
      sensor_wear_pct_at_least: TARGETS.wear,
    },
    whole_period: summary(all),
    last_14_days: summary(periodSummary(ds, last14.from, last14.to)),
    not_in_this_data: [
      'pump settings (basal, carb ratio, correction factor, target)',
      'which boluses were automatic (estimated)',
      'Control-IQ, Sleep and Exercise activity times',
      'food, exercise and notes',
    ],
  }
}

export function comparePeriods(ds: Dataset, a: { from: string; to: string }, b: { from: string; to: string }) {
  const A = summary(periodSummary(ds, a.from, a.to))
  const B = summary(periodSummary(ds, b.from, b.to))
  const d = (x: number, y: number) => r1(x - y)
  return {
    a: A,
    b: B,
    change_a_minus_b: {
      in_range_pct_points: d(A.pct.in_range_3_9_to_10_0, B.pct.in_range_3_9_to_10_0),
      below_3_9_pct_points: d(
        A.pct.very_low_below_3_0 + A.pct.low_3_0_to_3_8,
        B.pct.very_low_below_3_0 + B.pct.low_3_0_to_3_8,
      ),
      above_13_9_pct_points: d(A.pct.very_high_above_13_9, B.pct.very_high_above_13_9),
      mean_mmol: d(A.mean_mmol, B.mean_mmol),
      cv_pct_points: d(A.cv_pct, B.cv_pct),
      low_episodes: A.low_episodes - B.low_episodes,
      sensor_wear_pct_points: d(A.sensor_wear_pct, B.sensor_wear_pct),
    },
  }
}

export function profile(ds: Dataset, range: { from: string; to: string }, dayType: DayType) {
  return {
    ...range,
    day_type: dayType,
    hours: hourlyProfile(inDays(ds.readings, range.from, range.to), dayType).map((h) => ({
      hour: h.hour,
      readings: h.n,
      p5: r1(h.p5),
      p25: r1(h.p25),
      median: r1(h.p50),
      p75: r1(h.p75),
      p95: r1(h.p95),
      pct_below_3_9: r1(h.below39),
      pct_below_3_0: r1(h.below30),
      pct_above_10_0: r1(h.above10),
      pct_above_13_9: r1(h.above139),
    })),
  }
}

export function weekMap(ds: Dataset, range: { from: string; to: string }) {
  const cells = weekHeatmap(inDays(ds.readings, range.from, range.to))
  return {
    ...range,
    rows: cells.map((row, i) => ({
      weekday: WEEKDAY_LONG[i],
      hours: row.map((c, hour) => ({
        hour,
        readings: c.n,
        pct_below_3_9: r1(c.below39),
        pct_above_10_0: r1(c.above10),
        pct_above_13_9: r1(c.above139),
      })),
    })),
  }
}

export function patterns(ds: Dataset, days: number) {
  const res = findPatterns(ds, days)
  return {
    from: res.from,
    to: res.to,
    pct_below_3_9: r1(res.below39),
    lows_over_target: res.lowsOverTarget,
    patterns: res.patterns.map((p) => ({
      id: p.id,
      kind: p.kind,
      evidence_strength: p.strength,
      title: p.title,
      when: p.when,
      evidence: p.evidence,
      extra: p.extra ?? null,
      strength_note: p.strengthNote,
      setting_areas_for_care_team: p.topics,
      question_for_care_team: p.question,
      example_day: p.exampleDay,
      chart: p.chart,
    })),
  }
}

export function days(ds: Dataset, range: { from: string; to: string }) {
  return daySummaries(ds, range.from, range.to).map((d) => ({
    date: d.day,
    label: d.label,
    weekend: d.weekend,
    sensor_wear_pct: r1(d.wear),
    in_range_pct: r1(d.inRange),
    below_3_9_pct: r1(d.below39),
    above_10_pct: r1(d.above10),
    mean_mmol: r1(d.mean),
    low_episodes: d.lows,
    carb_boluses: d.carbBoluses,
  }))
}

/** One day, with CGM thinned to 15-minute points to keep the payload small. */
export function day(ds: Dataset, date: string) {
  const d = dayDetail(ds, date)
  const clock = (t: number) => {
    const m = Math.round(t * 60)
    return m >= 1440 ? '24:00' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  }
  return {
    date: d.day,
    label: d.label,
    weekend: d.weekend,
    summary: {
      sensor_wear_pct: r1(d.summary.wear),
      in_range_pct: r1(d.summary.inRange),
      below_3_9_pct: r1(d.summary.below39),
      above_10_pct: r1(d.summary.above10),
      mean_mmol: r1(d.summary.mean),
      low_episodes: d.summary.lows,
    },
    notes: d.notes,
    glucose_every_15_min: d.readings
      .filter((_, i) => i % 3 === 0)
      .map((r) => ({ time: clock(r.t), mmol: r.v, ...(r.limit ? { sensor_limit: r.limit } : {}) })),
    boluses: d.boluses.map((b) => ({
      time: clock(b.t),
      type: b.kind === 'auto' ? 'automatic correction (estimated)' : b.kind === 'carb' ? 'with carbs' : 'manual, no carbs',
      units: r1(b.units),
      carbs_g: b.carbs,
    })),
    pump_stops: d.basal
      .filter((s) => s.suspend && s.end - s.t >= 0.25)
      .map((s) => ({ from: clock(s.t), to: clock(s.end), minutes: Math.round((s.end - s.t) * 60) })),
    alarms: d.alarms.map((a) => ({ time: clock(a.t), event: a.label })),
    sensor_gaps: d.gaps.map((g) => ({ from: clock(g.from), to: clock(g.to) })),
  }
}

export type EventType = 'low' | 'very_low' | 'sensor_high' | 'pump_stop'

export function events(ds: Dataset, range: { from: string; to: string }, type: EventType) {
  const rs = inDays(ds.readings, range.from, range.to)
  if (type === 'pump_stop') {
    return inDays(ds.basal, range.from, range.to)
      .filter((b) => b.suspend && b.durationMin >= 15)
      .map((b) => ({ start: b.ts, minutes: Math.round(b.durationMin), date: dayOf(b.ts) }))
  }
  const eps =
    type === 'low'
      ? lowEpisodes(rs)
      : type === 'very_low'
        ? episodes(rs, (r) => r.v < 3.0)
        : sensorHighRuns(rs)
  return eps.map((e) => ({
    start: e.startTs,
    end: e.endTs,
    minutes: e.endMin - e.startMin + 5,
    [type === 'sensor_high' ? 'highest_mmol' : 'lowest_mmol']: e.extreme,
    date: dayOf(e.startTs),
  }))
}

export function meals(ds: Dataset, range: { from: string; to: string }, meal?: MealId, includeEach = false) {
  const all = mealResponses(ds, range.from, range.to)
  const list = meal ? all.filter((m) => m.meal === meal) : all
  return {
    ...range,
    note: 'Control-IQ was adjusting insulin after these meals, so the response is the whole system, not the carb ratio alone. Rise thresholds 3.3 and 1.7 mmol/L at 2 hours are the clinic reference points in docs/research/clinical-rules.md.',
    by_meal: summarizeMeals(list).filter((s) => s.boluses > 0),
    ...(includeEach ? { each: list } : {}),
  }
}

export function systemCheckData(ds: Dataset, range: { from: string; to: string }) {
  return { ...range, items: systemCheck(ds, range.from, range.to) }
}

export function weekSummary(ds: Dataset) {
  const h = homeData(ds)
  return {
    this_week: summary(h.thisWeek),
    last_week: summary(h.lastWeek),
    days: days(ds, { from: h.thisWeek.from, to: h.thisWeek.to }),
    wins: h.wins.map((w) => `${w.title}. ${w.detail}`),
    goals: h.goals.map((g) => ({ goal: g.text, done: g.done, target: g.target })),
  }
}
