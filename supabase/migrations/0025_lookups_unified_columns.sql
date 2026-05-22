-- Migration: 0025_lookups_unified_columns
-- Purpose: LUT 의 key_columns + value_columns 를 단일 columns 로 통합.
--
-- 배경:
--   LUT 자체에서 키/값 구분을 강제하면 UX 가 어색하다 (가져온 데이터에서 어떤 컬럼이
--   키가 될지 사전에 모르는 경우가 많음). 키/값 의미는 조건 에디터에서 결정하므로
--   LUT 는 단순 "컬럼 목록 + 행" 만 보유한다.
--
-- 영향:
--   1. saved_lookups: key_columns + value_columns → columns (둘을 concat)
--   2. surveys.lookups jsonb 배열 내 각 entry: keyColumns + valueColumns → columns
--   3. RightOperand.lookup 은 변경 없음 (keyMapping[].lutKey + valueColumn 으로 이미 의미를 표현)
--
-- 적용 순서 (사용자):
--   1. 0024 적용 후 (또는 신규 환경)
--   2. 이 SQL 파일 수동 적용 (supabase CLI 또는 MCP apply_migration)
--
-- 주의: drizzle migrate 자동 실행 대상 아님 (_journal.json 미등록).

-- 1) saved_lookups: columns 컬럼 추가 + key_columns/value_columns 합치기
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_lookups' AND column_name = 'key_columns'
  ) THEN
    ALTER TABLE saved_lookups
      ADD COLUMN IF NOT EXISTS columns JSONB NOT NULL DEFAULT '[]'::jsonb;

    UPDATE saved_lookups
      SET columns = COALESCE(key_columns, '[]'::jsonb) || COALESCE(value_columns, '[]'::jsonb)
      WHERE jsonb_array_length(columns) = 0;

    ALTER TABLE saved_lookups DROP COLUMN key_columns;
    ALTER TABLE saved_lookups DROP COLUMN value_columns;
  END IF;
END $$;

-- 2) surveys.lookups jsonb 내부 entry 의 keyColumns + valueColumns → columns
UPDATE surveys
  SET lookups = (
    SELECT COALESCE(
      jsonb_agg(
        CASE
          WHEN (entry ? 'keyColumns' OR entry ? 'valueColumns') AND NOT (entry ? 'columns')
            THEN (entry - 'keyColumns' - 'valueColumns')
                 || jsonb_build_object(
                      'columns',
                      COALESCE(entry->'keyColumns', '[]'::jsonb)
                        || COALESCE(entry->'valueColumns', '[]'::jsonb)
                    )
          ELSE entry
        END
      ),
      '[]'::jsonb
    )
    FROM jsonb_array_elements(lookups) AS entry
  )
  WHERE jsonb_typeof(lookups) = 'array' AND jsonb_array_length(lookups) > 0;
