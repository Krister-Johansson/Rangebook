import { describe, expect, test } from 'vitest'

import { dataset, dayOfReadings, days } from '#/test/fixtures'
import { activityDays, compareActivity, notNormalDays, withoutDays } from './lifelog'
import type { LogEntry } from './lifelog'

const entry = (e: Partial<LogEntry>): LogEntry => ({
  id: 1,
  kind: 'tag',
  tag: 'sick',
  text: '',
  startDate: '2026-01-05',
  endDate: null,
  weekdays: null,
  startMin: null,
  endMin: null,
  atMin: null,
  author: 'you',
  ...e,
})

test('not-normal days cover every day of a tag, and only tags', () => {
  const set = notNormalDays([
    entry({ startDate: '2026-01-05', endDate: '2026-01-07' }),
    entry({ kind: 'note', startDate: '2026-01-10' }),
  ])
  expect([...set]).toEqual(['2026-01-05', '2026-01-06', '2026-01-07'])
})

test('activity days follow the weekly schedule (0 is Monday)', () => {
  const badminton = entry({ kind: 'activity', weekdays: [1, 3], startDate: '2026-01-05', endDate: '2026-01-15' })
  // Tuesdays and Thursdays from Mon 5 Jan to Thu 15 Jan.
  expect(activityDays(badminton, '2026-01-01', '2026-01-31')).toEqual(['2026-01-06', '2026-01-08', '2026-01-13', '2026-01-15'])
})

describe('compareActivity', () => {
  // Lows from 18:00 to 20:00 on Tuesdays, steady otherwise.
  const readings = days('2026-01-05', 28).flatMap((d) =>
    dayOfReadings(d, (h) => (new Date(`${d}T00:00:00Z`).getUTCDay() === 2 && h >= 18 && h < 20 ? 3.5 : 7)),
  )
  const ds = dataset({ readings })
  const badminton = entry({ kind: 'activity', text: 'Badminton', weekdays: [1], startMin: 18 * 60, endMin: 20 * 60, startDate: '2026-01-05' })

  test('compares the activity hours with the same hours on other days', () => {
    const c = compareActivity(ds, badminton, new Set())
    expect(c.daysWith).toBe(4)
    expect(c.daysWithout).toBe(24)
    expect(c.rows[0]).toMatchObject({ label: 'During, 18:00 to 20:00', withPct: 100, withoutPct: 0 })
    expect(c.lowsMoreCommon).toBe(true)
    expect(c.question).toMatch(/during badminton/)
  })

  test('no question when lows are not more common', () => {
    const calm = dataset({ readings: days('2026-01-05', 28).flatMap((d) => dayOfReadings(d, () => 7)) })
    const c = compareActivity(calm, badminton, new Set())
    expect(c.lowsMoreCommon).toBe(false)
    expect(c.question).toBeNull()
  })

  test('leaves out not-normal days', () => {
    const c = compareActivity(ds, badminton, new Set(['2026-01-06']))
    expect(c.daysWith).toBe(3)
  })
})

test('withoutDays removes every row on those days', () => {
  const ds = dataset({ readings: days('2026-01-05', 3).flatMap((d) => dayOfReadings(d, () => 7)) })
  const out = withoutDays(ds, new Set(['2026-01-06']))
  expect(out.readings.some((r) => r.ts.startsWith('2026-01-06'))).toBe(false)
  expect(out.readings).toHaveLength(288 * 2)
})
