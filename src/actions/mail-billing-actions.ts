'use server';

import { eq, gt } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { db } from '@/db';
import { mailBillingPeriods } from '@/db/schema/mail-billing';
import { requireAuth } from '@/lib/auth';

interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

const createSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다.'),
  planLabel: z.string().trim().min(1, '요금제 라벨은 필수입니다.').max(60),
  monthlyFeeKrw: z.number().int().min(0).max(10_000_000_000),
  includedEmails: z.number().int().min(0).max(100_000_000),
  overagePer1kKrw: z.number().int().min(0).max(10_000_000),
  note: z.string().trim().max(500).optional(),
});

export async function createBillingPeriodAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    const parsed = createSchema.parse(input);

    // start_date.day === billing_day_of_month 강제. 결제일은 startDate.day 에서 추출.
    const day = parseInt(parsed.startDate.slice(8, 10), 10);
    if (!Number.isFinite(day) || day < 1 || day > 28) {
      return { ok: false, error: '시작일은 매달 1~28일 사이여야 합니다 (월말 보정 회피).' };
    }

    await db.insert(mailBillingPeriods).values({
      startDate: parsed.startDate,
      billingDayOfMonth: day,
      planLabel: parsed.planLabel,
      monthlyFeeKrw: parsed.monthlyFeeKrw,
      includedEmails: parsed.includedEmails,
      overagePer1kKrw: parsed.overagePer1kKrw,
      note: parsed.note ?? null,
      createdBy: user.id,
    });

    revalidatePath('/admin/billing/mail-cost');
    return { ok: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.issues.map((i) => i.message).join(', ') };
    }
    const msg = err instanceof Error ? err.message : String(err);
    // Postgres 가 자동 부여한 unique 제약 이름은 `<table>_<column>_key` 형식.
    // 메시지 매칭은 컬럼명 기준으로 느슨하게 처리해 향후 제약 이름 변경에도 견디게 함.
    if (msg.includes('start_date') && (msg.includes('unique') || msg.includes('duplicate key'))) {
      return { ok: false, error: '동일한 시작일의 요금제가 이미 등록되어 있습니다.' };
    }
    return { ok: false, error: msg };
  }
}

const deleteSchema = z.object({ id: z.string().uuid() });

/**
 * 가장 최근 행만 삭제 허용. 중간 행 삭제는 과거 사이클 정합성을 깨므로 거부.
 */
export async function deleteLatestBillingPeriodAction(input: unknown): Promise<ActionResult> {
  try {
    await requireAuth();
    const { id } = deleteSchema.parse(input);

    const target = await db
      .select({ id: mailBillingPeriods.id, startDate: mailBillingPeriods.startDate })
      .from(mailBillingPeriods)
      .where(eq(mailBillingPeriods.id, id))
      .limit(1);
    if (target.length === 0) return { ok: false, error: '대상 요금제를 찾을 수 없습니다.' };

    const newer = await db
      .select({ id: mailBillingPeriods.id })
      .from(mailBillingPeriods)
      .where(gt(mailBillingPeriods.startDate, target[0]!.startDate))
      .limit(1);
    if (newer.length > 0) {
      return {
        ok: false,
        error: '더 최근의 요금제가 존재합니다. 가장 최근 행부터 차례로 삭제해주세요.',
      };
    }

    await db.delete(mailBillingPeriods).where(eq(mailBillingPeriods.id, id));
    revalidatePath('/admin/billing/mail-cost');
    return { ok: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.issues.map((i) => i.message).join(', ') };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

