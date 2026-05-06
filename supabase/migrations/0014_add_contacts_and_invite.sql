-- Migration: 0014_add_contacts_and_invite
-- Purpose: 컨택 명단 적재 인프라 (contact_uploads/contact_targets/contact_attempts)
--          + surveys.contact_columns (표시 컬럼 스킴 메타데이터)
--          + survey_responses.contact_target_id (응답↔컨택 매칭)
-- Note: 신규 테이블 + ALTER ADD COLUMN 만. 데이터 변환 없음.

BEGIN;

CREATE TABLE "contact_uploads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "survey_id" uuid NOT NULL REFERENCES "surveys"("id") ON DELETE CASCADE,
  "filename" text NOT NULL,
  "uploaded_rows" integer NOT NULL DEFAULT 0,
  "merged_rows" integer NOT NULL DEFAULT 0,
  "error_rows" integer NOT NULL DEFAULT 0,
  "mapping" jsonb NOT NULL,
  "uploaded_by" uuid REFERENCES "auth"."users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "idx_contact_uploads_survey" ON "contact_uploads" ("survey_id", "created_at" DESC);

CREATE TABLE "contact_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "survey_id" uuid NOT NULL REFERENCES "surveys"("id") ON DELETE CASCADE,
  "resid" integer NOT NULL,
  "group_value" text,
  "email" text,
  "biz_number" text,
  "invite_token" uuid NOT NULL DEFAULT gen_random_uuid(),
  "attrs" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "upload_id" uuid REFERENCES "contact_uploads"("id") ON DELETE SET NULL,
  "responded_at" timestamp with time zone,
  "response_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "contact_targets_survey_resid_unique" UNIQUE ("survey_id", "resid"),
  CONSTRAINT "contact_targets_invite_token_unique" UNIQUE ("invite_token")
);
CREATE INDEX "idx_contact_targets_survey" ON "contact_targets" ("survey_id", "resid");
CREATE INDEX "idx_contact_targets_email" ON "contact_targets" ("survey_id", "email") WHERE "email" IS NOT NULL;
CREATE INDEX "idx_contact_targets_group" ON "contact_targets" ("survey_id", "group_value");

CREATE TABLE "contact_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "contact_target_id" uuid NOT NULL REFERENCES "contact_targets"("id") ON DELETE CASCADE,
  "attempt_no" integer NOT NULL,
  "result_code" text NOT NULL,
  "note" text,
  "created_by" uuid REFERENCES "auth"."users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "contact_attempts_target_no_unique" UNIQUE ("contact_target_id", "attempt_no")
);
CREATE INDEX "idx_contact_attempts_target" ON "contact_attempts" ("contact_target_id", "attempt_no" DESC);

ALTER TABLE "surveys" ADD COLUMN "contact_columns" jsonb;
ALTER TABLE "survey_responses" ADD COLUMN "contact_target_id" uuid REFERENCES "contact_targets"("id") ON DELETE SET NULL;
CREATE INDEX "idx_survey_responses_contact" ON "survey_responses" ("contact_target_id") WHERE "contact_target_id" IS NOT NULL;

-- 같은 컨택에 동시 두 in_progress 응답 차단 (spec 엣지케이스 #22)
CREATE UNIQUE INDEX "idx_active_response_per_contact"
  ON "survey_responses" ("contact_target_id")
  WHERE "is_completed" = false AND "contact_target_id" IS NOT NULL;

-- 응답 완료 시 contact_targets.response_id FK (순환 참조이므로 ALTER 로 후처리)
ALTER TABLE "contact_targets"
  ADD CONSTRAINT "contact_targets_response_id_fkey"
  FOREIGN KEY ("response_id") REFERENCES "survey_responses"("id") ON DELETE SET NULL;

-- resid 자동 발번 함수 (advisory lock 으로 race 차단)
CREATE OR REPLACE FUNCTION next_contact_resid(p_survey_id uuid) RETURNS integer AS $$
DECLARE
  next_id integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('contact_resid:' || p_survey_id::text));
  SELECT COALESCE(MAX(resid), 0) + 1 INTO next_id
    FROM contact_targets WHERE survey_id = p_survey_id;
  RETURN next_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ROLLBACK SQL (수동 적용용 — 본 마이그레이션 실패 시):
-- BEGIN;
-- DROP INDEX IF EXISTS idx_active_response_per_contact;
-- DROP INDEX IF EXISTS idx_survey_responses_contact;
-- ALTER TABLE survey_responses DROP COLUMN IF EXISTS contact_target_id;
-- ALTER TABLE surveys DROP COLUMN IF EXISTS contact_columns;
-- DROP FUNCTION IF EXISTS next_contact_resid(uuid);
-- DROP TABLE IF EXISTS contact_attempts;
-- DROP TABLE IF EXISTS contact_targets;
-- DROP TABLE IF EXISTS contact_uploads;
-- COMMIT;
