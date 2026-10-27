// Tools for the in-app chat. They return the same shapes as the MCP server
// (src/mcp/data.ts), so the chat and Claude Desktop quote the same numbers.
// Data access comes in through `deps`, so tests can run without a database.

import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

import { hasDoseValue } from '#/lib/dose-guard'
import { compareAround, findSettingsChanges } from '#/lib/glucose/changes'
import type { Dataset } from '#/lib/glucose/core'
import { MEAL_WINDOWS } from '#/lib/glucose/meals'
import {
  clampRange,
  comparePeriods,
  day,
  days,
  events,
  meals,
  overview,
  patterns,
  profile,
  systemCheckData,
  weekMap,
} from '#/mcp/data'
import { GLOSSARY } from '#/mcp/guidance'

export interface ChatDeps {
  dataset: () => Promise<Dataset | null>
  leaveOutDays: () => Promise<Set<string>>
  savedQuestions: () => Promise<{ patternId: string; question: string }[]>
  saveQuestion: (patternId: string, question: string) => Promise<void>
  // Whether the chat may read single days in detail (a setting).
  allowDayDetail: boolean
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const range = {
  from: date.optional().meta({ description: 'First day, YYYY-MM-DD. Defaults to `days` before `to`.' }),
  to: date.optional().meta({ description: 'Last day, YYYY-MM-DD. Defaults to the last day with data.' }),
  days: z.number().int().min(1).max(120).optional().meta({ description: 'Length of the period when `from` is not given.' }),
}


export function createChatTools(deps: ChatDeps) {
  const need = async () => {
    const ds = await deps.dataset()
    if (!ds) throw new Error('No data imported yet.')
    return ds
  }

  const getOverview = toolDefinition({
    name: 'get_overview',
    description:
      'Data range, last reading, consensus targets, whole-period and last-14-day summaries, and what the export does not contain. Call this first.',
    inputSchema: z.object({}),
  }).server(async () => overview(await need()))

  const getPeriodSummary = toolDefinition({
    name: 'get_period_summary',
    description:
      'Consensus CGM metrics for a period: time in each range, mean, GMI, CV, sensor wear, low episodes, carb boluses and which targets are met.',
    inputSchema: z.object(range),
  }).server(async ({ from, to, days: n }) => {
    const ds = await need()
    const r = clampRange(ds, from, to, n)
    return comparePeriods(ds, r, r).a
  })

  const comparePeriodsTool = toolDefinition({
    name: 'compare_periods',
    description:
      'Summaries of period A and period B plus the change (A minus B). Use for "this week vs last week" questions. Periods of 10 days or more compare more reliably.',
    inputSchema: z.object({ a_from: date, a_to: date, b_from: date, b_to: date }),
  }).server(async ({ a_from, a_to, b_from, b_to }) => {
    const ds = await need()
    return comparePeriods(ds, clampRange(ds, a_from, a_to), clampRange(ds, b_from, b_to))
  })

  const hourlyProfile = toolDefinition({
    name: 'get_hourly_profile',
    description:
      'Typical day: for each hour, the 5/25/50/75/95th percentiles and the share of readings below 3.9, below 3.0, above 10.0 and above 13.9.',
    inputSchema: z.object({
      ...range,
      day_type: z.enum(['all', 'school', 'weekend']).default('all').meta({ description: 'school = Monday to Friday' }),
    }),
  }).server(async ({ from, to, days: n, day_type }) => {
    const ds = await need()
    return profile(ds, clampRange(ds, from, to, n ?? 90), day_type ?? 'all')
  })

  const weekMapTool = toolDefinition({
    name: 'get_week_map',
    description: 'For each weekday and hour: readings and the share below 3.9, above 10.0 and above 13.9.',
    inputSchema: z.object(range),
  }).server(async ({ from, to, days: n }) => {
    const ds = await need()
    return weekMap(ds, clampRange(ds, from, to, n ?? 90))
  })

  const getPatterns = toolDefinition({
    name: 'get_patterns',
    description:
      'Rule-based findings (lows after meals, night lows, highs after pump stops, above-range windows, weekend nights, meal bolus routine) with evidence, strength 1 to 3, setting areas and a question for the care team. Lows come first. Days tagged as not normal are left out when the person chose that.',
    inputSchema: z.object({ days: z.number().int().min(14).max(120).default(90) }),
  }).server(async ({ days: n }) => {
    const [ds, leaveOut] = await Promise.all([need(), deps.leaveOutDays()])
    const keep = <T extends { ts: string }>(rows: T[]) => rows.filter((r) => !leaveOut.has(r.ts.slice(0, 10)))
    const trimmed = leaveOut.size
      ? { ...ds, readings: keep(ds.readings), boluses: keep(ds.boluses), basal: keep(ds.basal), alarms: keep(ds.alarms) }
      : ds
    return { ...patterns(trimmed, n ?? 90), not_normal_days_left_out: leaveOut.size }
  })

  const mealResponses = toolDefinition({
    name: 'get_meal_responses',
    description:
      'For boluses with carbs: glucose at the bolus, change at 2 hours, peak, lows within 4 hours and automatic corrections within 3 hours, per meal window.',
    inputSchema: z.object({
      ...range,
      meal: z.enum(MEAL_WINDOWS.map((m) => m.id) as [string, ...string[]]).optional(),
    }),
  }).server(async ({ from, to, days: n, meal }) => {
    const ds = await need()
    return meals(ds, clampRange(ds, from, to, n ?? 30), meal as never, false)
  })

  const listDays = toolDefinition({
    name: 'list_days',
    description: 'One row per day: sensor wear, time in range, below and above range, mean, low episodes and carb boluses.',
    inputSchema: z.object(range),
  }).server(async ({ from, to, days: n }) => {
    const ds = await need()
    return days(ds, clampRange(ds, from, to, n ?? 14))
  })

  const getDay = toolDefinition({
    name: 'get_day',
    description:
      'Glucose every 15 minutes, boluses, pump stops, alarms, sensor gaps and notes for one date. May be switched off in the chat settings; then use list_days instead.',
    inputSchema: z.object({ date: date.optional().meta({ description: 'Defaults to the last day with data' }) }),
  }).server(async ({ date: d }) => {
    if (!deps.allowDayDetail) {
      return { skipped: 'Reading single days in detail is switched off in the chat settings. Use list_days for daily summaries.' }
    }
    const ds = await need()
    return day(ds, d && d >= ds.firstDay && d <= ds.lastDay ? d : ds.lastDay)
  })

  const listEvents = toolDefinition({
    name: 'list_events',
    description:
      'Lows (15+ min below 3.9), very lows (below 3.0), runs at the sensor high limit (22.2) or pump stops (15+ min) in a period.',
    inputSchema: z.object({ ...range, type: z.enum(['low', 'very_low', 'sensor_high', 'pump_stop']) }),
  }).server(async ({ from, to, days: n, type }) => {
    const ds = await need()
    return events(ds, clampRange(ds, from, to, n ?? 14), type)
  })

  const systemCheck = toolDefinition({
    name: 'get_system_check',
    description: 'Sensor wear, carbs entered per day, share of automatic corrections, pump stops and what is missing from the export.',
    inputSchema: z.object(range),
  }).server(async ({ from, to, days: n }) => {
    const ds = await need()
    return systemCheckData(ds, clampRange(ds, from, to, n ?? 14))
  })

  const listChanges = toolDefinition({
    name: 'list_settings_changes',
    description:
      'Pump settings changes found in the export (basal profile and carb ratio), newest first, as a record of what was set. Use compare_settings_change for before and after.',
    inputSchema: z.object({}),
  }).server(async () => findSettingsChanges(await need()))

  const compareChange = toolDefinition({
    name: 'compare_settings_change',
    description:
      'The same number of days before and after one settings change: ranges, sensor wear, average, lows per week, warnings and whether other things changed at the same time. Lows first; it never says better or worse.',
    inputSchema: z.object({
      change_id: z.string().meta({ description: 'id from list_settings_changes' }),
      days: z.union([z.literal(7), z.literal(14), z.literal(21)]).default(14),
    }),
  }).server(async ({ change_id, days: n }) => {
    const [ds, leaveOut] = await Promise.all([need(), deps.leaveOutDays()])
    const found = findSettingsChanges(ds)
    const change = found.find((c) => c.id === change_id)
    if (!change) return { error: `No change with id ${change_id}.`, known_ids: found.map((c) => c.id) }
    const { before, after, ...rest } = compareAround(ds, change, n ?? 14, leaveOut, found)
    // The hourly profiles are for charts; the model gets the summary numbers.
    const side = ({ profile: _p, ...s }: typeof before) => s
    return { change, before: side(before), after: side(after), ...rest }
  })

  const glossary = toolDefinition({
    name: 'get_glossary',
    description: `Fixed explanations of terms. Known terms: ${Object.keys(GLOSSARY).join(', ')}.`,
    inputSchema: z.object({ term: z.string().optional() }),
  }).server(async ({ term }) => {
    if (!term) return GLOSSARY
    const key = Object.keys(GLOSSARY).find((k) => k === term.toLowerCase().trim())
    return key ? { [key]: GLOSSARY[key] } : { unknown_term: term, known_terms: Object.keys(GLOSSARY) }
  })

  const listSaved = toolDefinition({
    name: 'list_saved_questions',
    description: 'Questions saved for the next care team visit, from the dashboard or from this chat.',
    inputSchema: z.object({}),
  }).server(async () => deps.savedQuestions())

  const saveQuestion = toolDefinition({
    name: 'save_question_for_clinic',
    description:
      'Adds a question to the clinic list on the Patterns page. Only call this when the user asks to save it. The question must not contain doses or setting values.',
    inputSchema: z.object({
      question: z.string().min(10).max(500),
      pattern_id: z.string().optional().meta({ description: 'Pattern id from get_patterns, if the question belongs to one' }),
    }),
  }).server(async ({ question, pattern_id }) => {
    if (hasDoseValue(question)) {
      return { saved: false, reason: 'The question contains a dose or setting value. Ask it without numbers for insulin or ratios.' }
    }
    const patternId = pattern_id ?? `chat-${Date.now()}`
    await deps.saveQuestion(patternId, question)
    return { saved: true, pattern_id: patternId }
  })

  return [
    getOverview,
    getPeriodSummary,
    comparePeriodsTool,
    hourlyProfile,
    weekMapTool,
    getPatterns,
    mealResponses,
    listDays,
    getDay,
    listEvents,
    systemCheck,
    listChanges,
    compareChange,
    glossary,
    listSaved,
    saveQuestion,
  ]
}
