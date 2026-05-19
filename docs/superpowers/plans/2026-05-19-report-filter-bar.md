# 진척 보고 단일 검색바 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 진척 보고 페이지의 단일 q 텍스트 검색을 컨택 컬럼 전체에서 선택 가능한 [컬럼 select][값 input][검색] 형태 검색바로 교체. `system.resid` 만 ID 자동 range/list 처리, `attrs.*` 부분일치, `pii.*` blindIndex 정확 일치.

**Architecture:** URL `?col=&q=` 두 평문 파라미터로 단일 조건 직렬화 → Server Component 가 contactColumns 화이트리스트 검증 + pii blindIndex 계산 → Drizzle `sql` 동적 WHERE 절 빌더가 source 종류에 따라 분기 → Client 는 form + Select + Input 단순 검색바.

**Tech Stack:** Next.js 16 App Router (Server Components), Drizzle ORM (raw `sql`), shadcn/ui (Select/Input/Button), vitest (단위 테스트), TypeScript strict, Node `createHmac` (pii blindIndex).

**디자인 spec:** [docs/superpowers/specs/2026-05-19-report-filter-bar-design.md](../specs/2026-05-19-report-filter-bar-design.md)

---

## File Structure

| 변경 유형 | 파일 | 책임 |
| --- | --- | --- |
| 신규 | `src/lib/operations/progress-filters.ts` | `FilterCondition` / `NumRange` 타입, `parseIdListInput`, `parseConditionFromUrl`, `placeholderFor` (서버 한정 — blindIndex import) |
| 신규 | `tests/unit/progress-filters.test.ts` | 단위 테스트 — `parseIdListInput`·`parseConditionFromUrl`·`placeholderFor` |
| 수정 | `src/components/operations/report/progress-filter-bar.tsx` | 단일 q 검색바 → 단일 [select][input][검색] 폼으로 완전 재작성 |
| 수정 | `src/lib/operations/report-progress.server.ts` | `buildFilterSql(condition)` 헬퍼, `getProgressRows`/`getProgressTotals` 시그니처 변경 |
| 수정 | `src/app/admin/surveys/[id]/operations/report/page.tsx` | `sp.col`/`sp.q` 파싱, contactColumns 로드, pii 면 blindIndex 계산, ProgressFilterBar prop 갱신 |

DB 스키마 변경 없음 / 마이그레이션 없음.

> **참고**: `progress-filters.ts` 는 pii `blindIndex` 계산을 위해 `node:crypto` 의존성을 가진 `@/lib/crypto/blind` 를 import 한다 → **서버 전용 모듈**. 'use client' 컴포넌트에서 import 금지. UI 컴포넌트는 `FilterCondition` 타입과 `placeholderFor` 만 type-only import 가능하면 좋겠으나, 단순화 위해 UI 는 source 문자열만 다루고 타입 import 도 하지 않는다.

---

## Task 1: 공용 유틸 progress-filters.ts (TDD)

**Files:**
- Create: `src/lib/operations/progress-filters.ts`
- Test:   `tests/unit/progress-filters.test.ts`

- [ ] **Step 1.1: 빈 스켈레톤 파일 생성**

`src/lib/operations/progress-filters.ts` 를 다음 내용으로 생성:

```ts
import { blindIndex } from '@/lib/crypto/blind';
import type { PiiFieldType } from '@/lib/crypto/pii-fields';

export interface NumRange {
  from: number;
  to: number;
}

export type FilterCondition =
  | { source: 'system.resid'; mode: 'idlist'; ranges: NumRange[] }
  | { source: 'system.resid'; mode: 'text'; value: string }
  | { source: `attrs.${string}`; mode: 'text'; value: string }
  | { source: `pii.${string}`; mode: 'exact'; value: string; blindIndex: string };

export interface ColumnCandidate {
  source: string;
  label: string;
  piiType?: PiiFieldType;
}

export function parseIdListInput(_input: string): NumRange[] | null {
  throw new Error('not implemented');
}

export function placeholderFor(_source: string | null): string {
  throw new Error('not implemented');
}

export function parseConditionFromUrl(
  _col: string | null,
  _q: string | null,
  _candidates: ColumnCandidate[],
): FilterCondition | null {
  throw new Error('not implemented');
}
```

> `blindIndex` import 는 Step 1.8 에서 사용. 미사용 import 는 lint 경고가 날 수 있어도 다음 step 들이 바로 사용하므로 무시.

- [ ] **Step 1.2: parseIdListInput 실패 테스트 작성**

`tests/unit/progress-filters.test.ts` 를 다음 내용으로 생성:

