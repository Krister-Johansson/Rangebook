import { expect, test } from 'vitest'

import { chatStatusFrom } from './status'

test('the chat is off without an OpenRouter key', () => {
  expect(chatStatusFrom({})).toEqual({ enabled: false, fake: false })
  expect(chatStatusFrom({ OPENROUTER_API_KEY: '  ' })).toEqual({ enabled: false, fake: false })
})

test('the chat is on with a key, or in fake mode', () => {
  expect(chatStatusFrom({ OPENROUTER_API_KEY: 'sk-or-test' })).toEqual({ enabled: true, fake: false })
  expect(chatStatusFrom({ RANGEBOOK_FAKE_CHAT: '1' })).toEqual({ enabled: true, fake: true })
})
