import { getCookie } from '@tanstack/react-start/server'
import { asc } from 'drizzle-orm'

import { db } from '#/db'
import { people } from '#/db/schema'

// Server-only helpers. Keep them out of files that also define server
// functions: the client imports those files, and plain exports would pull the
// database driver into the browser bundle.

// The person being viewed lives in a cookie, so server-rendered pages and
// server functions agree on it without passing an id through every call.
export const PERSON_COOKIE = 'rb-person'

/** The person from the cookie, or the first person when the cookie is missing or stale. */
export async function activePersonId(): Promise<number | null> {
  const fromCookie = Number(getCookie(PERSON_COOKIE))
  const rows = await db.select({ id: people.id }).from(people).orderBy(asc(people.id))
  if (rows.some((r) => r.id === fromCookie)) return fromCookie
  return rows[0]?.id ?? null
}

export async function requirePersonId(): Promise<number> {
  const id = await activePersonId()
  if (id === null) throw new Error('Add a person before importing data.')
  return id
}

