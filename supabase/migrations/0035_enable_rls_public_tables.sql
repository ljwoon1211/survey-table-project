-- 0035_enable_rls_public_tables.sql
-- 적용: 2026-06-13 Supabase MCP apply_migration 로 운영 DB 적용 (drizzle _journal.json 비대상 — 추적 기록).
--
-- public 스키마 테이블에 RLS 활성(deny-all)으로 정합. 이 앱은 데이터 접근을 전부
-- Drizzle(DATABASE_URL=postgres, BYPASSRLS) / service_role(BYPASSRLS)로만 하고 anon/authenticated
-- 롤로 테이블을 직접 쿼리하지 않으므로, 정책 없이 RLS 만 켜도 서버 경로는 정상 동작하고
-- anon/authenticated 는 deny 된다 (service-role 전용 앱의 표준 구성). FORCE 가 아니라 ENABLE 만
-- (postgres owner/BYPASSRLS 가 우회). contact_pii / contact_targets 는 이미 RLS-on 이라 제외.
--
-- 향후: 신규 public 테이블 추가 시 같은 마이그레이션에서 ENABLE ROW LEVEL SECURITY 를 함께 적용할 것.

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_edit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_lookups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_billing_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- 레거시 고아 테이블(mail_* 리팩토링 이전 email_*) — 사용 안 하지만 노출 차단 위해 함께 활성
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;
