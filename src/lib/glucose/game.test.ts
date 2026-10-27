import { describe, expect, test } from 'vitest'

import { days } from '#/test/fixtures'
import { computeGame, levelFor, stageFor, weekStartOf } from './game'
import type { DayActivity, GameInput } from './game'

// Monday 5 January 2026 starts the first week in these tests.
const MONDAY = '2026-01-05'

function activity(day: string, d: Partial<DayActivity> = {}): DayActivity {
  return { day, readings: 288, inRange: 200, carbBoluses: 4, lunchCarbs: true, ...d }
}

function game(input: Partial<GameInput> & { days: DayActivity[] }) {
  return computeGame({ longestStretch: null, questions: [], picks: [], today: input.days.at(-1)!.day, freshFrom: null, ...input })
}

describe('levels', () => {
  test.each([
    [0, 1],
    [99, 1],
    [100, 2],
    [1349, 6],
    [1350, 7],
    [2700, 10],
    [3249, 10],
    [3250, 11],
  ])('%i XP is level %i', (xp, level) => {
    expect(levelFor(xp).level).toBe(level)
  })

  test('progress inside a level', () => {
    expect(levelFor(1535)).toMatchObject({ level: 7, from: 1350, to: 1750, into: 185, need: 400, left: 215 })
  })

  test('companion stages follow levels', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 9, 10, 14].map(stageFor)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
  })
})

test('weeks start on Monday', () => {
  expect(weekStartOf('2026-01-05')).toBe('2026-01-05')
  expect(weekStartOf('2026-01-11')).toBe('2026-01-05')
  expect(weekStartOf('2026-01-12')).toBe('2026-01-12')
})

describe('XP', () => {
  test('sensor days and carbs, with carbs capped at 4 a day', () => {
    const g = game({ days: [activity(MONDAY, { carbBoluses: 7 }), activity('2026-01-06', { readings: 100, carbBoluses: 1 })] })
    // Day 1: sensor day 10 + 4 x 5. Day 2: under 70% wear, so only 1 x 5.
    expect(g.weeks[0].sensor).toBe(10)
    expect(g.weeks[0].carbs).toBe(25)
  })

  test('two full weeks earn bronze badges and their XP', () => {
    const g = game({ days: days(MONDAY, 14).map((d) => activity(d)) })
    const earned = Object.fromEntries(g.badges.map((b) => [b.id, b.earned.map((e) => e.tier)]))
    expect(earned.fullweek).toEqual(['bronze'])
    expect(earned.meal).toEqual(['bronze']) // 56 boluses with carbs, bronze at 50
    expect(earned.lunch).toEqual(['bronze']) // 10 school lunches
    expect(earned.challenger).toEqual([])
    // 14 x (10 + 20) + 3 badges x 25
    expect(g.xp).toBe(14 * 30 + 3 * 25)
  })

  test('a question gives XP once, in the week it was first saved', () => {
    const g = game({
      days: days(MONDAY, 7).map((d) => activity(d)),
      questions: [{ patternId: 'p1', firstSaved: '2026-01-07' }],
    })
    expect(g.weeks[0].question).toBe(5)
    expect(g.badges.find((b) => b.id === 'clinic')!.earned).toHaveLength(1)
  })

  test('the same data always gives the same XP', () => {
    const input = { days: days(MONDAY, 21).map((d) => activity(d)) }
    expect(game(input).xp).toBe(game(input).xp)
  })
})

describe('weekly challenges', () => {
  test('a completed challenge gives 50 XP and shows in history', () => {
    const g = game({
      days: days(MONDAY, 14).map((d) => activity(d)),
      picks: [{ weekStart: MONDAY, challengeId: 'wear' }],
      today: '2026-01-14',
    })
    expect(g.weeks[0].challenge).toBe(50)
    expect(g.history[0]).toMatchObject({ id: 'wear', got: 7, target: 7, done: true })
  })

  test('the last imported day is not counted as missed', () => {
    // Data ends Wednesday with a cut-off day that has only 1 bolus with carbs.
    const data = [activity(MONDAY), activity('2026-01-06'), activity('2026-01-07', { carbBoluses: 1, readings: 100 })]
    const g = game({ days: data, today: '2026-01-07' })
    const meals = g.thisWeek.progress.find((p) => p.id === 'meals')!
    expect(meals.marks).toEqual([true, true, null, null, null, null, null])
  })

  test('the challenge can be changed until Wednesday', () => {
    expect(game({ days: [activity(MONDAY)], today: '2026-01-07' }).thisWeek.canChange).toBe(true)
    expect(game({ days: [activity(MONDAY)], today: '2026-01-08' }).thisWeek.canChange).toBe(false)
  })
})

describe('companion mood', () => {
  test('sleepy after 8 days without new data', () => {
    const g = game({ days: [activity(MONDAY)], today: '2026-01-13' })
    expect(g.mood).toBe('sleepy')
    expect(g.line).toContain('8 days')
  })

  test('never mentions glucose values', () => {
    const g = game({ days: days(MONDAY, 14).map((d) => activity(d, { inRange: 50 })) })
    expect(g.line).not.toMatch(/range|low|high|mmol/i)
  })
})

test('personal bests only use days with enough sensor wear', () => {
  const g = game({
    days: [activity(MONDAY, { inRange: 280 }), activity('2026-01-06', { readings: 50, inRange: 50 })],
  })
  const day = g.bests.find((b) => b.id === 'day')!
  expect(day.day).toBe(MONDAY)
  expect(day.value).toBe('97.2%')
})
