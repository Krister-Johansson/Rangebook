import { asc } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db'
import { people } from '#/db/schema'
import { loadDataset } from '#/server/dataset'

export const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

export const json = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
})

export const personArg = {
  person: z
    .string()
    .optional()
    .describe('Name or id from list_people. Needed when more than one person is stored.'),
}

/**
 * Picks the person a tool call is about: the `person` argument, else
 * RANGEBOOK_PERSON from the server config, else the only person stored.
 */
export async function resolvePerson(person?: string) {
  const rows = await db.select({ id: people.id, name: people.name }).from(people).orderBy(asc(people.id))
  if (rows.length === 0) {
    throw new Error('No people stored yet. Add a person and import an export on http://localhost:3000/people first.')
  }
  const wanted = (person ?? process.env.RANGEBOOK_PERSON ?? '').trim().toLowerCase()
  if (!wanted) {
    if (rows.length === 1) return rows[0]
    throw new Error(
      `More than one person is stored (${rows.map((r) => r.name).join(', ')}). Pass person with one of these names.`,
    )
  }
  const match = rows.find((r) => String(r.id) === wanted || r.name.toLowerCase() === wanted)
  if (!match) {
    throw new Error(`No person called "${person}". Stored people: ${rows.map((r) => r.name).join(', ')}.`)
  }
  return match
}

export async function requireData(person?: string) {
  const p = await resolvePerson(person)
  const ds = await loadDataset(p.id)
  if (!ds) {
    throw new Error(
      `No data imported for ${p.name} yet. Import an export on http://localhost:3000/import first.`,
    )
  }
  return ds
}
