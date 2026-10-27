import { createServerFn } from '@tanstack/react-start'
import { desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db'
import {
  alarms,
  basalEvents,
  bgReadings,
  boluses,
  cgmReadings,
  imports,
  people,
} from '#/db/schema'
import { currentRows } from './dataset'
import { ingestPrepared, prepareUploads } from './ingest'
import type { IngestResult } from './ingest'
import { activePersonId, requirePersonId } from './active-person'

export type IngestResponse =
  | { status: 'done'; personId: number; result: IngestResult }
  | {
      // The export's name does not match this person's earlier exports, or it
      // matches another person. Nothing was stored; resend with confirmed.
      status: 'check'
      exportName: string
      personName: string
      knownNames: string[]
      otherPerson: { id: number; name: string } | null
    }

const sameName = (a: string | null, b: string | null) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

export const ingestExport = createServerFn({ method: 'POST' })
  .validator((data) => {
    if (!(data instanceof FormData)) throw new Error('Expected FormData')
    const files = data.getAll('files').filter((f): f is File => f instanceof File)
    if (files.length === 0) throw new Error('No file uploaded')
    const personId = Number(data.get('personId'))
    return {
      files,
      personId: Number.isInteger(personId) && personId > 0 ? personId : null,
      replaceExisting: data.get('replaceExisting') === 'true',
      confirmed: data.get('confirmed') === 'true',
    }
  })
  .handler(async ({ data }): Promise<IngestResponse> => {
    const personId = data.personId ?? (await requirePersonId())
    const [person] = await db.select().from(people).where(eq(people.id, personId))
    if (!person) throw new Error('That person no longer exists.')

    const uploads = await Promise.all(
      data.files.map(async (f) => ({
        name: f.name,
        bytes: new Uint8Array(await f.arrayBuffer()),
      })),
    )
    const prepared = prepareUploads(uploads)
    const exportName = prepared.meta.patientName

    if (!data.confirmed && exportName) {
      const seen = await db
        .selectDistinct({ personId: imports.personId, name: imports.patientName, personName: people.name })
        .from(imports)
        .innerJoin(people, eq(people.id, imports.personId))
      const knownNames = [
        ...new Set(seen.filter((s) => s.personId === personId && s.name).map((s) => s.name!)),
      ]
      const other = seen.find((s) => s.personId !== personId && sameName(s.name, exportName))
      const mismatch = knownNames.length > 0 && !knownNames.some((n) => sameName(n, exportName))
      if (mismatch || other) {
        return {
          status: 'check',
          exportName,
          personName: person.name,
          knownNames,
          otherPerson: other ? { id: other.personId, name: other.personName } : null,
        }
      }
    }

    const result = await ingestPrepared(
      personId,
      data.files.map((f) => f.name).join(', '),
      prepared,
      data.replaceExisting,
    )
    return { status: 'done', personId, result }
  })

/** Imports of the person being viewed, newest first. */
export const listImports = createServerFn({ method: 'GET' }).handler(async () => {
  const personId = await activePersonId()
  if (personId === null) return []
  return db
    .select()
    .from(imports)
    .where(eq(imports.personId, personId))
    .orderBy(desc(imports.createdAt))
})

/** Deletes one import and its rows. Overlapping older imports show through again. */
export const deleteImport = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await db.delete(imports).where(eq(imports.id, data.id))
    return { ok: true }
  })

export const getDataOverview = createServerFn({ method: 'GET' }).handler(
  async () => {
    const personId = await activePersonId()
    const count = (t: typeof cgmReadings | typeof bgReadings | typeof boluses | typeof basalEvents | typeof alarms) =>
      db
        .select({
          rows: sql<number>`count(*)::int`,
          first: sql<string | null>`min(${t.ts})::text`,
          last: sql<string | null>`max(${t.ts})::text`,
        })
        .from(t)
        .where(personId === null ? sql`false` : currentRows(t, personId))
        .then((r) => r[0])

    const [cgm, bg, bolus, basal, alarm] = await Promise.all([
      count(cgmReadings),
      count(bgReadings),
      count(boluses),
      count(basalEvents),
      count(alarms),
    ])
    return { cgm, bg, bolus, basal, alarm }
  },
)
