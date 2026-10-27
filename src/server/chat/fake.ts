// Fake model for trying the chat screens without OpenRouter: no network, no
// credits, nothing leaves the computer. Switched on with RANGEBOOK_FAKE_CHAT=1.
// It picks real tools from keywords in the question, then gives a fixed answer.

import { fakeText } from '@tanstack/ai/testing'
import type { FakeResponse } from '@tanstack/ai/testing'

function lastUserText(request: { messages?: unknown[] }) {
  const messages = (request.messages ?? []) as { role: string; content?: unknown; parts?: { type: string; content?: string }[] }[]
  const last = [...messages].reverse().find((m) => m.role === 'user')
  if (!last) return ''
  if (typeof last.content === 'string') return last.content
  return last.parts?.find((p) => p.type === 'text')?.content ?? ''
}

function toolsFor(question: string): FakeResponse['toolCalls'] {
  const q = question.toLowerCase()
  if (/right now|shaky|feel/.test(q)) return []
  if (/change|before and after|setting/.test(q)) return [{ name: 'list_settings_changes', input: {} }]
  if (/pattern|clinic|low/.test(q)) return [{ name: 'get_patterns', input: { days: 90 } }]
  if (/typical|hour|day look/.test(q)) return [{ name: 'get_hourly_profile', input: { days: 90 } }]
  if (/saturday|sunday|monday|tuesday|wednesday|thursday|friday|yesterday/.test(q)) return [{ name: 'get_day', input: {} }]
  if (/save/.test(q)) return [{ name: 'save_question_for_clinic', input: { question: 'Why do lows often come about 2 hours after lunch?' } }]
  return [
    { name: 'get_period_summary', input: { days: 7 } },
    { name: 'list_events', input: { type: 'low', days: 7 } },
  ]
}

const ANSWER =
  'This is a test answer from the fake chat. The steps above show which tools ran and what they returned from your data. Nothing was sent to OpenRouter.'

/** The first change id in the latest list_settings_changes result, if that was the last tool. */
function newestChangeId(request: { messages?: unknown[] }) {
  const messages = (request.messages ?? []) as { role: string; content?: unknown }[]
  const last = messages.at(-1)
  if (last?.role !== 'tool' || typeof last.content !== 'string') return null
  try {
    const parsed = JSON.parse(last.content) as { id?: string; rows?: unknown }[]
    return Array.isArray(parsed) && parsed[0]?.rows ? (parsed[0].id ?? null) : null
  } catch {
    return null
  }
}

// One adapter for the whole server: its run counter gives every answer its own
// message id, so a second question in a thread is not merged into the first.
// Fine for a dev tool that answers one question at a time.
let shared: ReturnType<typeof fakeText> | null = null

export function fakeChatAdapter() {
  shared ??= fakeText({ model: 'fake-chat', tokensPerSecond: 120 })
  const fake = shared
  fake.setResponses([
    ({ request }) => {
      const calls = toolsFor(lastUserText(request))
      if (calls?.length) return { toolCalls: calls }
      return {
        text: 'This is the fake chat, so this answer is fixed. If something is happening right now, follow your care plan and the pump and CGM alerts, and get help from an adult or emergency services.',
      }
    },
    // After listing settings changes, compare the newest one, like a model would.
    ({ request }) => {
      const id = newestChangeId(request)
      return id ? { toolCalls: [{ name: 'compare_settings_change', input: { change_id: id, days: 14 } }] } : { text: ANSWER }
    },
    { text: ANSWER },
  ])
  return fake
}
