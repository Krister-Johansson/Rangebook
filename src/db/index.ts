import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'

import * as schema from './schema.ts'

config({ path: ['.env.local', '.env'], quiet: true })

export const db = drizzle(process.env.DATABASE_URL!, { schema })
