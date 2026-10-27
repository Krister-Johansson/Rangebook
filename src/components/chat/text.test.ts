import { describe, expect, it } from 'vitest'

import { errorText, lastQuestion, modelName, parseBlocks, parseInline, relativeDay } from './text'

describe('parseInline', () => {
  it('splits bold spans', () => {
    expect(parseInline('Lows **first**, then highs')).toEqual([
      { text: 'Lows ', bold: false },
      { text: 'first', bold: true },
      { text: ', then highs', bold: false },
    ])
  })

  it('drops a ** that has no pair yet', () => {
    expect(parseInline('In range **74')).toEqual([{ text: 'In range 74', bold: false }])
  })
})

describe('parseBlocks', () => {
  it('reads paragraphs, lists and headings', () => {
    const blocks = parseBlocks('First line\nsame paragraph.\n\n## Next\n- one\n- two\n  more\n\n1. a\n2. b\nAfter')
    expect(blocks.map((b) => b.type)).toEqual(['p', 'h', 'ul', 'ol', 'p'])
    expect(blocks[0]).toEqual({ type: 'p', spans: [{ text: 'First line same paragraph.', bold: false }] })
    expect(blocks[2]).toEqual({
      type: 'ul',
      items: [[{ text: 'one', bold: false }], [{ text: 'two more', bold: false }]],
    })
  })

  it('keeps HTML as plain text', () => {
    expect(parseBlocks('<b>hi</b>')).toEqual([{ type: 'p', spans: [{ text: '<b>hi</b>', bold: false }] }])
  })

  it('returns nothing for empty text', () => {
    expect(parseBlocks('  \n\n')).toEqual([])
  })
})

describe('lastQuestion', () => {
  it('finds the last sentence ending in a question mark', () => {
    const text = 'Lows came after lunch. **Why** is that? It may be timing.\n\n- Could we look at lunch boluses together?\n- Bring the log.'
    expect(lastQuestion(text)).toBe('Could we look at lunch boluses together?')
  })

  it('is empty without a question', () => {
    expect(lastQuestion('All done. Nothing to ask.')).toBe('')
  })
})

describe('relativeDay', () => {
  const now = new Date(2026, 9, 27, 15, 0)
  it('names today, yesterday and this week', () => {
    expect(relativeDay(new Date(2026, 9, 27, 9, 0).toISOString(), now)).toBe('Today')
    expect(relativeDay(new Date(2026, 9, 26, 23, 0).toISOString(), now)).toBe('Yesterday')
    expect(relativeDay(new Date(2026, 9, 23, 12, 0).toISOString(), now)).toBe('Fri')
  })
  it('uses the date for older chats', () => {
    expect(relativeDay(new Date(2026, 8, 30, 12, 0).toISOString(), now)).toBe('30 Sep')
    expect(relativeDay(new Date(2025, 11, 1, 12, 0).toISOString(), now)).toBe('1 Dec 2025')
  })
})

describe('errorText', () => {
  it('explains the missing key', () => {
    expect(errorText(new Error('HTTP error! status: 503 Service Unavailable'))).toMatch(/OPENROUTER_API_KEY/)
  })
  it('uses the status on the error when there is one', () => {
    expect(errorText(Object.assign(new Error('x'), { status: 409 }))).toMatch(/Add a person first/)
  })
  it('names a network problem', () => {
    expect(errorText(new TypeError('Failed to fetch'))).toMatch(/still running/)
  })
})

describe('modelName', () => {
  it('drops the note in brackets', () => {
    expect(modelName('Claude Haiku 5.5 (faster, cheaper)')).toBe('Claude Haiku 5.5')
    expect(modelName('Claude Sonnet 5.5')).toBe('Claude Sonnet 5.5')
  })
})
