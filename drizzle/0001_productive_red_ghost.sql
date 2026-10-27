DROP INDEX "basal_events_ts_type_uq";--> statement-breakpoint
DROP INDEX "boluses_ts_delivered_uq";--> statement-breakpoint
ALTER TABLE "basal_events" ADD CONSTRAINT "basal_events_dedupe_uq" UNIQUE NULLS NOT DISTINCT("ts","insulin_type","duration_min","rate_u_per_h");--> statement-breakpoint
ALTER TABLE "boluses" ADD CONSTRAINT "boluses_dedupe_uq" UNIQUE NULLS NOT DISTINCT("ts","insulin_type","delivered_u","carbs_g");