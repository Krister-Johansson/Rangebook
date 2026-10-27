CREATE TABLE "challenge_picks" (
	"person_id" integer NOT NULL,
	"week_start" date NOT NULL,
	"challenge_id" text NOT NULL,
	"picked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_picks_person_id_week_start_pk" PRIMARY KEY("person_id","week_start")
);
--> statement-breakpoint
CREATE TABLE "life_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"kind" text NOT NULL,
	"tag" text,
	"text" text DEFAULT '' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"weekdays" integer[],
	"start_min" integer,
	"end_min" integer,
	"at_min" integer,
	"author" text DEFAULT 'you' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"day" date NOT NULL,
	"at_min" integer,
	"note" text NOT NULL,
	"author" text DEFAULT 'parent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_questions" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "challenge_picks" ADD CONSTRAINT "challenge_picks_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_log" ADD CONSTRAINT "life_log_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings_notes" ADD CONSTRAINT "settings_notes_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "life_log_person_idx" ON "life_log" USING btree ("person_id","kind");--> statement-breakpoint
CREATE INDEX "settings_notes_person_idx" ON "settings_notes" USING btree ("person_id","day");