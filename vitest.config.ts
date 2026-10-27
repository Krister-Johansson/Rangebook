import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Two groups:
// - unit: the default. Pure calculations and the chat agent with a fake
//   OpenRouter. No network, no database, no API key.
// - live: calls OpenRouter with OPENROUTER_API_KEY from .env.local and spends
//   credits. Runs only with `pnpm test:live`.
const src = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  resolve: { alias: { '#': src, '@': src } },
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.live.test.ts'],
        },
      },
      {
        test: {
          name: 'live',
          environment: 'node',
          include: ['src/**/*.live.test.ts'],
          setupFiles: ['./src/test/live-setup.ts'],
          testTimeout: 90_000,
        },
      },
    ],
  },
})
