import { chatParamsFromRequestBody, toServerSentEventsResponse } from '@tanstack/ai'
import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'

import { db } from '#/db'
import { people, preferences } from '#/db/schema'
import { activePersonId } from '#/server/active-person'
import { openRouterAdapter, runChat } from '#/server/chat/agent'
import { databaseDeps } from '#/server/chat/deps'
import { fakeChatAdapter } from '#/server/chat/fake'
import { CHAT_MODELS, DEFAULT_CHAT_MODEL } from '#/server/chat/prompt'

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// The chat streams over server-sent events. It always answers about the person
// selected in the app (the cookie), never a person named in the request.
export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const fake = process.env.RANGEBOOK_FAKE_CHAT === '1'
        if (!fake && !process.env.OPENROUTER_API_KEY) {
          return Response.json({ error: 'OPENROUTER_API_KEY is not set in .env.local.' }, { status: 503 })
        }
        // Tools and state sent by the browser are ignored: the chat only gets
        // the server's own tools.
        let params: Awaited<ReturnType<typeof chatParamsFromRequestBody>>
        try {
          params = await chatParamsFromRequestBody(await request.json())
        } catch {
          return Response.json({ error: 'Bad request' }, { status: 400 })
        }
        if (!params.threadId || params.messages.length === 0) {
          return Response.json({ error: 'Bad request' }, { status: 400 })
        }

        const personId = await activePersonId()
        if (personId === null) return Response.json({ error: 'Add a person first.' }, { status: 409 })
        const [[person], prefs] = await Promise.all([
          db.select({ name: people.name }).from(people).where(eq(people.id, personId)),
          db.select().from(preferences).where(eq(preferences.personId, personId)),
        ])
        const pref = (key: string) => prefs.find((p) => p.key === key)?.value
        const model = CHAT_MODELS.find((m) => m.id === pref('chatModel'))?.id ?? DEFAULT_CHAT_MODEL
        const allowDayDetail = pref('chatDayDetail') !== false

        const abortController = new AbortController()
        request.signal.addEventListener('abort', () => abortController.abort())
        const stream = runChat({
          adapter: fake ? fakeChatAdapter() : openRouterAdapter(model),
          threadId: params.threadId,
          messages: params.messages,
          personName: person.name,
          today: localToday(),
          deps: databaseDeps(personId, allowDayDetail),
          abortController,
        })
        return toServerSentEventsResponse(stream, { abortController })
      },
    },
  },
})
