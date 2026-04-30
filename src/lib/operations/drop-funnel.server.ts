import 'server-only';

import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  responseAnswers,
  surveyResponses,
  surveys,
  surveyVersions,
} from '@/db/schema';
import type {
  QuestionGroupData,
  SurveyVersionSnapshot,
} from '@/db/schema/schema-types';

import {
  shapeDropFunnel,
  type DropFunnelInput,
  type DropFunnelOutput,
  type FunnelQuestion,
} from './drop-funnel';

/** 빈 결과 — published version 없거나 snapshot이 비어있을 때. */
const EMPTY_OUTPUT: DropFunnelOutput = { bars: [], totalDrops: 0 };

/**
 * jsonb -> 'exposedQuestionIds' 의 결과(unknown)를 string[] 또는 null로 좁힌다.
 *
 * - 배열이고 모든 원소가 string이면 그대로 반환.
 * - 그 외 (null, 객체, 빈 키, 다른 타입 섞인 배열) → null (= 노출 정보 미상).
 */
function toStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((v): v is string => typeof v === 'string')) return null;
  return value;
}

/**
 * snapshot의 questions를 깔때기용 FunnelQuestion[]으로 변환.
 *
 * - snapshot.questions의 배열 인덱스를 1-based position으로 사용.
 * - 라벨 우선순위: questionCode → `Q{position}` 폴백.
 *   (questionCode는 SPSS 변수명으로 'SQ', 'Q3', 'Q5_1' 등 mockup 형식과 일치한다.)
 * - page: 그 질문이 속한 *최상위* 그룹의 1-based 페이지 번호.
 *   - parentGroupId 체인을 따라 root까지 거슬러 올라가 root group을 찾는다.
 *   - 최상위 그룹들을 order ASC 로 정렬한 뒤 인덱스 + 1.
 *   - 질문이 ungrouped(groupId 없음) 또는 root group이 snapshot에 없으면 undefined.
 *
 * 주의: schema-types.ts의 QuestionData 인터페이스에는 questionCode 필드가 빠져있지만
 *   실제 저장된 snapshot에는 포함되어 있다 (questions 테이블의 question_code 컬럼이 그대로 들어감).
 *   안전하게 인덱스 액세스로 읽는다.
 */
function buildFunnelQuestions(
  snapshot: SurveyVersionSnapshot | null,
): FunnelQuestion[] {
  if (!snapshot || !Array.isArray(snapshot.questions)) return [];

  const groups: QuestionGroupData[] = Array.isArray(snapshot.groups)
    ? snapshot.groups
    : [];

  // groupId → group 매핑 (parent walk 용).
  const groupById = new Map<string, QuestionGroupData>();
  for (const g of groups) {
    groupById.set(g.id, g);
  }

  // 최상위 그룹을 order ASC 로 정렬 → 페이지 번호 (1-based) 매핑.
  const topLevelGroups = groups
    .filter((g) => !g.parentGroupId)
    .sort((a, b) => a.order - b.order);
  const pageByRootId = new Map<string, number>();
  topLevelGroups.forEach((g, idx) => {
    pageByRootId.set(g.id, idx + 1);
  });

  /**
   * 그룹의 root(최상위) group id를 찾는다.
   * parentGroupId 체인을 따라가며, 사이클이 있을 경우 방어적으로 종료.
   */
  const findRootGroupId = (groupId: string): string | null => {
    const visited = new Set<string>();
    let current: QuestionGroupData | undefined = groupById.get(groupId);
    while (current) {
      if (visited.has(current.id)) return null; // 사이클 방어.
      visited.add(current.id);
      if (!current.parentGroupId) return current.id;
      current = groupById.get(current.parentGroupId);
    }
    return null;
  };

  return snapshot.questions.map((q, idx) => {
    const position = idx + 1;
    // questionCode는 schema-types에 명시되지 않은 필드 — 인덱스 액세스로 안전 읽기.
    const code = (q as { questionCode?: string | null }).questionCode;
    const label = typeof code === 'string' && code.length > 0 ? code : `Q${position}`;

    // page 결정: groupId 있으면 root까지 거슬러 → 페이지 번호 lookup.
    let page: number | undefined;
    if (q.groupId) {
      const rootId = findRootGroupId(q.groupId);
      if (rootId !== null) {
        page = pageByRootId.get(rootId);
      }
    }

    return { id: q.id, position, label, page };
  });
}

