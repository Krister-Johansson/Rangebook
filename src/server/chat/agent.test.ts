// The chat agent with a scripted fake model (TanStack AI's fakeText): no
// network, no API key, no credits. The live check is agent.live.test.ts.

import { fakeText } from '@tanstack/ai/testing'
import type { FakeResponseStep } from '@tanstack/ai/testing'
import { describe, expect, test, vi } from 'vitest'

import { basal, bolus, dataset, dayOfReadings, days } from '#/test/fixtures'
import { MAX_TURNS, runChat } from './agent'
import type { ChatDeps } from './tools'

// Two weeks of readings with a low every afternoon from 14:00 to 15:00.
const DS = dataset({
  readings: days('2026-01-05', 14).flatMap((d) => dayOfReadings(d, (h) => (h >= 14 && h < 15 ? 3.4 : 7.5))),
})

function deps(over: Partial<ChatDeps> = {}): ChatDeps {
  return {
    dataset: async () => DS,
    leaveOutDays: async () => new Set(),
    savedQuestions: async () => [],
    saveQuestion: vi.fn(async () => {}),
    allowDayDetail: true,
    ...over,
  }
}

/** Runs one question and collects the streamed text and each tool's parsed result. */
async function ask(steps: FakeResponseStep[], d: ChatDeps = deps(), question = 'How was this week?') {
  const fake = fakeText()
  fake.setResponses(steps)
  const names = new Map<string, string>()
  const results: { name: string; result: any }[] = []
  let text = ''
  let error: string | null = null
  const stream = runChat({
    adapter: fake,
    threadId: 'test-thread',
    messages: [{ role: 'user', content: question }],
    personName: 'Sam',
    today: '2026-01-19',
    deps: d,
  })
  for await (const c of stream as AsyncIterable<any>) {
    if (c.type === 'TOOL_CALL_START') names.set(c.toolCallId, c.toolCallName)
    if (c.type === 'TOOL_CALL_RESULT') results.push({ name: names.get(c.toolCallId)!, result: JSON.parse(c.content) })
    if (c.type === 'TEXT_MESSAGE_CONTENT') text += c.delta
    if (c.type === 'RUN_ERROR') error = c.message ?? c.error?.message ?? 'error'
  }
  return { text, results, error, calls: fake.state.callCount }
}

describe('tool loop', () => {
  test('calls a tool, gets numbers from the data, then answers', async () => {
    const r = await ask([{ toolCalls: [{ name: 'get_overview', input: {} }] }, { text: 'Here is your week.' }])
    expect(r.results.map((x) => x.name)).toEqual(['get_overview'])
    expect(r.results[0].result).toMatchObject({ data_from: '2026-01-05', data_to: '2026-01-18', units: 'mmol/L' })
    expect(r.text).toBe('Here is your week.')
    expect(r.calls).toBe(2)
  })

  test('several tools in one turn', async () => {
    const r = await ask([
      {
        toolCalls: [
          { name: 'get_period_summary', input: { days: 7 } },
          { name: 'list_events', input: { type: 'low', days: 7 } },
        ],
      },
      { text: 'Done.' },
    ])
    expect(r.results.map((x) => x.name).sort()).toEqual(['get_period_summary', 'list_events'])
    const lows = r.results.find((x) => x.name === 'list_events')!.result
    expect(JSON.stringify(lows)).toContain('2026-01-18')
  })

  test(`stops after ${MAX_TURNS} model turns even if the model keeps calling tools`, async () => {
    const loop: FakeResponseStep = { toolCalls: [{ name: 'get_glossary', input: {} }] }
    const r = await ask(Array.from({ length: MAX_TURNS + 4 }, () => loop))
    expect(r.calls).toBe(MAX_TURNS)
  })

  test('a tool error goes back to the model instead of ending the chat', async () => {
    const r = await ask(
      [{ toolCalls: [{ name: 'get_overview', input: {} }] }, { text: 'There is no data yet.' }],
      deps({ dataset: async () => null }),
    )
    expect(JSON.stringify(r.results[0].result)).toContain('No data imported yet.')
    expect(r.text).toBe('There is no data yet.')
  })
})