```ts
import { describe, it, expect, beforeAll } from 'vitest';

import {
  parseIdListInput,
  placeholderFor,
  parseConditionFromUrl,
  type ColumnCandidate,
} from '@/lib/operations/progress-filters';

// blindIndex 가 env 의 CONTACT_PII_HMAC_KEY 를 요구하므로 테스트 셋업.
beforeAll(() => {
  // 32 byte base64 키 (테스트용 더미)
  process.env.CONTACT_PII_HMAC_KEY = Buffer.alloc(32, 7).toString('base64');
});

describe('parseIdListInput', () => {
  it('parses a single integer', () => {
    expect(parseIdListInput('5')).toEqual([{ from: 5, to: 5 }]);
  });

  it('parses a simple range', () => {
    expect(parseIdListInput('1-30')).toEqual([{ from: 1, to: 30 }]);
  });

  it('parses mixed list of singles and ranges', () => {
    expect(parseIdListInput('1-30, 45')).toEqual([
      { from: 1, to: 30 },
      { from: 45, to: 45 },
    ]);
  });

  it('tolerates whitespace around separators', () => {
    expect(parseIdListInput('  1 - 30 ,  45  ')).toEqual([
      { from: 1, to: 30 },
      { from: 45, to: 45 },
    ]);
  });

  it('swaps reversed ranges', () => {
    expect(parseIdListInput('50-10')).toEqual([{ from: 10, to: 50 }]);
  });

  it('rejects empty input', () => {
    expect(parseIdListInput('')).toBeNull();
    expect(parseIdListInput('   ')).toBeNull();
  });

  it('rejects double commas', () => {
    expect(parseIdListInput('1,,2')).toBeNull();
    expect(parseIdListInput('1,')).toBeNull();
    expect(parseIdListInput(',1')).toBeNull();
  });

  it('rejects decimals', () => {
    expect(parseIdListInput('1.5')).toBeNull();
  });

  it('rejects values larger than int32 max', () => {
    expect(parseIdListInput('2147483648')).toBeNull();
  });

  it('rejects text', () => {
    expect(parseIdListInput('abc')).toBeNull();
    expect(parseIdListInput('1-abc')).toBeNull();
  });
});
```

- [ ] **Step 1.3: 테스트 실패 확인**

```bash
pnpm vitest run tests/unit/progress-filters.test.ts -t parseIdListInput
```
Expected: 모든 케이스 FAIL ('not implemented' throw)

- [ ] **Step 1.4: parseIdListInput 구현**

`progress-filters.ts` 의 `parseIdListInput` 본문을 다음으로 교체. 파일 상단에 `INT32_MAX`/`ID_LIST_REGEX` 상수 추가 (module-private):

```ts
const INT32_MAX = 2147483647;
const ID_LIST_REGEX = /^\s*\d+(\s*-\s*\d+)?(\s*,\s*\d+(\s*-\s*\d+)?)*\s*$/;

export function parseIdListInput(input: string): NumRange[] | null {
  if (!ID_LIST_REGEX.test(input)) return null;
  const tokens = input.split(',').map((t) => t.trim());
  const ranges: NumRange[] = [];
  for (const token of tokens) {
    if (token.length === 0) return null;
    const parts = token.split('-').map((p) => p.trim());
    if (parts.length === 1) {
      const n = Number(parts[0]);
      if (!Number.isInteger(n) || n > INT32_MAX || n < 0) return null;
      ranges.push({ from: n, to: n });
    } else if (parts.length === 2) {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      if (
        !Number.isInteger(a) ||
        !Number.isInteger(b) ||
        a > INT32_MAX ||
        b > INT32_MAX ||
        a < 0 ||
        b < 0
      ) {
        return null;
      }
      ranges.push({ from: Math.min(a, b), to: Math.max(a, b) });
    } else {
      return null;
    }
  }
  return ranges;
}
```

- [ ] **Step 1.5: parseIdListInput 통과 확인**

```bash
pnpm vitest run tests/unit/progress-filters.test.ts -t parseIdListInput
```
Expected: 모든 케이스 PASS

- [ ] **Step 1.6: placeholderFor 실패 테스트 + 구현**

테스트 append:

```ts
describe('placeholderFor', () => {
  it('returns default for null source', () => {
    expect(placeholderFor(null)).toBe('검색어');
  });

  it('returns id range hint for system.resid', () => {
    expect(placeholderFor('system.resid')).toBe('예: 1-30, 45');
  });

  it('returns exact-match hint for pii.*', () => {
    expect(placeholderFor('pii.email')).toBe('정확한 값 입력 (부분 검색 불가)');
    expect(placeholderFor('pii.mobile')).toBe('정확한 값 입력 (부분 검색 불가)');
  });

  it('returns partial-match hint for attrs.*', () => {
    expect(placeholderFor('attrs.전시회명')).toBe('부분일치');
  });
});
```

Run (fail): `pnpm vitest run tests/unit/progress-filters.test.ts -t placeholderFor`

`progress-filters.ts` 의 `placeholderFor` 본문 교체:

```ts
export function placeholderFor(source: string | null): string {
  if (!source) return '검색어';
  if (source === 'system.resid') return '예: 1-30, 45';
  if (source.startsWith('pii.')) return '정확한 값 입력 (부분 검색 불가)';
  return '부분일치';
}
```

Run (pass): `pnpm vitest run tests/unit/progress-filters.test.ts -t placeholderFor`

