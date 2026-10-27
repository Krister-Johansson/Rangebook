import { describe, expect, it } from 'vitest'

import { groupTurns } from './turns'

const msg = (id: string, role: string, ...parts: string[]) => ({ id, role, parts })

describe('groupTurns', () => {
  it('merges the tool turn and the text turn into one answer', () => {
    const turns = groupTurns([
      msg('1', 'user', 'q'),
      msg('2', 'assistant', 'tool-call', 'tool-result'),
      msg('3', 'assistant', 'text'),
      msg('4', 'user', 'q2'),
      msg('5', 'assistant', 'text'),
    ])
    expect(turns.map((t) => [t.id, t.parts])).toEqual([
      ['1', ['q']],
      ['2', ['tool-call', 'tool-result', 'text']],
      ['4', ['q2']],
      ['5', ['text']],
    ])
  })

  it('leaves out system messages', () => {
    expect(groupTurns([msg('1', 'system', 'x'), msg('2', 'user', 'q')]).map((t) => t.id)).toEqual(['2'])
  })
})
