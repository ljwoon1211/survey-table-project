import 'server-only';

import { asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { contactTargets } from '@/db/schema/contacts';

export interface FirstContactSample {
  attrs: Record<string, string>;
  inviteToken: string;
  email: string | null;
  resid: number;
}

/**
 * 메일 미리보기용 — `resid ASC` 정렬 첫 컨택 1건.
 * 가장 먼저 업로드된 row 로 미리보기를 채운다.
 * 컨택이 0건이면 null.
 */
export async function getFirstContactSample(
  surveyId: string,
): Promise<FirstContactSample | null> {
  const [row] = await db
    .select({
      attrs: contactTargets.attrs,
      inviteToken: contactTargets.inviteToken,
      email: contactTargets.email,
      resid: contactTargets.resid,
    })
    .from(contactTargets)
    .where(eq(contactTargets.surveyId, surveyId))
    .orderBy(asc(contactTargets.resid))
    .limit(1);

  return row ?? null;
}