- [ ] **Step 1.7: parseConditionFromUrl 실패 테스트 작성**

테스트 append:

```ts
describe('parseConditionFromUrl', () => {
  const candidates: ColumnCandidate[] = [
    { source: 'system.resid', label: '컨택번호' },
    { source: 'attrs.전시회명', label: '전시회명' },
    { source: 'attrs.개최월', label: '개최월' },
    { source: 'pii.email', label: '이메일', piiType: 'email' },
  ];

  it('returns null for null col', () => {
    expect(parseConditionFromUrl(null, 'x', candidates)).toBeNull();
  });

  it('returns null for empty q', () => {
    expect(parseConditionFromUrl('attrs.전시회명', '', candidates)).toBeNull();
    expect(parseConditionFromUrl('attrs.전시회명', '   ', candidates)).toBeNull();
    expect(parseConditionFromUrl('attrs.전시회명', null, candidates)).toBeNull();
  });

  it('returns null for whitelist violation', () => {
    expect(parseConditionFromUrl('attrs.unknown', 'x', candidates)).toBeNull();
    expect(parseConditionFromUrl('system.contact_result', 'x', candidates)).toBeNull();
  });

  it('parses system.resid with numeric pattern as idlist', () => {
    expect(parseConditionFromUrl('system.resid', '1-30, 45', candidates)).toEqual({
      source: 'system.resid',
      mode: 'idlist',
      ranges: [
        { from: 1, to: 30 },
        { from: 45, to: 45 },
      ],
    });
  });

  it('parses system.resid with non-numeric as text fallback', () => {
    expect(parseConditionFromUrl('system.resid', 'abc', candidates)).toEqual({
      source: 'system.resid',
      mode: 'text',
      value: 'abc',
    });
  });

  it('parses attrs.* as text', () => {
    expect(parseConditionFromUrl('attrs.전시회명', '핵심', candidates)).toEqual({
      source: 'attrs.전시회명',
      mode: 'text',
      value: '핵심',
    });
  });

  it('trims attrs value', () => {
    const result = parseConditionFromUrl('attrs.전시회명', '  핵심  ', candidates);
    expect(result).toEqual({
      source: 'attrs.전시회명',
      mode: 'text',
      value: '핵심',
    });
  });

  it('parses pii.* with computed blindIndex', () => {
    const result = parseConditionFromUrl('pii.email', 'user@example.com', candidates);
    expect(result).toMatchObject({
      source: 'pii.email',
      mode: 'exact',
      value: 'user@example.com',
    });
    // blindIndex 는 HMAC-SHA256 hex (64 chars)
    expect(result?.mode === 'exact' && /^[0-9a-f]{64}$/.test(result.blindIndex)).toBe(true);
  });

  it('returns null for pii.* when candidate missing piiType', () => {
    const candidatesNoPiiType: ColumnCandidate[] = [
      { source: 'pii.email', label: '이메일' }, // piiType 누락
    ];
    expect(parseConditionFromUrl('pii.email', 'user@example.com', candidatesNoPiiType)).toBeNull();
  });
});
```

Run (fail): `pnpm vitest run tests/unit/progress-filters.test.ts -t parseConditionFromUrl`

- [ ] **Step 1.8: parseConditionFromUrl 구현**

`progress-filters.ts` 의 `parseConditionFromUrl` 본문 교체:

```ts
export function parseConditionFromUrl(
  col: string | null,
  q: string | null,
  candidates: ColumnCandidate[],
): FilterCondition | null {
  if (!col) return null;
  const trimmed = (q ?? '').trim();
  if (trimmed.length === 0) return null;

  const candidate = candidates.find((c) => c.source === col);
  if (!candidate) return null; // 화이트리스트 위반 silent drop

  if (col === 'system.resid') {
    const ranges = parseIdListInput(trimmed);
    if (ranges !== null) {
      return { source: 'system.resid', mode: 'idlist', ranges };
    }
    return { source: 'system.resid', mode: 'text', value: trimmed };
  }

  if (col.startsWith('attrs.')) {
    return { source: col as `attrs.${string}`, mode: 'text', value: trimmed };
  }

  if (col.startsWith('pii.')) {
    if (!candidate.piiType) return null; // piiType 누락 — silent drop
    const bi = blindIndex(candidate.piiType, trimmed);
    return {
      source: col as `pii.${string}`,
      mode: 'exact',
      value: trimmed,
      blindIndex: bi,
    };
  }

  return null; // 알 수 없는 source
}
```

- [ ] **Step 1.9: 전체 단위 테스트 통과 + tsc 확인**

```bash
pnpm vitest run tests/unit/progress-filters.test.ts
pnpm tsc --noEmit 2>&1 | head -20
```

Expected:
- vitest 모든 케이스 PASS
- tsc 에서 page.tsx / progress-filter-bar.tsx / report-progress.server.ts 에서 시그니처 불일치 에러 발생 가능 — 그 외 에러 0
- progress-filters.ts 자체는 에러 0

