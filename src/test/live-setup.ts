import { config } from 'dotenv'

// Live tests read the real key from .env.local. Without it they fail loudly
// instead of silently passing.
config({ path: ['.env.local', '.env'], quiet: true })
if (!process.env.OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY is not set. Add it to .env.local to run pnpm test:live.')
}
