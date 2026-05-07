import 'server-only';

import { eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { surveys } from '@/db/schema/surveys';
import type { ProgressColumnScheme } from '@/db/schema/schema-types';

import type { ProgressRow, ProgressSortKey, SortDir } from './report-progress';

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
 * SECURITY: metaKeys 는 progress_columns 에서 가져온 사용자 입력 — SQL injection
 * 방지를 위해 문자열 escape 필수. attrs JSONB 키는 한글·공백 허용이므로
 * `quote_ident` 가 아닌 literal escape (작은따옴표 두 번) 사용.
 */
export async function getProgressRows(args: GetProgressRowsArgs): Promise<ProgressRow[]> {
  const { surveyId, q, page, size, sort, dir, metaKeys } = args;
  const offset = Math.max(0, (page - 1) * size);

  // 메타 키 SELECT 절 동적 생성. attrs JSONB 키는 parameter binding (안전).
  const metaSelectSql = metaKeys
    .map((k, i) => sql`MIN(ct.attrs->>${k}) AS ${sql.identifier(`meta_${i}`)}`)
    .reduce<ReturnType<typeof sql>>(
      (acc, cur, i) => (i === 0 ? cur : sql`${acc}, ${cur}`),
      sql``,
    );

  // 정렬 표현식. whitelist 후 raw 사용 (column 이름은 binding 불가).
  const sortExpr = sort.startsWith('meta:')
    ? sql.raw(`MIN(ct.attrs->>${escapeLiteral(sort.slice(5))})`)
    : sql.raw(SORT_COL_MAP[sort as Exclude<ProgressSortKey, `meta:${string}`>]);
  const dirSql = dir === 'asc' ? sql.raw('ASC') : sql.raw('DESC');

  const result = await db.execute(sql`
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
      AND (${q} = '' OR COALESCE(ct.group_value, '(미분류)') ILIKE '%' || ${q} || '%')
    GROUP BY ct.group_value
    ORDER BY ${sortExpr} ${dirSql} NULLS LAST, ct.group_value NULLS LAST
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

function escapeLiteral(s: string): string {
  return `'${s.replaceAll("'", "''")}'`;
}
