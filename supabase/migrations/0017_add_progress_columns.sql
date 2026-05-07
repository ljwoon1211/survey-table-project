-- Migration: 0017_add_progress_columns
-- Purpose: slice 4 (Report 탭) — 진척률 표 표시 컬럼 픽커 + GROUP BY 인덱스
-- - surveys.progress_columns JSONB — ProgressColumnScheme (NULL = 4개 고정 컬럼만)
-- - idx_contact_targets_survey_group — (survey_id, group_value) GROUP BY 가속

BEGIN;

ALTER TABLE "surveys" ADD COLUMN "progress_columns" jsonb;

COMMENT ON COLUMN "surveys"."progress_columns" IS
  'ProgressColumnScheme — 진척률 표 (Report 탭) 표시 컬럼 픽커 결과. NULL=4개 고정 컬럼만.';

CREATE INDEX IF NOT EXISTS "idx_contact_targets_survey_group"
  ON "contact_targets" ("survey_id", "group_value");

COMMIT;

-- ROLLBACK SQL (수동):
-- BEGIN;
-- DROP INDEX IF EXISTS idx_contact_targets_survey_group;
-- ALTER TABLE surveys DROP COLUMN IF EXISTS progress_columns;
-- COMMIT;
