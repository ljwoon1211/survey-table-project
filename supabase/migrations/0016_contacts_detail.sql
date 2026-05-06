-- Migration: 0016_contacts_detail
-- Purpose: slice 3 컨택 단건 편집 페이지 데이터 모델
-- - contact_targets.memo TEXT — 자유 메모
-- - contact_targets.contact_method TEXT — 수신방법 (이메일/문자/방문/우편)
-- - surveys.contact_result_codes JSONB — 사용자 정의 결과코드 (NULL = 디폴트 13개)

BEGIN;

ALTER TABLE "contact_targets" ADD COLUMN "memo" text;
ALTER TABLE "contact_targets" ADD COLUMN "contact_method" text;

ALTER TABLE "surveys" ADD COLUMN "contact_result_codes" jsonb;

COMMIT;

-- ROLLBACK SQL (수동):
-- BEGIN;
-- ALTER TABLE surveys DROP COLUMN IF EXISTS contact_result_codes;
-- ALTER TABLE contact_targets DROP COLUMN IF EXISTS contact_method;
-- ALTER TABLE contact_targets DROP COLUMN IF EXISTS memo;
-- COMMIT;
