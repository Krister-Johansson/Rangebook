import { expect, test } from 'vitest'

import { prefsSchema, prefsUpdateSchema } from './preferences'

test('saving one setting carries only that setting', () => {
  expect(prefsUpdateSchema.parse({ chatModel: 'anthropic/claude-haiku-5.5' })).toEqual({ chatModel: 'anthropic/claude-haiku-5.5' })
  expect(prefsUpdateSchema.parse({ excludeNotNormal: true })).toEqual({ excludeNotNormal: true })
})

test('reading settings still fills defaults for missing ones', () => {
  expect(prefsSchema.parse({ goalId: 'lunch' })).toMatchObject({ chatModel: 'anthropic/claude-sonnet-5.5', excludeNotNormal: false })
})
