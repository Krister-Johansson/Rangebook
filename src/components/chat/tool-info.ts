// Plain labels and key numbers for the chat's tool calls, and which inline
// card a tool result gets. Shapes come from src/server/chat/tools.ts and
// src/mcp/data.ts; anything missing falls back to a plain label.

import { longDate, rangeLabel, shortDate } from '#/lib/glucose/format'

type Obj = Record<string, unknown>

export type ToolRow = [label: string, value: string]

export interface ToolView {
  /** Past tense, after the result came back. */
  label: string
  /** Present tense, while the tool runs. */
  running: string
  rows: ToolRow[]
  /** The tool chose not to look (single days are off). */
  skipped?: boolean
}

export type CardKind = 'period' | 'compare' | 'typical' | 'patterns' | 'change' | 'day'

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const obj = (v: unknown): Obj => (isObj(v) ? v : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

/** "12.3%", or "none" when the number is missing. */
export const pctText = (v: unknown) => {
  const n = num(v)
  return n === undefined ? 'none' : `${n.toFixed(1)}%`
}

const thenText = (a: unknown, b: unknown) => `${pctText(a)} then ${pctText(b)}`

/** "30 Sep" */
export const dayMonth = (day: string) => shortDate(day).slice(4)

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** JSON from a tool result, or the value itself when it is already parsed. */
export function parseResult(content: unknown): unknown {
  if (typeof content !== 'string') return content
  try {
    return JSON.parse(content)
  } catch {
    return content
  }
}

/** Tool input from the parsed `input`, or from the raw `arguments` string. */
export function toolInput(part: { input?: unknown; arguments?: string }): Obj {
  if (isObj(part.input)) return part.input
  if (part.arguments) {
    const parsed = parseResult(part.arguments)
    if (isObj(parsed)) return parsed
  }
  return {}
}

function lastDays(input: Obj, fallback: number) {
  if (isDate(input.from)) return isDate(input.to) ? rangeLabel(input.from, input.to) : `from ${shortDate(input.from)}`
  return `last ${num(input.days) ?? fallback} days`
}

function periodRows(s: Obj): ToolRow[] {
  const pct = obj(s.pct)
  const below = (num(pct.very_low_below_3_0) ?? 0) + (num(pct.low_3_0_to_3_8) ?? 0)
  const above = (num(pct.high_10_1_to_13_9) ?? 0) + (num(pct.very_high_above_13_9) ?? 0)
  const rows: ToolRow[] = []
  if (isDate(s.from) && isDate(s.to)) rows.push(['Days', rangeLabel(s.from, s.to)])
  rows.push(
    ['In range, 3.9 to 10.0', pctText(pct.in_range_3_9_to_10_0)],
    ['Below 3.9', pctText(below)],
    ['Below 3.0', pctText(pct.very_low_below_3_0)],
    ['Above 10.0', pctText(above)],
    ['Sensor worn', pctText(s.sensor_wear_pct)],
  )
  const lows = num(s.low_episodes)
  if (lows !== undefined) rows.push(['Lows', String(lows)])
  return rows
}

const fromOf = (s: Obj) => (isDate(s.from) ? s.from : '')

function compareRows(out: Obj): ToolRow[] {
  const a = obj(out.a)
  const b = obj(out.b)
  // Earlier period first, so "then" reads in time order.
  const [first, second] = fromOf(a) <= fromOf(b) ? [a, b] : [b, a]
  const below = (s: Obj) => (num(obj(s.pct).very_low_below_3_0) ?? 0) + (num(obj(s.pct).low_3_0_to_3_8) ?? 0)
  return [
    ['In range', thenText(obj(first.pct).in_range_3_9_to_10_0, obj(second.pct).in_range_3_9_to_10_0)],
    ['Below 3.9', thenText(below(first), below(second))],
    ['Above 13.9', thenText(obj(first.pct).very_high_above_13_9, obj(second.pct).very_high_above_13_9)],
    ['Sensor worn', thenText(first.sensor_wear_pct, second.sensor_wear_pct)],
  ]
}

const clockOf = (h: number) => `${String(h).padStart(2, '0')}:00`

function peakHour(hours: unknown[], key: string): string {
  let best: Obj | null = null
  for (const h of hours.map(obj)) {
    if ((num(h[key]) ?? 0) > (num(best?.[key]) ?? 0)) best = h
  }
  return best ? `${clockOf(num(best.hour) ?? 0)}, ${pctText(best[key])}` : 'none'
}

const EVENT_WORDS: Record<string, string> = {
  low: 'lows',
  very_low: 'lows below 3.0',
  sensor_high: 'readings above 22.2',
  pump_stop: 'pump stops',
}

const DAY_TYPE: Record<string, string> = { school: ', school days', weekend: ', weekends' }

/** The past-tense label, key numbers and running label for one tool call. */
export function describeTool(name: string, input: Obj, output?: unknown): ToolView {
  const out = obj(output)
  const has = output !== undefined
  const view = (label: string, rows: ToolRow[] = [], extra: Partial<ToolView> = {}): ToolView => ({
    label,
    running: ingForm(label),
    rows: has ? rows : [],
    ...extra,
  })
  if (has && str(out.error)) {
    return { ...describeTool(name, input), rows: [['Problem', str(out.error)!]] }
  }

  switch (name) {
    case 'get_overview': {
      const last = obj(out.last_14_days)
      return view('Looked at an overview of the data', [
        ...(isDate(out.data_from) && isDate(out.data_to) ? [['Data', rangeLabel(out.data_from, out.data_to)] as ToolRow] : []),
        ['In range, last 14 days', pctText(obj(last.pct).in_range_3_9_to_10_0)],
        ['Sensor worn, last 14 days', pctText(last.sensor_wear_pct)],
      ])
    }
    case 'get_period_summary': {
      const when = isDate(input.from) ? rangeLabel(input.from, isDate(input.to) ? input.to : str(out.to) ?? input.from) : `your last ${num(input.days) ?? 14} days`
      return view(`Looked at ${when}`, periodRows(out))
    }
    case 'compare_periods': {
      const a = isDate(input.a_from) && isDate(input.a_to) ? rangeLabel(input.a_from, input.a_to) : 'one period'
      const b = isDate(input.b_from) && isDate(input.b_to) ? rangeLabel(input.b_from, input.b_to) : 'another'
      return view(`Compared ${a} with ${b}`, compareRows(out))
    }
    case 'get_hourly_profile': {
      const hours = arr(out.hours)
      return view(`Looked at a typical day, ${lastDays(input, 90)}${DAY_TYPE[str(input.day_type) ?? ''] ?? ''}`, [
        ['Most readings below 3.9', peakHour(hours, 'pct_below_3_9')],
        ['Most readings above 10.0', peakHour(hours, 'pct_above_10_0')],
      ])
    }
    case 'get_week_map': {
      let low: [string, number, number] | null = null
      for (const row of arr(out.rows).map(obj)) {
        for (const h of arr(row.hours).map(obj)) {
          const v = num(h.pct_below_3_9) ?? 0
          if (v > (low?.[2] ?? 0)) low = [str(row.weekday) ?? '', num(h.hour) ?? 0, v]
        }
      }
      return view(`Looked at the week map, ${lastDays(input, 90)}`, [
        ['Most readings below 3.9', low ? `${low[0]} ${clockOf(low[1])}, ${pctText(low[2])}` : 'none'],
      ])
    }
    case 'get_patterns': {
      const ps = arr(out.patterns).map(obj)
      const count = (kind: string) => ps.filter((p) => p.kind === kind).length
      const rows: ToolRow[] = [
        ['Patterns found', String(ps.length)],
        ['About lows', String(count('low'))],
        ['About highs', String(count('high'))],
      ]
      if (ps[0] && str(ps[0].title)) rows.push(['First one', str(ps[0].title)!])
      const left = num(out.not_normal_days_left_out)
      if (left) rows.push(['Not-normal days left out', String(left)])
      return view(`Looked at patterns, last ${num(input.days) ?? 90} days`, rows)
    }
    case 'get_meal_responses': {
      const meals = arr(out.by_meal).map(obj)
      const meal = str(input.meal)
      return view(`Looked at ${meal ? `${meal} boluses` : 'meal boluses'}, ${lastDays(input, 30)}`,
        meals.slice(0, 4).map((m) => [
          str(m.label) ?? str(m.meal) ?? 'Meal',
          `${plural(num(m.boluses) ?? 0, 'bolus', 'boluses')}, a low after ${num(m.lowWithin4h) ?? 0}`,
        ]),
      )
    }
    case 'list_days': {
      const days = arr(output).map(obj)
      return view(`Looked at each day, ${lastDays(input, 14)}`, [
        ['Days', String(days.length)],
        ['Days with a low', String(days.filter((d) => (num(d.low_episodes) ?? 0) > 0).length)],
        ['Days with under 70% sensor wear', String(days.filter((d) => (num(d.sensor_wear_pct) ?? 100) < 70).length)],
      ])
    }
    case 'get_day': {
      if (str(out.skipped)) {
        return { label: 'Skipped reading a single day', running: 'Reading a single day', rows: [], skipped: true }
      }
      const date = isDate(out.date) ? out.date : isDate(input.date) ? input.date : null
      const s = obj(out.summary)
      return view(date ? `Read ${longDate(date)} in detail` : 'Read a single day in detail', [
        ['In range', pctText(s.in_range_pct)],
        ['Lows', String(num(s.low_episodes) ?? 0)],
        ['Pump stops', String(arr(out.pump_stops).length)],
        ['Sensor gaps', String(arr(out.sensor_gaps).length)],
      ])
    }
    case 'list_events': {
      const type = str(input.type) ?? 'low'
      const events = arr(output).map(obj)
      const rows: ToolRow[] = [['Found', String(events.length)]]
      if (type === 'low' || type === 'very_low') {
        const lowest = Math.min(...events.map((e) => num(e.lowest_mmol) ?? Infinity))
        if (Number.isFinite(lowest)) rows.push(['Lowest reading', `${lowest.toFixed(1)} mmol/L`])
      }
      if (type === 'pump_stop' && events.length) {
        rows.push(['Longest', `${Math.max(...events.map((e) => num(e.minutes) ?? 0))} min`])
      }
      return view(`Looked for ${EVENT_WORDS[type] ?? 'events'}, ${lastDays(input, 14)}`, rows)
    }
    case 'get_system_check':
      return view(
        'Checked sensor, carbs and pump stops',
        arr(out.items).map(obj).slice(0, 5).map((i) => [str(i.label) ?? '', str(i.value) ?? ''] as ToolRow),
      )
    case 'list_settings_changes': {
      const changes = arr(output).map(obj)
      const newest = changes[0]
      const rows: ToolRow[] = [['Changes found', String(changes.length)]]
      if (newest && isDate(newest.day)) {
        rows.push(['Newest', shortDate(newest.day)])
        for (const r of arr(newest.rows).map(obj)) rows.push([str(r.setting) ?? '', `${str(r.before) ?? '?'} then ${str(r.after) ?? '?'}`])
      }
      return view('Looked for settings changes', rows)
    }
    case 'compare_settings_change': {
      const change = obj(out.change)
      const fromId = /^c-(\d{4}-\d{2}-\d{2})/.exec(str(input.change_id) ?? '')?.[1]
      const day = isDate(change.day) ? change.day : fromId
      const before = obj(out.before)
      const after = obj(out.after)
      return view(day ? `Compared before and after ${dayMonth(day)}` : 'Compared before and after a settings change', [
        ['Below 3.9', thenText(before.below39, after.below39)],
        ['In range', thenText(obj(before.pct).in, obj(after.pct).in)],
        ['Sensor worn', thenText(before.wear, after.wear)],
        ['Days on each side', String(num(out.days) ?? num(input.days) ?? 14)],
      ])
    }
    case 'get_glossary': {
      const term = str(input.term)
      return view(term ? `Looked up "${term}"` : 'Looked up the word list')
    }
    case 'list_saved_questions':
      return view('Checked the questions already saved', [['Saved', String(arr(output).length)]])
    case 'save_question_for_clinic': {
      if (has && out.saved === false) {
        return { label: 'Did not save the question', running: 'Saving a question', rows: [['Why', str(out.reason) ?? '']] }
      }
      return view('Saved a question for clinic', str(input.question) ? [['Question', str(input.question)!]] : [])
    }
    default:
      return view(`Looked something up (${name})`)
  }
}

/** "Looked at" becomes "Looking at", and so on, for a tool that is still running. */
export function ingForm(label: string) {
  return label
    .replace(/^Looked/, 'Looking')
    .replace(/^Compared/, 'Comparing')
    .replace(/^Checked/, 'Checking')
    .replace(/^Read /, 'Reading ')
    .replace(/^Saved/, 'Saving')
    .replace(/^Skipped/, 'Skipping')
}

/** Which inline card a finished tool result gets, if any. */
export function cardFor(name: string, output: unknown): CardKind | null {
  if (!isObj(output) && name !== 'get_day') return null
  const out = obj(output)
  if (str(out.error) || str(out.skipped)) return null
  switch (name) {
    case 'get_period_summary':
      return isObj(out.pct) ? 'period' : null
    case 'compare_periods':
      return isObj(out.a) && isObj(out.b) ? 'compare' : null
    case 'get_hourly_profile':
      return arr(out.hours).some((h) => (num(obj(h).readings) ?? 0) > 0) ? 'typical' : null
    case 'get_patterns':
      return arr(out.patterns).length ? 'patterns' : null
    case 'compare_settings_change':
      return isObj(out.before) && isObj(out.after) && isObj(out.change) ? 'change' : null
    case 'get_day':
      return arr(out.glucose_every_15_min).length ? 'day' : null
    default:
      return null
  }
}
