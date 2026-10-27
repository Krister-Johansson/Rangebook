import { createServerFn } from '@tanstack/react-start'
import { setCookie } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db'
import { people } from '#/db/schema'
import { PERSON_COOKIE, activePersonId } from './active-person'
import { listPeopleRows } from './people-store'

export type { Person } from './people-store'

function remember(id: number) {
  setCookie(PERSON_COOKIE, String(id), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
}

export const getPeople = createServerFn({ method: 'GET' }).handler(async () => ({
  people: await listPeopleRows(),
  activeId: await activePersonId(),
}))

export const setActivePerson = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(({ data }) => {
    remember(data.id)
    return { ok: true }
  })

const nameSchema = z.string().trim().min(1, 'Enter a name').max(60)

export const createPerson = createServerFn({ method: 'POST' })
  .validator(z.object({ name: nameSchema }))
  .handler(async ({ data }) => {
    const [row] = await db.insert(people).values({ name: data.name }).returning({ id: people.id })
    remember(row.id)
    return row
  })

export const renamePerson = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int(), name: nameSchema }))
  .handler(async ({ data }) => {
    await db.update(people).set({ name: data.name }).where(eq(people.id, data.id))
    return { ok: true }
  })

/** Deletes the person and, through cascading keys, all their imports, readings and saved questions. */
export const deletePerson = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await db.delete(people).where(eq(people.id, data.id))
    return { ok: true }
  })
