import { describe, expect, test } from 'vitest'

import { basal, bolus, dataset, dayOfReadings, days } from '#/test/fixtures'
import { compareAround, findSettingsChanges } from './changes'

const START = '2026-01-05'

/** A long profile-rate segment each day at 09:30, plus a carb bolus with its ratio at noon. */
function profileDays(from: string, count: number, rate: number, ratio: number) {
  return days(from, count).flatMap((d) => ({
    basal: [basal(d, '09:30', rate, 90), basal(d, '13:05', 1.835, 5)],
    boluses: [bolus(d, '12:00', { ratio })],
  }))
}

function build(parts: ReturnType<typeof profileDays>) {
  return dataset({ basal: parts.flatMap((p) => p.basal), boluses: parts.flatMap((p) => p.boluses) })
}

describe('findSettingsChanges', () => {
  test('finds one change with basal and carb ratio before and after', () => {
    const ds = build([...profileDays(START, 10, 0.7, 10), ...profileDays('2026-01-15', 10, 0.8, 9)])
    const changes = findSettingsChanges(ds)
    expect(changes).toHaveLength(1)
    expect(changes[0].day).toBe('2026-01-15')
    expect(changes[0].rows).toEqual([
      { setting: 'Basal', before: '0.7 U/h all day', after: '0.8 U/h all day' },
      { setting: 'Carb ratio', before: '10.0', after: '9.0' },
    ])
  })

  test('ignores Control-IQ rates in short segments', () => {
    const ds = build(profileDays(START, 10, 0.7, 10))
    expect(findSettingsChanges(ds)).toEqual([])
  })

  test('one odd long segment that is not seen again is not a change', () => {
    const parts = profileDays(START, 10, 0.7, 10)
    parts[4].basal[0] = basal('2026-01-09', '09:30', 0.9, 90)
    expect(findSettingsChanges(build(parts))).toEqual([])
  })

  test('newest change first', () => {
    const ds = build([...profileDays(START, 8, 0.7, 10), ...profileDays('2026-01-13', 8, 0.8, 10), ...profileDays('2026-01-21', 8, 0.9, 10)])
    expect(findSettingsChanges(ds).map((c) => c.day)).toEqual(['2026-01-21', '2026-01-13'])
  })
})

describe('compareAround', () => {
  const low = (h: number) => (h >= 14 && h < 15 ? 3.4 : 7)
  const steady = () => 7
  const readings = [
    ...days(START, 14).flatMap((d) => dayOfReadings(d, steady)),
    ...days('2026-01-19', 14).flatMap((d) => dayOfReadings(d, low)),
  ]

  test('lows first: says when time below 3.9 went up', () => {
    const ds = dataset({ readings })
    const c = compareAround(ds, { day: '2026-01-19' }, 14, new Set(), [])
    expect(c.before.below39).toBe(0)
    expect(c.after.below39).toBeGreaterThan(4)
    expect(c.lowsUp).toBe(true)
    expect(c.question).toMatch(/time below 3\.9 went from 0\.0% to \d+\.\d%/)
    expect(c.warnings).toEqual([])
  })

  test('warns about short windows, low wear and overlapping changes', () => {
    const ds = dataset({ readings: readings.filter((_, i) => i % 3 === 0) })
    const c = compareAround(ds, { day: '2026-01-19' }, 21, new Set(), [{ day: '2026-01-25' }])
    expect(c.warnings.join(' ')).toMatch(/Only 14 days before/)
    expect(c.warnings.join(' ')).toMatch(/Sensor wear before the change was 33%/)
    expect(c.warnings.join(' ')).toMatch(/Another change on Sun 25 Jan/)
  })

  test('not-normal days are left out and counted', () => {
    const ds = dataset({ readings })
    const c = compareAround(ds, { day: '2026-01-19' }, 14, new Set(['2026-01-20', '2026-01-21']), [])
    expect(c.after.days).toBe(12)
    expect(c.after.daysLeftOut).toBe(2)
  })

  test('never gives a verdict', () => {
    const c = compareAround(dataset({ readings }), { day: '2026-01-19' }, 14, new Set(), [])
    expect(`${c.question} ${c.otherChanges ?? ''} ${c.warnings.join(' ')}`).not.toMatch(/\b(better|worse|improv)/i)
  })
})
