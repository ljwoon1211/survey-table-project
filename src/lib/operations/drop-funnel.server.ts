import 'server-only';

import { eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { surveys, surveyVersions } from '@/db/schema';
import type {
  QuestionGroupData,
  SurveyVersionSnapshot,
} from '@/db/schema/schema-types';

import {
  formatDropFunnel,
  type DropFunnelOutput,
  type FunnelQuestion,
} from './drop-funnel';

/** 빈 결과 — published version 없거나 snapshot이 비어있을 때. */
const EMPTY_OUTPUT: DropFunnelOutput = { bars: [], totalDrops: 0 };

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
 *   A) surveys.currentVersionId → surveyVersions.snapshot 에서 질문 순서 추출.
 *   B) SQL CTE 로 drop 세션의 마지막 답변 위치별 COUNT 집계.
 *      - DISTINCT ON 으로 응답 1건당 가장 최근 answer 만 선택 (answer 0건이면 NULL).
 *      - exposedQuestionIds 필터: array 이고 lastQuestionId 가 거기 없으면 *제외*.
 *      - 마지막 GROUP BY 가 위치별 COUNT 산출 → 응답 N rows → 위치 M rows 축소.
 *   C) JS 측에서 validQuestionIds 비교로 legacy 분류 → formatDropFunnel 에 위임.
 *
 * Edge case:
 *   - currentVersionId 없음 / snapshot.questions 비어있음 → 빈 결과.
 *   - drop 세션 0건이어도 formatDropFunnel 이 빈 bars 를 반환.
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

  // ── B) SQL 위치별 COUNT 집계 ─────────────────────────────────────────────
  // exposedQuestionIds 필터: shape 함수의 toStringArray 와 동등 — array 가 아닌 모든 형태는 필터 미적용.
  // element type 검증 (모두 string) 은 JS 가 더 엄격하나 데이터 무결성이 보장되는 한 동일 결과.
  const aggregateRows = await db.execute(sql`
    WITH drop_lasts AS (
      SELECT DISTINCT ON (sr.id)
        sr.id AS response_id,
        ra.question_id AS last_question_id,
        sr.metadata -> 'exposedQuestionIds' AS exposed_raw
      FROM survey_responses sr
      LEFT JOIN response_answers ra ON ra.response_id = sr.id
      WHERE sr.survey_id = ${surveyId}::uuid AND sr.status = 'drop'
      ORDER BY sr.id, ra.created_at DESC NULLS LAST
    ),
    filtered AS (
      SELECT last_question_id
      FROM drop_lasts
      WHERE NOT (
        jsonb_typeof(exposed_raw) = 'array'
        AND last_question_id IS NOT NULL
        AND NOT (exposed_raw @> to_jsonb(last_question_id::text))
      )
    )
    SELECT last_question_id, COUNT(*)::int AS cnt
    FROM filtered
    GROUP BY last_question_id
  `);

  // ── C) JS 분류: counts (정상 위치) vs legacyCount (snapshot 부재 / null) ──
  const validQuestionIds = new Set(questions.map((q) => q.id));
  const counts = new Map<string, number>();
  let legacyCount = 0;
  let totalDrops = 0;

  for (const row of aggregateRows as unknown as Array<{
    last_question_id: string | null;
    cnt: number;
  }>) {
    const id = row.last_question_id;
    const cnt = Number(row.cnt);
    totalDrops += cnt;
    if (id === null || !validQuestionIds.has(id)) {
      legacyCount += cnt;
    } else {
      counts.set(id, cnt);
    }
  }

  return formatDropFunnel({ questions, counts, legacyCount, totalDrops });
}
