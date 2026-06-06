import 'server-only';

import { eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { contactAttempts } from '@/db/schema';

import type {
  AddContactAttemptInput,
  DeleteContactAttemptInput,
  UpdateContactAttemptInput,
} from '../../domain/contact-attempt';

/**
 * Postgres UNIQUE 위반 (SQLSTATE 23505) 감지.
 * drizzle-orm + postgres-js 의 error 객체에 code 필드.
 * 폴백으로 message 문자열도 검사.
 *
 * 기존 contact-actions.ts 의 file-private 헬퍼를 동반 이관(한 글자도 변형 금지).
 */
function isUniqueViolation(e: unknown): boolean {
  if (e == null || typeof e !== 'object') return false;
  const err = e as { code?: unknown; message?: unknown };
  if (err.code === '23505') return true;
  if (typeof err.message === 'string') {
    if (err.message.includes('23505')) return true;
    if (err.message.toLowerCase().includes('unique')) return true;
  }
  return false;
}

/**
 * 회차 추가 — attempt_no 는 MAX(attempt_no)+1 로 자동 발번.
 * UNIQUE(contact_target_id, attempt_no) 가 race 가드.
 *
 * I6: 두 사용자 동시 추가 시 23505 (UNIQUE 위반) 발생 가능 → 최대 3회 재시도.
 * 3회 모두 실패 시 user-facing error.
 *
 * surveyId 는 input 으로 받되 service 로직에서는 사용하지 않는다(revalidate 제거).
 */
export async function addAttempt(
  input: AddContactAttemptInput,
): Promise<{ id: string; attemptNo: number }> {
  const { contactTargetId, resultCode, note } = input;

  const MAX_RETRIES = 3;
  let lastError: unknown = null;
  let result: { id: string; attemptNo: number } | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      result = await db.transaction(async (tx) => {
        const [maxRow] = await tx
          .select({ maxNo: sql<number | null>`MAX(${contactAttempts.attemptNo})` })
          .from(contactAttempts)
          .where(eq(contactAttempts.contactTargetId, contactTargetId));
        const nextNo = (maxRow?.maxNo ?? 0) + 1;

        const [row] = await tx
          .insert(contactAttempts)
          .values({
            contactTargetId,
            attemptNo: nextNo,
            resultCode,
            note: note ?? null,
          })
          .returning({ id: contactAttempts.id, attemptNo: contactAttempts.attemptNo });
        if (!row) throw new Error('contact_attempts INSERT 실패');
        return row;
      });
      break; // 성공 시 retry loop 종료
    } catch (e) {
      lastError = e;
      if (!isUniqueViolation(e)) throw e; // 다른 에러는 즉시 전파
      // UNIQUE 위반은 retry — 다음 iteration 에서 MAX+1 재계산
    }
  }

  if (result == null) {
    console.error('[addAttempt] race retry exhausted:', lastError);
    throw new Error('동시 편집 충돌이 발생했습니다. 다시 시도해주세요.');
  }

  return result;
}

/**
 * 회차 수정 — resultCode/note 갱신.
 * surveyId/contactTargetId 는 input 으로 받되 service 로직에서는 사용하지 않는다.
 */
export async function updateAttempt(input: UpdateContactAttemptInput): Promise<void> {
  const { id, resultCode, note } = input;
  await db
    .update(contactAttempts)
    .set({ resultCode, note: note ?? null })
    .where(eq(contactAttempts.id, id));
}

/**
 * 회차 삭제.
 * surveyId/contactTargetId 는 input 으로 받되 service 로직에서는 사용하지 않는다.
 */
export async function deleteAttempt(input: DeleteContactAttemptInput): Promise<void> {
  const { id } = input;
  await db.delete(contactAttempts).where(eq(contactAttempts.id, id));
}