/**
 * 단일 설문의 Drop funnel 데이터를 반환한다 (서버 전용).
 *
 * 처리 단계:
 *   A) surveys.currentVersionId → surveyVersions.snapshot에서 질문 순서 추출.
 *   B) drop 세션의 마지막 답변 질문(`response_answers.created_at` 최댓값) + exposedQuestionIds 수집.
 *   C) 순수 함수 `shapeDropFunnel` 에 위임해 막대 배열 생성.
 *
 * Edge case:
 *   - currentVersionId 없음 / snapshot.questions 비어있음 → 빈 결과.
 *   - drop 세션 0건이어도 순수 함수가 빈 bars를 반환하므로 자연스럽게 처리된다.
 *
 * 진행률 의미:
 *   `cumulativeProgressPct`는 도달자 비율이 아니라 *질문 위치 비율* (position / totalQuestions × 100)
 *   이므로 reachedCounts / totalStarted 쿼리는 더 이상 필요 없다.
 */
export async function getDropFunnel(surveyId: string): Promise<DropFunnelOutput> {
  // ── A) 현재 published snapshot 로드 ──────────────────────────────────────
  const surveyRow = await db
    .select({ currentVersionId: surveys.currentVersionId })
    .from(surveys)
    .where(eq(surveys.id, surveyId))
    .limit(1);

  const currentVersionId = surveyRow[0]?.currentVersionId;
  if (!currentVersionId) return EMPTY_OUTPUT;

  const versionRow = await db
    .select({ snapshot: surveyVersions.snapshot })
    .from(surveyVersions)
    .where(eq(surveyVersions.id, currentVersionId))
    .limit(1);

  const snapshot = versionRow[0]?.snapshot ?? null;
  const questions = buildFunnelQuestions(snapshot);
  if (questions.length === 0) return EMPTY_OUTPUT;

  // ── B) drop 세션의 마지막 답변 + exposure 메타데이터 ─────────────────────
  // DISTINCT ON (sr.id) + ORDER BY sr.id, ra.created_at DESC NULLS LAST 로
  // 응답 1건당 가장 최근 answer 1행만 선택. answer 0건인 drop은 LEFT JOIN으로 NULL 보존.
  // - exposedQuestionIds 는 jsonb -> 'exposedQuestionIds' 결과를 그대로 받아 런타임 검사로 좁힌다.
  const dropRows = await db
    .selectDistinctOn([surveyResponses.id], {
      responseId: surveyResponses.id,
      lastQuestionId: responseAnswers.questionId,
      exposedQuestionIdsRaw: sql<unknown>`${surveyResponses.metadata} -> 'exposedQuestionIds'`,
    })
    .from(surveyResponses)
    .leftJoin(responseAnswers, eq(responseAnswers.responseId, surveyResponses.id))
    .where(
      and(
        eq(surveyResponses.surveyId, surveyId),
        eq(surveyResponses.status, 'drop'),
      ),
    )
    .orderBy(
      surveyResponses.id,
      sql`${responseAnswers.createdAt} DESC NULLS LAST`,
    );

  const drops: DropFunnelInput['drops'] = dropRows.map((r) => ({
    responseId: r.responseId,
    lastQuestionId: r.lastQuestionId,
    // jsonb -> ... 결과: 배열이면 그대로, 다른 타입이면 (객체/숫자/문자열/null) 방어적으로 null.
    exposedQuestionIds: toStringArray(r.exposedQuestionIdsRaw),
  }));

  // ── C) 순수 함수에 위임 ─────────────────────────────────────────────
  return shapeDropFunnel({
    questions,
    drops,
  });
}
