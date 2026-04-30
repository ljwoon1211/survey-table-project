'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { NewSurveyResponse, questions, responseAnswers, surveyResponses } from '@/db/schema';
import type { PageVisit } from '@/db/schema/schema-types';
import { requireAuth } from '@/lib/auth';
import { parseBrowser, parsePlatform } from '@/lib/operations/parse-ua';
import { normalizeToAnswers } from '@/lib/response-normalizer';

// ========================
// 응답 변경 액션 (Mutations)
// ========================

// 아래 3개 함수는 설문 응답자용이므로 인증 체크하지 않음
// - startResponse
// - updateQuestionResponse
// - completeResponse

// 응답 시작
export async function startResponse(
  surveyId: string,
  sessionId?: string,
  versionId?: string,
) {
  const newResponse: NewSurveyResponse = {
    surveyId,
    questionResponses: {},
    isCompleted: false,
    sessionId: sessionId || `session-${Date.now()}`,
    versionId: versionId || null,
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

// ========================
// 운영 현황 콘솔 — 응답 라이프사이클 통합 지점 (T4)
// ========================

/**
 * 첫 답변과 함께 survey_responses 행을 INSERT.
 *
 * - UA를 서버 헤더에서 읽어 platform/browser를 파싱
 * - 첫 답변(`questionResponses`)과 첫 페이지 방문 기록을 함께 기록
 * - 동일 (surveyId, sessionId) 조합이 이미 있으면 INSERT를 건너뛰고
 *   기존 행에 답변만 적용 (멱등성 보장 — 더블클릭 방어)
 *
 * @returns 생성되거나 기존에 존재하던 응답 행의 id
 */
export async function createResponseWithFirstAnswer(input: {
  surveyId: string;
  sessionId: string;
  versionId: string | null;
  questionId: string;
  value: unknown;
  currentStepId: string;
}): Promise<{ id: string }> {
  const { surveyId, sessionId, versionId, questionId, value, currentStepId } = input;

  // 1. 멱등성 체크: 동일 (surveyId, sessionId) 행이 이미 존재하는가?
  const existing = await db
    .select({ id: surveyResponses.id })
    .from(surveyResponses)
    .where(
      and(eq(surveyResponses.surveyId, surveyId), eq(surveyResponses.sessionId, sessionId)),
    )
    .limit(1);

  if (existing.length > 0) {
    // 이미 존재 → INSERT 건너뛰고 답변만 적용
    await updateQuestionResponse(existing[0].id, questionId, value);
    return { id: existing[0].id };
  }

  // 2. UA 파싱 (Next 15+ 비동기 headers API)
  const headerStore = await headers();
  const userAgent = headerStore.get('user-agent') ?? null;
  const platform = parsePlatform(userAgent);
  const browser = parseBrowser(userAgent);

  // 3. 첫 페이지 방문 기록 (ISO 문자열 — JSONB 형태가 PageVisit 타입과 일치하도록)
  const nowIso = new Date().toISOString();
  const firstVisit: PageVisit = {
    stepId: currentStepId,
    enteredAt: nowIso,
    leftAt: undefined,
  };

  // 4. INSERT — startedAt/lastActivityAt은 DB의 defaultNow()에 위임
  const newResponse: NewSurveyResponse = {
    surveyId,
    sessionId,
    versionId: versionId ?? null,
    questionResponses: { [questionId]: value },
    isCompleted: false,
    status: 'in_progress',
    userAgent,
    platform,
    browser,
    currentStepId,
    pageVisits: [firstVisit],
  };

  const [inserted] = await db
    .insert(surveyResponses)
    .values(newResponse)
    .returning({ id: surveyResponses.id });

  return { id: inserted.id };
}

/**
 * 페이지 이동(스텝 전환) 기록.
 *
 * - 동일 stepId면 no-op (React 더블 이펙트, 네비게이션 레이스 방어)
 * - 그 외 단일 UPDATE로 원자적 처리:
 *   - 이전 마지막 pageVisits 항목의 leftAt을 now()로 (NULL일 때만 — 뒤로갔다 앞으로 시 기존 leftAt 보존)
 *   - 새 항목을 pageVisits 끝에 append
 *   - currentStepId, lastActivityAt 갱신
 *
 * @throws 행이 없으면 에러 — 호출자(T5)는 catch & log하되 사용자 흐름은 막지 않는다
 */
export async function recordStepVisit(input: {
  responseId: string;
  nextStepId: string;
}): Promise<void> {
  const { responseId, nextStepId } = input;

  // 단일 UPDATE: WHERE 절에서 currentStepId !== nextStepId 조건으로 멱등성 보장
  // jsonb_set은 마지막 항목의 leftAt이 NULL일 때만 갱신, 그 후 || 로 새 항목 append.
  const result = await db
    .update(surveyResponses)
    .set({
      currentStepId: nextStepId,
      lastActivityAt: new Date(),
      pageVisits: sql`(
        CASE
          WHEN jsonb_array_length(COALESCE(${surveyResponses.pageVisits}, '[]'::jsonb)) > 0
           AND (COALESCE(${surveyResponses.pageVisits}, '[]'::jsonb) -> -1 ->> 'leftAt') IS NULL
          THEN jsonb_set(
                 COALESCE(${surveyResponses.pageVisits}, '[]'::jsonb),
                 ARRAY[(jsonb_array_length(COALESCE(${surveyResponses.pageVisits}, '[]'::jsonb)) - 1)::text, 'leftAt'],
                 to_jsonb(now())
               )
          ELSE COALESCE(${surveyResponses.pageVisits}, '[]'::jsonb)
        END
      ) || jsonb_build_array(
        jsonb_build_object(
          'stepId', ${nextStepId}::text,
          'enteredAt', to_jsonb(now())
        )
      )`,
    })
    .where(
      and(
        eq(surveyResponses.id, responseId),
        // 동일 스텝이면 UPDATE 자체를 건너뛴다 (no-op idempotency)
        sql`COALESCE(${surveyResponses.currentStepId}, '') <> ${nextStepId}`,
      ),
    )
    .returning({ id: surveyResponses.id });

  if (result.length === 0) {
    // 행이 없거나 이미 같은 스텝인 경우. 같은 스텝은 no-op이므로 통과해야 함.
    // → 행 존재 여부를 확인해 행이 없을 때만 throw.
    const exists = await db
      .select({ id: surveyResponses.id })
      .from(surveyResponses)
      .where(eq(surveyResponses.id, responseId))
      .limit(1);

    if (exists.length === 0) {
      throw new Error('응답을 찾을 수 없습니다.');
    }
    // 같은 스텝이면 그냥 통과 (no-op)
  }
}

// 응답 완료 (JSONB + response_answers 이중 쓰기)
// 읽기: response_answers 우선 (getResponsesWithAnswers), JSONB fallback
// JSONB 쓰기는 마이그레이션 완료 + 모든 읽기 경로 전환 후 제거 예정
export async function completeResponse(
  responseId: string,
  data?: {
    questionResponses?: Record<string, unknown>;
    exposedQuestionIds?: string[];
    exposedRowIds?: string[];
  },
) {
  const result = await db.transaction(async (tx) => {
    // 1. 기존 JSONB 방식 저장 + 운영 현황 추적 컬럼 갱신
    const [updated] = await tx
      .update(surveyResponses)
      .set({
        isCompleted: true,
        completedAt: new Date(),
        // 운영 현황 콘솔용 추적 컬럼
        status: 'completed',
        lastActivityAt: new Date(),
        // 서버 클럭 기준 경과 초 (started_at부터 now()까지)
        totalSeconds: sql`EXTRACT(EPOCH FROM (now() - ${surveyResponses.startedAt}))::int`,
        // 마지막 pageVisits 항목의 leftAt이 NULL이면 now()로 백필
        // (sweep_stale_sessions 함수의 CASE 패턴과 동일)
        pageVisits: sql`CASE
          WHEN jsonb_array_length(COALESCE(${surveyResponses.pageVisits}, '[]'::jsonb)) > 0
           AND (COALESCE(${surveyResponses.pageVisits}, '[]'::jsonb) -> -1 ->> 'leftAt') IS NULL
          THEN jsonb_set(
                 COALESCE(${surveyResponses.pageVisits}, '[]'::jsonb),
                 ARRAY[(jsonb_array_length(COALESCE(${surveyResponses.pageVisits}, '[]'::jsonb)) - 1)::text, 'leftAt'],
                 to_jsonb(now())
               )
          ELSE COALESCE(${surveyResponses.pageVisits}, '[]'::jsonb)
        END`,
        ...(data?.questionResponses ? { questionResponses: data.questionResponses } : {}),
        ...((data?.exposedQuestionIds || data?.exposedRowIds)
          ? {
              metadata: {
                ...(data?.exposedQuestionIds
                  ? { exposedQuestionIds: data.exposedQuestionIds }
                  : {}),
                ...(data?.exposedRowIds ? { exposedRowIds: data.exposedRowIds } : {}),
              },
            }
          : {}),
      })
      .where(eq(surveyResponses.id, responseId))
      .returning();

    // 2. response_answers 정규화 저장 (이중 쓰기)
    if (data?.questionResponses && Object.keys(data.questionResponses).length > 0) {
      // 해당 응답의 설문 질문 목록 조회
      const questionList = await tx.query.questions.findMany({
        where: eq(questions.surveyId, updated.surveyId),
        columns: { id: true, type: true },
      });

      const normalizedAnswers = normalizeToAnswers(
        responseId,
        data.questionResponses,
        questionList,
      );

      if (normalizedAnswers.length > 0) {
        await tx.insert(responseAnswers).values(normalizedAnswers);
      }
    }

    return updated;
  });

  revalidatePath('/analytics');
  return result;
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
