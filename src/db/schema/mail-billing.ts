import { date, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Resend 메일 발송 비용 정산 — 요금제+결제일 시계열.
 *
 * 각 행은 "start_date(포함) 이후 시작하는 사이클에 이 요금제가 적용" 을 의미한다.
 * 결제일·월정액·초과단가·포함량까지 시계열로 보존해 과거 사이클 정합성을 유지.
 *
 * 청구 카운트는 webhook 으로 적재된 mail_recipients.status (sent 이상)에서 산정한다.
 * Resend API 폴링은 사용하지 않는다 (webhook 이 단일 진실원).
 *
 * 정책:
 *  - start_date.day === billing_day_of_month 가 일관되도록 폼 단에서 강제.
 *  - 가장 최근 행만 삭제 허용 (과거 사이클 정합성 보호).
 *  - 행 UPDATE 는 note 만 허용 (다른 필드 수정은 새 행 등록).
 */
export const mailBillingPeriods = pgTable('mail_billing_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  startDate: date('start_date', { mode: 'string' }).notNull().unique(),
  billingDayOfMonth: integer('billing_day_of_month').notNull(),
  planLabel: text('plan_label').notNull(),
  monthlyFeeKrw: integer('monthly_fee_krw').notNull(),
  includedEmails: integer('included_emails').notNull(),
  overagePer1kKrw: integer('overage_per_1k_krw').notNull(),
  note: text('note'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type MailBillingPeriod = typeof mailBillingPeriods.$inferSelect;
export type NewMailBillingPeriod = typeof mailBillingPeriods.$inferInsert;
