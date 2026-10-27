// Local MCP server for Rangebook. Runs over stdio, reads the same
// Postgres database as the app and uses the same analysis code, so Claude sees
// the numbers the dashboard shows. Start with `pnpm mcp` (see README).

import { McpServer } from '@modelcontextprotocol/server'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { asc } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db'
import { savedQuestions } from '#/db/schema'
import { MEAL_WINDOWS } from '#/lib/glucose/meals'
import { registerAppViews } from './apps'
import { json, readOnly, requireData } from './util'
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
} from './data'
import {
  GLOSSARY,
  SERVER_INSTRUCTIONS,
  clinicPrepPrompt,
  explainDayPrompt,
  weeklyReviewPrompt,
} from './guidance'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
const rangeArgs = {
  from: date.optional().describe('First day, YYYY-MM-DD. Defaults to `days` before `to`.'),
  to: date.optional().describe('Last day, YYYY-MM-DD. Defaults to the last day with data.'),
  days: z.number().int().min(1).max(120).optional().describe('Length of the period when `from` is not given.'),
}
export function createServer() {
  const server = new McpServer(
    { name: 'rangebook', version: '1.0.0' },
    { instructions: SERVER_INSTRUCTIONS },
  )

  server.registerTool(
    'get_overview',
    {
      title: 'Data overview',
      description:
        'Data range, last reading, consensus targets, whole-period and last-14-day summaries, and what the export does not contain. Call this first.',
      annotations: readOnly,
    },
    async () => json(overview(await requireData())),
  )

  server.registerTool(
    'get_period_summary',
    {
      title: 'Period summary',
      description:
        'Consensus CGM metrics for a period: time in each range, mean, GMI, CV, sensor wear, low episodes, carb boluses and which targets are met.',
      inputSchema: z.object(rangeArgs),
      annotations: readOnly,
    },
    async ({ from, to, days: n }) => {
      const ds = await requireData()
      const r = clampRange(ds, from, to, n)
      return json(comparePeriods(ds, r, r).a)
    },
  )

  server.registerTool(
    'compare_periods',
    {
      title: 'Compare two periods',
      description:
        'Summaries of period A and period B plus the change (A minus B). Use for "this week vs last week" style questions. Periods of 10 days or more compare more reliably.',
      inputSchema: z.object({ a_from: date, a_to: date, b_from: date, b_to: date }),
      annotations: readOnly,
    },
    async ({ a_from, a_to, b_from, b_to }) => {
      const ds = await requireData()
      return json(
        comparePeriods(ds, clampRange(ds, a_from, a_to), clampRange(ds, b_from, b_to)),
      )
    },
  )

  server.registerTool(
    'get_hourly_profile',
    {
      title: 'Typical day by hour',
      description:
        'AGP-style profile: for each hour, the 5/25/50/75/95th percentiles and the share of readings below 3.9, below 3.0, above 10.0 and above 13.9.',
      inputSchema: z.object({
        ...rangeArgs,
        day_type: z.enum(['all', 'school', 'weekend']).default('all').describe('school = Monday to Friday'),
      }),
      annotations: readOnly,
    },
    async ({ from, to, days: n, day_type }) => {
      const ds = await requireData()
      return json(profile(ds, clampRange(ds, from, to, n ?? 90), day_type))
    },
  )

  server.registerTool(
    'get_week_map',
    {
      title: 'Weekday by hour map',
      description: 'For each weekday and hour: readings and the share below 3.9, above 10.0 and above 13.9.',
      inputSchema: z.object(rangeArgs),
      annotations: readOnly,
    },
    async ({ from, to, days: n }) => {
      const ds = await requireData()
      return json(weekMap(ds, clampRange(ds, from, to, n ?? 90)))
    },
  )

  server.registerTool(
    'get_patterns',
    {
      title: 'Patterns for the care team',
      description:
        'Rule-based findings (lows after meals, night lows, highs after pump stops, above-range windows, weekend nights, meal bolus routine) with evidence counts, strength 1 to 3, setting areas and a question for the care team. Lows are listed first.',
      inputSchema: z.object({
        days: z.number().int().min(14).max(120).default(90).describe('How many days back from the last reading'),
      }),
      annotations: readOnly,
    },
    async ({ days: n }) => json(patterns(await requireData(), n)),
  )

  server.registerTool(
    'get_meal_responses',
    {
      title: 'Glucose after meals',
      description:
        'For boluses with carbs: glucose at the bolus, change at 2 hours, peak, lows within 4 hours and automatic corrections within 3 hours, summarised per meal window. Set include_each for one row per bolus.',
      inputSchema: z.object({
        ...rangeArgs,
        meal: z.enum(MEAL_WINDOWS.map((m) => m.id) as [string, ...string[]]).optional(),
        include_each: z.boolean().default(false),
      }),
      annotations: readOnly,
    },
    async ({ from, to, days: n, meal, include_each }) => {
      const ds = await requireData()
      return json(meals(ds, clampRange(ds, from, to, n ?? 30), meal as never, include_each))
    },
  )

  server.registerTool(
    'list_days',
    {
      title: 'List days',
      description: 'One row per day: sensor wear, time in range, below and above range, mean, low episodes and carb boluses.',
      inputSchema: z.object(rangeArgs),
      annotations: readOnly,
    },
    async ({ from, to, days: n }) => {
      const ds = await requireData()
      return json(days(ds, clampRange(ds, from, to, n ?? 14)))
    },
  )

  server.registerTool(
    'get_day',
    {
      title: 'One day in detail',
      description:
        'Glucose every 15 minutes, boluses (carb, manual, estimated automatic), pump stops, alarms, sensor gaps and notes for one date.',
      inputSchema: z.object({ date: date.optional().describe('Defaults to the last day with data') }),
      annotations: readOnly,
    },
    async ({ date: d }) => {
      const ds = await requireData()
      const target = d && d >= ds.firstDay && d <= ds.lastDay ? d : ds.lastDay
      return json(day(ds, target))
    },
  )

  server.registerTool(
    'list_events',
    {
      title: 'List events',
      description:
        'Lows (15+ min below 3.9), very lows (below 3.0), runs at the sensor high limit (22.2) or pump stops (15+ min) in a period, with start, end and duration.',
      inputSchema: z.object({
        ...rangeArgs,
        type: z.enum(['low', 'very_low', 'sensor_high', 'pump_stop']),
      }),
      annotations: readOnly,
    },
    async ({ from, to, days: n, type }) => {
      const ds = await requireData()
      return json(events(ds, clampRange(ds, from, to, n ?? 14), type))
    },
  )

  server.registerTool(
    'get_system_check',
    {
      title: 'System check',
      description: 'Sensor wear, carbs entered per day, share of automatic corrections, pump stops and what is missing from the export.',
      inputSchema: z.object(rangeArgs),
      annotations: readOnly,
    },
    async ({ from, to, days: n }) => {
      const ds = await requireData()
      return json(systemCheckData(ds, clampRange(ds, from, to, n ?? 14)))
    },
  )

  server.registerTool(
    'get_glossary',
    {
      title: 'Glossary',
      description: `Fixed explanations of terms. Known terms: ${Object.keys(GLOSSARY).join(', ')}.`,
      inputSchema: z.object({ term: z.string().optional() }),
      annotations: readOnly,
    },
    async ({ term }) => {
      if (!term) return json(GLOSSARY)
      const key = Object.keys(GLOSSARY).find((k) => k === term.toLowerCase().trim())
      return json(key ? { [key]: GLOSSARY[key] } : { unknown_term: term, known_terms: Object.keys(GLOSSARY) })
    },
  )

  server.registerTool(
    'list_saved_questions',
    {
      title: 'Saved clinic questions',
      description: 'Questions saved for the next care team visit, from the dashboard or from this chat.',
      annotations: readOnly,
    },
    async () => json(await db.select().from(savedQuestions).orderBy(asc(savedQuestions.createdAt))),
  )

  server.registerTool(
    'save_question_for_clinic',
    {
      title: 'Save a question for clinic',
      description:
        'Adds a question to the clinic list shown on the Patterns page. Only call this when the user asks to save it. The question must not contain doses or setting values.',
      inputSchema: z.object({
        question: z.string().min(10).max(500),
        pattern_id: z.string().optional().describe('Pattern id from get_patterns, if the question belongs to one'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ question, pattern_id }) => {
      const patternId = pattern_id ?? `chat-${Date.now()}`
      await db.insert(savedQuestions).values({ patternId, question }).onConflictDoNothing()
      return json({ saved: true, pattern_id: patternId })
    },
  )

  server.registerPrompt(
    'weekly_review',
    { title: 'Weekly review', description: 'Short, friendly review of the last week with questions for the care team.' },
    () => ({ messages: [{ role: 'user', content: { type: 'text', text: weeklyReviewPrompt() } }] }),
  )

  server.registerPrompt(
    'clinic_prep',
    {
      title: 'Prepare for clinic',
      description: 'Draft questions for the next care team visit from patterns, meals and the system check.',
      argsSchema: z.object({ days: z.string().optional().describe('Days to look back, default 90') }),
    },
    ({ days: n }) => ({
      messages: [{ role: 'user', content: { type: 'text', text: clinicPrepPrompt(Number(n) || 90) } }],
    }),
  )

  server.registerPrompt(
    'explain_day',
    {
      title: 'Explain a day',
      description: 'Walk through one day: meals, boluses, lows, highs, pump stops and gaps.',
      argsSchema: z.object({ date: z.string().describe('YYYY-MM-DD') }),
    },
    ({ date: d }) => ({
      messages: [{ role: 'user', content: { type: 'text', text: explainDayPrompt(d) } }],
    }),
  )

  registerAppViews(server)
  return server
}

async function main() {
  const server = createServer()
  await server.connect(new StdioServerTransport())
}

main().catch((err) => {
  // stdout is the protocol channel; errors go to stderr.
  console.error(err)
  process.exit(1)
})
