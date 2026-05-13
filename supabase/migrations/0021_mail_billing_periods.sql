-- Migration: 0021_mail_billing_periods
-- Purpose: Resend 메일 발송 비용 정산을 위한 요금제+결제일 시계열.
--   각 행 = "start_date(KST 자정, 포함) 이후 시작하는 사이클에 이 요금제가 적용됨".
--   결제일 변경뿐 아니라 요금제 변경 이력도 시계열로 보존하여 과거 사이클의 청구 정합성을 유지한다.
--
-- 청구 카운트는 mail_recipients.status (webhook 적재) 에서 sent 이상 진행된 행 수로 산정.
-- Resend GET /emails API 폴링은 사용하지 않는다 (webhook 이 단일 진실원).
--
-- 정책:
--  - start_date.day === billing_day_of_month 가 일관되도록 어플리케이션 폼에서 강제.
--  - 가장 최근 행만 삭제 허용 (과거 사이클 정합성 보호).
--  - 행 UPDATE 는 note 만 허용 (다른 필드 수정은 새 행 등록).

BEGIN;

CREATE TABLE "mail_billing_periods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- KST 자정 기준. 이 날짜 이후 시작하는 사이클에 적용.
  "start_date" date NOT NULL UNIQUE,
  -- 매달 결제일 (1~28). 월말 보정 회피.
  "billing_day_of_month" integer NOT NULL CHECK ("billing_day_of_month" BETWEEN 1 AND 28),
  -- 요금제 라벨 (예: 'Pro 50K', 'Pro 100K', 'Scale 100K').
  "plan_label" text NOT NULL,
  -- 월 구독료 (원). 운영자가 환율을 반영해 KRW 정수로 직접 입력.
  "monthly_fee_krw" integer NOT NULL CHECK ("monthly_fee_krw" >= 0),
  -- 사이클 포함 이메일 수 (예: 50000).
  "included_emails" integer NOT NULL CHECK ("included_emails" >= 0),
  -- 1,000건당 초과 단가 (원).
  "overage_per_1k_krw" integer NOT NULL CHECK ("overage_per_1k_krw" >= 0),
  "note" text,
  "created_by" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "mail_billing_periods_start_date_idx" ON "mail_billing_periods" ("start_date");

COMMIT;
