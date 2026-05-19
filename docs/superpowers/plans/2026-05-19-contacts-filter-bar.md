# 조사 대상 다중 조건 필터 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 조사 대상 목록 페이지의 단일 `qfield+q+resultCode` 필터를 `contactColumns` 기반 다중 AND/OR 조건 필터로 교체. Collapsible 진입점(단순 검색바 + [▼ 다중 조건] 패널), 좌→우 평가, system.resid/contact_result/web 등 system 컬럼별 위젯 분기.

**Architecture:** URL `?col[]=&q[]=&op[]=` multi-value 직렬화 → Server Component 가 `contactColumns` 화이트리스트 검증 + pii blindIndex 계산 → Drizzle `sql` 좌→우 평가 빌더가 `(절)` 단위 괄호로 결합 → Client 는 form + Collapsible + ClauseRow + ValueWidget (source 따라 text/enum/boolean 위젯 분기). `parseIdListInput` 은 진척 보고와 공유하기 위해 `range-list.ts` 로 분리.

**Tech Stack:** Next.js 16 App Router (Server Components), Drizzle ORM (raw `sql`), shadcn/ui (Select/Input/Button), vitest (단위 테스트), TypeScript strict, Node `createHmac` (pii blindIndex).

**디자인 spec:** [docs/superpowers/specs/2026-05-19-contacts-filter-bar-design.md](../specs/2026-05-19-contacts-filter-bar-design.md)

---

## File Structure

| 변경 유형 | 파일 | 책임 |
| --- | --- | --- |
| 신규 | `src/lib/operations/range-list.ts` | `NumRange` 타입 + `parseIdListInput` pure utility (no `'server-only'`) |
| 신규 | `tests/unit/range-list.test.ts` | 기존 `parseIdListInput` 케이스 이동 |
| 신규 | `src/lib/operations/contacts-filters.server.ts` | `FilterCondition`/`FilterClause`/`CombineOp` 타입, `parseClausesFromUrl`, `placeholderFor` (서버 전용) |
| 신규 | `tests/unit/contacts-filters.test.ts` | `parseClausesFromUrl` 단위 테스트 |
| 신규 | `src/components/operations/contacts/clause-row.tsx` | 추가 행(두 번째 절 이후) 컴포넌트 — AND/OR + Select + ValueWidget + × |
| 신규 | `src/components/operations/contacts/value-widget.tsx` | source 따라 text/enum/boolean 위젯 분기 |
| 수정 | `src/lib/operations/progress-filters.server.ts` | `parseIdListInput` 인라인 제거 → `range-list.ts` import |
| 수정 | `tests/unit/progress-filters.test.ts` | `parseIdListInput` 케이스 제거 (이동) |
| 수정 | `src/lib/operations/contacts.server.ts` | `buildClauseSql`/`buildContactsFilterSql` 추가, `qfield`/`q`/`resultCode` WHERE 절 제거, `listContactsForSurvey` 시그니처 변경 |
| 수정 | `src/components/operations/contacts/contacts-filter-bar.tsx` | 전면 재작성 — Collapsible + 다중 패널 |
| 수정 | `src/app/admin/surveys/[id]/operations/contacts/page.tsx` | searchParams col[]/q[]/op[] 파싱, `getContactResultCodes` 로드, `parseClausesFromUrl` 호출 |

DB 스키마 변경 없음 / 마이그레이션 없음.

> **브랜치 전략**: `feat/contacts-filter-bar` 를 `feat/report-filter-bar` 위에 분기. 진척 보고 코드(`progress-filters.server.ts`) 를 베이스로 깔고 그 위 `range-list.ts` 분리 + contacts 신규. `feat/report-filter-bar` 머지 후 main 으로 rebase 가능.

---

## Task 1: range-list.ts 공유 유틸 분리 (DRY)

**Files:**
- Create: `src/lib/operations/range-list.ts`
- Create: `tests/unit/range-list.test.ts`
- Modify: `src/lib/operations/progress-filters.server.ts`
- Modify: `tests/unit/progress-filters.test.ts`

- [ ] **Step 1.1: range-list.ts 신규 작성**

`src/lib/operations/range-list.ts` 생성:

```ts
const INT32_MAX = 2147483647;
const ID_LIST_REGEX = /^\s*\d+(\s*-\s*\d+)?(\s*,\s*\d+(\s*-\s*\d+)?)*\s*$/;

export interface NumRange {
  from: number;
  to: number;
}

/**
 * "1-30, 45" 같은 범위/리스트 입력 파싱. 매치 실패 시 null.
 *
 * - 정규식 `^\s*\d+(\s*-\s*\d+)?(\s*,\s*\d+(\s*-\s*\d+)?)*\s*$` 매치만 통과
 * - 값은 양의 정수 (1 ≤ n ≤ INT32_MAX) — 0/음수/소수/INT32_MAX 초과/텍스트 모두 null
 * - 역방향 (50-10) 은 자동 swap (10-50)
 * - 빈 토큰/이중 콤마/공백만 → null
 *
 * progress-filters.server.ts 와 contacts-filters.server.ts 양쪽에서 공유.
 */
export function parseIdListInput(input: string): NumRange[] | null {
  if (!ID_LIST_REGEX.test(input)) return null;
  const tokens = input.split(',').map((t) => t.trim());
  const ranges: NumRange[] = [];
  for (const token of tokens) {
    if (token.length === 0) return null;
    const parts = token.split('-').map((p) => p.trim());
    if (parts.length === 1) {
      const n = Number(parts[0]);
      if (!Number.isInteger(n) || n > INT32_MAX || n < 1) return null;
      ranges.push({ from: n, to: n });
    } else if (parts.length === 2) {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      if (
        !Number.isInteger(a) ||
        !Number.isInteger(b) ||
        a > INT32_MAX ||
        b > INT32_MAX ||
        a < 1 ||
        b < 1
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

- [ ] **Step 1.2: tests/unit/range-list.test.ts 생성 (기존 progress-filters.test.ts 케이스 이동)**

`tests/unit/range-list.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

import { parseIdListInput } from '@/lib/operations/range-list';

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

  it('rejects zero (resid 는 1 부터 시작)', () => {
    expect(parseIdListInput('0')).toBeNull();
    expect(parseIdListInput('0-5')).toBeNull();
    expect(parseIdListInput('5-0')).toBeNull();
  });
});
```

- [ ] **Step 1.3: progress-filters.server.ts 에서 parseIdListInput 인라인 제거**

`src/lib/operations/progress-filters.server.ts` 상단 부분 교체:

```ts
import 'server-only';

