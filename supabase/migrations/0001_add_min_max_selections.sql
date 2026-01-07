-- Add min_selections and max_selections columns to questions table
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "min_selections" integer;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "max_selections" integer;

