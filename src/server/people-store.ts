import { asc, eq, sql } from 'drizzle-orm'

import { db } from '#/db'
import { imports, people } from '#/db/schema'

// Plain database access, shared by the app's server functions and the MCP server.

export interface Person {
  id: number
  name: string
  imports: number
  lastData: string | null
}

export async function listPeopleRows(): Promise<Person[]> {
  return db
    .select({
      id: people.id,
      name: people.name,
      imports: sql<number>`count(${imports.id})::int`,
      lastData: sql<string | null>`max(${imports.dataEnd})::text`,
    })
    .from(people)
    .leftJoin(imports, eq(imports.personId, people.id))
    .groupBy(people.id)
    .orderBy(asc(people.id))
}

