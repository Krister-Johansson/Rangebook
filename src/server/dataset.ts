import { asc, sql } from 'drizzle-orm'

import { db } from '#/db'
import {
  alarms,
  basalEvents,
  bgReadings,
  boluses,
  cgmReadings,
  imports,
} from '#/db/schema'
import { addDays, classifyBolus, dayOf, toMin } from '#/lib/glucose/core'
import type { Dataset } from '#/lib/glucose/core'

// The analysis reads the last 120 days so the 90-day views also have the
// week before for comparisons. The dataset is rebuilt after each import.
const WINDOW_DAYS = 120

// Keyed on the newest import time: a "replace" import restarts ids, so ids alone could repeat.
let cache: { stamp: string | null; data: Dataset | null } | null = null

export async function loadDataset(): Promise<Dataset | null> {
  const [{ latest }] = await db
    .select({ latest: sql<string | null>`max(${imports.createdAt})::text` })
    .from(imports)
  if (cache && cache.stamp === latest) return cache.data

  const [{ lastTs }] = await db
    .select({ lastTs: sql<string | null>`max(${cgmReadings.ts})::text` })
    .from(cgmReadings)
  if (!lastTs) {
    cache = { stamp: latest, data: null }
    return null
  }
  const since = `${addDays(dayOf(lastTs), -(WINDOW_DAYS - 1))} 00:00:00`
  const after = sql`>= ${since}`

  const [cgm, bol, bas, alm, bg] = await Promise.all([
    db.select().from(cgmReadings).where(sql`${cgmReadings.ts} ${after}`).orderBy(asc(cgmReadings.ts)),
    db.select().from(boluses).where(sql`${boluses.ts} ${after}`).orderBy(asc(boluses.ts)),
    db.select().from(basalEvents).where(sql`${basalEvents.ts} >= ${addDays(dayOf(since), -1)}`).orderBy(asc(basalEvents.ts)),
    db.select().from(alarms).where(sql`${alarms.ts} ${after}`).orderBy(asc(alarms.ts)),
    db.select({ ts: bgReadings.ts }).from(bgReadings).where(sql`${bgReadings.ts} ${after}`),
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
  cache = { stamp: latest, data }
  return data
}
