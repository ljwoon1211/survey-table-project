'use server';

import { db } from '@/db';
import { surveyResponses, NewSurveyResponse } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth';

// ========================
// 응답 변경 액션 (Mutations)
// ========================

// 아래 3개 함수는 설문 응답자용이므로 인증 체크하지 않음
// - startResponse
// - updateQuestionResponse
// - completeResponse

// 응답 시작
export async function startResponse(surveyId: string, sessionId?: string) {
  const newResponse: NewSurveyResponse = {
    surveyId,
    questionResponses: {},
    isCompleted: false,
    sessionId: sessionId || `session-${Date.now()}`,
  };

  const [response] = await db.insert(surveyResponses).values(newResponse).returning();
  return response;
}

// 질문 응답 업데이트
export async function updateQuestionResponse(
  responseId: string,
  questionId: string,
  value: unknown
) {
  // 현재 응답 조회
  const current = await db.query.surveyResponses.findFirst({
    where: eq(surveyResponses.id, responseId),
  });

  if (!current) {
    throw new Error('응답을 찾을 수 없습니다.');
  }

  // 응답 데이터 업데이트
  const updatedResponses = {
    ...(current.questionResponses as Record<string, unknown>),
    [questionId]: value,
  };

  const [updated] = await db
    .update(surveyResponses)
    .set({ questionResponses: updatedResponses })
    .where(eq(surveyResponses.id, responseId))
    .returning();

  return updated;
}

// 응답 완료
export async function completeResponse(responseId: string) {
  const [updated] = await db
    .update(surveyResponses)
    .set({
      isCompleted: true,
      completedAt: new Date(),
    })
    .where(eq(surveyResponses.id, responseId))
    .returning();

  revalidatePath('/analytics');
  return updated;
}

// 응답 삭제 (관리자 전용)
export async function deleteResponse(responseId: string) {
  await requireAuth();

  await db.delete(surveyResponses).where(eq(surveyResponses.id, responseId));
  revalidatePath('/analytics');
}

// 응답 데이터 가져오기 (관리자 전용)
export async function importResponses(data: NewSurveyResponse[]) {
  await requireAuth();

  const inserted = await db.insert(surveyResponses).values(data).returning();
  revalidatePath('/analytics');
  return inserted;
}

// 설문별 응답 전체 삭제 (관리자 전용)
export async function clearSurveyResponses(surveyId: string) {
  await requireAuth();

  await db.delete(surveyResponses).where(eq(surveyResponses.surveyId, surveyId));
  revalidatePath('/analytics');
}

// 전체 응답 삭제 (관리자 전용)
export async function clearAllResponses() {
  await requireAuth();

  await db.delete(surveyResponses);
  revalidatePath('/analytics');
}
