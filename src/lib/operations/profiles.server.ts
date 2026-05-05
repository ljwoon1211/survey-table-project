import 'server-only';

import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import { surveyResponses } from '@/db/schema';

import { formatIpMask } from './profiles';

export type SortKey =
  | 'idx'
  | 'ip'
  | 'platform'
  | 'browser'
  | 'startedAt'
  | 'completedAt'
  | 'totalSeconds';

export type SortDir = 'asc' | 'desc';

export type QField = 'all' | 'idx' | 'ip' | 'browser';

export type StatusFilter =
  | 'all'
  | 'completed'
  | 'in_progress'
  | 'drop'
  | 'screened_out'
  | 'quotaful_out'
  | 'bad';

const SORT_KEY_WHITELIST: readonly SortKey[] = [
  'idx',
  'ip',
  'platform',
  'browser',
  'startedAt',
  'completedAt',
  'totalSeconds',
] as const;

const QFIELD_WHITELIST: readonly QField[] = ['all', 'idx', 'ip', 'browser'] as const;

const STATUS_FILTER_WHITELIST: readonly StatusFilter[] = [
  'all',
  'completed',
  'in_progress',
  'drop',
  'screened_out',
  'quotaful_out',
  'bad',
] as const;

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
  /** ROW_NUMBER() — 표시용 순번 (started_at desc 기준) */
  idx: number;
  ipMasked: string;
  platform: string | null;
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
}

/**
 * 응답자 목록 페이지의 메인 어댑터.
 *
 * - 모든 input 은 화이트리스트 검증된 값이라고 가정 (page.tsx 에서 normalize)
 * - row 객체에는 raw `ip_address` 가 들어가지 않는다 — `formatIpMask` 적용 후 `ipMasked` 만 노출
 * - row_number 는 윈도우 함수로 계산 (started_at desc 고정 기준)
 * - 검색은 `qfield` 컬럼에 한정. `all` 이면 ip + browser OR 매치 (idx 는 row_number 라 검색 비대상)
 */
export async function listResponsesForProfiles(
  args: ListProfilesArgs,
): Promise<ListProfilesResult> {
  const { surveyId, page, pageSize, q, qfield, status, sort, dir } = args;

  // 0. WHERE 조건 빌드
  const whereParts: SQL[] = [eq(surveyResponses.surveyId, surveyId)];

  if (status !== 'all') {
    whereParts.push(eq(surveyResponses.status, status));
  }

  const trimmed = q.normalize('NFC').trim();
  if (trimmed.length > 0) {
    // LIKE 와일드카드 이스케이프 (Postgres ILIKE 기준)
    const escaped = trimmed
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
    const pattern = `%${escaped}%`;

    if (qfield === 'ip') {
      whereParts.push(ilike(surveyResponses.ipAddress, pattern));
    } else if (qfield === 'browser') {
      whereParts.push(ilike(surveyResponses.browser, pattern));
    } else if (qfield === 'all') {
      const ipMatch = ilike(surveyResponses.ipAddress, pattern);
      const browserMatch = ilike(surveyResponses.browser, pattern);
      const orClause = or(ipMatch, browserMatch);
      if (orClause) whereParts.push(orClause);
    }
    // qfield === 'idx' 는 row_number 매칭이라 별도 처리 불가능 → 검색 무시
  }

  const whereClause = whereParts.length === 1 ? whereParts[0] : and(...whereParts);

  // 1. total count
  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(surveyResponses)
    .where(whereClause);

  const total = countRow?.total ?? 0;

  // 2. data + row_number
  //   row_number 는 전체 결과(필터 적용 후) 기준으로 매기며, 정렬 키와 무관하게 started_at desc 로 고정.
  //   → 운영자에게 "최근 응답이 1번" 의미가 일관됨.
  const orderColumn =
    sort === 'idx'
      ? surveyResponses.startedAt
      : sort === 'ip'
        ? surveyResponses.ipAddress
        : sort === 'platform'
          ? surveyResponses.platform
          : sort === 'browser'
            ? surveyResponses.browser
            : sort === 'completedAt'
              ? surveyResponses.completedAt
              : sort === 'totalSeconds'
                ? surveyResponses.totalSeconds
                : surveyResponses.startedAt;

  // idx 정렬은 사실상 startedAt 정렬과 동일. desc 가 idx asc 와 매칭 (최근=1번).
  const directionFn = dir === 'asc' ? asc : desc;
  const orderBy =
    sort === 'idx'
      ? dir === 'asc'
        ? desc(surveyResponses.startedAt)
        : asc(surveyResponses.startedAt)
      : directionFn(orderColumn);

  const offset = (page - 1) * pageSize;

  const dataRows = await db
    .select({
      id: surveyResponses.id,
      idx: sql<number>`row_number() over (order by ${surveyResponses.startedAt} desc)`,
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
    .where(whereClause)
    .orderBy(orderBy, asc(surveyResponses.id))
    .limit(pageSize)
    .offset(offset);

  // 3. raw IP 마스킹 — 클라로는 마스킹된 값만 전달
  const rows: ProfilesRow[] = dataRows.map((r) => ({
    id: r.id,
    idx: r.idx,
    ipMasked: formatIpMask(r.ipAddress),
    platform: r.platform,
    browser: r.browser,
    status: r.status,
    currentStepId: r.currentStepId,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    totalSeconds: r.totalSeconds,
  }));

  return { rows, total };
}

/**
 * `searchParams` 의 가공되지 않은 string 입력을 화이트리스트 + 기본값으로 normalize.
 * page.tsx 에서 호출.
 */
export function normalizeListArgs(input: {
  page?: string;
  q?: string;
  qfield?: string;
  status?: string;
  sort?: string;
  dir?: string;
}): Omit<ListProfilesArgs, 'surveyId' | 'pageSize'> {
  const pageNum = Math.max(1, parseInt(input.page ?? '1', 10) || 1);
  const qfield: QField = (QFIELD_WHITELIST as readonly string[]).includes(input.qfield ?? '')
    ? (input.qfield as QField)
    : 'all';
  const status: StatusFilter = (STATUS_FILTER_WHITELIST as readonly string[]).includes(
    input.status ?? '',
  )
    ? (input.status as StatusFilter)
    : 'all';
  const sort: SortKey = (SORT_KEY_WHITELIST as readonly string[]).includes(input.sort ?? '')
    ? (input.sort as SortKey)
    : 'idx';
  const dir: SortDir = input.dir === 'asc' ? 'asc' : 'desc';
  const q = (input.q ?? '').slice(0, 200); // sanity bound

  return { page: pageNum, q, qfield, status, sort, dir };
}

/** UI 가 사용하는 고정 페이지 사이즈. URL 사용자 조작 차단. */
export const PROFILES_PAGE_SIZE = 20;