import { blindIndex } from '@/lib/crypto/blind';
import type { PiiFieldType } from '@/lib/crypto/pii-fields';
import { parseIdListInput, type NumRange } from './range-list';

export type { NumRange } from './range-list';
export { parseIdListInput } from './range-list';

// INT32_MAX 와 ID_LIST_REGEX 상수, parseIdListInput 함수 모두 제거
// (다른 export 는 그대로 유지)
```

기존 `parseIdListInput` 함수 본문과 그 위 `INT32_MAX` / `ID_LIST_REGEX` 상수 선언 모두 삭제. 다른 export (`FilterCondition`, `placeholderFor`, `parseConditionFromUrl`, `ColumnCandidate`) 는 그대로 유지.

- [ ] **Step 1.4: progress-filters.test.ts 에서 parseIdListInput 케이스 제거**

`tests/unit/progress-filters.test.ts` 에서 `describe('parseIdListInput', ...)` 블록 전체 삭제. 다른 describe (placeholderFor, parseConditionFromUrl) 는 유지.

- [ ] **Step 1.5: 전체 테스트 + tsc**

```bash
pnpm vitest run tests/unit/range-list.test.ts tests/unit/progress-filters.test.ts
pnpm tsc --noEmit
```

Expected:
- range-list.test.ts: 11 케이스 PASS
- progress-filters.test.ts: 기존 25 케이스 - 11 = 14 케이스 PASS
- tsc 에러 0

- [ ] **Step 1.6: 커밋**

```bash
git add src/lib/operations/range-list.ts tests/unit/range-list.test.ts src/lib/operations/progress-filters.server.ts tests/unit/progress-filters.test.ts
git commit -m "$(cat <<'EOF'
refactor: parseIdListInput 을 range-list.ts 로 분리

progress-filters.server.ts 와 contacts-filters.server.ts 가 공유할 수 있도록
범위/리스트 파싱 유틸을 별도 모듈로 추출. 기존 11 테스트 케이스 이동.
EOF
)"
```

---

## Task 2: contacts-filters.server.ts 공용 유틸 TDD

**Files:**
- Create: `src/lib/operations/contacts-filters.server.ts`
- Create: `tests/unit/contacts-filters.test.ts`

- [ ] **Step 2.1: 빈 스켈레톤 파일 생성 (타입만)**

`src/lib/operations/contacts-filters.server.ts`:

```ts
import 'server-only';

import { blindIndex } from '@/lib/crypto/blind';
import { normalizePii, type PiiFieldType } from '@/lib/crypto/pii-fields';
import type { ContactResultCode } from '@/db/schema/schema-types';
import { parseIdListInput, type NumRange } from './range-list';

export type CombineOp = 'AND' | 'OR';
export type ConditionMode = 'idlist' | 'text' | 'exact' | 'enum' | 'boolean';

export interface FilterCondition {
  source: string;
  mode: ConditionMode;
  value: string;
  ranges?: NumRange[];
  blindIndex?: string;
}

export interface FilterClause {
  condition: FilterCondition;
  op: CombineOp | null;
}

export interface ColumnCandidate {
  source: string;
  label: string;
  piiType?: PiiFieldType;
}

export function placeholderFor(source: string): string {
  throw new Error('not implemented');
}

export function parseClausesFromUrl(
  _cols: string[] | undefined,
  _qs: string[] | undefined,
  _ops: string[] | undefined,
  _candidates: ColumnCandidate[],
  _resultCodes: ContactResultCode[],
): FilterClause[] {
  throw new Error('not implemented');
}
```

- [ ] **Step 2.2: placeholderFor 실패 테스트 작성**

`tests/unit/contacts-filters.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

import {
  parseClausesFromUrl,
  placeholderFor,
  type ColumnCandidate,
} from '@/lib/operations/contacts-filters.server';
import type { ContactResultCode } from '@/db/schema/schema-types';

describe('placeholderFor', () => {
  it('returns id range hint for system.resid', () => {
    expect(placeholderFor('system.resid')).toBe('예: 1-30, 45');
  });

  it('returns exact-match hint for pii.*', () => {
    expect(placeholderFor('pii.email')).toBe('정확한 값 입력 (부분 검색 불가)');
    expect(placeholderFor('pii.mobile')).toBe('정확한 값 입력 (부분 검색 불가)');
  });

  it('returns generic 검색어 for the rest', () => {
    expect(placeholderFor('attrs.전시회명')).toBe('검색어');
    expect(placeholderFor('system.contact_result')).toBe('검색어');
    expect(placeholderFor('system.web')).toBe('검색어');
  });
});
```

Run (fail): `pnpm vitest run tests/unit/contacts-filters.test.ts -t placeholderFor`

- [ ] **Step 2.3: placeholderFor 구현**

`contacts-filters.server.ts` 의 `placeholderFor` 본문 교체:

```ts
export function placeholderFor(source: string): string {
  if (source === 'system.resid') return '예: 1-30, 45';
  if (source.startsWith('pii.')) return '정확한 값 입력 (부분 검색 불가)';
  return '검색어';
}
```

Run (pass): `pnpm vitest run tests/unit/contacts-filters.test.ts -t placeholderFor`
Expected: 3 케이스 PASS.

- [ ] **Step 2.4: parseClausesFromUrl 테스트 픽스처 + 첫 번째 테스트 작성**

`tests/unit/contacts-filters.test.ts` 끝에 append:

```ts
const candidates: ColumnCandidate[] = [
  { source: 'system.resid', label: '번호' },
  { source: 'system.contact_result', label: '결과코드' },
  { source: 'system.web', label: '응답' },
  { source: 'attrs.전시회명', label: '전시회명' },
  { source: 'attrs.지역', label: '지역' },
  { source: 'pii.email', label: '이메일', piiType: 'email' },
];

const resultCodes: ContactResultCode[] = [
  { code: '1.조사완료', label: '1.조사완료', order: 1 },
  { code: '2.재통화예약', label: '2.재통화예약', order: 2 },
];

