ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "ranking_config" jsonb;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "hide_column_labels" boolean DEFAULT false;
