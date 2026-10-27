import { expect, test } from 'vitest'

import { hasDoseValue } from './dose-guard'

test.each([
  'Should my lunch ratio be 1:8?',
  'Lower basal to 0.6 U/h at night?',
  'Take 2 units less?',
  'Is 10 g/U right for breakfast?',
  'Give 1.5u before badminton?',
])('flags a dose or setting value: %s', (text) => {
  expect(hasDoseValue(text)).toBe(true)
})

test.each([
  'Why do lows often come about 2 hours after lunch?',
  'Time below 3.9 went from 1.0% to 7.4%. What should we look at first?',
  'Lows after 20 of 47 lunch boluses with carbs. Should we look at lunch together?',
  'Is it OK that I enter carbs about 1.6 times a day?',
])('lets a plain question through: %s', (text) => {
  expect(hasDoseValue(text)).toBe(false)
})
