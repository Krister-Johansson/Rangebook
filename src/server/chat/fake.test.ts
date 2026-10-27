import { describe, expect, test } from 'vitest'

import { dataset, dayOfReadings, days } from '#/test/fixtures'
import { runChat } from './agent'
import { fakeChatAdapter } from './fake'

const DS = dataset({ readings: days('2026-01-05', 14).flatMap((d) => dayOfReadings(d, () => 7)) })

async function toolsFor(question: string) {
  const tools: string[] = []
  let text = ''
  const stream = runChat({
    adapter: fakeChatAdapter(),
    threadId: 'fake-test',
    messages: [{ role: 'user', content: question }],
    personName: 'Sam',
    today: '2026-01-19',
    deps: {
      dataset: async () => DS,
      leaveOutDays: async () => new Set(),
      savedQuestions: async () => [],
      saveQuestion: async () => {},
      allowDayDetail: true,
    },
  })
  for await (const c of stream as AsyncIterable<any>) {
    if (c.type === 'TOOL_CALL_START') tools.push(c.toolCallName)
    if (c.type === 'TEXT_MESSAGE_CONTENT') text += c.delta
  }
  return { tools, text }
}

describe('fake chat mode', () => {
  test.each([
    ['How was this week?', ['get_period_summary', 'list_events']],
    ['Why do I go low after lunch?', ['get_patterns']],
    ['Compare before and after the last settings change', ['list_settings_changes']], // no changes in this data
    ['What does a typical day look like?', ['get_hourly_profile']],
  ])('%s', async (question, expected) => {
    const r = await toolsFor(question)
    expect(r.tools).toEqual(expected)
    expect(r.text).toContain('Nothing was sent to OpenRouter')
  })

  test('each answer gets its own message id', async () => {
    const ids = new Set<string>()
    for (const q of ['How was this week?', 'How was this week?']) {
      const stream = runChat({
        adapter: fakeChatAdapter(),
        threadId: 'fake-ids',
        messages: [{ role: 'user', content: q }],
        personName: 'Sam',
        today: '2026-01-19',
        deps: { dataset: async () => DS, leaveOutDays: async () => new Set(), savedQuestions: async () => [], saveQuestion: async () => {}, allowDayDetail: true },
      })
      for await (const c of stream as AsyncIterable<any>) if (c.type === 'TEXT_MESSAGE_START') ids.add(c.messageId)
    }
    expect(ids.size).toBe(2)
  })

  test('something happening right now gets no tools and points to the care plan', async () => {
    const r = await toolsFor('I feel shaky right now')
    expect(r.tools).toEqual([])
    expect(r.text).toMatch(/care plan/)
  })
})
