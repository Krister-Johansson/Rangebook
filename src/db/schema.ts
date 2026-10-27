import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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

// One row per person whose exports are imported (for example each child in a family).
export const people = pgTable('people', {
  id: serial().primaryKey(),
  name: text().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

const personId = () =>
  integer('person_id')
    .notNull()
    .references(() => people.id, { onDelete: 'cascade' })

// Each import keeps its own rows. Where imports overlap, rows from the newest
// import covering a timestamp win (see src/server/dataset.ts), so deleting an
// import only removes its rows and older data shows through again.
export const imports = pgTable('imports', {
  id: serial().primaryKey(),
  personId: personId(),
  fileName: text('file_name').notNull(),
  // Name from the export's first line, used to warn about uploads to the wrong person.
  patientName: text('patient_name'),
  rangeStart: date('range_start', { mode: 'string' }),
  rangeEnd: date('range_end', { mode: 'string' }),
  // First and last timestamp across all rows in this import.
  dataStart: timestamp('data_start', { mode: 'string' }),
  dataEnd: timestamp('data_end', { mode: 'string' }),
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
    personId: personId(),
    importId: integer('import_id')
      .notNull()
      .references(() => imports.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('cgm_readings_import_ts_uq').on(t.importId, t.ts),
    index('cgm_readings_person_ts_idx').on(t.personId, t.ts),
  ],
)

export const bgReadings = pgTable(
  'bg_readings',
  {
    id: serial().primaryKey(),
    ts: localTs('ts'),
    mmol: real().notNull(),
    manual: boolean().notNull().default(true),
    serial: text(),
    personId: personId(),
    importId: integer('import_id')
      .notNull()
      .references(() => imports.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('bg_readings_import_ts_mmol_uq').on(t.importId, t.ts, t.mmol),
    index('bg_readings_person_ts_idx').on(t.personId, t.ts),
  ],
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
    personId: personId(),
    importId: integer('import_id')
      .notNull()
      .references(() => imports.id, { onDelete: 'cascade' }),
  },
  (t) => [
    unique('boluses_dedupe_uq')
      .on(t.importId, t.ts, t.insulinType, t.deliveredU, t.carbsG)
      .nullsNotDistinct(),
    index('boluses_person_ts_idx').on(t.personId, t.ts),
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
    personId: personId(),
    importId: integer('import_id')
      .notNull()
      .references(() => imports.id, { onDelete: 'cascade' }),
  },
  (t) => [
    // Several segments can start at the same minute (e.g. midnight profile switch).
    unique('basal_events_dedupe_uq')
      .on(t.importId, t.ts, t.insulinType, t.durationMin, t.rateUPerH)
      .nullsNotDistinct(),
    index('basal_events_person_ts_idx').on(t.personId, t.ts),
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
    personId: personId(),
    importId: integer('import_id')
      .notNull()
      .references(() => imports.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('daily_insulin_import_ts_uq').on(t.importId, t.ts),
    index('daily_insulin_person_ts_idx').on(t.personId, t.ts),
  ],
)

export const alarms = pgTable(
  'alarms',
  {
    id: serial().primaryKey(),
    ts: localTs('ts'),
    event: text().notNull(),
    serial: text(),
    personId: personId(),
    importId: integer('import_id')
      .notNull()
      .references(() => imports.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('alarms_import_ts_event_uq').on(t.importId, t.ts, t.event),
    index('alarms_person_ts_idx').on(t.personId, t.ts),
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
    personId: personId(),
    importId: integer('import_id')
      .notNull()
      .references(() => imports.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('manual_entries_import_kind_ts_data_uq').on(t.importId, t.kind, t.ts, t.data),
    index('manual_entries_person_ts_idx').on(t.personId, t.ts),
  ],
)

// Per-person preferences as key/value rows (goal, sharing).
export const preferences = pgTable(
  'preferences',
  {
    personId: personId(),
    key: text().notNull(),
    value: jsonb().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.personId, t.key] })],
)

// Questions saved from pattern cards. The text is copied so the list survives
// when a pattern no longer shows up in newer data.
export const savedQuestions = pgTable(
  'saved_questions',
  {
    personId: personId(),
    patternId: text('pattern_id').notNull(),
    question: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.personId, t.patternId] })],
)