describe('what the model is given', () => {
  test('the system prompt names the person and carries the safety rules', async () => {
    let request: any
    await ask([
      (call) => {
        request = call.request
        return { text: 'ok' }
      },
    ])
    const system = JSON.stringify(request.systemPrompts ?? request.messages)
    expect(system).toContain('Sam')
    expect(system).toMatch(/Never suggest a dose, a new setting value or a direction of change/)
    expect(system).toMatch(/emergency services/)
    expect(system).toMatch(/Lows come first/)
  })

  test('the model gets the data tools and only one tool that writes', async () => {
    let request: any
    await ask([
      (call) => {
        request = call.request
        return { text: 'ok' }
      },
    ])
    const names = (request.tools as { name: string }[]).map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining(['get_overview', 'get_patterns', 'compare_settings_change', 'get_day', 'save_question_for_clinic']),
    )
    expect(names.filter((n) => /^(save|add|delete|update|set)_/.test(n))).toEqual(['save_question_for_clinic'])
  })

  test('requests ask OpenRouter for providers that do not keep data', async () => {
    let request: any
    await ask([
      (call) => {
        request = call.request
        return { text: 'ok' }
      },
    ])
    expect(request.modelOptions).toMatchObject({ provider: { data_collection: 'deny' } })
  })
})

describe('tools', () => {
  test('single days are not sent when day detail is switched off', async () => {
    const r = await ask(
      [{ toolCalls: [{ name: 'get_day', input: { date: '2026-01-10' } }] }, { text: 'ok' }],
      deps({ allowDayDetail: false }),
    )
    expect(r.results[0].result).toHaveProperty('skipped')
    expect(JSON.stringify(r.results[0].result)).not.toContain('readings')
  })

  test('single days are sent when allowed', async () => {
    const r = await ask([{ toolCalls: [{ name: 'get_day', input: { date: '2026-01-10' } }] }, { text: 'ok' }])
    expect(r.results[0].result).toMatchObject({ date: '2026-01-10' })
  })

  test('saves a plain question for clinic', async () => {
    const d = deps()
    const r = await ask(
      [{ toolCalls: [{ name: 'save_question_for_clinic', input: { question: 'Why do lows come after lunch on school days?' } }] }, { text: 'Saved.' }],
      d,
    )
    expect(r.results[0].result).toMatchObject({ saved: true })
    expect(d.saveQuestion).toHaveBeenCalledWith(expect.stringMatching(/^chat-/), 'Why do lows come after lunch on school days?')
  })

  test.each([
    'Should we change my lunch carb ratio to 1:8?',
    'Can I lower basal to 0.6 U/h at night?',
    'Should I take 2 units less at lunch?',
  ])('refuses to save a question with a dose or setting value: %s', async (question) => {
    const d = deps()
    const r = await ask([{ toolCalls: [{ name: 'save_question_for_clinic', input: { question } }] }, { text: 'ok' }], d)
    expect(r.results[0].result).toMatchObject({ saved: false })
    expect(d.saveQuestion).not.toHaveBeenCalled()
  })

  test('patterns leave out not-normal days when the person chose that', async () => {
    const r = await ask(
      [{ toolCalls: [{ name: 'get_patterns', input: { days: 14 } }] }, { text: 'ok' }],
      deps({ leaveOutDays: async () => new Set(['2026-01-06', '2026-01-07']) }),
    )
    expect(r.results[0].result).toMatchObject({ not_normal_days_left_out: 2 })
  })

  test('settings changes: list, then compare before and after', async () => {
    const withChange = dataset({
      readings: [
        ...days('2026-01-05', 14).flatMap((d) => dayOfReadings(d, () => 7)),
        ...days('2026-01-19', 14).flatMap((d) => dayOfReadings(d, (h) => (h >= 14 && h < 15 ? 3.4 : 7))),
      ],
      basal: [
        ...days('2026-01-05', 14).map((d) => basal(d, '09:30', 0.7, 90)),
        ...days('2026-01-19', 14).map((d) => basal(d, '09:30', 0.8, 90)),
      ],
      boluses: days('2026-01-05', 28).map((d) => bolus(d, '12:00', { ratio: d < '2026-01-19' ? 10 : 9 })),
    })
    const listed = await ask([{ toolCalls: [{ name: 'list_settings_changes', input: {} }] }, { text: 'ok' }], deps({ dataset: async () => withChange }))
    const id = listed.results[0].result[0].id
    expect(listed.results[0].result[0].day).toBe('2026-01-19')

    const compared = await ask(
      [{ toolCalls: [{ name: 'compare_settings_change', input: { change_id: id, days: 14 } }] }, { text: 'ok' }],
      deps({ dataset: async () => withChange }),
    )
    const c = compared.results[0].result
    expect(c.lowsUp).toBe(true)
    expect(c.before.below39).toBe(0)
    expect(c.after).not.toHaveProperty('profile')
    expect(JSON.stringify(c)).not.toMatch(/\b(better|worse)\b/i)
  })

  test('an unknown change id lists the known ones', async () => {
    const r = await ask([{ toolCalls: [{ name: 'compare_settings_change', input: { change_id: 'nope' } }] }, { text: 'ok' }])
    expect(r.results[0].result).toMatchObject({ error: 'No change with id nope.' })
  })
})
