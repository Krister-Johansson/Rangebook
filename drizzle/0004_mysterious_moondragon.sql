CREATE TABLE "people" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "basal_events" DROP CONSTRAINT "basal_events_dedupe_uq";--> statement-breakpoint
ALTER TABLE "boluses" DROP CONSTRAINT "boluses_dedupe_uq";--> statement-breakpoint
ALTER TABLE "alarms" DROP CONSTRAINT "alarms_import_id_imports_id_fk";
--> statement-breakpoint
ALTER TABLE "basal_events" DROP CONSTRAINT "basal_events_import_id_imports_id_fk";
--> statement-breakpoint
ALTER TABLE "bg_readings" DROP CONSTRAINT "bg_readings_import_id_imports_id_fk";
--> statement-breakpoint
ALTER TABLE "boluses" DROP CONSTRAINT "boluses_import_id_imports_id_fk";
--> statement-breakpoint
ALTER TABLE "cgm_readings" DROP CONSTRAINT "cgm_readings_import_id_imports_id_fk";
--> statement-breakpoint
ALTER TABLE "daily_insulin" DROP CONSTRAINT "daily_insulin_import_id_imports_id_fk";
--> statement-breakpoint
ALTER TABLE "manual_entries" DROP CONSTRAINT "manual_entries_import_id_imports_id_fk";
--> statement-breakpoint
DROP INDEX "alarms_ts_event_uq";--> statement-breakpoint
DROP INDEX "bg_readings_ts_mmol_uq";--> statement-breakpoint
DROP INDEX "cgm_readings_ts_uq";--> statement-breakpoint
DROP INDEX "daily_insulin_ts_uq";--> statement-breakpoint
DROP INDEX "manual_entries_kind_ts_data_uq";--> statement-breakpoint
ALTER TABLE "alarms" ALTER COLUMN "import_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "basal_events" ALTER COLUMN "import_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bg_readings" ALTER COLUMN "import_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "boluses" ALTER COLUMN "import_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cgm_readings" ALTER COLUMN "import_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_insulin" ALTER COLUMN "import_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "manual_entries" ALTER COLUMN "import_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "preferences" DROP CONSTRAINT "preferences_pkey";--> statement-breakpoint
ALTER TABLE "saved_questions" DROP CONSTRAINT "saved_questions_pkey";--> statement-breakpoint
ALTER TABLE "alarms" ADD COLUMN "person_id" integer;--> statement-breakpoint
ALTER TABLE "basal_events" ADD COLUMN "person_id" integer;--> statement-breakpoint
ALTER TABLE "bg_readings" ADD COLUMN "person_id" integer;--> statement-breakpoint
ALTER TABLE "boluses" ADD COLUMN "person_id" integer;--> statement-breakpoint
ALTER TABLE "cgm_readings" ADD COLUMN "person_id" integer;--> statement-breakpoint
ALTER TABLE "daily_insulin" ADD COLUMN "person_id" integer;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "person_id" integer;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "data_start" timestamp;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "data_end" timestamp;--> statement-breakpoint
ALTER TABLE "manual_entries" ADD COLUMN "person_id" integer;--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN "person_id" integer;--> statement-breakpoint
ALTER TABLE "saved_questions" ADD COLUMN "person_id" integer;--> statement-breakpoint
-- Existing data belongs to one person, named from the first import's export when there is one.
INSERT INTO "people" ("name")
  SELECT coalesce(nullif(split_part(trim((SELECT "patient_name" FROM "imports" ORDER BY "id" LIMIT 1)), ' ', 1), ''), 'Person 1')
  WHERE EXISTS (SELECT 1 FROM "imports") OR EXISTS (SELECT 1 FROM "preferences") OR EXISTS (SELECT 1 FROM "saved_questions");--> statement-breakpoint