describe('parseClausesFromUrl', () => {
  it('returns empty array for missing arrays', () => {
    expect(parseClausesFromUrl(undefined, undefined, undefined, candidates, resultCodes)).toEqual([]);
    expect(parseClausesFromUrl([], [], [], candidates, resultCodes)).toEqual([]);
  });
});
```

Run (fail): `pnpm vitest run tests/unit/contacts-filters.test.ts -t parseClausesFromUrl`

- [ ] **Step 2.5: parseClausesFromUrl 빈 케이스 구현**

`contacts-filters.server.ts` 에 헬퍼 + 함수 본문 교체:

```ts
function toArray(v: string[] | string | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export function parseClausesFromUrl(
  cols: string[] | string | undefined,
  qs: string[] | string | undefined,
  ops: string[] | string | undefined,
  candidates: ColumnCandidate[],
  resultCodes: ContactResultCode[],
): FilterClause[] {
  const colsArr = toArray(cols);
  const qsArr = toArray(qs);
  const opsArr = toArray(ops);
  const len = Math.min(colsArr.length, qsArr.length);
  if (len === 0) return [];
  const clauses: FilterClause[] = [];
  for (let i = 0; i < len; i++) {
    const clause = buildClause(colsArr[i], qsArr[i], opsArr[i] ?? '', candidates, resultCodes, i);
    if (clause) clauses.push(clause);
  }
  return clauses;
}

function buildClause(
  col: string,
  q: string,
  opRaw: string,
  candidates: ColumnCandidate[],
  resultCodes: ContactResultCode[],
  index: number,
): FilterClause | null {
  const trimmed = q.trim();
  if (trimmed.length === 0) return null;
  const candidate = candidates.find((c) => c.source === col);
  if (!candidate) return null;
  const op: CombineOp | null = index === 0 ? null : opRaw === 'OR' ? 'OR' : 'AND';

  if (col === 'system.resid') {
    const ranges = parseIdListInput(trimmed);
    if (ranges !== null) {
      return { op, condition: { source: 'system.resid', mode: 'idlist', value: trimmed, ranges } };
    }
    return { op, condition: { source: 'system.resid', mode: 'text', value: trimmed } };
  }

  if (col === 'system.contact_result') {
    const code = resultCodes.find((rc) => rc.code === trimmed);
    if (!code) return null;
    return { op, condition: { source: 'system.contact_result', mode: 'enum', value: trimmed } };
  }

  if (col === 'system.web') {
    if (trimmed !== 'true' && trimmed !== 'false') return null;
    return { op, condition: { source: 'system.web', mode: 'boolean', value: trimmed } };
  }

  if (col.startsWith('attrs.')) {
    return { op, condition: { source: col, mode: 'text', value: trimmed } };
  }

  if (col.startsWith('pii.')) {
    if (!candidate.piiType) return null;
    const normalized = normalizePii(candidate.piiType, trimmed);
    if (!normalized) return null;
    const bi = blindIndex(candidate.piiType, trimmed);
    if (!bi) return null;
    return { op, condition: { source: col, mode: 'exact', value: trimmed, blindIndex: bi } };
  }

  return null;
}
```

Run (pass): `pnpm vitest run tests/unit/contacts-filters.test.ts -t parseClausesFromUrl`
Expected: 빈 케이스 PASS.

- [ ] **Step 2.6: 모든 source/mode 테스트 케이스 추가**

테스트 append:

```ts
describe('parseClausesFromUrl - source 분기', () => {
  it('system.resid + 숫자 패턴 → idlist', () => {
    const result = parseClausesFromUrl(
      ['system.resid'],
      ['1-30, 45'],
      [''],
      candidates,
      resultCodes,
    );
    expect(result).toEqual([
      {
        op: null,
        condition: {
          source: 'system.resid',
          mode: 'idlist',
          value: '1-30, 45',
          ranges: [
            { from: 1, to: 30 },
            { from: 45, to: 45 },
          ],
        },
      },
    ]);
  });

  it('system.resid + 비숫자 → text 폴백', () => {
    const result = parseClausesFromUrl(['system.resid'], ['abc'], [''], candidates, resultCodes);
    expect(result).toEqual([
      { op: null, condition: { source: 'system.resid', mode: 'text', value: 'abc' } },
    ]);
  });

  it('system.contact_result + enum 값 → enum', () => {
    const result = parseClausesFromUrl(
      ['system.contact_result'],
      ['1.조사완료'],
      [''],
      candidates,
      resultCodes,
    );
    expect(result).toEqual([
      {
        op: null,
        condition: { source: 'system.contact_result', mode: 'enum', value: '1.조사완료' },
      },
    ]);
  });

  it('system.contact_result + enum 외 값 → drop', () => {
    expect(
      parseClausesFromUrl(['system.contact_result'], ['unknown'], [''], candidates, resultCodes),
    ).toEqual([]);
  });

  it('system.web + true/false → boolean', () => {
    const t = parseClausesFromUrl(['system.web'], ['true'], [''], candidates, resultCodes);
    expect(t[0].condition).toEqual({ source: 'system.web', mode: 'boolean', value: 'true' });
    const f = parseClausesFromUrl(['system.web'], ['false'], [''], candidates, resultCodes);
    expect(f[0].condition).toEqual({ source: 'system.web', mode: 'boolean', value: 'false' });
  });

  it('system.web + 외 값 → drop', () => {
    expect(parseClausesFromUrl(['system.web'], ['yes'], [''], candidates, resultCodes)).toEqual([]);
  });

  it('attrs.* → text', () => {
    const result = parseClausesFromUrl(
      ['attrs.전시회명'],
      ['핵심'],
      [''],
      candidates,
      resultCodes,
    );
    expect(result).toEqual([
      { op: null, condition: { source: 'attrs.전시회명', mode: 'text', value: '핵심' } },
    ]);
  });

  it('pii.email + 유효 이메일 → exact + blindIndex', () => {
    const result = parseClausesFromUrl(
      ['pii.email'],
      ['user@example.com'],
      [''],
      candidates,
      resultCodes,
    );
    expect(result).toHaveLength(1);
    expect(result[0].condition.source).toBe('pii.email');
    expect(result[0].condition.mode).toBe('exact');
    expect(result[0].condition.value).toBe('user@example.com');
    expect(
      result[0].condition.mode === 'exact' &&
        /^[0-9a-f]{64}$/.test(result[0].condition.blindIndex ?? ''),
    ).toBe(true);
  });

  it('pii.* + 정규화 실패 → drop', () => {
    expect(parseClausesFromUrl(['pii.email'], ['abc'], [''], candidates, resultCodes)).toEqual([]);
  });

  it('whitelist 위반 → drop', () => {
    expect(parseClausesFromUrl(['attrs.unknown'], ['x'], [''], candidates, resultCodes)).toEqual(
      [],
    );
  });

  it('빈 q → drop', () => {
    expect(parseClausesFromUrl(['attrs.전시회명'], [''], [''], candidates, resultCodes)).toEqual(
      [],
    );
    expect(parseClausesFromUrl(['attrs.전시회명'], ['   '], [''], candidates, resultCodes)).toEqual(
      [],
    );
  });
});

describe('parseClausesFromUrl - 다중 조건', () => {
  it('첫 절 op 는 강제 null, 나머지는 AND/OR', () => {
    const result = parseClausesFromUrl(
      ['attrs.전시회명', 'attrs.지역', 'attrs.지역'],
      ['핵심', '서울', '부산'],
      ['', 'AND', 'OR'],
      candidates,
      resultCodes,
    );
    expect(result.map((c) => c.op)).toEqual([null, 'AND', 'OR']);
  });

  it('op[0] 에 AND/OR 가 와도 첫 절은 null 로 강제', () => {
    const result = parseClausesFromUrl(
      ['attrs.전시회명'],
      ['핵심'],
      ['OR'],
      candidates,
      resultCodes,
    );
    expect(result[0].op).toBeNull();
  });

  it('op 가 AND/OR 외 값이면 AND 폴백', () => {
    const result = parseClausesFromUrl(
      ['attrs.전시회명', 'attrs.지역'],
      ['핵심', '서울'],
      ['', 'XOR'],
      candidates,
      resultCodes,
    );
    expect(result[1].op).toBe('AND');
  });

  it('길이 불일치 → 짧은 쪽까지만 (silent truncate)', () => {
    const result = parseClausesFromUrl(
      ['attrs.전시회명', 'attrs.지역'],
      ['핵심'],
      [''],
      candidates,
      resultCodes,
    );
    expect(result).toHaveLength(1);
  });

  it('일부 drop, 나머지 유지 (인덱스 보존 아님 — 통과한 절 순서대로)', () => {
    const result = parseClausesFromUrl(
      ['attrs.전시회명', 'attrs.unknown', 'attrs.지역'],
      ['핵심', 'x', '서울'],
      ['', 'AND', 'OR'],
      candidates,
      resultCodes,
    );
    expect(result).toHaveLength(2);
    expect(result[0].condition.source).toBe('attrs.전시회명');
    expect(result[1].condition.source).toBe('attrs.지역');
    expect(result[1].op).toBe('OR');
  });
});
```

Run: `pnpm vitest run tests/unit/contacts-filters.test.ts`
Expected: 모든 케이스 PASS (총 17+ 케이스).

- [ ] **Step 2.7: tsc 확인**

```bash
pnpm tsc --noEmit
```
Expected: 에러 0.

- [ ] **Step 2.8: 커밋**

```bash
git add src/lib/operations/contacts-filters.server.ts tests/unit/contacts-filters.test.ts
git commit -m "$(cat <<'EOF'
feat: 조사 대상 다중 조건 필터 공용 유틸 추가

FilterCondition/Clause/CombineOp 타입 + parseClausesFromUrl + placeholderFor.
system.resid/contact_result/web/attrs/pii 각 source 별 mode 자동 결정,
화이트리스트·enum·boolean·pii 정규화 검증으로 잘못된 절 silent drop.
EOF
)"
```

---

## Task 3: contacts.server.ts 서버 쿼리 빌더

**Files:**
- Modify: `src/lib/operations/contacts.server.ts`

서버 단 단위 테스트 없이 tsc + Task 4·5 통합 흐름으로 검증.

- [ ] **Step 3.1: 사전 확인**

```bash
cd /Users/ljwoon/study/next-study/survey-table-project
cat src/lib/operations/contacts.server.ts | head -150
grep -n "latestResultCodeExpr\|whereParts\|qfield\|listContactsForSurvey" src/lib/operations/contacts.server.ts | head -20
```

기존 `listContactsForSurvey` 의 시그니처·WHERE 절 빌더 위치 파악.

- [ ] **Step 3.2: import + 헬퍼 추가**

`src/lib/operations/contacts.server.ts` 상단 import 에 다음 추가:

```ts
import type { FilterCondition, FilterClause } from './contacts-filters.server';
```

기존 헬퍼 (`escapeLikePattern`, `latestResultCodeExpr`) 가 정의된 위치 다음에 두 헬퍼 삽입:

```ts
/**
 * 단일 절 SQL. cond.source 와 mode 별로 분기.
 *
 * SECURITY: cond.source 는 호출자에서 contactColumns 화이트리스트 검증 끝난 값만
 * 전달된다고 가정. value/from/to/blindIndex/key 모두 parameter binding 으로 안전.
 *
 * pii.* 평문 미노출 (사전 계산된 blindIndex 만 SQL 에 진입).
 */
