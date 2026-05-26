'use server';

import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { contactTargets } from '@/db/schema/contacts';
import { requireAuth } from '@/lib/auth';

/**
 * inviteToken 으로 attrs 조회. 무효 토큰이면 null 반환 (silent fallback).
 * - lookup_contact_by_invite_token RPC 와 동일한 매칭 정책 (surveyId + inviteToken)
 * - 응답 도중 새로고침 시 매번 fresh 로드 — 운영자가 attrs 수정하면 다음 진입에 반영
 */
export async function lookupContactAttrs(
  surveyId: string,
  inviteToken: string,
): Promise<Record<string, string> | null> {
  if (!inviteToken) return null;

  const [row] = await db
    .select({ attrs: contactTargets.attrs })
    .from(contactTargets)
    .where(
      and(
        eq(contactTargets.surveyId, surveyId),
        eq(contactTargets.inviteToken, inviteToken),
      ),
    )
    .limit(1);

  return row?.attrs ?? null;
}

/**
 * 빌더 테스트 모드의 "샘플 컨택 셀렉터" 용 — 설문의 컨택 목록을 일부만 조회.
 * - PII(이메일/사업자번호 등) 는 contact_targets.attrs JSONB 내부에 머지되어 저장됨.
 *   라벨은 attrs 의 일반적인 키 (email/bizNumber 등) 를 우선 시도하고, 없으면 resid·id slice 로 fallback.
 * - 응답 페이지 본체와 달리 어드민 인증된 빌더에서만 호출되므로 requireAuth 만 적용.
 *   (lookup-actions.ts 와 동일한 권한 패턴)
 */
export async function listContactsForSampleAction(
  surveyId: string,
  limit = 50,
): Promise<Array<{ id: string; label: string; attrs: Record<string, string> }>> {
  await requireAuth();

  const rows = await db
    .select({
      id: contactTargets.id,
      resid: contactTargets.resid,
      attrs: contactTargets.attrs,
    })
    .from(contactTargets)
    .where(eq(contactTargets.surveyId, surveyId))
    .orderBy(asc(contactTargets.resid))
    .limit(limit);

  return rows.map((r) => {
    const attrs = (r.attrs as Record<string, string>) ?? {};
    const primary =
      attrs.email ??
      attrs.Email ??
      attrs.bizNumber ??
      attrs.biz_number ??
      attrs.businessNumber ??
      null;
    const label = primary
      ? `${primary} (#${r.resid})`
      : `#${r.resid} · ${r.id.slice(0, 8)}`;
    return { id: r.id, label, attrs };
  });
}
