import { asc, eq, sql } from 'drizzle-orm'

import { db } from '#/db'
import { boluses, cgmReadings, imports } from '#/db/schema'
import { addDays, toMin } from '#/lib/glucose/core'
import type { DayActivity, Stretch } from '#/lib/glucose/game'
import { currentRows } from './dataset'

// Per-day counts over a person's whole history, for XP, badges and personal
// bests. The analysis dataset only holds the last 120 days; these stay small
// because they are aggregated in Postgres.

const cache = new Map<number, { stamp: string; data: History }>()

export interface History {
  days: DayActivity[]
  longestStretch: Stretch | null
  lastImport: string | null
  // First day that is new in the latest import, or null with only one import.
  newSince: string | null
}

export async function loadHistory(personId: number): Promise<History> {
  const [{ stamp, lastImport, previousEnd }] = await db
    .select({
      stamp: sql<string>`coalesce(string_agg(${imports.id} || ':' || coalesce(${imports.dataEnd}::text, ''), ',' order by ${imports.id}), '')`,
      lastImport: sql<string | null>`max(${imports.createdAt})::text`,
      // End of the previous import's data: anything after it is new in the latest import.
      previousEnd: sql<string | null>`(array_agg(${imports.dataEnd}::text order by ${imports.dataEnd} desc nulls last))[2]`,
    })
    .from(imports)
    .where(eq(imports.personId, personId))
  const hit = cache.get(personId)
  if (hit && hit.stamp === stamp) return hit.data

  const [cgmDays, bolusDays, readings] = await Promise.all([
    db
      .select({
        day: sql<string>`${cgmReadings.ts}::date::text`,
        readings: sql<number>`count(*)::int`,
        inRange: sql<number>`count(*) filter (where ${cgmReadings.mmol} >= 3.9 and ${cgmReadings.mmol} <= 10.0)::int`,
      })
      .from(cgmReadings)
      .where(currentRows(cgmReadings, personId))
      .groupBy(sql`1`),
    db
      .select({
        day: sql<string>`${boluses.ts}::date::text`,
        carbBoluses: sql<number>`count(*) filter (where ${boluses.carbsG} > 0)::int`,
        lunch: sql<number>`count(*) filter (where ${boluses.carbsG} > 0 and extract(hour from ${boluses.ts}) >= 10 and extract(hour from ${boluses.ts}) < 15)::int`,
      })
      .from(boluses)
      .where(currentRows(boluses, personId))
      .groupBy(sql`1`),
    db
      .select({ ts: sql<string>`${cgmReadings.ts}::text`, v: cgmReadings.mmol })
      .from(cgmReadings)
      .where(currentRows(cgmReadings, personId))
      .orderBy(asc(cgmReadings.ts)),
  ])

  const byDay = new Map<string, DayActivity>()
  const get = (day: string) => {
    let d = byDay.get(day)
    if (!d) {
      d = { day, readings: 0, inRange: 0, carbBoluses: 0, lunchCarbs: false }
      byDay.set(day, d)
    }
    return d
  }
  for (const r of cgmDays) Object.assign(get(r.day), { readings: r.readings, inRange: r.inRange })
  for (const r of bolusDays) Object.assign(get(r.day), { carbBoluses: r.carbBoluses, lunchCarbs: r.lunch > 0 })

  // Fill gaps so weeks without data still exist.
  const known = [...byDay.keys()].sort()
  if (known.length) {
    for (let d = known[0]; d <= known[known.length - 1]; d = addDays(d, 1)) get(d)
  }

  // Longest run of readings in range without a gap over 15 minutes.
  let longestStretch: Stretch | null = null
  let startTs: string | null = null
  let prevMin = -Infinity
  for (const r of readings) {
    const min = toMin(r.ts)
    const inRange = r.v >= 3.9 && r.v <= 10
    // A reading out of range, or a gap over 15 minutes, ends the stretch.
    if (!inRange) startTs = null
    else if (!startTs || min - prevMin > 15) startTs = r.ts
    if (inRange && startTs) {
      const minutes = min - toMin(startTs)
      if (!longestStretch || minutes > longestStretch.minutes) {
        longestStretch = { minutes, start: startTs.slice(0, 16), end: r.ts.slice(0, 16) }
      }
    }
    prevMin = min
  }

  const data: History = {
    days: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    longestStretch,
    lastImport,
    newSince: previousEnd ? previousEnd.slice(0, 10) : null,
  }
  cache.set(personId, { stamp, data })
  return data
}