function buildClauseSql(cond: FilterCondition) {
  if (cond.source === 'system.resid') {
    if (cond.mode === 'idlist') {
      if (!cond.ranges || cond.ranges.length === 0) return sql`FALSE`;
      const conds = cond.ranges.map((r) =>
        r.from === r.to
          ? sql`ct.resid = ${r.from}`
          : sql`ct.resid BETWEEN ${r.from} AND ${r.to}`,
      );
      return sql.join(conds, sql` OR `);
    }
    return sql`FALSE`;
  }

  if (cond.source === 'system.contact_result' && cond.mode === 'enum') {
    return sql`${latestResultCodeExpr} = ${cond.value}`;
  }

  if (cond.source === 'system.web' && cond.mode === 'boolean') {
    return cond.value === 'true'
      ? sql`ct.responded_at IS NOT NULL`
      : sql`ct.responded_at IS NULL`;
  }

  if (cond.source.startsWith('attrs.') && cond.mode === 'text') {
    const key = cond.source.slice('attrs.'.length);
    const escaped = escapeLikePattern(cond.value);
    return sql`ct.attrs->>${key} ILIKE '%' || ${escaped} || '%'`;
  }

  if (cond.source.startsWith('pii.') && cond.mode === 'exact') {
    if (!cond.blindIndex) return sql`FALSE`;
    const columnKey = cond.source.slice('pii.'.length);
    return sql`EXISTS (
      SELECT 1 FROM contact_pii pp
      WHERE pp.contact_target_id = ct.id
        AND pp.column_key = ${columnKey}
        AND pp.blind_index = ${cond.blindIndex}
    )`;
  }

  return sql`FALSE`;
}

/**
 * 절 배열 → WHERE 절. 좌→우 평가, 각 절을 (...) 로 감싸 AND/OR 우선순위 모호함 제거.
 *
 * 빈 배열 → TRUE (전체 조회).
 */
