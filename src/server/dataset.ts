import { and, asc, eq, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'

import { db } from '#/db'
import {
  alarms,
  basalEvents,
  bgReadings,
  boluses,
  cgmReadings,
  dailyInsulin,
  imports,
} from '#/db/schema'
import { addDays, classifyBolus, dayOf, toMin } from '#/lib/glucose/core'
import type { Dataset } from '#/lib/glucose/core'

// The analysis reads the last 120 days so the 90-day views also have the
// week before for comparisons. The dataset is rebuilt after each import.
const WINDOW_DAYS = 120

type DataTable =
  | typeof cgmReadings
  | typeof bgReadings
  | typeof boluses
  | typeof basalEvents
  | typeof alarms
  | typeof dailyInsulin

/**
 * Rows of one person that no other import overrides. Imports can overlap (a
 * weekly 90-day export repeats most of the last one). Inside the time span of
 * an import, its rows replace those of any import whose data ends earlier
 * (ties go to the later upload). That also replaces the cut-off last day of an
 * older export with the complete day from a newer one.
 */
export function currentRows(t: DataTable, personId: number): SQL {
  return and(
    eq(t.personId, personId),
    sql`not exists (
      select 1 from ${imports} n, ${imports} o
      where o.id = ${t.importId} and n.person_id = o.person_id and n.id <> o.id
        and ${t.ts} between n.data_start and n.data_end
        and (n.data_end, n.id) > (o.data_end, o.id)
    )`,
  )!
}

// Per person, keyed on the person's import ids and spans, so adding or
// deleting an import rebuilds the dataset.
const cache = new Map<number, { stamp: string; data: Dataset | null }>()

export async function loadDataset(personId: number): Promise<Dataset | null> {
  const [{ stamp }] = await db
    .select({
      stamp: sql<string>`coalesce(string_agg(${imports.id} || ':' || coalesce(${imports.dataEnd}::text, ''), ',' order by ${imports.id}), '')`,
    })
    .from(imports)
    .where(eq(imports.personId, personId))
  const hit = cache.get(personId)
  if (hit && hit.stamp === stamp) return hit.data

  const [{ lastTs }] = await db
    .select({ lastTs: sql<string | null>`max(${cgmReadings.ts})::text` })
    .from(cgmReadings)
    .where(eq(cgmReadings.personId, personId))
  if (!lastTs) {
    cache.set(personId, { stamp, data: null })
    return null
  }
  const since = `${addDays(dayOf(lastTs), -(WINDOW_DAYS - 1))} 00:00:00`
  const recent = (t: DataTable, from = since) => and(currentRows(t, personId), sql`${t.ts} >= ${from}`)

  const [cgm, bol, bas, alm, bg] = await Promise.all([
    db.select().from(cgmReadings).where(recent(cgmReadings)).orderBy(asc(cgmReadings.ts)),
    db.select().from(boluses).where(recent(boluses)).orderBy(asc(boluses.ts)),
    db.select().from(basalEvents).where(recent(basalEvents, addDays(dayOf(since), -1))).orderBy(asc(basalEvents.ts)),
    db.select().from(alarms).where(recent(alarms)).orderBy(asc(alarms.ts)),
    db.select({ ts: bgReadings.ts }).from(bgReadings).where(recent(bgReadings)),
  ])

  const fingersticks = new Set(bg.map((b) => b.ts))
  const readings = cgm.map((r) => ({
    min: toMin(r.ts),
    ts: r.ts,
    v: r.mmol,
    limit: r.sensorLimit ?? null,
  }))

  const data: Dataset = {
    readings,
    boluses: bol.map((b) => ({
      min: toMin(b.ts),
      ts: b.ts,
      kind: classifyBolus(
        { ts: b.ts, carbs: b.carbsG, bg: b.bgInputMmol, carbRatio: b.carbRatio },
        fingersticks,
      ),
      units: b.deliveredU,
      carbs: b.carbsG ?? 0,
      bg: b.bgInputMmol,
      ratio: b.carbRatio,
    })),
    basal: bas.map((b) => ({
      min: toMin(b.ts),
      ts: b.ts,
      suspend: b.insulinType === 'Suspend',
      durationMin: b.durationMin ?? 5,
      rate: b.rateUPerH ?? 0,
    })),
    alarms: alm.map((a) => ({ min: toMin(a.ts), ts: a.ts, event: a.event })),
    firstDay: dayOf(readings[0].ts),
    lastDay: dayOf(lastTs),
    lastTs,
  }
  cache.set(personId, { stamp, data })
  return data
}
