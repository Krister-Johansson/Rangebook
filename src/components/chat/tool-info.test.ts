import { describe, expect, it } from 'vitest'

import { cardFor, describeTool, ingForm, parseResult, toolInput } from './tool-info'

const summary = {
  from: '2026-10-21',
  to: '2026-10-27',
  sensor_wear_pct: 91.2,
  low_episodes: 4,
  pct: {
    very_low_below_3_0: 0.5,
    low_3_0_to_3_8: 6,
    in_range_3_9_to_10_0: 74,
    high_10_1_to_13_9: 15,
    very_high_above_13_9: 4.5,
  },
}

describe('describeTool', () => {
  it('labels a period summary by its days and pulls the key numbers', () => {
    const v = describeTool('get_period_summary', { days: 7 }, summary)
    expect(v.label).toBe('Looked at your last 7 days')
    expect(v.running).toBe('Looking at your last 7 days')
    expect(v.rows).toContainEqual(['In range, 3.9 to 10.0', '74.0%'])
    expect(v.rows).toContainEqual(['Below 3.9', '6.5%'])
    expect(v.rows).toContainEqual(['Above 10.0', '19.5%'])
  })

  it('has no rows while the tool runs', () => {
    expect(describeTool('get_period_summary', { days: 7 }).rows).toEqual([])
  })

  it('reads compare_periods in time order', () => {
    const a = { ...summary, pct: { ...summary.pct, in_range_3_9_to_10_0: 74 } }
    const b = { ...summary, from: '2026-10-14', pct: { ...summary.pct, in_range_3_9_to_10_0: 64 } }
    const v = describeTool('compare_periods', { a_from: '2026-10-21', a_to: '2026-10-27', b_from: '2026-10-14', b_to: '2026-10-20' }, { a, b })
    expect(v.label).toBe('Compared Wed 21 to Tue 27 Oct with Wed 14 to Tue 20 Oct')
    expect(v.rows[0]).toEqual(['In range', '64.0% then 74.0%'])
  })

  it('names the settings change day', () => {
    const v = describeTool(
      'compare_settings_change',
      { change_id: 'c-2026-09-30-09-26' },
      { change: { day: '2026-09-30' }, before: { below39: 1.1, pct: { in: 42.7 }, wear: 68.7 }, after: { below39: 7.4, pct: { in: 64.7 }, wear: 91.5 }, days: 14 },
    )
    expect(v.label).toBe('Compared before and after 30 Sep')
    expect(v.rows[0]).toEqual(['Below 3.9', '1.1% then 7.4%'])
    expect(describeTool('compare_settings_change', { change_id: 'c-2026-09-30-09-26' }).label).toBe(
      'Compared before and after 30 Sep',
    )
  })

  it('marks a skipped day', () => {
    const v = describeTool('get_day', {}, { skipped: 'off' })
    expect(v.skipped).toBe(true)
    expect(v.label).toBe('Skipped reading a single day')
  })

  it('shows a tool error as a row', () => {
    const v = describeTool('compare_settings_change', { change_id: 'x' }, { error: 'No change with id x.' })
    expect(v.rows).toEqual([['Problem', 'No change with id x.']])
  })

  it('counts events', () => {
    const v = describeTool('list_events', { type: 'low', days: 7 }, [{ lowest_mmol: 3.1 }, { lowest_mmol: 2.8 }])
    expect(v.label).toBe('Looked for lows, last 7 days')
    expect(v.rows).toEqual([
      ['Found', '2'],
      ['Lowest reading', '2.8 mmol/L'],
    ])
  })
})

describe('ingForm', () => {
  it('turns past tense labels into running ones', () => {
    expect(ingForm('Read Saturday 24 October in detail')).toBe('Reading Saturday 24 October in detail')
    expect(ingForm('Checked sensor')).toBe('Checking sensor')
  })
})

describe('cardFor', () => {
  it('picks a card only for results that have the numbers', () => {
    expect(cardFor('get_period_summary', summary)).toBe('period')
    expect(cardFor('get_day', { glucose_every_15_min: [] })).toBeNull()
    expect(cardFor('get_day', { glucose_every_15_min: [{ time: '00:00', mmol: 6 }] })).toBe('day')
    expect(cardFor('get_day', { skipped: 'off' })).toBeNull()
    expect(cardFor('list_events', [])).toBeNull()
    expect(cardFor('get_patterns', { patterns: [] })).toBeNull()
  })
})

describe('parsing', () => {
  it('parses JSON results and arguments', () => {
    expect(parseResult('{"a":1}')).toEqual({ a: 1 })
    expect(parseResult('not json')).toBe('not json')
    expect(toolInput({ arguments: '{"days":7}' })).toEqual({ days: 7 })
    expect(toolInput({ input: { days: 3 }, arguments: '{"days":7}' })).toEqual({ days: 3 })
  })
})