function buildContactsFilterSql(clauses: FilterClause[]) {
  if (clauses.length === 0) return sql`TRUE`;
  let expr = buildClauseSql(clauses[0].condition);
  for (let i = 1; i < clauses.length; i++) {
    const next = buildClauseSql(clauses[i].condition);
    const op = clauses[i].op === 'OR' ? sql.raw('OR') : sql.raw('AND');
    expr = sql`(${expr}) ${op} (${next})`;
  }
  return expr;
}
```

- [ ] **Step 3.3: `listContactsForSurvey` 시그니처 + WHERE 절 변경**

기존 `ListContactsForSurveyArgs` 인터페이스 (혹은 타입 정의) 와 함수 본문에서:

1. `qfield`, `q`, `resultCode` 필드 제거 → `clauses: FilterClause[]` 추가
2. 본문 안의 `whereParts.push(...)` 분기 (qfield 처리, resultCode 처리) 전체 삭제
3. 그 자리에 다음 한 줄:

```ts
whereParts.push(buildContactsFilterSql(clauses));
```

> 정확한 라인은 현재 코드에 맞춰 조정. `whereParts` 가 `eq(contactTargets.surveyId, surveyId)` 만 갖고 있다가 그 뒤 `buildContactsFilterSql` 결과 한 개만 push 되는 형태.

- [ ] **Step 3.4: tsc 확인**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected:
- `src/app/admin/surveys/[id]/operations/contacts/page.tsx` 에서 qfield/q/resultCode 인자 / 시그니처 불일치 에러 (Task 4 에서 해소)
- `src/components/operations/contacts/contacts-filter-bar.tsx` 의 prop 미스매치 (Task 5 에서 해소)
- 그 외 호출처는 발견 즉시 보고

다른 호출처 있으면:
```bash
grep -rn "listContactsForSurvey" src/ --include='*.ts' --include='*.tsx'
```

- [ ] **Step 3.5: 커밋**

```bash
git add src/lib/operations/contacts.server.ts
git commit -m "$(cat <<'EOF'
refactor: 조사 대상 쿼리를 FilterClause[] 시그니처로 전환

qfield/q/resultCode 분기 제거, buildClauseSql + buildContactsFilterSql 헬퍼 추가.
좌→우 평가로 AND/OR 결합, 각 절 (...) 괄호로 우선순위 모호함 제거.
EOF
)"
```

---

## Task 4: page.tsx 변환

**Files:**
- Modify: `src/app/admin/surveys/[id]/operations/contacts/page.tsx`

- [ ] **Step 4.1: 현재 page.tsx 구조 확인**

```bash
cd /Users/ljwoon/study/next-study/survey-table-project
cat src/app/admin/surveys/[id]/operations/contacts/page.tsx
grep -n "normalizeContactListArgs\|getContactResultCodes\|ContactsFilterBar" src/app/admin/surveys/[id]/operations/contacts/page.tsx
```

기존 `sp.qfield`/`sp.q`/`sp.resultCode` 사용 위치 + `normalizeContactListArgs` 동작 + `ContactsFilterBar` prop 파악.

- [ ] **Step 4.2: import 정리**

`src/app/admin/surveys/[id]/operations/contacts/page.tsx` 상단 import 에 다음 추가:

```ts
import {
  parseClausesFromUrl,
  type ColumnCandidate,
} from '@/lib/operations/contacts-filters.server';
import {
  getContactColumnScheme,
  getContactResultCodes,
  listContactsForSurvey,
} from '@/lib/operations/contacts.server';
```

(`getContactResultCodes` import 가 빠져있으면 추가. 다른 함수는 이미 import 돼있을 가능성 큼.)

- [ ] **Step 4.3: searchParams 타입 + 파싱 교체**

`PageProps.searchParams` 의 `q?: string; qfield?: string; resultCode?: string;` 를 제거하고 다음으로 교체:

```ts
searchParams: Promise<{
  col?: string | string[];
  q?: string | string[];
  op?: string | string[];
  page?: string;
  size?: string;
  sort?: string;
  dir?: string;
}>;
```

기존 `normalizeContactListArgs(sp)` 호출과 그 반환값 사용을 다음으로 교체:

```ts
const [scheme, resultCodes] = await Promise.all([
  getContactColumnScheme(surveyId),
  getContactResultCodes(surveyId),
]);

// 컬럼 후보: system.resid + system.contact_result + system.web + attrs.* + pii.* 만.
// system.email_count / system.contact_owner 는 placeholder 라 제외.
const columnCandidates: ColumnCandidate[] = (scheme?.columns ?? [])
  .filter((c) =>
    c.source === 'system.resid' ||
    c.source === 'system.contact_result' ||
    c.source === 'system.web' ||
    c.source.startsWith('attrs.') ||
    c.source.startsWith('pii.'),
  )
  .map((c) => ({ source: c.source, label: c.label, piiType: c.piiType }));

const clauses = parseClausesFromUrl(
  sp.col,
  sp.q,
  sp.op,
  columnCandidates,
  resultCodes,
);
```

- [ ] **Step 4.4: `listContactsForSurvey` 호출 변경**

기존 호출 (qfield/q/resultCode 전달) 을 다음으로 교체:

```ts
const { rows, total, page: clampedPage } = await listContactsForSurvey({
  surveyId,
  pageSize: CONTACTS_PAGE_SIZE,
  clauses,
  page: parsedPage,
  sort: safeSort,
  dir: safeDir,
});
```

> `parsedPage`/`safeSort`/`safeDir` 등 기존 변수명은 그대로 유지. `normalizeContactListArgs` 호출 코드가 page/sort/dir 파싱도 하고 있었다면 그 로직만 인라인하거나 별도 helper 로 유지.

- [ ] **Step 4.5: ContactsFilterBar prop 변경**

JSX 의 `<ContactsFilterBar initialQ={...} initialQField={...} initialResultCode={...} resultCodeOptions={[]} />` 를 다음으로 교체:

```tsx
<ContactsFilterBar
  surveyId={surveyId}
  initialClauses={clauses}
  columnCandidates={columnCandidates}
  resultCodeOptions={resultCodes}
/>
```

- [ ] **Step 4.6: tsc 확인**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: `ContactsFilterBar` 의 prop 타입 mismatch 만 (Task 5 에서 해소). 그 외 에러 0.

다른 에러가 나오면 즉시 보고.

- [ ] **Step 4.7: 커밋**

```bash
git add src/app/admin/surveys/[id]/operations/contacts/page.tsx
git commit -m "$(cat <<'EOF'
refactor: 조사 대상 page.tsx 를 col[]/q[]/op[] 다중 조건 흐름으로 전환

