import 'server-only';

import { and, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  surveyResponses,
  surveys,
  surveyVersions,
} from '@/db/schema';
import type { PageVisit } from '@/db/schema/schema-types';

import { shapePageDwell, type DwellOutput } from './page-dwell';

/** 빈 결과 — published version이 없거나 snapshot이 비어있을 때. */
const EMPTY_OUTPUT: DwellOutput = { pages: [] };

/**
 * 단일 설문의 페이지별 체류시간 분포를 반환한다 (서버 전용).
 *
 * 처리 단계:
 *   A) surveys.currentVersionId → surveyVersions.snapshot 로드.
 *      - 없으면 EMPTY_OUTPUT (drop-funnel과 동일).
 *   B) status IN ('completed', 'drop') 응답들의 pageVisits만 조회.
 *      page_visits가 빈 배열인 행은 SQL 단계에서 사전 제외 → 페이로드 절감.
 *   C) shapePageDwell에 위임.
 *
 * Notes:
 *   - in_progress는 leftAt이 비어 있을 가능성이 높아 의미 없는 데이터를 만든다 → 제외.
 *   - drop은 마지막 페이지의 leftAt이 비어 있을 수 있으나, 그 visit는 순수 함수에서 skip.
 */
export async function getPageDwell(surveyId: string): Promise<DwellOutput> {
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
  if (!snapshot) return EMPTY_OUTPUT;

  // ── B) 응답 pageVisits 조회 ──────────────────────────────────────────────
  // jsonb_array_length로 빈 배열 사전 제외 (백필된 '[]' 행 다수 가정).
  const rows = await db
    .select({ pageVisits: surveyResponses.pageVisits })
    .from(surveyResponses)
    .where(
      and(
        eq(surveyResponses.surveyId, surveyId),
        inArray(surveyResponses.status, ['completed', 'drop']),
        sql`jsonb_array_length(${surveyResponses.pageVisits}) > 0`,
      ),
    );

  // ── C) 순수 함수에 위임 ─────────────────────────────────────────────────
  const responses: Array<{ pageVisits: PageVisit[] | null }> = rows.map((r) => ({
    pageVisits: r.pageVisits ?? null,
  }));

  return shapePageDwell({ responses, snapshot });
}
