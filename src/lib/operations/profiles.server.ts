import 'server-only';

import { and, asc, eq, ilike, or, sql, type AnyColumn, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import { surveyResponses } from '@/db/schema';

import type { Platform } from './parse-ua';
import { formatIpMask } from './profiles';

const SORT_KEYS = [
  'idx',
  'ip',
  'platform',
  'browser',
  'startedAt',
  'completedAt',
  'totalSeconds',
] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export type SortDir = 'asc' | 'desc';

const QFIELDS = ['all', 'idx', 'ip', 'browser'] as const;
export type QField = (typeof QFIELDS)[number];

const STATUS_FILTERS = [
  'all',
  'completed',
  'in_progress',
  'drop',
  'screened_out',
  'quotaful_out',
  'bad',
] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export interface ListProfilesArgs {
  surveyId: string;
  page: number;
  pageSize: number;
  q: string;
  qfield: QField;
  status: StatusFilter;
  sort: SortKey;
  dir: SortDir;
}

export interface ProfilesRow {
  id: string;
  /** ROW_NUMBER() — 표시용 순번 (started_at desc 기준, surveyId 단위 절대값) */
  idx: number;
  ipMasked: string;
  platform: Platform | null;
  browser: string | null;
  status: string;
  currentStepId: string | null;
  startedAt: Date;
  completedAt: Date | null;
  totalSeconds: number | null;
}

export interface ListProfilesResult {
  rows: ProfilesRow[];
  total: number;
  /** 클램프 후 실제 사용된 page 번호 (page > totalPages 였으면 totalPages 로 보정됨) */
  page: number;
}

/** Postgres 기본 desc=NULLS FIRST 가 비직관이라 모든 정렬에 NULLS LAST 명시. */
function orderExpr(col: AnyColumn | SQL, direction: SortDir): SQL {
  return direction === 'asc'
    ? sql`${col} ASC NULLS LAST`
    : sql`${col} DESC NULLS LAST`;
}

function pickFromWhitelist<T extends string>(
  value: string | undefined,
  whitelist: readonly T[],
  fallback: T,
): T {
  return (whitelist as readonly string[]).includes(value ?? '') ? (value as T) : fallback;
}

/**
 * 응답자 목록 페이지의 메인 어댑터.
 *
 * 핵심 설계:
 * - **순번(idx)** 은 surveyId 단위의 절대 row_number (started_at desc 기준).
 *   status / q 필터와 독립 → 운영자에게 "최근 응답이 1번" 의미가 일관됨.
 *   이를 위해 base subquery 에서 row_number 를 먼저 매기고, 외부 select 에서 필터를 건다.
 * - **idx 검색** (qfield='idx'): subquery 위에서 정확 매치 (`= parseInt(q)`).
 *   숫자 변환 실패 시 결과 0건.
 * - **page 클램프**: page > totalPages 면 totalPages 로 보정해 마지막 페이지 노출
 *   (검색 0건과 시각적 혼동 방지).
 * - **보안**: row 객체에 raw `ip_address` 포함 안 함 — `formatIpMask` 후 `ipMasked` 만 노출.
 */
export async function listResponsesForProfiles(
  args: ListProfilesArgs,
): Promise<ListProfilesResult> {
  const { surveyId, page, pageSize, q, qfield, status, sort, dir } = args;

  const numbered = db
    .select({
      id: surveyResponses.id,
      idx: sql<number>`row_number() over (order by ${surveyResponses.startedAt} desc)`.as(
        'idx',
      ),
      ipAddress: surveyResponses.ipAddress,
      platform: surveyResponses.platform,
      browser: surveyResponses.browser,
      status: surveyResponses.status,
      currentStepId: surveyResponses.currentStepId,
      startedAt: surveyResponses.startedAt,
      completedAt: surveyResponses.completedAt,
      totalSeconds: surveyResponses.totalSeconds,
    })
    .from(surveyResponses)
    .where(eq(surveyResponses.surveyId, surveyId))
    .as('numbered');

  const SORT_COLUMN_MAP = {
    ip: numbered.ipAddress,
    platform: numbered.platform,
    browser: numbered.browser,
    startedAt: numbered.startedAt,
    completedAt: numbered.completedAt,
    totalSeconds: numbered.totalSeconds,
  } as const satisfies Record<Exclude<SortKey, 'idx'>, AnyColumn>;

  const whereParts: SQL[] = [];

  if (status !== 'all') {
    whereParts.push(eq(numbered.status, status));
  }

  const trimmed = q.normalize('NFC').trim();
  if (trimmed.length > 0) {
    if (qfield === 'idx') {
      const n = parseInt(trimmed, 10);
      // 숫자 변환 실패 → 매칭 없음
      whereParts.push(Number.isFinite(n) && n > 0 ? sql`${numbered.idx} = ${n}` : sql`false`);
    } else {
      const escaped = trimmed
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      const pattern = `%${escaped}%`;

      if (qfield === 'ip') {
        whereParts.push(ilike(numbered.ipAddress, pattern));
      } else if (qfield === 'browser') {
        whereParts.push(ilike(numbered.browser, pattern));
      } else if (qfield === 'all') {
        const orClause = or(
          ilike(numbered.ipAddress, pattern),
          ilike(numbered.browser, pattern),
        );
        if (orClause) whereParts.push(orClause);
      }
    }
  }

  const whereClause =
    whereParts.length === 0
      ? undefined
      : whereParts.length === 1
        ? whereParts[0]
        : and(...whereParts);

  const countQuery = db.select({ total: sql<number>`count(*)::int` }).from(numbered);
  const [countRow] = await (whereClause ? countQuery.where(whereClause) : countQuery);
  const total = countRow?.total ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const offset = (clampedPage - 1) * pageSize;

  // idx asc = "최근일수록 1번" 이므로 startedAt 정렬 방향이 반대.
  const orderClause =
    sort === 'idx'
      ? orderExpr(numbered.startedAt, dir === 'asc' ? 'desc' : 'asc')
      : orderExpr(SORT_COLUMN_MAP[sort], dir);

  const dataQuery = db
    .select({
      id: numbered.id,
      idx: numbered.idx,
      ipAddress: numbered.ipAddress,
      platform: numbered.platform,
      browser: numbered.browser,
      status: numbered.status,
      currentStepId: numbered.currentStepId,
      startedAt: numbered.startedAt,
      completedAt: numbered.completedAt,
      totalSeconds: numbered.totalSeconds,
    })
    .from(numbered);

  const dataRows = await (whereClause ? dataQuery.where(whereClause) : dataQuery)
    .orderBy(orderClause, asc(numbered.id))
    .limit(pageSize)
    .offset(offset);

  const rows: ProfilesRow[] = dataRows.map((r) => ({
    id: r.id,
    idx: r.idx,
    ipMasked: formatIpMask(r.ipAddress),
    platform: r.platform as Platform | null,
    browser: r.browser,
    status: r.status,
    currentStepId: r.currentStepId,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    totalSeconds: r.totalSeconds,
  }));

  return { rows, total, page: clampedPage };
}

/**
 * `searchParams` 의 가공되지 않은 string 입력을 화이트리스트 + 기본값으로 normalize.
 */
export function normalizeListArgs(input: {
  page?: string;
  q?: string;
  qfield?: string;
  status?: string;
  sort?: string;
  dir?: string;
}): Omit<ListProfilesArgs, 'surveyId' | 'pageSize'> {
  return {
    page: Math.max(1, parseInt(input.page ?? '1', 10) || 1),
    q: (input.q ?? '').slice(0, 200),
    qfield: pickFromWhitelist(input.qfield, QFIELDS, 'all'),
    status: pickFromWhitelist(input.status, STATUS_FILTERS, 'all'),
    sort: pickFromWhitelist(input.sort, SORT_KEYS, 'idx'),
    dir: input.dir === 'asc' ? 'asc' : 'desc',
  };
}

/** 현재 URL 의 검색 파라미터에 활성 필터가 걸려 있는지 판단. */
export function hasActiveFilters(input: {
  q?: string;
  qfield?: string;
  status?: string;
}): boolean {
  return (
    (input.q ?? '') !== '' ||
    (input.qfield ?? 'all') !== 'all' ||
    (input.status ?? 'all') !== 'all'
  );
}

/** UI 가 사용하는 고정 페이지 사이즈. URL 사용자 조작 차단. */
export const PROFILES_PAGE_SIZE = 20;