contactColumns 화이트리스트 + resultCodes 동적 로드 + parseClausesFromUrl 호출.
ContactsFilterBar 는 다음 커밋에서 새 prop 시그니처로 재작성.
EOF
)"
```

---

## Task 5: ContactsFilterBar UI 재작성 + ClauseRow + ValueWidget

**Files:**
- Create: `src/components/operations/contacts/clause-row.tsx`
- Create: `src/components/operations/contacts/value-widget.tsx`
- Modify: `src/components/operations/contacts/contacts-filter-bar.tsx`

단위 테스트 없음 — Task 6 dogfooding 검증.

- [ ] **Step 5.1: value-widget.tsx 작성 (source 따라 위젯 분기)**

`src/components/operations/contacts/value-widget.tsx`:

```tsx
'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ContactResultCode } from '@/db/schema/schema-types';

function placeholderFor(source: string): string {
  if (source === 'system.resid') return '예: 1-30, 45';
  if (source.startsWith('pii.')) return '정확한 값 입력 (부분 검색 불가)';
  return '검색어';
}

interface Props {
  source: string;
  value: string;
  onChange: (v: string) => void;
  resultCodeOptions: ContactResultCode[];
  inputId?: string;
}

/**
 * 컬럼 source 에 따라 다른 입력 위젯 렌더.
 * - system.contact_result → 결과코드 dropdown
 * - system.web → 응답 완료/미응답 dropdown
 * - 그 외 (system.resid / attrs.* / pii.*) → text input
 */
