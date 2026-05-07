import 'server-only';

import { eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { surveys } from '@/db/schema/surveys';
import type { ProgressColumnScheme } from '@/db/schema/schema-types';

import type { ProgressRow, ProgressSortKey, SortDir, ProgressTotals } from './report-progress';

const EMPTY_SCHEME: ProgressColumnScheme = { version: 1, columns: [] };

/**
 * `surveys.progress_columns` 가져오기. NULL → 빈 스킴 (4개 고정 컬럼만).
 */
export async function getProgressColumnScheme(surveyId: string): Promise<ProgressColumnScheme> {
  const rows = await db
    .select({ progressColumns: surveys.progressColumns })
    .from(surveys)
    .where(eq(surveys.id, surveyId))
    .limit(1);
  const scheme = rows[0]?.progressColumns;
  return scheme ?? EMPTY_SCHEME;
}

interface GetProgressRowsArgs {
  surveyId: string;
  q: string;
  page: number;
  size: number;
  sort: ProgressSortKey;
  dir: SortDir;
  metaKeys: string[];
}

const SORT_COL_MAP: Record<Exclude<ProgressSortKey, `meta:${string}`>, string> = {
  groupLabel: 'group_label',
  listCount: 'list_count',
  completedCount: 'completed_count',
  responseRate: '(completed_count::float / NULLIF(list_count, 0))',
};

/**
 * 단일 SQL GROUP BY 집계 — 페이지네이션 + 정렬 + 그룹 메타 컬럼 동적 SELECT.
 *
 * 클로징 정의 W∪A: survey_responses.is_completed=true OR
 * contact_attempts.result_code='1.조사완료'. EXISTS 두 번.
 *
 * NULL group_value 는 '(미분류)' 라벨로 표시.
 *
 * 구현 노트: PostgreSQL 은 ORDER BY 절의 expression 안에서 SELECT alias 를
 * 참조할 수 없음 (`ORDER BY (completed_count / list_count)` 같은 형태는
 * unknown column 에러). 그래서 GROUP BY 집계를 inner subquery 로 감싸고
 * outer SELECT 의 ORDER BY 가 inner alias 를 일반 컬럼처럼 참조하도록 함.
 *
 * SECURITY: metaKeys 는 progress_columns 에서 가져온 사용자 입력. attrs JSONB
 * 키는 parameter binding 으로 안전. sortExpr 는 whitelist 또는 inner alias
 * 참조 (meta_0..meta_N) 만 raw 임베드 — 사용자 입력이 SQL 에 직접 박히지 않음.
 */
export async function getProgressRows(args: GetProgressRowsArgs): Promise<ProgressRow[]> {
  const { surveyId, q, page, size, sort, dir, metaKeys } = args;
  const offset = Math.max(0, (page - 1) * size);

  // ILIKE wildcard escape (profiles.server.ts 와 동일 패턴). `${q} = ''`
  // 단축 평가는 사용자 원본 비교라 escape 적용 X — ILIKE 패턴에만 적용.
  const qLike = q
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');

  // 메타 키 SELECT 절 동적 생성. attrs JSONB 키는 parameter binding (안전).
  const metaSelectSql = metaKeys
    .map((k, i) => sql`MIN(ct.attrs->>${k}) AS ${sql.identifier(`meta_${i}`)}`)
    .reduce<ReturnType<typeof sql>>(
      (acc, cur, i) => (i === 0 ? cur : sql`${acc}, ${cur}`),
      sql``,
    );

  // 정렬 표현식 — outer SELECT scope 에서 inner subquery alias 참조.
  // meta:<key> 는 inner alias `meta_<idx>` 로 매핑. 매칭 실패 시 responseRate 폴백.
  let sortExpr;
  if (sort.startsWith('meta:')) {
    const key = sort.slice(5);
    const idx = metaKeys.indexOf(key);
    sortExpr =
      idx >= 0
        ? sql.raw(`meta_${idx}`)
        : sql.raw(SORT_COL_MAP.responseRate);
  } else {
    sortExpr = sql.raw(SORT_COL_MAP[sort as Exclude<ProgressSortKey, `meta:${string}`>]);
  }
  const dirSql = dir === 'asc' ? sql.raw('ASC') : sql.raw('DESC');

  const result = await db.execute(sql`
    SELECT * FROM (
      SELECT
        COALESCE(ct.group_value, '(미분류)') AS group_label,
        ct.group_value AS group_value_raw,
        COUNT(*)::int AS list_count,
        COUNT(*) FILTER (
          WHERE EXISTS (SELECT 1 FROM survey_responses sr
                        WHERE sr.contact_target_id = ct.id AND sr.is_completed = true)
             OR EXISTS (SELECT 1 FROM contact_attempts ca
                        WHERE ca.contact_target_id = ct.id AND ca.result_code = '1.조사완료')
        )::int AS completed_count
        ${metaKeys.length > 0 ? sql`, ${metaSelectSql}` : sql``}
      FROM contact_targets ct
      WHERE ct.survey_id = ${surveyId}
        AND (${q} = '' OR COALESCE(ct.group_value, '(미분류)') ILIKE '%' || ${qLike} || '%')
      GROUP BY ct.group_value
    ) sub
    ORDER BY ${sortExpr} ${dirSql} NULLS LAST, group_value_raw NULLS LAST
    LIMIT ${size} OFFSET ${offset}
  `);

  return (result as unknown as Array<Record<string, unknown>>).map((r) => {
    const meta: Record<string, string | null> = {};
    metaKeys.forEach((k, i) => {
      const v = r[`meta_${i}`];
      meta[k] = typeof v === 'string' && v.length > 0 ? v : null;
    });
    return {
      groupLabel: String(r.group_label),
      groupValueRaw: r.group_value_raw == null ? null : String(r.group_value_raw),
      listCount: Number(r.list_count),
      completedCount: Number(r.completed_count),
      meta,
    };
  });
}

/**
 * 페이지네이션 무시 합계 — "총 N개 그룹 · 리스트 합계 X / 완료 Y".
 * group_count 는 NULL 그룹도 1로 카운트.
 */
export async function getProgressTotals(surveyId: string, q: string): Promise<ProgressTotals> {
  const qLike = q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  const result = await db.execute(sql`
    SELECT
      COUNT(DISTINCT COALESCE(ct.group_value, '(미분류)'))::int AS group_count,
      COUNT(*)::int AS list_total,
      COUNT(*) FILTER (
        WHERE EXISTS (SELECT 1 FROM survey_responses sr
                      WHERE sr.contact_target_id = ct.id AND sr.is_completed = true)
           OR EXISTS (SELECT 1 FROM contact_attempts ca
                      WHERE ca.contact_target_id = ct.id AND ca.result_code = '1.조사완료')
      )::int AS completed_total
    FROM contact_targets ct
    WHERE ct.survey_id = ${surveyId}
      AND (${q} = '' OR COALESCE(ct.group_value, '(미분류)') ILIKE '%' || ${qLike} || '%')
  `);
  const r = (result as unknown as Array<Record<string, unknown>>)[0] ?? {};
  return {
    groupCount: Number(r.group_count ?? 0),
    listTotal: Number(r.list_total ?? 0),
    completedTotal: Number(r.completed_total ?? 0),
  };
}