UPDATE "imports" SET "person_id" = (SELECT min("id") FROM "people");--> statement-breakpoint
UPDATE "cgm_readings" SET "person_id" = (SELECT min("id") FROM "people");--> statement-breakpoint
UPDATE "bg_readings" SET "person_id" = (SELECT min("id") FROM "people");--> statement-breakpoint
UPDATE "boluses" SET "person_id" = (SELECT min("id") FROM "people");--> statement-breakpoint
UPDATE "basal_events" SET "person_id" = (SELECT min("id") FROM "people");--> statement-breakpoint
UPDATE "daily_insulin" SET "person_id" = (SELECT min("id") FROM "people");--> statement-breakpoint
UPDATE "alarms" SET "person_id" = (SELECT min("id") FROM "people");--> statement-breakpoint
UPDATE "manual_entries" SET "person_id" = (SELECT min("id") FROM "people");--> statement-breakpoint
UPDATE "preferences" SET "person_id" = (SELECT min("id") FROM "people");--> statement-breakpoint
UPDATE "saved_questions" SET "person_id" = (SELECT min("id") FROM "people");--> statement-breakpoint
UPDATE "imports" i SET "data_start" = r.first, "data_end" = r.last FROM (
  SELECT "import_id", min(ts) AS first, max(ts) AS last FROM (
    SELECT "import_id", "ts" FROM "cgm_readings" UNION ALL SELECT "import_id", "ts" FROM "boluses"
    UNION ALL SELECT "import_id", "ts" FROM "basal_events" UNION ALL SELECT "import_id", "ts" FROM "alarms"
    UNION ALL SELECT "import_id", "ts" FROM "bg_readings" UNION ALL SELECT "import_id", "ts" FROM "daily_insulin"
  ) x GROUP BY "import_id"
) r WHERE r."import_id" = i."id";--> statement-breakpoint
ALTER TABLE "imports" ALTER COLUMN "person_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cgm_readings" ALTER COLUMN "person_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bg_readings" ALTER COLUMN "person_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "boluses" ALTER COLUMN "person_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "basal_events" ALTER COLUMN "person_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_insulin" ALTER COLUMN "person_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "alarms" ALTER COLUMN "person_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "manual_entries" ALTER COLUMN "person_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "preferences" ALTER COLUMN "person_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_questions" ALTER COLUMN "person_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_person_id_key_pk" PRIMARY KEY("person_id","key");--> statement-breakpoint
ALTER TABLE "saved_questions" ADD CONSTRAINT "saved_questions_person_id_pattern_id_pk" PRIMARY KEY("person_id","pattern_id");--> statement-breakpoint
ALTER TABLE "alarms" ADD CONSTRAINT "alarms_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alarms" ADD CONSTRAINT "alarms_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "basal_events" ADD CONSTRAINT "basal_events_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "basal_events" ADD CONSTRAINT "basal_events_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bg_readings" ADD CONSTRAINT "bg_readings_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bg_readings" ADD CONSTRAINT "bg_readings_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boluses" ADD CONSTRAINT "boluses_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boluses" ADD CONSTRAINT "boluses_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cgm_readings" ADD CONSTRAINT "cgm_readings_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cgm_readings" ADD CONSTRAINT "cgm_readings_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_insulin" ADD CONSTRAINT "daily_insulin_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_insulin" ADD CONSTRAINT "daily_insulin_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_entries" ADD CONSTRAINT "manual_entries_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_entries" ADD CONSTRAINT "manual_entries_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_questions" ADD CONSTRAINT "saved_questions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alarms_import_ts_event_uq" ON "alarms" USING btree ("import_id","ts","event");--> statement-breakpoint
CREATE INDEX "alarms_person_ts_idx" ON "alarms" USING btree ("person_id","ts");--> statement-breakpoint
CREATE INDEX "basal_events_person_ts_idx" ON "basal_events" USING btree ("person_id","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "bg_readings_import_ts_mmol_uq" ON "bg_readings" USING btree ("import_id","ts","mmol");--> statement-breakpoint
CREATE INDEX "bg_readings_person_ts_idx" ON "bg_readings" USING btree ("person_id","ts");--> statement-breakpoint
CREATE INDEX "boluses_person_ts_idx" ON "boluses" USING btree ("person_id","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "cgm_readings_import_ts_uq" ON "cgm_readings" USING btree ("import_id","ts");--> statement-breakpoint
CREATE INDEX "cgm_readings_person_ts_idx" ON "cgm_readings" USING btree ("person_id","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_insulin_import_ts_uq" ON "daily_insulin" USING btree ("import_id","ts");--> statement-breakpoint
CREATE INDEX "daily_insulin_person_ts_idx" ON "daily_insulin" USING btree ("person_id","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "manual_entries_import_kind_ts_data_uq" ON "manual_entries" USING btree ("import_id","kind","ts","data");--> statement-breakpoint
CREATE INDEX "manual_entries_person_ts_idx" ON "manual_entries" USING btree ("person_id","ts");--> statement-breakpoint
ALTER TABLE "basal_events" ADD CONSTRAINT "basal_events_dedupe_uq" UNIQUE NULLS NOT DISTINCT("import_id","ts","insulin_type","duration_min","rate_u_per_h");--> statement-breakpoint
ALTER TABLE "boluses" ADD CONSTRAINT "boluses_dedupe_uq" UNIQUE NULLS NOT DISTINCT("import_id","ts","insulin_type","delivered_u","carbs_g");