남은 시그니처 에러는 Task 2 / 3 / 4 에서 해소된다.

- [ ] **Step 1.10: 커밋**

```bash
git add src/lib/operations/progress-filters.ts tests/unit/progress-filters.test.ts
git commit -m "$(cat <<'EOF'
feat: 진척 보고 단일 검색 공용 유틸 추가

FilterCondition 타입 + parseIdListInput + parseConditionFromUrl +
placeholderFor. pii blindIndex 계산 포함 (서버 한정).
EOF
)"
```

---

## Task 2: 서버 쿼리 빌더 (report-progress.server.ts)

**Files:**
- Modify: `src/lib/operations/report-progress.server.ts`

이 task 는 서버 단 단위 테스트 없이 tsc + 다음 task 통합 흐름으로 검증. Drizzle `sql` 출력 inspecting brittle.

- [ ] **Step 2.1: import + 헬퍼 추가**

`src/lib/operations/report-progress.server.ts` 상단 import 에 다음 추가:

```ts
import type { FilterCondition } from './progress-filters';
```

`escapeLikePattern` 함수 바로 아래(`getProgressColumnScheme` 위)에 헬퍼 삽입:

```ts
/**
 * 조건 → WHERE 절. null 이면 TRUE (전체 조회).
 *
 * SECURITY: condition.source 는 호출자에서 contactColumns 화이트리스트 검증 끝난 값만
 * 전달된다고 가정. value/from/to/blindIndex/key 모두 parameter binding 으로 안전.
 *
 * pii.* 매칭: condition.value 평문은 SQL 에 들어가지 않고 사전 계산된 blindIndex 만 사용.
 *
 * NULL 동작: ct.attrs->>key 가 NULL 이면 NULL ILIKE → false (자동 제외). pii.* 도 EXISTS
 * 가 false. system.resid 는 NOT NULL.
 */
function buildFilterSql(condition: FilterCondition | null) {
  if (!condition) return sql`TRUE`;

  if (condition.source === 'system.resid') {
    if (condition.mode === 'idlist') {
      if (condition.ranges.length === 0) return sql`FALSE`;
      const conds = condition.ranges.map((r) =>
        r.from === r.to
          ? sql`ct.resid = ${r.from}`
          : sql`ct.resid BETWEEN ${r.from} AND ${r.to}`,
      );
      return sql.join(conds, sql` OR `);
    }
    return sql`FALSE`; // text 폴백 — resid 가 정수 컬럼이라 비숫자 매칭 0건
  }

  if (condition.source.startsWith('attrs.')) {
    const key = condition.source.slice('attrs.'.length);
    const escaped = escapeLikePattern(condition.value);
    return sql`ct.attrs->>${key} ILIKE '%' || ${escaped} || '%'`;
  }

  if (condition.source.startsWith('pii.')) {
    const columnKey = condition.source.slice('pii.'.length);
    return sql`EXISTS (
      SELECT 1 FROM contact_pii pp
      WHERE pp.contact_target_id = ct.id
        AND pp.column_key = ${columnKey}
        AND pp.blind_index = ${condition.blindIndex}
    )`;
  }

  return sql`TRUE`; // 알 수 없는 source — 페이지 깨짐 방지
}
```

- [ ] **Step 2.2: `getProgressRows` 시그니처 + WHERE 절 변경**

`GetProgressRowsArgs` 인터페이스와 `getProgressRows` 함수 본문을 다음과 같이 교체. 기존 `qLike` 변수와 `(${q} = '' OR ...)` 라인은 제거:

```ts
interface GetProgressRowsArgs {
  surveyId: string;
  condition: FilterCondition | null;
  page: number;
  size: number;
  sort: ProgressSortKey;
  dir: SortDir;
  metaKeys: string[];
}

export async function getProgressRows(args: GetProgressRowsArgs): Promise<ProgressRow[]> {
  const { surveyId, condition, page, size, sort, dir, metaKeys } = args;
  const offset = Math.max(0, (page - 1) * size);

  const metaSelectSql = metaKeys
    .map((k, i) => sql`MIN(ct.attrs->>${k}) AS ${sql.identifier(`meta_${i}`)}`)
    .reduce<ReturnType<typeof sql>>(
      (acc, cur, i) => (i === 0 ? cur : sql`${acc}, ${cur}`),
      sql``,
    );

  let sortExpr;
  if (sort.startsWith('meta:')) {
    const key = sort.slice(5);
    const idx = metaKeys.indexOf(key);
    sortExpr =
      idx >= 0 ? sql.raw(`meta_${idx}`) : sql.raw(SORT_COL_MAP.responseRate);
  } else {
    const mapped = SORT_COL_MAP[sort as Exclude<ProgressSortKey, `meta:${string}`>];
    sortExpr = sql.raw(mapped ?? SORT_COL_MAP.responseRate);
  }
  const dirSql = dir === 'asc' ? sql.raw('ASC') : sql.raw('DESC');

  const filterSql = buildFilterSql(condition);

  const result = await db.execute(sql`
    SELECT * FROM (
      SELECT
        COALESCE(ct.group_value, '(미분류)') AS group_label,
        ct.group_value AS group_value_raw,
        COUNT(*)::int AS list_count,
        COUNT(*) FILTER (WHERE ${closingFilter})::int AS completed_count
        ${metaKeys.length > 0 ? sql`, ${metaSelectSql}` : sql``}
      FROM contact_targets ct
      WHERE ct.survey_id = ${surveyId}
        AND ${filterSql}
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
```

- [ ] **Step 2.3: `getProgressTotals` 시그니처 + WHERE 절 변경**

함수 끝부분 `getProgressTotals` 를 다음과 같이 교체:

```ts
export async function getProgressTotals(
  surveyId: string,
  condition: FilterCondition | null,
): Promise<ProgressTotals> {
  const filterSql = buildFilterSql(condition);
  const result = await db.execute(sql`
    SELECT
      COUNT(DISTINCT COALESCE(ct.group_value, '(미분류)'))::int AS group_count,
      COUNT(*)::int AS list_total,
      COUNT(*) FILTER (WHERE ${closingFilter})::int AS completed_total
    FROM contact_targets ct
    WHERE ct.survey_id = ${surveyId}
      AND ${filterSql}
  `);
  const r = (result as unknown as Array<Record<string, unknown>>)[0] ?? {};
  return {
    groupCount: Number(r.group_count ?? 0),
    listTotal: Number(r.list_total ?? 0),
    completedTotal: Number(r.completed_total ?? 0),
  };
}
```

- [ ] **Step 2.4: `escapeLikePattern` JSDoc 갱신**

기존 주석에 `q = ''` 단축 평가 설명이 남아있으면 stale. 다음과 같이 교체:

```ts
/**
 * ILIKE wildcard escape — `%` `_` `\` 를 리터럴로 처리하기 위한 사전 escape.
 * profiles.server.ts 와 동일 패턴. attrs.* 텍스트 모드 조건의 value 에 적용된다.
 */
```

- [ ] **Step 2.5: tsc 확인**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: page.tsx 호출처 에러만 발생 (q 전달 / 시그니처 불일치). 그 외 에러 0.

다른 호출처(예: 다른 페이지/API) 에서 시그니처 불일치 발견 시 즉시 보고. 일반적으로 `getProgressRows`/`getProgressTotals` 는 report/page.tsx 만 호출 (slice 4 머지 직후 상태).

- [ ] **Step 2.6: 커밋**

```bash
git add src/lib/operations/report-progress.server.ts
git commit -m "$(cat <<'EOF'
refactor: 진척 보고 쿼리를 FilterCondition 시그니처로 전환

q 단일 검색 제거, buildFilterSql 헬퍼 추가.
system.resid IN/BETWEEN, attrs ILIKE, pii blindIndex EXISTS 분기.
EOF
)"
```

---

## Task 3: Server Component page.tsx — sp.col/sp.q 파싱 + pii blindIndex 계산

**Files:**
- Modify: `src/app/admin/surveys/[id]/operations/report/page.tsx`

- [ ] **Step 3.1: 현재 page.tsx 의 q 사용 위치 확인**

```bash
cd /Users/ljwoon/study/next-study/survey-table-project
cat src/app/admin/surveys/[id]/operations/report/page.tsx
```

`sp.q` 파싱·`getProgressRows`/`getProgressTotals` 호출·`ProgressFilterBar` 사용 위치 파악.

- [ ] **Step 3.2: import 정리**

기존 import 위에 다음을 추가/교체:

```ts
import { parseConditionFromUrl, type ColumnCandidate } from '@/lib/operations/progress-filters';
```

(기존 `getProgressColumnScheme` / `getProgressRows` / `getProgressTotals` / `ProgressFilterBar` import 는 유지)

- [ ] **Step 3.3: searchParams 타입 변경 + 파싱**

`PageProps.searchParams` 의 `q?: string` 을 다음으로 교체:

```ts
searchParams: Promise<{
  col?: string;
  q?: string;
  page?: string;
  size?: string;
  sort?: string;
  dir?: string;
}>;
```

`const q = sp.q ?? '';` 라인은 제거.

기존 `const [scheme, groupLabel] = await Promise.all([...])` 직후, `visibleColumns` / `metaKeys` 계산 직후 (즉 `sort` 결정 전 또는 후 어느쪽이든) 다음 블록 삽입:

```ts
// contactColumns 로드 — pii 면 blindIndex 계산용 piiType 함께 가져옴.
const surveyRow = await db
  .select({ contactColumns: surveys.contactColumns })
  .from(surveys)
  .where(eq(surveys.id, surveyId))
  .limit(1);
const contactScheme = surveyRow[0]?.contactColumns ?? null;

