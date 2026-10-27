// MCP Apps views: tools that hosts with MCP Apps support (Claude Desktop,
// claude.ai) render as an interactive view in the chat. Hosts without it get
// the same data as text. One bundled HTML file (mcp-app/) renders every view
// based on `structuredContent.view`.

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from '@modelcontextprotocol/ext-apps/server'
import type { McpServer } from '@modelcontextprotocol/server'
import { asc } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db'
import { savedQuestions } from '#/db/schema'
import { dayDetail } from '#/lib/glucose/analysis'
import { addDays } from '#/lib/glucose/core'
import { clampRange, patterns, profile, weekSummary } from './data'
import { readOnly, requireData } from './util'

const VIEW_URI = 'ui://rangebook/view.html'
const VIEW_FILE = path.resolve(import.meta.dirname, '../../mcp-app/dist/view.html')

const FALLBACK_HTML = `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:16px">
The view is not built yet. Run <code>pnpm mcp:build</code> in the project and restart the MCP server.</body>`

const ui = { ui: { resourceUri: VIEW_URI } }

/** Tool result with a short text for the model and full data for the view. */
function view(text: string, data: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text }],
    structuredContent: data,
  }
}

export function registerAppViews(server: McpServer) {
  registerAppResource(
    server,
    'Rangebook view',
    VIEW_URI,
    { description: 'Charts and cards for the Rangebook tools.' },
    async () => {
      const html = await readFile(VIEW_FILE, 'utf-8').catch(() => FALLBACK_HTML)
      return { contents: [{ uri: VIEW_URI, mimeType: RESOURCE_MIME_TYPE, text: html }] }
    },
  )

  registerAppTool(
    server,
    'show_week_summary',
    {
      title: 'Show this week',
      description:
        'Shows time in ranges for the last 7 days next to the 7 days before, with average, GMI, CV, wins and goals. Renders a view in hosts with MCP Apps support.',
      annotations: readOnly,
      _meta: ui,
    },
    async () => {
      const data = weekSummary(await requireData())
      return view(JSON.stringify({ this_week: data.this_week, last_week: data.last_week, wins: data.wins }), {
        view: 'week',
        ...data,
      })
    },
  )

  registerAppTool(
    server,
    'show_typical_day',
    {
      title: 'Show typical day',
      description:
        'Shows the typical day chart (median and percentile bands by hour, target 3.9 to 10.0) for the last 90 days. Renders a view in hosts with MCP Apps support.',
      inputSchema: z.object({
        day_type: z.enum(['all', 'school', 'weekend']).default('all'),
        days: z.number().int().min(14).max(120).default(90),
      }),
      annotations: readOnly,
      _meta: ui,
    },
    async ({ day_type, days }) => {
      const ds = await requireData()
      const data = profile(ds, clampRange(ds, undefined, undefined, days), day_type)
      return view(JSON.stringify(data), { view: 'agp', ...data })
    },
  )

  registerAppTool(
    server,
    'show_patterns',
    {
      title: 'Show patterns',
      description:
        'Shows the pattern cards with evidence, charts and questions for the care team. In hosts with MCP Apps support, the user can save questions for clinic from the view.',
      inputSchema: z.object({ days: z.number().int().min(14).max(120).default(90) }),
      annotations: readOnly,
      _meta: ui,
    },
    async ({ days }) => {
      const data = patterns(await requireData(), days)
      const saved = await db
        .select({ id: savedQuestions.patternId })
        .from(savedQuestions)
        .orderBy(asc(savedQuestions.createdAt))
      const forModel = { ...data, patterns: data.patterns.map(({ chart: _c, ...p }) => p) }
      return view(JSON.stringify(forModel), {
        view: 'patterns',
        ...data,
        saved_ids: saved.map((s) => s.id),
      })
    },
  )

  registerAppTool(
    server,
    'show_day',
    {
      title: 'Show a day',
      description:
        'Shows one day: glucose curve with the target range, boluses, pump stops and alarms. Renders a view in hosts with MCP Apps support.',
      inputSchema: z.object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe('YYYY-MM-DD, defaults to the last day with data'),
      }),
      annotations: readOnly,
      _meta: ui,
    },
    async ({ date }) => {
      const ds = await requireData()
      const d = date && date >= ds.firstDay && date <= ds.lastDay ? date : ds.lastDay
      const detail = dayDetail(ds, d)
      const text = JSON.stringify({
        date: detail.day,
        summary: detail.summary,
        notes: detail.notes,
        boluses: detail.boluses.length,
        previous_day: detail.prev ?? null,
        next_day: detail.next && detail.next <= ds.lastDay ? detail.next : null,
      })
      return view(text, { view: 'day', detail, first_day: ds.firstDay, last_day: ds.lastDay, week_start: addDays(ds.lastDay, -6) })
    },
  )
}
