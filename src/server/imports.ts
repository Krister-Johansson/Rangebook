import { createServerFn } from '@tanstack/react-start'
import { desc, sql } from 'drizzle-orm'

import { db } from '#/db'
import {
  alarms,
  basalEvents,
  bgReadings,
  boluses,
  cgmReadings,
  imports,
} from '#/db/schema'
import { ingestUploads } from './ingest'

export const ingestExport = createServerFn({ method: 'POST' })
  .validator((data) => {
    if (!(data instanceof FormData)) throw new Error('Expected FormData')
    const files = data.getAll('files').filter((f): f is File => f instanceof File)
    if (files.length === 0) throw new Error('No file uploaded')
    return { files, replaceExisting: data.get('replaceExisting') === 'true' }
  })
  .handler(async ({ data }) => {
    const uploads = await Promise.all(
      data.files.map(async (f) => ({
        name: f.name,
        bytes: new Uint8Array(await f.arrayBuffer()),
      })),
    )
    return ingestUploads(
      data.files.map((f) => f.name).join(', '),
      uploads,
      data.replaceExisting,
    )
  })

export const listImports = createServerFn({ method: 'GET' }).handler(() =>
  db.select().from(imports).orderBy(desc(imports.createdAt)),
)

export const getDataOverview = createServerFn({ method: 'GET' }).handler(
  async () => {
    const count = (t: typeof cgmReadings | typeof bgReadings | typeof boluses | typeof basalEvents | typeof alarms) =>
      db
        .select({
          rows: sql<number>`count(*)::int`,
          first: sql<string | null>`min(${t.ts})::text`,
          last: sql<string | null>`max(${t.ts})::text`,
        })
        .from(t)
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