export function ValueWidget({ source, value, onChange, resultCodeOptions, inputId }: Props) {
  if (source === 'system.contact_result') {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={inputId} className="w-[260px] h-10">
          <SelectValue placeholder="결과코드 선택" />
        </SelectTrigger>
        <SelectContent>
          {resultCodeOptions.map((rc) => (
            <SelectItem key={rc.code} value={rc.code}>
              {rc.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (source === 'system.web') {
    return (
      <Select value={value || 'true'} onValueChange={onChange}>
        <SelectTrigger id={inputId} className="w-[260px] h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">응답 완료</SelectItem>
          <SelectItem value="false">미응답</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      id={inputId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholderFor(source)}
      className="w-[260px] h-10"
    />
  );
}
```

- [ ] **Step 5.2: clause-row.tsx 작성 (추가 행 컴포넌트)**

`src/components/operations/contacts/clause-row.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ContactResultCode } from '@/db/schema/schema-types';

import { ValueWidget } from './value-widget';

interface ColumnCandidate {
  source: string;
  label: string;
}

export interface ClauseRowValue {
  op: 'AND' | 'OR';
  source: string;
  value: string;
}

interface Props {
  clause: ClauseRowValue;
  columnCandidates: ColumnCandidate[];
  resultCodeOptions: ContactResultCode[];
  onChange: (next: ClauseRowValue) => void;
  onRemove: () => void;
  index: number; // aria-label 에 사용
}

export function ClauseRow({
  clause,
  columnCandidates,
  resultCodeOptions,
  onChange,
  onRemove,
  index,
}: Props) {
  return (
    <div
      className="mb-2 flex items-center gap-2"
      role="group"
      aria-label={`조건 ${index + 2}`}
    >
      <Select
        value={clause.op}
        onValueChange={(v) => onChange({ ...clause, op: v as 'AND' | 'OR' })}
      >
        <SelectTrigger className="h-9 w-[70px] font-bold text-blue-700">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AND">AND</SelectItem>
          <SelectItem value="OR">OR</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={clause.source}
        onValueChange={(s) => onChange({ ...clause, source: s, value: '' })}
      >
        <SelectTrigger className="h-10 w-[180px]">
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
      <ValueWidget
        source={clause.source}
        value={clause.value}
        onChange={(v) => onChange({ ...clause, value: v })}
        resultCodeOptions={resultCodeOptions}
      />
      <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
        ×
      </Button>
    </div>
  );
}
```

- [ ] **Step 5.3: contacts-filter-bar.tsx 전면 재작성**

`src/components/operations/contacts/contacts-filter-bar.tsx` 전체 내용을 다음으로 교체:

```tsx
'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSearchParamsMutator } from '@/hooks/use-search-params-mutator';
import type { ContactResultCode } from '@/db/schema/schema-types';

import { ClauseRow, type ClauseRowValue } from './clause-row';
import { ValueWidget } from './value-widget';

interface ColumnCandidate {
  source: string;
  label: string;
}

// page.tsx 의 FilterClause 와 형상 같지만 client 모듈이라 서버 import 못 함 — 인라인.
interface ClientFilterClause {
  op: 'AND' | 'OR' | null;
  source: string;
  value: string;
}

interface Props {
  surveyId: string;
  initialClauses: ClientFilterClause[];
  columnCandidates: ColumnCandidate[];
  resultCodeOptions: ContactResultCode[];
}

/**
 * 조사 대상 다중 조건 필터.
 *
 * - 단순 검색바 = 첫 절 (op=null)
 * - [▼ 다중 조건] 클릭 시 두 번째 이후 절 패널 펼침
 * - 활성 조건 2개 이상이면 자동 펼침
 * - URL ?col[]=&q[]=&op[]= multi-value 직렬화
 * - 빈 value 절은 [검색] 시 silent drop
 */
export function ContactsFilterBar({
  surveyId,
  initialClauses,
  columnCandidates,
  resultCodeOptions,
}: Props) {
  // 첫 절 (단순 검색바) + 추가 절 (다중 패널) 분리 관리.
  // initialClauses 가 비었으면 빈 첫 절로 시작.
  const [firstSource, setFirstSource] = useState<string>(
    initialClauses[0]?.source ?? '',
  );
  const [firstValue, setFirstValue] = useState<string>(initialClauses[0]?.value ?? '');
  const [extraClauses, setExtraClauses] = useState<ClauseRowValue[]>(
    initialClauses.slice(1).map((c) => ({
      op: (c.op ?? 'AND') as 'AND' | 'OR',
      source: c.source,
      value: c.value,
    })),
  );
  const [advancedOpen, setAdvancedOpen] = useState(initialClauses.length >= 2);
  const [, startTransition] = useTransition();
  const pushParams = useSearchParamsMutator();

  // 브라우저 뒤로/앞으로 가기 시 동기화. 깊은 비교 위해 JSON.stringify 1회.
  useEffect(() => {
    setFirstSource(initialClauses[0]?.source ?? '');
    setFirstValue(initialClauses[0]?.value ?? '');
    setExtraClauses(
      initialClauses.slice(1).map((c) => ({
        op: (c.op ?? 'AND') as 'AND' | 'OR',
        source: c.source,
        value: c.value,
      })),
    );
    setAdvancedOpen(initialClauses.length >= 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialClauses)]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // 모든 절 평탄화: 첫 절 + 추가 절들. 빈 value 또는 빈 source 는 silent drop.
    const cols: string[] = [];
    const qs: string[] = [];
    const ops: string[] = [];
    if (firstSource && firstValue.trim().length > 0) {
      cols.push(firstSource);
      qs.push(firstValue.trim());
      ops.push('');
    }
    for (const c of extraClauses) {
      if (!c.source || c.value.trim().length === 0) continue;
      cols.push(c.source);
      qs.push(c.value.trim());
      ops.push(c.op);
    }
    startTransition(() => {
      pushParams((p) => {
        p.delete('col');
        p.delete('q');
        p.delete('op');
        cols.forEach((c) => p.append('col', c));
        qs.forEach((q) => p.append('q', q));
        ops.forEach((o) => p.append('op', o));
        p.delete('page');
      });
    });
  };

  const addClause = () => {
    const firstCandidate = columnCandidates[0]?.source ?? '';
    setExtraClauses((cs) => [...cs, { op: 'AND', source: firstCandidate, value: '' }]);
    setAdvancedOpen(true);
  };

  const updateExtraAt = (i: number, next: ClauseRowValue) => {
    setExtraClauses((cs) => cs.map((c, idx) => (idx === i ? next : c)));
  };

  const removeExtraAt = (i: number) => {
    setExtraClauses((cs) => cs.filter((_, idx) => idx !== i));
  };

  return (
    <form
      onSubmit={handleSearch}
      className="mb-3"
      role="search"
      aria-label="조사 대상 필터"
    >
      {/* 단순 검색바 (첫 절) */}
      <div className="flex items-center gap-2">
        <label htmlFor="contacts-first-source" className="sr-only">
          검색 컬럼
        </label>
        <Select value={firstSource} onValueChange={(v) => setFirstSource(v)}>
          <SelectTrigger id="contacts-first-source" className="h-10 w-[180px] shrink-0">
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

        <label htmlFor="contacts-first-value" className="sr-only">
          검색어
        </label>
        <ValueWidget
          source={firstSource}
          value={firstValue}
          onChange={setFirstValue}
          resultCodeOptions={resultCodeOptions}
          inputId="contacts-first-value"
        />

        <Button
          type="submit"
          className="h-10"
          disabled={columnCandidates.length === 0}
        >
          검색
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={() => setAdvancedOpen(!advancedOpen)}
        >
          {advancedOpen ? '▲' : '▼'} 다중 조건
          {extraClauses.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {extraClauses.length}
            </Badge>
          )}
        </Button>
        <Button asChild variant="outline" className="ml-auto h-10">
          <Link href={`/admin/surveys/${surveyId}/operations/contacts/columns`}>
            컬럼 설정
          </Link>
        </Button>
      </div>

      {/* 다중 조건 패널 (두 번째 절 이후) */}
      {advancedOpen && (
        <div className="mt-2 rounded border border-dashed border-slate-300 bg-white p-3">
          {extraClauses.map((c, i) => (
            <ClauseRow
              key={i}
              clause={c}
              columnCandidates={columnCandidates}
              resultCodeOptions={resultCodeOptions}
              onChange={(next) => updateExtraAt(i, next)}
              onRemove={() => removeExtraAt(i)}
              index={i}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            className="border-dashed text-slate-600"
            onClick={addClause}
          >
            + 조건 추가
          </Button>
        </div>
      )}
    </form>
  );
}
```

- [ ] **Step 5.4: import 경로 + 의존성 확인**

```bash
ls src/components/ui/select.tsx src/components/ui/input.tsx src/components/ui/button.tsx src/components/ui/badge.tsx src/hooks/use-search-params-mutator.ts
```

Expected: 모두 존재.

`Badge` 가 다른 컴포넌트에서 사용 중인지 확인 (스타일 variant 일관성):

```bash
grep -rn "from '@/components/ui/badge'" src/components/ | head -5
```

- [ ] **Step 5.5: tsc + build 통과 확인**

```bash
pnpm tsc --noEmit 2>&1 | head -10
pnpm build 2>&1 | tail -20
```

Expected:
- tsc 에러 0
- build 성공

`pnpm lint` 는 ESLint 인프라 깨짐 — 실행하지 않음.

- [ ] **Step 5.6: 커밋**

```bash
git add src/components/operations/contacts/clause-row.tsx src/components/operations/contacts/value-widget.tsx src/components/operations/contacts/contacts-filter-bar.tsx
git commit -m "$(cat <<'EOF'
feat: 조사 대상 다중 조건 필터 UI 재작성

Collapsible 진입점 (단순 검색바 + ▼ 다중 조건 패널).
ClauseRow + ValueWidget 분리, source 따라 text/enum/boolean 위젯 분기.
form 으로 감싸 Enter 자동 submit, 활성 조건 2개+ 면 자동 펼침.
EOF
)"
```

---

## Task 6: 수동 dogfooding + 최종 검증

**Files:** (수정 없음, 검증만)

- [ ] **Step 6.1: dev 서버 기동**

```bash
pnpm dev
```

`http://localhost:3000/admin/surveys/<id>/operations/contacts` 로 이동 (컨택 + pii 컬럼이 있는 설문 권장).

- [ ] **Step 6.2: 시나리오 검증**

각 시나리오 수동 확인:

1. **빈 필터 상태**: 페이지 진입 시 478건 모두 표시. 검색바 비어있음. 다중 조건 패널 닫힘.
2. **단일 attrs 검색**: 컬럼=전시회명, 값=핵심, [검색]. URL `?col=attrs.전시회명&q=핵심&op=`. 표 매칭 행만.
3. **system.resid range**: 컬럼=번호, 값=`1-30, 45`, [검색]. URL `?col=system.resid&q=1-30%2C+45&op=`. 31개 행 표시.
4. **system.contact_result dropdown**: 컬럼=결과코드 → 값 dropdown 활성화, "1.조사완료" 선택, [검색]. URL `?col=system.contact_result&q=1.조사완료&op=`. 완료 컨택만 표시.
5. **system.web boolean**: 컬럼=응답 → 값 "응답 완료" 또는 "미응답" dropdown, [검색]. URL `?col=system.web&q=true&op=` (또는 false).
6. **pii 정확 일치**: 컬럼=이메일 → placeholder "정확한 값 입력...", 정확한 이메일 입력 → [검색]. 매칭 1건.
7. **pii 부분 입력 → 0건**: 컬럼=이메일, 부분 도메인 "@gmail.com" 입력 → 0건 (정확 일치만).
8. **다중 AND 검색**:
   - 단순: 전시회명=핵심
   - [▼ 다중 조건] 클릭 → 패널 펼침
   - [+ 조건 추가] → AND/컬럼=지역/값=서울
   - [검색] → URL `?col=attrs.전시회명&col=attrs.지역&q=핵심&q=서울&op=&op=AND`. 두 조건 AND 매칭.
9. **다중 OR 검색**:
   - 단순: 지역=서울
   - 추가 행: OR/지역/부산
   - [검색] → 서울 OR 부산 컨택 표시.
10. **좌→우 평가 (AND + OR)**:
    - 단순: 전시회명=핵심
    - 추가1: AND/지역/서울
    - 추가2: OR/지역/부산
    - SQL: `((전시회명~핵심) AND (지역~서울)) OR (지역~부산)`. 결과 행 합리적 확인.
11. **다중 조건 행 삭제**: × 버튼 → 그 행만 제거, 다른 행 유지.
12. **활성 조건 2개+ → 페이지 진입 시 자동 펼침**: 위 시나리오 8 적용된 URL 직접 붙여넣기 → 페이지 진입 시 [▲ 다중 조건] 펼친 상태.
13. **빈 input + [검색]**: 모든 필드 비우고 [검색] → URL `col`/`q`/`op` 모두 삭제, 전체 조회.
14. **컬럼 스킴에 없는 URL 조작**: `?col=attrs.unknown&q=x` 직접 URL → 페이지 안 깨지고 필터 무시.
15. **정렬·페이지네이션 회귀**: 필터 적용 후 정렬 / 페이지 이동 → 정상 동작.

- [ ] **Step 6.3: 최종 자동 검증**

```bash
pnpm vitest run tests/unit/contacts-filters.test.ts tests/unit/range-list.test.ts tests/unit/progress-filters.test.ts
pnpm tsc --noEmit
pnpm build
```

Expected: 모두 통과.

- [ ] **Step 6.4: dogfooding 결과 fix + 추가 커밋**

(필요한 경우만) 6.2 에서 발견된 이슈를 fix → 추가 커밋.

- [ ] **Step 6.5: PR 준비용 push (사용자 결정)**

```bash
git push -u origin feat/contacts-filter-bar
```

PR 본문 템플릿:
```
## Summary
- 조사 대상 목록 필터를 contactColumns 기반 다중 AND/OR 조건으로 재작성
- Collapsible UI — 단순 검색바 + ▼ 다중 조건 패널
- system.resid range/list, system.contact_result enum, system.web boolean,
  attrs.* ILIKE, pii.* blindIndex 정확 일치
- URL ?col[]=&q[]=&op[]= multi-value 직렬화, 좌→우 평가

## Test plan
- [x] pnpm vitest run tests/unit/contacts-filters.test.ts tests/unit/range-list.test.ts
- [x] pnpm tsc --noEmit
- [x] pnpm build
- [x] 수동 dogfooding 15 시나리오

## Known Limitations (spec §4 참조)
- 그룹 표현 불가 (좌→우 평가만)
- pii 부분일치 미지원
- system.email_count / system.contact_owner 검색 미지원
- contact_pii 복합 인덱스 누락
- 북마크된 ?qfield= URL 깨짐
```

---

## Self-Review

### Spec 커버리지 체크

| Spec 섹션 | 대응 Task / Step |
| --- | --- |
| §1 FilterCondition/Clause/CombineOp 타입 | Task 2, Step 2.1 |
| §1 URL ?col[]=&q[]=&op[]= 직렬화 | Task 5, Step 5.3 (UI append) + Task 4, Step 4.3 (서버 파싱) |
| §1 mode 자동 결정 (parseClausesFromUrl) | Task 2, Step 2.5 + 2.6 |
| §1 화이트리스트 검증 silent drop | Task 2, Step 2.5 (candidates.find 실패) + 2.6 (테스트) |
| §1 컬럼 후보 빌드 | Task 4, Step 4.3 |
| §1 첫 절 op=null 강제 | Task 2, Step 2.5 (`index === 0 ? null : ...`) + 2.6 (테스트) |
| §2 buildClauseSql 분기 (resid/contact_result/web/attrs/pii) | Task 3, Step 3.2 |
| §2 buildContactsFilterSql 좌→우 평가 | Task 3, Step 3.2 |
| §2 listContactsForSurvey 시그니처 변경 | Task 3, Step 3.3 |
| §3 Collapsible UI | Task 5, Step 5.3 |
| §3 ClauseRow + ValueWidget 분리 | Task 5, Steps 5.1 + 5.2 |
| §3 placeholderFor 위젯 별 | Task 5, Step 5.1 (value-widget 인라인) |
| §3 활성 조건 2개+ 자동 펼침 | Task 5, Step 5.3 |
| §3 URL 동기화 useEffect | Task 5, Step 5.3 |
| §3 접근성 (form/role/htmlFor) | Task 5, Step 5.3 |
| §4 range-list 분리 | Task 1 |
| §4 단위 테스트 | Task 1 (range-list) + Task 2 (contacts-filters) |
| §4 변경 파일 목록 | File Structure 섹션 |

빠진 spec 요구사항 없음.

### Placeholder 스캔

- "TBD" / "TODO" / "implement later" 검색: 없음
- 모호 지시 ("적절히 처리") 없음 — 모든 코드 명시
- "Similar to Task N" 생략 없음
- 각 step 에 실제 코드 블록

### 타입 일관성

- `NumRange` / `FilterCondition` / `FilterClause` / `CombineOp` / `ColumnCandidate`: Task 1·2 정의 → Task 3 (서버 헬퍼) → Task 4 (page) → Task 5 (UI 는 client 별도 인라인 타입 `ClientFilterClause` / `ClauseRowValue`, 형상 동일)
- `parseClausesFromUrl` 시그니처: Task 2 정의 → Task 4 호출 — 일치
- `placeholderFor` 시그니처: Task 2 (서버) + Task 5 (client 인라인) — 동일 본문
- `listContactsForSurvey` 시그니처: Task 3 정의 → Task 4 호출 — 일치
- `ContactsFilterBar` props (`surveyId`/`initialClauses`/`columnCandidates`/`resultCodeOptions`): Task 5 정의 → Task 4 사용 — 일치
- `ClauseRow` / `ValueWidget` 의 prop 타입은 Task 5 내부 일관
