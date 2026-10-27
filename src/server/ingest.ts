import { eq, sql } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'

import { db } from '#/db'
import {
  alarms,
  basalEvents,
  bgReadings,
  boluses,
  cgmReadings,
  dailyInsulin,
  imports,
  manualEntries,
} from '#/db/schema'
import type { ImportSummary } from '#/db/schema'
import { cgmValue, localTs, num } from '#/lib/glooko/parse'
import type { ExportMeta, FileKind, ParsedFile } from '#/lib/glooko/parse'
import { unpackUploads } from '#/lib/glooko/unpack'

type Row = Record<string, string>
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Postgres allows 65535 bind parameters per statement; 1000 rows stays well under it.
const CHUNK = 1000

const MANUAL_KINDS: FileKind[] = [
  'cgm_carbs',
  'exercise',
  'food',
  'notes',
  'manual_insulin',
  'medication',
]

function mapRows(kind: FileKind, rows: Row[], personId: number, importId: number) {
  const out: Record<string, unknown>[] = []
  for (const r of rows) {
    const ts = localTs(r['Timestamp'])
    if (!ts) continue
    const serial = r['Serial Number'] || null
    switch (kind) {
      case 'cgm': {
        const raw = num(r['CGM Glucose Value (mmol/l)'])
        if (raw !== null) out.push({ ts, ...cgmValue(raw), serial, personId, importId })
        break
      }
      case 'bg': {
        const mmol = num(r['Glucose Value (mmol/l)'])
        if (mmol !== null)
          out.push({ ts, mmol, manual: r['Manual Reading'] === 'M', serial, personId, importId })
        break
      }
      case 'bolus':
        out.push({
          ts,
          insulinType: r['Insulin Type'] || 'Unknown',
          bgInputMmol: num(r['Blood Glucose Input (mmol/l)']),
          carbsG: num(r['Carbs Input (g)']),
          carbRatio: num(r['Carbs Ratio']),
          deliveredU: num(r['Insulin Delivered (U)']) ?? 0,
          initialU: num(r['Initial Delivery (U)']),
          extendedU: num(r['Extended Delivery (U)']),
          serial,
          personId,
          importId,
        })
        break
      case 'basal':
        out.push({
          ts,
          insulinType: r['Insulin Type'] || 'Unknown',
          durationMin: num(r['Duration (minutes)']),
          percentage: num(r['Percentage (%)']),
          rateUPerH: num(r['Rate']),
          deliveredU: num(r['Insulin Delivered (U)']),
          serial,
          personId,
          importId,
        })
        break
      case 'insulin':
        out.push({
          ts,
          totalBolusU: num(r['Total Bolus (U)']),
          totalInsulinU: num(r['Total Insulin (U)']),
          totalBasalU: num(r['Total Basal (U)']),
          serial,
          personId,
          importId,
        })
        break
      case 'alarms':
        out.push({ ts, event: r['Alarm/Event'] || 'unknown', serial, personId, importId })
        break
      default: {
        const { Timestamp: _ts, ...data } = r
        out.push({ kind, ts, data, personId, importId })
      }
    }
  }
  return out
}

function tableFor(kind: FileKind): PgTable {
  if (MANUAL_KINDS.includes(kind)) return manualEntries
  return {
    cgm: cgmReadings,
    bg: bgReadings,
    bolus: boluses,
    basal: basalEvents,
    insulin: dailyInsulin,
    alarms,
  }[kind as 'cgm' | 'bg' | 'bolus' | 'basal' | 'insulin' | 'alarms']
}

async function insertChunks(tx: Tx, table: PgTable, rows: Record<string, unknown>[]) {
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const res = await tx
      .insert(table)
      .values(rows.slice(i, i + CHUNK) as never)
      .onConflictDoNothing()
      .returning({ id: sql<number>`id` })
    inserted += res.length
  }
  return inserted
}

export interface IngestResult {
  importId: number
  patientName: string | null
  rangeStart: string | null
  rangeEnd: string | null
  summary: ImportSummary
  ignored: string[]
}

export interface PreparedUpload {
  files: ParsedFile[]
  ignored: string[]
  meta: ExportMeta
}

/** Unpacks and parses the upload without touching the database. */
export function prepareUploads(uploads: { name: string; bytes: Uint8Array }[]): PreparedUpload {
  const { files, ignored } = unpackUploads(uploads)
  if (files.length === 0) {
    throw new Error(
      'No export CSV files found. Expected files like cgm_data_1.csv or bolus_data_1.csv.',
    )
  }
  const meta = files.find((f) => f.meta.rangeStart)?.meta ?? files[0].meta
  return { files, ignored, meta }
}

/**
 * Stores one export for one person. Rows are kept per import; overlap with
 * earlier imports is resolved when reading (see currentRows in dataset.ts).
 * With replaceExisting, the person's earlier imports are deleted first.
 */
export async function ingestPrepared(
  personId: number,
  fileName: string,
  { files, ignored, meta }: PreparedUpload,
  replaceExisting: boolean,
): Promise<IngestResult> {
  const byKind = new Map<FileKind, ParsedFile[]>()
  for (const f of files) byKind.set(f.kind, [...(byKind.get(f.kind) ?? []), f])

  return db.transaction(async (tx) => {
    if (replaceExisting) await tx.delete(imports).where(eq(imports.personId, personId))

    const [imp] = await tx
      .insert(imports)
      .values({
        personId,
        fileName,
        patientName: meta.patientName,
        rangeStart: meta.rangeStart,
        rangeEnd: meta.rangeEnd,
        summary: {},
      })
      .returning({ id: imports.id })

    const summary: ImportSummary = {}
    let dataStart: string | null = null
    let dataEnd: string | null = null
    for (const [kind, kindFiles] of byKind) {
      const rows = kindFiles.flatMap((f) => mapRows(kind, f.rows, personId, imp.id))
      for (const r of rows) {
        const ts = r.ts as string
        if (!dataStart || ts < dataStart) dataStart = ts
        if (!dataEnd || ts > dataEnd) dataEnd = ts
      }
      const inserted = await insertChunks(tx, tableFor(kind), rows)
      summary[kind] = {
        files: kindFiles.map((f) => f.path),
        parsed: rows.length,
        inserted,
      }
    }

    await tx
      .update(imports)
      .set({ summary, dataStart, dataEnd })
      .where(eq(imports.id, imp.id))

    return {
      importId: imp.id,
      patientName: meta.patientName,
      rangeStart: meta.rangeStart,
      rangeEnd: meta.rangeEnd,
      summary,
      ignored,
    }
  })
}

export async function ingestUploads(
  personId: number,
  fileName: string,
  uploads: { name: string; bytes: Uint8Array }[],
  replaceExisting: boolean,
): Promise<IngestResult> {
  return ingestPrepared(personId, fileName, prepareUploads(uploads), replaceExisting)
}