// 후보: system.resid + attrs.* + pii.* 만. 그 외 system.* 은 이번 슬라이스 제외.
const columnCandidates: ColumnCandidate[] = (contactScheme?.columns ?? [])
  .filter((c) =>
    c.source === 'system.resid' ||
    c.source.startsWith('attrs.') ||
    c.source.startsWith('pii.'),
  )
  .map((c) => ({
    source: c.source,
    label: c.label,
    piiType: c.piiType,
  }));

const rawCol = typeof sp.col === 'string' ? sp.col : null;
const rawQ = typeof sp.q === 'string' ? sp.q : null;
const condition = parseConditionFromUrl(rawCol, rawQ, columnCandidates);
```

> `surveys` / `eq` import 가 page.tsx 에 없으면 추가:
> ```ts
> import { eq } from 'drizzle-orm';
> import { surveys } from '@/db/schema';
> ```
> 이미 있는지 grep 확인.

- [ ] **Step 3.4: `getProgressRows` / `getProgressTotals` 호출 변경**

기존 호출:
```ts
getProgressRows({ surveyId, q, page, size, sort, dir, metaKeys }),
getProgressTotals(surveyId, q),
```

다음으로 교체:
```ts
getProgressRows({ surveyId, condition, page, size, sort, dir, metaKeys }),
getProgressTotals(surveyId, condition),
```

- [ ] **Step 3.5: ProgressFilterBar prop 변경**

JSX 의 `<ProgressFilterBar initialQuery={q} groupLabel={groupLabel} />` 를 다음으로 교체:

```tsx
<ProgressFilterBar
  initialSource={condition?.source ?? null}
  initialValue={condition && condition.mode !== 'idlist' ? condition.value : (rawQ ?? '')}
  columnCandidates={columnCandidates}
/>
```

> `idlist` 모드는 `value` 가 없고 `ranges` 만 있다. UI 입력값은 원본 URL `rawQ` 그대로 복원해 보여준다 (예: `1-30, 45`).

- [ ] **Step 3.6: tsc 확인**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: `ProgressFilterBar` 의 prop 타입 mismatch 에러 1-2건만 (Task 4 에서 해소). 그 외 에러 0.

- [ ] **Step 3.7: 커밋**

```bash
git add src/app/admin/surveys/[id]/operations/report/page.tsx
git commit -m "$(cat <<'EOF'
refactor: 진척 보고 page.tsx 를 col/q 두 파라미터 + condition 흐름으로 전환

contactColumns 화이트리스트 검증 + pii blindIndex 계산 + condition 객체 전달.
ProgressFilterBar 는 다음 커밋에서 새 prop 시그니처로 재작성.
EOF
)"
```

---

## Task 4: ProgressFilterBar UI 재작성

**Files:**
- Modify: `src/components/operations/report/progress-filter-bar.tsx`

UI 컴포넌트는 단위 테스트 X — 수동 dogfooding (Task 5) 로 검증.

- [ ] **Step 4.1: useSearchParamsMutator 사용 패턴 확인**

```bash
grep -n "useSearchParamsMutator" src/hooks/use-search-params-mutator.ts | head -10
```

main 의 progress-filter-bar.tsx 에서는 `const pushParams = useSearchParamsMutator()` 패턴 (함수 직접 반환). 새 컴포넌트도 동일 패턴.

- [ ] **Step 4.2: 전체 파일 재작성**

`src/components/operations/report/progress-filter-bar.tsx` 의 전체 내용을 다음으로 교체:

```tsx
'use client';

import { useEffect, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSearchParamsMutator } from '@/hooks/use-search-params-mutator';

interface ColumnCandidate {
  source: string;
  label: string;
}

interface Props {
  initialSource: string | null;
  initialValue: string;
  columnCandidates: ColumnCandidate[];
}

function placeholderFor(source: string | null): string {
  if (!source) return '검색어';
  if (source === 'system.resid') return '예: 1-30, 45';
  if (source.startsWith('pii.')) return '정확한 값 입력 (부분 검색 불가)';
  return '부분일치';
}

/**
 * 진척 보고 단일 검색바.
 *
 * - 컬럼 select + 값 input + [검색]/[초기화] 한 줄
 * - 한 번에 한 컬럼만 검색 (다중 AND 없음)
 * - URL ?col=&q= 두 파라미터 직렬화
 * - 빈 input + [검색] = 필터 해제 (URL 키 둘 다 삭제)
 * - source 에 따라 input placeholder 자동 변경
 *
 * pii.* 컬럼은 백엔드에서 blindIndex 정확 일치 매칭 — 사용자에게는 "(정확 일치)" 마커.
 */
