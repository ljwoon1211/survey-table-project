'use server';

import { revalidatePath } from 'next/cache';

import { eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { NewSurveyResponse, surveyResponses } from '@/db/schema';
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

// 질문 응답 업데이트 (원자적 업데이트로 Race Condition 방지)
export async function updateQuestionResponse(
  responseId: string,
  questionId: string,
  value: unknown,
) {
  // 🚀 SQL 레벨에서 JSON의 특정 경로만 원자적으로 업데이트
  // PostgreSQL의 jsonb_set 함수 사용 (읽기-수정-쓰기 과정 없음)
  const [updated] = await db
    .update(surveyResponses)
    .set({
      questionResponses: sql`jsonb_set(
        COALESCE(${surveyResponses.questionResponses}, '{}'::jsonb),
        ARRAY[${questionId}],
        ${JSON.stringify(value)}::jsonb,
        true
      )`,
    })
    .where(eq(surveyResponses.id, responseId))
    .returning();

  if (!updated) {
    throw new Error('응답을 찾을 수 없습니다.');
  }

  return updated;
}

// 응답 완료
export async function completeResponse(
  responseId: string,
  data?: {
    questionResponses?: Record<string, unknown>;
    exposedQuestionIds?: string[];
    exposedRowIds?: string[];
  },
) {
  const [updated] = await db
    .update(surveyResponses)
    .set({
      isCompleted: true,
      completedAt: new Date(),
      ...(data?.questionResponses ? { questionResponses: data.questionResponses } : {}),
      ...((data?.exposedQuestionIds || data?.exposedRowIds)
        ? {
            metadata: {
              ...(data?.exposedQuestionIds ? { exposedQuestionIds: data.exposedQuestionIds } : {}),
              ...(data?.exposedRowIds ? { exposedRowIds: data.exposedRowIds } : {}),
            },
          }
        : {}),
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
