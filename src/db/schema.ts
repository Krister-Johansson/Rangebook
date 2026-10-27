import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// Pump and CGM timestamps are local wall-clock time without a zone, so they are
// stored as `timestamp` (no tz) in string mode to avoid shifts from the server zone.
const localTs = (name: string) =>
  timestamp(name, { mode: 'string' }).notNull()

export const imports = pgTable('imports', {
  id: serial().primaryKey(),
  fileName: text('file_name').notNull(),
  patientName: text('patient_name'),
  rangeStart: date('range_start', { mode: 'string' }),
  rangeEnd: date('range_end', { mode: 'string' }),
  // Per-file counts: { [kind]: { parsed, inserted } }
  summary: jsonb().$type<ImportSummary>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export type ImportSummary = Record<
  string,
  { files: string[]; parsed: number; inserted: number }
>

export const cgmReadings = pgTable(
  'cgm_readings',
  {
    id: serial().primaryKey(),
    ts: localTs('ts'),
    mmol: real().notNull(),
    // The export writes 0.1 for "LOW" (below 2.2) and 111.1 for "HIGH" (above 22.2).
    // Those readings are stored clamped to the sensor limit with this flag set.
    sensorLimit: text('sensor_limit').$type<'low' | 'high'>(),
    serial: text(),
    importId: integer('import_id').references(() => imports.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [uniqueIndex('cgm_readings_ts_uq').on(t.ts)],
)

export const bgReadings = pgTable(
  'bg_readings',
  {
    id: serial().primaryKey(),
    ts: localTs('ts'),
    mmol: real().notNull(),
    manual: boolean().notNull().default(true),
    serial: text(),
    importId: integer('import_id').references(() => imports.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [uniqueIndex('bg_readings_ts_mmol_uq').on(t.ts, t.mmol)],
)

export const boluses = pgTable(
  'boluses',
  {
    id: serial().primaryKey(),
    ts: localTs('ts'),
    insulinType: text('insulin_type').notNull(),
    bgInputMmol: real('bg_input_mmol'),
    carbsG: real('carbs_g'),
    carbRatio: real('carb_ratio'),
    deliveredU: real('delivered_u').notNull(),
    initialU: real('initial_u'),
    extendedU: real('extended_u'),
    serial: text(),
    importId: integer('import_id').references(() => imports.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    unique('boluses_dedupe_uq')
      .on(t.ts, t.insulinType, t.deliveredU, t.carbsG)
      .nullsNotDistinct(),
  ],
)

export const basalEvents = pgTable(
  'basal_events',
  {
    id: serial().primaryKey(),
    ts: localTs('ts'),
    // "Scheduled" (Control-IQ modulated rate) or "Suspend"
    insulinType: text('insulin_type').notNull(),
    durationMin: real('duration_min'),
    percentage: real(),
    rateUPerH: real('rate_u_per_h'),
    deliveredU: real('delivered_u'),
    serial: text(),
    importId: integer('import_id').references(() => imports.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    // Several segments can start at the same minute (e.g. midnight profile switch).
    unique('basal_events_dedupe_uq')
      .on(t.ts, t.insulinType, t.durationMin, t.rateUPerH)
      .nullsNotDistinct(),
  ],
)

export const dailyInsulin = pgTable(
  'daily_insulin',
  {
    id: serial().primaryKey(),
    ts: localTs('ts'),
    totalBolusU: real('total_bolus_u'),
    totalInsulinU: real('total_insulin_u'),
    totalBasalU: real('total_basal_u'),
    serial: text(),
    importId: integer('import_id').references(() => imports.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [uniqueIndex('daily_insulin_ts_uq').on(t.ts)],
)

export const alarms = pgTable(
  'alarms',
  {
    id: serial().primaryKey(),
    ts: localTs('ts'),
    event: text().notNull(),
    serial: text(),
    importId: integer('import_id').references(() => imports.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    uniqueIndex('alarms_ts_event_uq').on(t.ts, t.event),
    index('alarms_event_idx').on(t.event),
  ],
)

// Exercise, food, notes, manual insulin, medication and CGM carbs share one table:
// the export usually has few or no rows for these, and the columns differ per kind.
export const manualEntries = pgTable(
  'manual_entries',
  {
    id: serial().primaryKey(),
    kind: text().notNull(),
    ts: localTs('ts'),
    data: jsonb().$type<Record<string, string>>().notNull(),
    importId: integer('import_id').references(() => imports.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [uniqueIndex('manual_entries_kind_ts_data_uq').on(t.kind, t.ts, t.data)],
)

// Single-user app: preferences are key/value rows (goal, sharing, theme).
export const preferences = pgTable('preferences', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// Questions saved from pattern cards. The text is copied so the list survives
// when a pattern no longer shows up in newer data.
export const savedQuestions = pgTable('saved_questions', {
  patternId: text('pattern_id').primaryKey(),
  question: text().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})
