ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "input_type" text;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "empty_default" double precision;
