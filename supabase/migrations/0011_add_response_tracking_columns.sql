-- Migration: 0011_add_response_tracking_columns
-- Purpose: 운영 현황 콘솔용 응답 추적 컬럼 추가 + 백필 + 인덱스
-- Note: questions.options_columns is intentionally omitted — already applied in 0010_add_options_columns.sql

BEGIN;

-- 7 new tracking columns on survey_responses
ALTER TABLE "survey_responses" ADD COLUMN "status" text DEFAULT 'in_progress' NOT NULL;
ALTER TABLE "survey_responses" ADD COLUMN "platform" text;
ALTER TABLE "survey_responses" ADD COLUMN "browser" text;
ALTER TABLE "survey_responses" ADD COLUMN "current_step_id" text;
ALTER TABLE "survey_responses" ADD COLUMN "page_visits" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "survey_responses" ADD COLUMN "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "survey_responses" ADD COLUMN "total_seconds" integer;

-- Backfill existing rows
UPDATE survey_responses
SET
  status = CASE WHEN is_completed THEN 'completed' ELSE 'in_progress' END,
  last_activity_at = COALESCE(completed_at, started_at, created_at, now());

-- Indexes
CREATE INDEX idx_responses_survey_status ON survey_responses (survey_id, status);
CREATE INDEX idx_responses_survey_started ON survey_responses (survey_id, started_at DESC);
CREATE INDEX idx_responses_last_activity ON survey_responses (last_activity_at)
  WHERE status = 'in_progress';

COMMIT;