export function ProgressFilterBar({ initialSource, initialValue, columnCandidates }: Props) {
  const [source, setSource] = useState<string | null>(initialSource);
  const [value, setValue] = useState<string>(initialValue);
  const [, startTransition] = useTransition();
  const pushParams = useSearchParamsMutator();

  // 브라우저 뒤로/앞으로 가기 시 URL 의 col/q 가 바뀌면 Server Component 가 새 initial 을
  // 내려준다. 로컬 state 를 동기화 — JSON 비교로 무한 re-render 방지.
  useEffect(() => {
    setSource(initialSource);
    setValue(initialValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify({ initialSource, initialValue })]);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = value.trim();
    startTransition(() => {
      pushParams((p) => {
        if (!source || trimmed.length === 0) {
          // source 미선택 또는 빈 값 → 필터 해제
          p.delete('col');
          p.delete('q');
        } else {
          p.set('col', source);
          p.set('q', trimmed);
        }
        p.delete('page');
      });
    });
  };

  const handleReset = () => {
    setSource(null);
    setValue('');
    startTransition(() => {
      pushParams((p) => {
        p.delete('col');
        p.delete('q');
        p.delete('page');
      });
    });
  };

  return (
    <form
      onSubmit={handleSearch}
      className="mb-3 flex items-center gap-2"
      role="search"
      aria-label="진척 보고 필터"
    >
      <label htmlFor="filter-column" className="sr-only">검색 컬럼</label>
      <Select
        value={source ?? ''}
        onValueChange={(v) => setSource(v || null)}
      >
        <SelectTrigger id="filter-column" className="min-w-[160px]">
          <SelectValue placeholder="컬럼 선택" />
        </SelectTrigger>
        <SelectContent>
          {columnCandidates.map((c) => (
            <SelectItem key={c.source} value={c.source}>
              {c.label}
              {c.source.startsWith('pii.') && (
                <span className="ml-1 text-xs text-muted-foreground">(정확 일치)</span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <label htmlFor="filter-value" className="sr-only">검색어</label>
      <Input
        id="filter-value"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholderFor(source)}
        className="max-w-xs"
      />

      <Button type="submit" disabled={columnCandidates.length === 0}>
        검색
      </Button>
      <Button type="button" variant="outline" onClick={handleReset}>
        초기화
      </Button>
    </form>
  );
}
```

- [ ] **Step 4.3: import 경로 확인**

```bash
ls src/components/ui/select.tsx src/components/ui/input.tsx src/components/ui/button.tsx src/hooks/use-search-params-mutator.ts
```

Expected: 모두 존재. shadcn `Select` 가 named export 인지 확인 (기존 칩 컴포넌트에서 사용 패턴 동일하면 OK).

- [ ] **Step 4.4: tsc + build 통과 확인**

```bash
pnpm tsc --noEmit
pnpm build 2>&1 | tail -20
```

Expected: tsc 에러 0, build 성공.

`pnpm lint` 는 ESLint 인프라 깨짐(메모 참조)으로 실행하지 않음.

- [ ] **Step 4.5: 커밋**

```bash
git add src/components/operations/report/progress-filter-bar.tsx
git commit -m "$(cat <<'EOF'
feat: 진척 보고 단일 검색바 UI 재작성

[컬럼 select][값 input][검색]/[초기화] 한 줄 폼.
source 에 따라 placeholder 자동 변경, pii 옵션은 정확 일치 마커.
form 으로 감싸 Enter 자동 submit, label/htmlFor 접근성 보강.
EOF
)"
```

---

## Task 5: 수동 dogfooding + 최종 검증

**Files:** (수정 없음, 검증만)

- [ ] **Step 5.1: dev 서버 기동**

```bash
pnpm dev
```

`http://localhost:3000/admin/surveys/<id>/operations/report` 로 이동 (설문 ID 는 컨택 명단 + pii 컬럼이 있는 것 사용. 컨택리스트의 컬럼 설정에서 이메일이 pii 로 매핑된 설문 권장).

- [ ] **Step 5.2: 시나리오 검증**

각 시나리오 수동 확인:

1. **빈 필터 상태**: 페이지 진입 시 전체 그룹 표시. 합계 행 정상.
2. **attrs 부분일치**: 컬럼 select 에서 "전시회명" → input "핵심" → [검색]. URL `?col=attrs.전시회명&q=핵심`. 매칭 행만 표시.
3. **system.resid range**: "컨택번호" 선택 → placeholder 가 "예: 1-30, 45" 로 변경 → `1-30, 45` 입력 → [검색]. 매칭 그룹 표시.
4. **system.resid 비숫자**: "컨택번호" 선택 → "abc" 입력 → [검색]. 0건 표시.
5. **pii 정확 일치**: "이메일" 선택 → placeholder 가 "정확한 값 입력 (부분 검색 불가)" + select option 에 "(정확 일치)" 마커 → 정확한 이메일 입력 → [검색]. 매칭 1건 표시.
6. **pii 부분 입력**: "이메일" 선택 → "@gmail.com" 부분만 입력 → [검색]. 0건 표시 (정확 일치만).
7. **빈 input + 검색**: input 비우고 [검색]. URL `col`/`q` 삭제, 전체 조회.
8. **초기화**: 임의 검색 적용 → [초기화]. URL 깨끗, 전체 조회.
9. **URL 공유**: 검색 적용된 URL 복사 → 새 탭. 동일 상태 복원.
10. **브라우저 뒤로/앞**: 검색 → 다른 검색 → 뒤로 가기. 칩 UI 가 이전 상태로 동기화.
11. **컬럼 스킴에 없는 URL 조작**: `?col=attrs.unknown&q=x` 직접 URL. 페이지 안 깨지고 필터 무시.
12. **정렬/페이지네이션 회귀**: 필터 적용 후 정렬 / 페이지 이동. 정상 동작.

- [ ] **Step 5.3: 최종 자동 검증**

```bash
pnpm vitest run tests/unit/progress-filters.test.ts
pnpm tsc --noEmit
pnpm build
```

Expected: 모두 통과.

- [ ] **Step 5.4: dogfooding 결과 fix + 추가 커밋**

(필요한 경우만) 5.2 에서 발견된 이슈를 fix → 추가 커밋. 이슈 없으면 skip.

- [ ] **Step 5.5: PR 준비용 push (사용자 결정)**

push 는 사용자가 결정. 진행 시:

```bash
git push -u origin feat/report-filter-bar
```

PR 본문 템플릿:
```
## Summary
- 진척 보고 페이지의 단일 q 검색을 [컬럼 select][값 input][검색] 단일 검색바로 교체
- system.resid 자동 range/list, attrs ILIKE 부분일치, pii blindIndex 정확 일치
- URL ?col=&q= 두 평문 파라미터

## Test plan
- [x] pnpm vitest run tests/unit/progress-filters.test.ts
- [x] pnpm tsc --noEmit
- [x] pnpm build
- [x] 수동 dogfooding 12 시나리오

## Known Limitations (spec §4 참조)
- pii 부분일치 미지원 (별도 슬라이스에서 trigram 등 검토)
- 다중 컬럼 AND 미지원 (필요시 별도)
- system.resid 외 다른 system 컬럼 미지원
- attrs ID-like 컬럼 마킹 (dataType) 별도 슬라이스
```

---

## Self-Review

### Spec 커버리지 체크

| Spec 섹션 | 대응 Task / Step |
| --- | --- |
| §1 FilterCondition / NumRange 타입 | Task 1, Step 1.1 |
| §1 URL ?col=&q= 직렬화 | Task 4, Step 4.2 (UI 측 set/delete) + Task 3, Step 3.3 (서버 파싱) |
| §1 모드 자동 결정 (parseConditionFromUrl) | Task 1, Step 1.8 |
| §1 화이트리스트 검증 (silent drop) | Task 1, Step 1.8 (`candidate.find` 실패 시 null) |
| §1 컬럼 후보 빌드 (system.resid + attrs + pii) | Task 3, Step 3.3 |
| §2 buildFilterSql + 분기 (system.resid/attrs/pii) | Task 2, Step 2.1 |
| §2 보안 (parameter binding, blindIndex 사전 계산) | Task 2, Step 2.1 + Task 1, Step 1.8 |
| §2 getProgressRows/Totals 시그니처 변경 | Task 2, Steps 2.2 + 2.3 |
| §3 UI form 구조 (Select + Input + Button) | Task 4, Step 4.2 |
| §3 placeholder 자동 변경 | Task 4, Step 4.2 (placeholderFor 인라인 정의) |
| §3 URL 동기화 (pushParams) | Task 4, Step 4.2 handleSearch/handleReset |
| §3 useEffect state 동기화 | Task 4, Step 4.2 |
| §3 접근성 (form/role/htmlFor/sr-only) | Task 4, Step 4.2 |
| §4 단위 테스트 (parseIdListInput, placeholderFor, parseConditionFromUrl) | Task 1 전반 |
| §4 변경 파일 목록 | File Structure 섹션 |
| §4 브랜치 / 마이그레이션 없음 | (작업 시작 시 이미 체크아웃) |

빠진 spec 요구사항 없음.

### Placeholder 스캔

- "TBD" / "TODO" / "implement later" 검색: 없음
- 모호 지시: 없음 (모든 코드 명시)
- "Similar to Task N" 생략: 없음 (각 task 자급자족)
- 코드 step 마다 실제 코드 블록 존재

### 타입 일관성

- `FilterCondition` / `NumRange` / `ColumnCandidate` 타입: Task 1.1 정의 → Task 2.1 (서버 헬퍼) → Task 3.3 (page) → Task 4.2 (UI 는 별도 ColumnCandidate 인터페이스 재정의 — 동일 형상, 'use client' 모듈이 서버 모듈 import 안 함)
- `parseConditionFromUrl` 시그니처: Task 1.8 정의 → Task 3.3 호출 — 일치
- `placeholderFor` 시그니처: Task 1.6 정의 → Task 4.2 인라인 재정의 (UI 가 progress-filters.ts 를 import 하면 서버 모듈을 client 에 가져가는 셈이라 회피)
- `getProgressRows` / `getProgressTotals` 시그니처: Task 2.2/2.3 정의 → Task 3.4 호출 — 일치
- `ProgressFilterBar` props (`initialSource`, `initialValue`, `columnCandidates`): Task 4.2 정의 → Task 3.5 사용 — 일치
