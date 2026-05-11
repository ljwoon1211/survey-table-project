'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import * as Sentry from '@sentry/nextjs';

import { db } from '@/db';
import { contactTargets } from '@/db/schema/contacts';
import { UUID_RE } from '@/lib/mail/constants';

export interface UnsubscribeResult {
  ok: boolean;
  email: string | null;
  alreadyUnsubscribed: boolean;
}

/**
 * 토큰으로 contact_targets 행을 찾아 unsubscribed_at 을 설정.
 * idempotent — 이미 해지된 row 는 추가 변경 없이 통과.
 * 페이지가 GET 시 호출하므로 link prefetch 가 사고를 일으켜도 영향 무해.
 *
 * DB 장애 등 예외는 swallow 하고 `ok: false` 로 응답 — 페이지가 친절한 fallback 표시.
 */
export async function unsubscribeByToken(token: string): Promise<UnsubscribeResult> {
  if (!UUID_RE.test(token)) {
    return { ok: false, email: null, alreadyUnsubscribed: false };
  }

  try {
    const [existing] = await db
      .select({
        unsubscribedAt: contactTargets.unsubscribedAt,
        email: contactTargets.email,
      })
      .from(contactTargets)
      .where(eq(contactTargets.unsubscribeToken, token))
      .limit(1);

    if (!existing) {
      return { ok: false, email: null, alreadyUnsubscribed: false };
    }

    const alreadyUnsubscribed = existing.unsubscribedAt !== null;
    if (!alreadyUnsubscribed) {
      await db
        .update(contactTargets)
        .set({ unsubscribedAt: new Date() })
        .where(eq(contactTargets.unsubscribeToken, token));
    }
    return { ok: true, email: existing.email, alreadyUnsubscribed };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { operation: 'unsubscribe_by_token' },
      level: 'error',
    });
    return { ok: false, email: null, alreadyUnsubscribed: false };
  }
}

/**
 * 되돌리기 — form action 으로 호출. token 은 .bind(null, token) 로 partial 적용.
 * 처리 후 /unsubscribe/restored 로 redirect — 같은 페이지로 돌아가면 즉시 재해지되는
 * 루프 방지. DB 장애 시에도 redirect 는 진행 (사용자에게 무한 로딩 노출 방지).
 */
export async function revertUnsubscribeAction(token: string): Promise<void> {
  if (UUID_RE.test(token)) {
    try {
      await db
        .update(contactTargets)
        .set({ unsubscribedAt: null })
        .where(eq(contactTargets.unsubscribeToken, token));
    } catch (err) {
      Sentry.captureException(err, {
        tags: { operation: 'revert_unsubscribe' },
        level: 'error',
      });
    }
  }
  redirect('/unsubscribe/restored');
}
