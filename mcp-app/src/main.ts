import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
} from '@modelcontextprotocol/ext-apps'

import { renderView } from './render'

const root = document.getElementById('root')!
const app = new App({ name: 'Rangebook view', version: '1.0.0' })

function show(data: unknown) {
  if (!data || typeof data !== 'object' || !('view' in data)) {
    root.innerHTML = '<p class="muted">No data to show.</p>'
    return
  }
  renderView(root, data as { view: string }, actions)
}

const actions = {
  async callTool(name: string, args: Record<string, unknown>) {
    const res = await app.callServerTool({ name, arguments: args })
    if (res.isError) throw new Error('The tool returned an error')
    return res.structuredContent
  },
  async openDay(date: string) {
    show(await actions.callTool('show_day', { date }))
  },
}

app.ontoolresult = (result) => show(result.structuredContent)
app.onhostcontextchanged = (ctx) => {
  if (ctx.theme) applyDocumentTheme(ctx.theme)
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables)
}

app.connect().then(() => {
  const ctx = app.getHostContext()
  if (ctx?.theme) applyDocumentTheme(ctx.theme)
  if (ctx?.styles?.variables) applyHostStyleVariables(ctx.styles.variables)
})

export type Actions = typeof actions
