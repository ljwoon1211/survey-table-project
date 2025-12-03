'use server';

import { db } from '@/db';
import { surveyResponses, NewSurveyResponse } from '@/db/schema';
import { eq, desc, and, count } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

// ========================
// 응답 관련 액션
// ========================

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

// 응답 삭제
export async function deleteResponse(responseId: string) {
  await db.delete(surveyResponses).where(eq(surveyResponses.id, responseId));
  revalidatePath('/analytics');
}

// 설문별 응답 조회
export async function getResponsesBySurvey(surveyId: string) {
  const responses = await db.query.surveyResponses.findMany({
    where: eq(surveyResponses.surveyId, surveyId),
    orderBy: [desc(surveyResponses.startedAt)],
  });
  return responses;
}

// 완료된 응답만 조회
export async function getCompletedResponses(surveyId: string) {
  const responses = await db.query.surveyResponses.findMany({
    where: and(
      eq(surveyResponses.surveyId, surveyId),
      eq(surveyResponses.isCompleted, true)
    ),
    orderBy: [desc(surveyResponses.completedAt)],
  });
  return responses;
}

// 응답 단일 조회
export async function getResponseById(responseId: string) {
  const response = await db.query.surveyResponses.findFirst({
    where: eq(surveyResponses.id, responseId),
  });
  return response;
}

// 응답 통계 계산
export async function calculateResponseSummary(surveyId: string) {
  const allResponses = await getResponsesBySurvey(surveyId);
  const completedResponses = allResponses.filter(r => r.isCompleted);

  const totalResponses = allResponses.length;
  const completedCount = completedResponses.length;

  // 평균 완료 시간 계산 (분 단위)
  const completionTimes = completedResponses
    .filter(r => r.completedAt)
    .map(r => {
      const startTime = new Date(r.startedAt).getTime();
      const completedTime = new Date(r.completedAt!).getTime();
      return (completedTime - startTime) / (1000 * 60);
    });

  const averageCompletionTime = completionTimes.length > 0
    ? completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length
    : 0;

  const lastResponse = allResponses[0];

  return {
    surveyId,
    totalResponses,
    completedResponses: completedCount,
    averageCompletionTime,
    lastResponseAt: lastResponse?.startedAt,
    responseRate: totalResponses > 0 ? (completedCount / totalResponses) * 100 : 0,
  };
}

// 질문별 통계 계산
export async function getQuestionStatistics(surveyId: string, questionId: string) {
  const completedResponses = await getCompletedResponses(surveyId);

  const questionResponses = completedResponses
    .map(r => (r.questionResponses as Record<string, unknown>)[questionId])
    .filter(r => r !== undefined && r !== null && r !== '');

  if (questionResponses.length === 0) {
    return {
      totalResponses: 0,
      responseRate: 0,
      responses: [],
    };
  }

  const firstResponse = questionResponses[0];

  if (Array.isArray(firstResponse)) {
    // 다중 선택 또는 체크박스
    const allOptions = questionResponses.flat() as string[];
    const optionCounts: Record<string, number> = {};

    allOptions.forEach(option => {
      if (typeof option === 'string') {
        optionCounts[option] = (optionCounts[option] || 0) + 1;
      }
    });

    return {
      totalResponses: questionResponses.length,
      responseRate: (questionResponses.length / completedResponses.length) * 100,
      type: 'multiple',
      optionCounts,
      responses: questionResponses,
    };
  } else if (typeof firstResponse === 'object' && firstResponse !== null) {
    // 테이블 응답
    return {
      totalResponses: questionResponses.length,
      responseRate: (questionResponses.length / completedResponses.length) * 100,
      type: 'table',
      responses: questionResponses,
    };
  } else {
    // 단일 응답 (텍스트, 라디오)
    const responseCounts: Record<string, number> = {};

    questionResponses.forEach(response => {
      const key = String(response);
      responseCounts[key] = (responseCounts[key] || 0) + 1;
    });

    return {
      totalResponses: questionResponses.length,
      responseRate: (questionResponses.length / completedResponses.length) * 100,
      type: 'single',
      responseCounts,
      responses: questionResponses,
    };
  }
}

// 응답 데이터 내보내기 (JSON)
export async function exportResponsesAsJson(surveyId: string) {
  const responses = await getCompletedResponses(surveyId);
  return JSON.stringify(responses, null, 2);
}

// 응답 데이터 내보내기 (CSV)
export async function exportResponsesAsCsv(surveyId: string) {
  const responses = await getCompletedResponses(surveyId);

  if (responses.length === 0) return '';

  const headers = ['응답 ID', '시작 시간', '완료 시간', '완료 시간(분)'];
  const questionIds = new Set<string>();

  responses.forEach(response => {
    Object.keys(response.questionResponses as Record<string, unknown>).forEach(questionId => {
      questionIds.add(questionId);
    });
  });

  headers.push(...Array.from(questionIds));

  const csvData = responses.map(response => {
    const completionTime = response.completedAt
      ? (new Date(response.completedAt).getTime() - new Date(response.startedAt).getTime()) / (1000 * 60)
      : 0;

    const row = [
      response.id,
      response.startedAt.toISOString(),
      response.completedAt?.toISOString() || '',
      completionTime.toFixed(2),
    ];

    const responseData = response.questionResponses as Record<string, unknown>;
    Array.from(questionIds).forEach(questionId => {
      const value = responseData[questionId];
      if (Array.isArray(value)) {
        row.push(value.join('; '));
      } else if (typeof value === 'object') {
        row.push(JSON.stringify(value));
      } else {
        row.push(String(value || ''));
      }
    });

    return row;
  });

  return [headers, ...csvData]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

// 응답 데이터 가져오기
export async function importResponses(data: NewSurveyResponse[]) {
  const inserted = await db.insert(surveyResponses).values(data).returning();
  revalidatePath('/analytics');
  return inserted;
}

// 설문별 응답 전체 삭제
export async function clearSurveyResponses(surveyId: string) {
  await db.delete(surveyResponses).where(eq(surveyResponses.surveyId, surveyId));
  revalidatePath('/analytics');
}

// 전체 응답 삭제
export async function clearAllResponses() {
  await db.delete(surveyResponses);
  revalidatePath('/analytics');
}

// 설문별 응답 수 조회
export async function getResponseCountBySurvey(surveyId: string) {
  const result = await db
    .select({ count: count() })
    .from(surveyResponses)
    .where(eq(surveyResponses.surveyId, surveyId));

  return result[0]?.count || 0;
}

// 설문별 완료된 응답 수 조회
export async function getCompletedResponseCountBySurvey(surveyId: string) {
  const result = await db
    .select({ count: count() })
    .from(surveyResponses)
    .where(
      and(
        eq(surveyResponses.surveyId, surveyId),
        eq(surveyResponses.isCompleted, true)
      )
    );

  return result[0]?.count || 0;
}

