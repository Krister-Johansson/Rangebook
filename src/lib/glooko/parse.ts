// Parser for the Glooko-style CSV export (Tandem t:slim X2 with Control-IQ).
// Every CSV starts with a metadata line ("Name:...,Date Range:A - B") before the header.

export const FILE_KINDS = [
  'cgm',
  'bg',
  'bolus',
  'basal',
  'insulin',
  'alarms',
  'cgm_carbs',
  'exercise',
  'food',
  'notes',
  'manual_insulin',
  'medication',
] as const

export type FileKind = (typeof FILE_KINDS)[number]

// cgm_carbs must come before cgm so the longer prefix wins.
const KIND_RE =
  /^(cgm_carbs|cgm|bg|bolus|basal|insulin|alarms|exercise|food|notes|manual_insulin|medication)_data_\d+\.csv$/i

export function fileKind(path: string): FileKind | null {
  const base = path.split('/').pop() ?? path
  const m = KIND_RE.exec(base)
  return m ? (m[1].toLowerCase() as FileKind) : null
}

export interface ExportMeta {
  patientName: string | null
  rangeStart: string | null
  rangeEnd: string | null
}

export interface ParsedFile {
  path: string
  kind: FileKind
  meta: ExportMeta
  header: string[]
  rows: Record<string, string>[]
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((v) => v.trim())
}

export function parseMeta(line: string): ExportMeta {
  const name = /Name:([^,]*)/.exec(line)?.[1]?.trim() || null
  const range = /Date Range:\s*(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/.exec(
    line,
  )
  return {
    patientName: name,
    rangeStart: range?.[1] ?? null,
    rangeEnd: range?.[2] ?? null,
  }
}

export function parseExportCsv(path: string, text: string): ParsedFile | null {
  const kind = fileKind(path)
  if (!kind) return null

  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')

  let meta: ExportMeta = { patientName: null, rangeStart: null, rangeEnd: null }
  if (lines[0]?.startsWith('Name:')) {
    meta = parseMeta(lines.shift()!)
  }

  const header = lines.length ? parseCsvLine(lines.shift()!) : []
  const rows = lines.map((line) => {
    const cells = parseCsvLine(line)
    const row: Record<string, string> = {}
    header.forEach((h, i) => (row[h] = cells[i] ?? ''))
    return row
  })

  return { path, kind, meta, header, rows }
}

export function num(v: string | undefined): number | null {
  if (v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// "2026-10-27 13:45" -> "2026-10-27 13:45:00" (local wall-clock time, no zone)
export function localTs(v: string | undefined): string | null {
  if (!v) return null
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2})?$/.exec(v.trim())
  return m ? `${m[1]} ${m[2]}${m[3] ?? ':00'}` : null
}

// CGM sentinels in the export: 0.1 = "LOW" (below 2.2), 111.1 = "HIGH" (above 22.2).
export const CGM_LOW_LIMIT = 2.2
export const CGM_HIGH_LIMIT = 22.2

export function cgmValue(
  raw: number,
): { mmol: number; sensorLimit: 'low' | 'high' | null } {
  if (raw <= 0.1) return { mmol: CGM_LOW_LIMIT, sensorLimit: 'low' }
  if (raw >= 111) return { mmol: CGM_HIGH_LIMIT, sensorLimit: 'high' }
  return { mmol: raw, sensorLimit: null }
}
