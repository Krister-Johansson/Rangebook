CREATE TABLE "alarms" (
	"id" serial PRIMARY KEY NOT NULL,
	"ts" timestamp NOT NULL,
	"event" text NOT NULL,
	"serial" text,
	"import_id" integer
);
--> statement-breakpoint
CREATE TABLE "basal_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"ts" timestamp NOT NULL,
	"insulin_type" text NOT NULL,
	"duration_min" real,
	"percentage" real,
	"rate_u_per_h" real,
	"delivered_u" real,
	"serial" text,
	"import_id" integer
);
--> statement-breakpoint
CREATE TABLE "bg_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"ts" timestamp NOT NULL,
	"mmol" real NOT NULL,
	"manual" boolean DEFAULT true NOT NULL,
	"serial" text,
	"import_id" integer
);
--> statement-breakpoint
CREATE TABLE "boluses" (
	"id" serial PRIMARY KEY NOT NULL,
	"ts" timestamp NOT NULL,
	"insulin_type" text NOT NULL,
	"bg_input_mmol" real,
	"carbs_g" real,
	"carb_ratio" real,
	"delivered_u" real NOT NULL,
	"initial_u" real,
	"extended_u" real,
	"serial" text,
	"import_id" integer
);
--> statement-breakpoint
CREATE TABLE "cgm_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"ts" timestamp NOT NULL,
	"mmol" real NOT NULL,
	"serial" text,
	"import_id" integer
);
--> statement-breakpoint
CREATE TABLE "daily_insulin" (
	"id" serial PRIMARY KEY NOT NULL,
	"ts" timestamp NOT NULL,
	"total_bolus_u" real,
	"total_insulin_u" real,
	"total_basal_u" real,
	"serial" text,
	"import_id" integer
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"patient_name" text,
	"range_start" date,
	"range_end" date,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"ts" timestamp NOT NULL,
	"data" jsonb NOT NULL,
	"import_id" integer
);
--> statement-breakpoint
ALTER TABLE "alarms" ADD CONSTRAINT "alarms_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "basal_events" ADD CONSTRAINT "basal_events_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bg_readings" ADD CONSTRAINT "bg_readings_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boluses" ADD CONSTRAINT "boluses_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cgm_readings" ADD CONSTRAINT "cgm_readings_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_insulin" ADD CONSTRAINT "daily_insulin_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_entries" ADD CONSTRAINT "manual_entries_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alarms_ts_event_uq" ON "alarms" USING btree ("ts","event");--> statement-breakpoint
CREATE INDEX "alarms_event_idx" ON "alarms" USING btree ("event");--> statement-breakpoint
CREATE UNIQUE INDEX "basal_events_ts_type_uq" ON "basal_events" USING btree ("ts","insulin_type");--> statement-breakpoint
CREATE UNIQUE INDEX "bg_readings_ts_mmol_uq" ON "bg_readings" USING btree ("ts","mmol");--> statement-breakpoint
CREATE UNIQUE INDEX "boluses_ts_delivered_uq" ON "boluses" USING btree ("ts","delivered_u");--> statement-breakpoint
CREATE UNIQUE INDEX "cgm_readings_ts_uq" ON "cgm_readings" USING btree ("ts");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_insulin_ts_uq" ON "daily_insulin" USING btree ("ts");--> statement-breakpoint
CREATE UNIQUE INDEX "manual_entries_kind_ts_data_uq" ON "manual_entries" USING btree ("kind","ts","data");