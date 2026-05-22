# 외부 LUT 룩업 비교 + 좌변 1단계 산술 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** displayCondition 에서 "셀값 산술 1단계 (예: 출장비÷출장인원) ≤ 외부 LUT 룩업값 (예: attrs.개최대륙별 평균 항공요금)" 형태 조건을 빌더로 표현·평가 가능하게 함.

**Architecture:** `NumericComparison` 타입의 좌변에 단일 셀 또는 1단계 binop, 우변에 literal 또는 LUT 룩업 variant 를 추가. `saved_lookups` 보관함 테이블 + `surveys.lookups` jsonb 컬럼 (Copy 모델, snapshot 시점 freeze). Pure evaluator 4개 (`src/lib/lookup/`) 로 TDD, 빌더 UI 는 보관함 패널 + 조건 에디터 양쪽 확장. 룩업/산술 실패는 fail-safe SHOW, 빌더 테스트 모드에서만 디버그 사유 노출.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, Supabase Postgres, React 19, Zustand, Vitest, exceljs.

**Spec:** [docs/superpowers/specs/2026-05-22-lookup-comparison-design.md](../specs/2026-05-22-lookup-comparison-design.md)

---

## File Structure

**신규:**
| 파일 | 책임 |
|---|---|
| `src/lib/lookup/types.ts` | internal evaluator 타입 (Ctx, EvalResult) |
| `src/lib/lookup/lookup-row-matcher.ts` | keyMapping → LUT row 찾기 (pure) |
| `src/lib/lookup/evaluate-arith.ts` | 좌변 1단계 binop 평가 (pure) |
| `src/lib/lookup/evaluate-lookup.ts` | 우변 LUT 룩업값 추출 (pure) |
| `src/lib/lookup/evaluate-comparison.ts` | 결합 + fail-safe 판정 (pure) |
| `src/actions/lookup-actions.ts` | `saved_lookups` / `surveys.lookups` server actions |
| `src/components/survey-builder/sample-contact-selector.tsx` | 테스트 모드 sample 컨택 셀렉터 |
| `src/components/survey-builder/left-operand-editor.tsx` | 좌변 단일셀/binop 토글 + 셀 셀렉터 |
| `src/components/survey-builder/lookup-selector.tsx` | 설문 LUT 드롭다운 + 인라인 등록 진입점 |
| `src/components/survey-builder/lookup-key-mapping-editor.tsx` | LUT 키 ↔ attrs 키 매핑 행 |
| `src/components/survey-builder/lookup-comparand-editor.tsx` | 우변 LUT 룩업 설정 컨테이너 |
| `src/components/survey-builder/lookup-edit-modal.tsx` | LUT 인라인 편집 (테이블 + 붙여넣기) |
| `src/components/survey-builder/lookup-csv-import.tsx` | 엑셀/CSV 업로드 4-step 다이얼로그 |
| `src/components/survey-builder/lookup-library-section.tsx` | 보관함 패널의 LUT 섹션 |
| `src/components/survey-builder/condition-debug-panel.tsx` | 테스트 모드 평가 사유 표시 |

**수정:**
| 파일 | 변경 요약 |
|---|---|
| `src/types/survey.ts` | `LeftOperand`, `RightOperand`, `SurveyLookup`, `SavedLookup` 타입 + `NumericComparison` 재정의 |
| `src/db/schema/surveys.ts` | `saved_lookups` 테이블 + `surveys.lookups` jsonb 컬럼 |
| `src/utils/branch-logic.ts` | `evaluateNumericComparison` 시그니처 `(comparison, ctx)` 일반화, lookup 분기 위임 |
| `src/lib/survey/snapshot-builder.ts` | snapshot 에 `lookups` 포함 |
| `src/actions/survey-save-actions.ts` | `lookups` explicit field set (6~7곳) |
| `src/components/survey-builder/numeric-comparison-editor.tsx` | 좌변/우변 토글 + sub-component 위임 |
| `src/components/survey-builder/question-library-panel.tsx` | `<LookupLibrarySection />` 컴포지션 |

**테스트:**
| 파일 | 책임 |
|---|---|
| `tests/unit/lib/lookup/lookup-row-matcher.test.ts` | 단일/복합 키 매칭, trim, 없음 |
| `tests/unit/lib/lookup/evaluate-arith.test.ts` | 좌변 산술 — 0 나누기, NaN, 단일 셀 |
| `tests/unit/lib/lookup/evaluate-lookup.test.ts` | 우변 룩업 — attrs 누락, 행 없음, valueColumn 누락 |
| `tests/unit/lib/lookup/evaluate-comparison.test.ts` | fail-safe SHOW 전파, 6개 연산자 |
| `tests/integration/lookup-actions.test.ts` | CRUD + Copy 흐름 |
| `tests/integration/display-condition-with-lookup.test.ts` | snapshot → 평가 end-to-end |

---

## Phase 1 — DB Schema + Types + Migration

### Task 1: 타입 정의 추가

**Files:**
- Modify: `src/types/survey.ts:84-91` (`ComparandRef`, `NumericComparison`)

- [ ] **Step 1: 기존 `ComparandRef` / `NumericComparison` 구조 read**

Run: `grep -n "ComparandRef\|NumericComparison" src/types/survey.ts`

Expected: 위 두 타입이 `survey.ts:84-91` 부근에 정의되어 있음을 확인.

- [ ] **Step 2: 타입 확장 적용**

Edit `src/types/survey.ts`. 기존 84-91 블록을 다음으로 교체:

```ts
// 분기 조건 좌변 — 단일 셀 또는 1단계 binop (L5 폭증 방지)
export type CellRef = { kind: 'cell'; questionId: string; cellId: string };

export type LeftOperand =
  | CellRef
  | {
      kind: 'binop';
      op: '+' | '-' | '*' | '/';
      left: CellRef;
      right: CellRef | { kind: 'literal'; value: number };
    };

// 분기 조건 우변 — literal (기존 L2) 또는 LUT 룩업 (신규 L4)
export type RightOperand =
  | { kind: 'literal'; value: number }
  | {
      kind: 'lookup';
      surveyLookupId: string;
      keyMapping: Array<{ lutKey: string; attrsKey: string }>;
    };

// 분기 조건 숫자 비교
export interface NumericComparison {
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
  // 하위 호환: 기존 데이터는 left 가 없고 comparand 만 있음.
  // 평가 시 left undefined 면 "현재 평가 중인 cellValue" 를 좌변으로 본다.
  left?: LeftOperand;
  // 하위 호환: 기존 데이터는 comparand 사용. 새 데이터는 right 사용.
  comparand?: { kind: 'literal'; value: number };
  right?: RightOperand;
}

// 설문에 복사된 LUT 사본 (snapshot 시점 freeze)
export interface SurveyLookup {
  id: string; // nanoid
  name: string;
  sourceSavedLookupId?: string;
  keyColumns: string[];
  valueColumn: string;
  rows: Array<Record<string, string | number>>;
}

// 보관함 LUT
export interface SavedLookup {
  id: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  keyColumns: string[];
  valueColumn: string;
  rows: Array<Record<string, string | number>>;
  usageCount: number;
  isPreset: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 3: `Survey` 인터페이스에 `lookups` 필드 추가**

같은 파일에서 `Survey` 인터페이스 찾아서 `contactColumns` 옆에 추가:

```ts
lookups?: SurveyLookup[];
```

- [ ] **Step 4: 타입 체크**

Run: `pnpm tsc --noEmit`

Expected: PASS (기존 사용처가 `comparand` optional 로 인해 깨지지 않음).

- [ ] **Step 5: 커밋**

```bash
git add src/types/survey.ts
git commit -m "feat: LUT 룩업 비교용 LeftOperand·RightOperand·SurveyLookup·SavedLookup 타입 추가"
```

---

### Task 2: Drizzle schema 추가

**Files:**
- Modify: `src/db/schema/surveys.ts` (`saved_questions` 정의 부근에 `saved_lookups` 테이블 + `surveys` 테이블에 `lookups` 컬럼)

- [ ] **Step 1: `saved_questions` 패턴 read**

Run: `grep -n "savedQuestions\|saved_questions\|^export const surveys" src/db/schema/surveys.ts`

Expected: `surveys` 테이블 정의 위치와 `savedQuestions` 패턴 라인 확인.

- [ ] **Step 2: `surveys` 테이블에 `lookups` 컬럼 추가**

Edit `src/db/schema/surveys.ts`. `surveys` 테이블의 `contactColumns` 컬럼 정의 뒤에 추가:

```ts
lookups: jsonb('lookups').$type<SurveyLookup[]>().default([]).notNull(),
```

상단 import 블록에 추가:

```ts
import type { SurveyLookup, SavedLookup } from '@/types/survey';
```

(이미 import 되어 있으면 스킵)

- [ ] **Step 3: `saved_lookups` 테이블 추가**

`savedQuestions` 테이블 정의 바로 뒤에 추가:

```ts
// LUT 보관함 테이블
export const savedLookups = pgTable('saved_lookups', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 메타데이터
  name: text('name').notNull(),
  description: text('description'),
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  category: text('category').notNull(),

  // LUT 데이터
  keyColumns: jsonb('key_columns').$type<string[]>().notNull(),
  valueColumn: text('value_column').notNull(),
  rows: jsonb('rows').$type<Array<Record<string, string | number>>>().default([]).notNull(),

  usageCount: integer('usage_count').default(0).notNull(),
  isPreset: boolean('is_preset').default(false).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type SavedLookupRow = typeof savedLookups.$inferSelect;
export type NewSavedLookupRow = typeof savedLookups.$inferInsert;
```

- [ ] **Step 4: 타입 체크**

Run: `pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/db/schema/surveys.ts
git commit -m "feat: saved_lookups 테이블 + surveys.lookups jsonb 컬럼 Drizzle schema 추가"
```

---

### Task 3: Migration 적용

**Files:**
- 신규 SQL 직접 적용 (Supabase MCP `apply_migration`)

> **이유:** 메모 `drizzle_migrate_journal` 따라 `pnpm db:migrate` 는 `_journal.json` 외 SQL 무시. Supabase MCP 로 직접 적용.

- [ ] **Step 1: Migration SQL 준비**

다음 SQL 을 한 migration 으로 묶음 (name: `add_saved_lookups_and_survey_lookups`):

```sql
-- saved_lookups 테이블 신규 생성
CREATE TABLE saved_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  category text NOT NULL,
  key_columns jsonb NOT NULL,
  value_column text NOT NULL,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage_count integer NOT NULL DEFAULT 0,
  is_preset boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- surveys.lookups 컬럼 추가
ALTER TABLE surveys
  ADD COLUMN lookups jsonb NOT NULL DEFAULT '[]'::jsonb;
```

- [ ] **Step 2: Supabase MCP 로 apply_migration**

Tool call:
```
mcp__claude_ai_Supabase__apply_migration
  name: add_saved_lookups_and_survey_lookups
  query: <위 SQL>
```

Expected: SUCCESS. (현재 working tree clean 으로 시작했으므로 추후 rollback 필요 시 별도 migration 으로 처리)

- [ ] **Step 3: 검증 — 테이블/컬럼 존재 확인**

Tool call:
```
mcp__claude_ai_Supabase__execute_sql
  query: SELECT column_name FROM information_schema.columns WHERE table_name='saved_lookups' ORDER BY ordinal_position;
```

Expected: 11개 컬럼 (id, name, description, tags, category, key_columns, value_column, rows, usage_count, is_preset, created_at, updated_at) 모두 확인.

```
mcp__claude_ai_Supabase__execute_sql
  query: SELECT column_name FROM information_schema.columns WHERE table_name='surveys' AND column_name='lookups';
```

Expected: 1행 (`lookups`).

- [ ] **Step 4: TypeScript 타입 재생성 (Supabase types 사용 시)**

Run:
```
mcp__claude_ai_Supabase__generate_typescript_types
```

(결과 파일이 자동 갱신되지 않으면 수동 unused — Drizzle 만 쓰는 경우 스킵)

- [ ] **Step 5: 커밋 (마이그레이션 SQL 파일이 있다면)**

수동 SQL 파일을 `supabase/migrations/` 디렉토리에 같이 보관하는 게 관행이면:

```bash
git add supabase/migrations/<timestamp>_add_saved_lookups_and_survey_lookups.sql 2>/dev/null || true
git commit -m "feat: saved_lookups 테이블 + surveys.lookups 컬럼 migration 적용" --allow-empty
```

(파일이 없으면 `--allow-empty` 로 빈 커밋. 실제 변경은 DB 에 적용됨)

---

## Phase 2 — Pure Evaluator (TDD)

### Task 4: `lookup-row-matcher.ts` (pure, TDD)

**Files:**
- Create: `src/lib/lookup/types.ts`
- Create: `src/lib/lookup/lookup-row-matcher.ts`
- Create: `tests/unit/lib/lookup/lookup-row-matcher.test.ts`

- [ ] **Step 1: internal 타입 정의 (`types.ts`)**

```ts
// src/lib/lookup/types.ts
import type { SurveyLookup } from '@/types/survey';

export type ContactAttrs = Record<string, string | undefined>;

export type LookupEvalCtx = {
  // 응답 데이터: questionId → cellId → string value
  responses: Record<string, Record<string, string | undefined>>;
  // 현재 응답자 컨택 attrs (없으면 빈 객체)
  contactAttrs: ContactAttrs;
  // snapshot 의 LUT 목록 (id 로 조회)
  lookups: SurveyLookup[];
};

// fail-safe 사유는 빌더 테스트 모드에서만 사용
export type FailReason =
  | 'attrs-key-missing'         // attrs 에 매핑된 키가 없음
  | 'lookup-not-found'          // surveyLookupId 가 lookups 에 없음
  | 'lookup-row-not-matched'    // keys 로 행을 못 찾음
  | 'lookup-value-missing'      // 매칭된 행에 valueColumn 키 없음
  | 'cell-value-missing'        // 좌변 셀 응답 없음
  | 'cell-value-not-number'     // 좌변 셀 응답이 숫자 파싱 실패
  | 'divide-by-zero';           // binop 우측 0 (op==='/')

export type EvalResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: FailReason };
```

- [ ] **Step 2: 실패하는 테스트 작성**

```ts
// tests/unit/lib/lookup/lookup-row-matcher.test.ts
import { describe, it, expect } from 'vitest';
import { findLookupRow } from '@/lib/lookup/lookup-row-matcher';
import type { SurveyLookup } from '@/types/survey';

const SINGLE_KEY_LUT: SurveyLookup = {
  id: 'lut-1',
  name: 'avg-airfare',
  keyColumns: ['대륙'],
  valueColumn: '2026년도_적용액',
  rows: [
    { 대륙: '유럽', '2026년도_적용액': 2470000 },
    { 대륙: '아시아', '2026년도_적용액': 800000 },
  ],
};

const COMPOSITE_KEY_LUT: SurveyLookup = {
  id: 'lut-2',
  name: 'avg-airfare-by-class',
  keyColumns: ['대륙', '클래스'],
  valueColumn: '평균',
  rows: [
    { 대륙: '유럽', 클래스: '이코노미', 평균: 1500000 },
    { 대륙: '유럽', 클래스: '비즈', 평균: 3200000 },
  ],
};

describe('findLookupRow', () => {
  it('단일 키 정확 매칭 성공', () => {
    const row = findLookupRow(SINGLE_KEY_LUT, { 대륙: '유럽' });
    expect(row).toEqual({ 대륙: '유럽', '2026년도_적용액': 2470000 });
  });

  it('단일 키 매칭 실패 시 null', () => {
    const row = findLookupRow(SINGLE_KEY_LUT, { 대륙: '오세아니아' });
    expect(row).toBeNull();
  });

  it('공백 trim 후 매칭', () => {
    const row = findLookupRow(SINGLE_KEY_LUT, { 대륙: ' 유럽 ' });
    expect(row).not.toBeNull();
    expect(row?.['2026년도_적용액']).toBe(2470000);
  });

  it('복합 키 모두 일치해야 매칭', () => {
    const row = findLookupRow(COMPOSITE_KEY_LUT, { 대륙: '유럽', 클래스: '비즈' });
    expect(row?.평균).toBe(3200000);
  });

  it('복합 키 중 하나만 일치하면 매칭 실패', () => {
    const row = findLookupRow(COMPOSITE_KEY_LUT, { 대륙: '유럽', 클래스: '퍼스트' });
    expect(row).toBeNull();
  });

  it('keys 에 lutKey 가 빠지면 매칭 실패', () => {
    const row = findLookupRow(COMPOSITE_KEY_LUT, { 대륙: '유럽' });
    expect(row).toBeNull();
  });

  it('대소문자 구분 (정확 매칭 정책)', () => {
    const row = findLookupRow(SINGLE_KEY_LUT, { 대륙: '유럽 ' });
    // trim 후 정확 매칭 → "유럽" === "유럽" → 매칭
    expect(row).not.toBeNull();

    const row2 = findLookupRow(SINGLE_KEY_LUT, { 대륙: 'Europe' });
    // 대소문자 무시 안 함
    expect(row2).toBeNull();
  });
});
```

- [ ] **Step 3: 테스트 실행 → FAIL**

Run: `pnpm vitest run tests/unit/lib/lookup/lookup-row-matcher.test.ts`

Expected: FAIL — 모듈 not found.

- [ ] **Step 4: 최소 구현**

```ts
// src/lib/lookup/lookup-row-matcher.ts
import type { SurveyLookup } from '@/types/survey';

export function findLookupRow(
  lookup: SurveyLookup,
  keys: Record<string, string | undefined>,
): Record<string, string | number> | null {
  for (const row of lookup.rows) {
    let matched = true;
    for (const lutKey of lookup.keyColumns) {
      const expected = String(row[lutKey] ?? '').trim();
      const actual = (keys[lutKey] ?? '').trim();
      if (expected !== actual || actual === '') {
        matched = false;
        break;
      }
    }
    if (matched) return row;
  }
  return null;
}
```

- [ ] **Step 5: 테스트 재실행 → PASS**

Run: `pnpm vitest run tests/unit/lib/lookup/lookup-row-matcher.test.ts`

Expected: PASS (7/7).

- [ ] **Step 6: 커밋**

```bash
git add src/lib/lookup/types.ts src/lib/lookup/lookup-row-matcher.ts tests/unit/lib/lookup/lookup-row-matcher.test.ts
git commit -m "feat: LUT 행 매칭 pure 함수 + TDD 7케이스 추가"
```

---

### Task 5: `evaluate-arith.ts` (pure, TDD)

**Files:**
- Create: `src/lib/lookup/evaluate-arith.ts`
- Create: `tests/unit/lib/lookup/evaluate-arith.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/unit/lib/lookup/evaluate-arith.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateLeftOperand } from '@/lib/lookup/evaluate-arith';
import type { LeftOperand } from '@/types/survey';
import type { LookupEvalCtx } from '@/lib/lookup/types';

const baseCtx: LookupEvalCtx = {
  responses: {
    q1: { c_exp: '1000000', c_ppl: '2', c_empty: '', c_bad: '약 50' },
  },
  contactAttrs: {},
  lookups: [],
};

describe('evaluateLeftOperand', () => {
  it('단일 셀: 정수 파싱', () => {
    const op: LeftOperand = { kind: 'cell', questionId: 'q1', cellId: 'c_exp' };
    const r = evaluateLeftOperand(op, baseCtx);
    expect(r).toEqual({ ok: true, value: 1000000 });
  });

  it('단일 셀: 응답 없음 → cell-value-missing', () => {
    const op: LeftOperand = { kind: 'cell', questionId: 'q1', cellId: 'c_missing' };
    const r = evaluateLeftOperand(op, baseCtx);
    expect(r).toEqual({ ok: false, reason: 'cell-value-missing' });
  });

  it('단일 셀: 빈 문자열 → cell-value-missing', () => {
    const op: LeftOperand = { kind: 'cell', questionId: 'q1', cellId: 'c_empty' };
    const r = evaluateLeftOperand(op, baseCtx);
    expect(r).toEqual({ ok: false, reason: 'cell-value-missing' });
  });

  it('단일 셀: 파싱 실패 → cell-value-not-number', () => {
    const op: LeftOperand = { kind: 'cell', questionId: 'q1', cellId: 'c_bad' };
    const r = evaluateLeftOperand(op, baseCtx);
    expect(r).toEqual({ ok: false, reason: 'cell-value-not-number' });
  });

  it('binop: 나눗셈 정상', () => {
    const op: LeftOperand = {
      kind: 'binop',
      op: '/',
      left: { kind: 'cell', questionId: 'q1', cellId: 'c_exp' },
      right: { kind: 'cell', questionId: 'q1', cellId: 'c_ppl' },
    };
    const r = evaluateLeftOperand(op, baseCtx);
    expect(r).toEqual({ ok: true, value: 500000 });
  });

  it('binop: 0 으로 나누기 → divide-by-zero', () => {
    const ctx: LookupEvalCtx = {
      ...baseCtx,
      responses: { q1: { a: '100', b: '0' } },
    };
    const op: LeftOperand = {
      kind: 'binop',
      op: '/',
      left: { kind: 'cell', questionId: 'q1', cellId: 'a' },
      right: { kind: 'cell', questionId: 'q1', cellId: 'b' },
    };
    const r = evaluateLeftOperand(op, ctx);
    expect(r).toEqual({ ok: false, reason: 'divide-by-zero' });
  });

  it('binop: 우측 리터럴 곱셈', () => {
    const op: LeftOperand = {
      kind: 'binop',
      op: '*',
      left: { kind: 'cell', questionId: 'q1', cellId: 'c_ppl' },
      right: { kind: 'literal', value: 3 },
    };
    const r = evaluateLeftOperand(op, baseCtx);
    expect(r).toEqual({ ok: true, value: 6 });
  });

  it('binop: 좌측 셀 빈 응답 → cell-value-missing 전파', () => {
    const op: LeftOperand = {
      kind: 'binop',
      op: '+',
      left: { kind: 'cell', questionId: 'q1', cellId: 'c_empty' },
      right: { kind: 'cell', questionId: 'q1', cellId: 'c_ppl' },
    };
    const r = evaluateLeftOperand(op, baseCtx);
    expect(r).toEqual({ ok: false, reason: 'cell-value-missing' });
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL**

Run: `pnpm vitest run tests/unit/lib/lookup/evaluate-arith.test.ts`

Expected: FAIL — 모듈 not found.

- [ ] **Step 3: 구현**

```ts
// src/lib/lookup/evaluate-arith.ts
import type { CellRef, LeftOperand } from '@/types/survey';
import { parseNumericInput } from '@/utils/numeric-input';
import type { EvalResult, LookupEvalCtx } from './types';

function evalCell(cell: CellRef, ctx: LookupEvalCtx): EvalResult<number> {
  const raw = ctx.responses[cell.questionId]?.[cell.cellId];
  if (raw === undefined || raw === '') {
    return { ok: false, reason: 'cell-value-missing' };
  }
  const n = parseNumericInput(raw);
  if (n === null) {
    return { ok: false, reason: 'cell-value-not-number' };
  }
  return { ok: true, value: n };
}

export function evaluateLeftOperand(
  op: LeftOperand,
  ctx: LookupEvalCtx,
): EvalResult<number> {
  if (op.kind === 'cell') return evalCell(op, ctx);

  const l = evalCell(op.left, ctx);
  if (!l.ok) return l;

  const r: EvalResult<number> =
    op.right.kind === 'cell'
      ? evalCell(op.right, ctx)
      : { ok: true, value: op.right.value };
  if (!r.ok) return r;

  switch (op.op) {
    case '+': return { ok: true, value: l.value + r.value };
    case '-': return { ok: true, value: l.value - r.value };
    case '*': return { ok: true, value: l.value * r.value };
    case '/':
      if (r.value === 0) return { ok: false, reason: 'divide-by-zero' };
      return { ok: true, value: l.value / r.value };
  }
}
```

- [ ] **Step 4: 테스트 재실행 → PASS**

Run: `pnpm vitest run tests/unit/lib/lookup/evaluate-arith.test.ts`

Expected: PASS (8/8).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/lookup/evaluate-arith.ts tests/unit/lib/lookup/evaluate-arith.test.ts
git commit -m "feat: 좌변 1단계 산술 평가 pure 함수 + TDD 8케이스 추가"
```

---

### Task 6: `evaluate-lookup.ts` (pure, TDD)

**Files:**
- Create: `src/lib/lookup/evaluate-lookup.ts`
- Create: `tests/unit/lib/lookup/evaluate-lookup.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/unit/lib/lookup/evaluate-lookup.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateRightOperand } from '@/lib/lookup/evaluate-lookup';
import type { RightOperand, SurveyLookup } from '@/types/survey';
import type { LookupEvalCtx } from '@/lib/lookup/types';

const LUT: SurveyLookup = {
  id: 'lut-1',
  name: 'avg-airfare',
  keyColumns: ['대륙'],
  valueColumn: '2026년도_적용액',
  rows: [
    { 대륙: '유럽', '2026년도_적용액': 2470000 },
    { 대륙: '아시아', '2026년도_적용액': 800000 },
    { 대륙: '북미', '2026년도_적용액': '2210000' }, // 문자열 숫자도 허용
  ],
};

const ctx = (attrs: Record<string, string>): LookupEvalCtx => ({
  responses: {},
  contactAttrs: attrs,
  lookups: [LUT],
});

describe('evaluateRightOperand', () => {
  it('literal: 그대로 반환', () => {
    const op: RightOperand = { kind: 'literal', value: 100 };
    const r = evaluateRightOperand(op, ctx({}));
    expect(r).toEqual({ ok: true, value: 100 });
  });

  it('lookup: 정상 룩업', () => {
    const op: RightOperand = {
      kind: 'lookup',
      surveyLookupId: 'lut-1',
      keyMapping: [{ lutKey: '대륙', attrsKey: '개최대륙' }],
    };
    const r = evaluateRightOperand(op, ctx({ 개최대륙: '유럽' }));
    expect(r).toEqual({ ok: true, value: 2470000 });
  });

  it('lookup: 문자열 숫자 값도 number 로 변환', () => {
    const op: RightOperand = {
      kind: 'lookup',
      surveyLookupId: 'lut-1',
      keyMapping: [{ lutKey: '대륙', attrsKey: '개최대륙' }],
    };
    const r = evaluateRightOperand(op, ctx({ 개최대륙: '북미' }));
    expect(r).toEqual({ ok: true, value: 2210000 });
  });

  it('lookup: surveyLookupId 가 lookups 에 없음', () => {
    const op: RightOperand = {
      kind: 'lookup',
      surveyLookupId: 'missing',
      keyMapping: [{ lutKey: '대륙', attrsKey: '개최대륙' }],
    };
    const r = evaluateRightOperand(op, ctx({ 개최대륙: '유럽' }));
    expect(r).toEqual({ ok: false, reason: 'lookup-not-found' });
  });

  it('lookup: attrs 에 매핑된 키 없음', () => {
    const op: RightOperand = {
      kind: 'lookup',
      surveyLookupId: 'lut-1',
      keyMapping: [{ lutKey: '대륙', attrsKey: '개최대륙' }],
    };
    const r = evaluateRightOperand(op, ctx({}));
    expect(r).toEqual({ ok: false, reason: 'attrs-key-missing' });
  });

  it('lookup: attrs 값으로 행 매칭 실패', () => {
    const op: RightOperand = {
      kind: 'lookup',
      surveyLookupId: 'lut-1',
      keyMapping: [{ lutKey: '대륙', attrsKey: '개최대륙' }],
    };
    const r = evaluateRightOperand(op, ctx({ 개최대륙: '남극' }));
    expect(r).toEqual({ ok: false, reason: 'lookup-row-not-matched' });
  });

  it('lookup: 행에 valueColumn 키 없음 → lookup-value-missing', () => {
    const lutNoValue: SurveyLookup = {
      ...LUT,
      rows: [{ 대륙: '유럽' }], // 2026년도_적용액 누락
    };
    const op: RightOperand = {
      kind: 'lookup',
      surveyLookupId: 'lut-1',
      keyMapping: [{ lutKey: '대륙', attrsKey: '개최대륙' }],
    };
    const r = evaluateRightOperand(op, {
      responses: {},
      contactAttrs: { 개최대륙: '유럽' },
      lookups: [lutNoValue],
    });
    expect(r).toEqual({ ok: false, reason: 'lookup-value-missing' });
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL**

Run: `pnpm vitest run tests/unit/lib/lookup/evaluate-lookup.test.ts`

Expected: FAIL — 모듈 not found.

- [ ] **Step 3: 구현**

```ts
// src/lib/lookup/evaluate-lookup.ts
import type { RightOperand } from '@/types/survey';
import { findLookupRow } from './lookup-row-matcher';
import type { EvalResult, LookupEvalCtx } from './types';

export function evaluateRightOperand(
  op: RightOperand,
  ctx: LookupEvalCtx,
): EvalResult<number> {
  if (op.kind === 'literal') {
    return { ok: true, value: op.value };
  }

  const lookup = ctx.lookups.find((l) => l.id === op.surveyLookupId);
  if (!lookup) return { ok: false, reason: 'lookup-not-found' };

  // keyMapping 으로 keys 만들기
  const keys: Record<string, string | undefined> = {};
  for (const { lutKey, attrsKey } of op.keyMapping) {
    const v = ctx.contactAttrs[attrsKey];
    if (v === undefined || v === '') {
      return { ok: false, reason: 'attrs-key-missing' };
    }
    keys[lutKey] = v;
  }

  const row = findLookupRow(lookup, keys);
  if (!row) return { ok: false, reason: 'lookup-row-not-matched' };

  const raw = row[lookup.valueColumn];
  if (raw === undefined || raw === null || raw === '') {
    return { ok: false, reason: 'lookup-value-missing' };
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    return { ok: false, reason: 'lookup-value-missing' };
  }
  return { ok: true, value: n };
}
```

- [ ] **Step 4: 테스트 재실행 → PASS**

Run: `pnpm vitest run tests/unit/lib/lookup/evaluate-lookup.test.ts`

Expected: PASS (7/7).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/lookup/evaluate-lookup.ts tests/unit/lib/lookup/evaluate-lookup.test.ts
git commit -m "feat: 우변 LUT 룩업 평가 pure 함수 + TDD 7케이스 추가"
```

---

### Task 7: `evaluate-comparison.ts` (pure, TDD)

**Files:**
- Create: `src/lib/lookup/evaluate-comparison.ts`
- Create: `tests/unit/lib/lookup/evaluate-comparison.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/unit/lib/lookup/evaluate-comparison.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateComparisonWithFailSafe } from '@/lib/lookup/evaluate-comparison';
import type { NumericComparison, SurveyLookup } from '@/types/survey';
import type { LookupEvalCtx } from '@/lib/lookup/types';

const LUT: SurveyLookup = {
  id: 'lut-1',
  name: 'avg',
  keyColumns: ['대륙'],
  valueColumn: 'v',
  rows: [{ 대륙: '유럽', v: 1000 }],
};

const baseCtx: LookupEvalCtx = {
  responses: { q1: { a: '500', b: '2' } },
  contactAttrs: { 개최대륙: '유럽' },
  lookups: [LUT],
};

describe('evaluateComparisonWithFailSafe', () => {
  it('binop / lookup: 만족', () => {
    const cmp: NumericComparison = {
      operator: '<=',
      left: {
        kind: 'binop',
        op: '/',
        left: { kind: 'cell', questionId: 'q1', cellId: 'a' },
        right: { kind: 'cell', questionId: 'q1', cellId: 'b' },
      },
      right: {
        kind: 'lookup',
        surveyLookupId: 'lut-1',
        keyMapping: [{ lutKey: '대륙', attrsKey: '개최대륙' }],
      },
    };
    const r = evaluateComparisonWithFailSafe(cmp, baseCtx);
    // 500 / 2 = 250 <= 1000 → satisfied true
    expect(r.satisfied).toBe(true);
    expect(r.failSafeShow).toBe(false);
    expect(r.reason).toBeUndefined();
  });

  it('binop / lookup: 불만족', () => {
    const cmp: NumericComparison = {
      operator: '<=',
      left: {
        kind: 'binop',
        op: '*',
        left: { kind: 'cell', questionId: 'q1', cellId: 'a' },
        right: { kind: 'cell', questionId: 'q1', cellId: 'b' },
      },
      right: {
        kind: 'lookup',
        surveyLookupId: 'lut-1',
        keyMapping: [{ lutKey: '대륙', attrsKey: '개최대륙' }],
      },
    };
    const r = evaluateComparisonWithFailSafe(cmp, baseCtx);
    // 500 * 2 = 1000 <= 1000 → true (boundary)
    expect(r.satisfied).toBe(true);
  });

  it('fail-safe: attrs 누락 시 satisfied=true (SHOW), failSafeShow=true, reason 포함', () => {
    const cmp: NumericComparison = {
      operator: '<',
      left: { kind: 'cell', questionId: 'q1', cellId: 'a' },
      right: {
        kind: 'lookup',
        surveyLookupId: 'lut-1',
        keyMapping: [{ lutKey: '대륙', attrsKey: '개최대륙' }],
      },
    };
    const r = evaluateComparisonWithFailSafe(cmp, {
      ...baseCtx,
      contactAttrs: {},
    });
    expect(r.satisfied).toBe(true);
    expect(r.failSafeShow).toBe(true);
    expect(r.reason).toBe('attrs-key-missing');
  });

  it('하위 호환: comparand (literal) 만 있는 기존 데이터', () => {
    const cmp: NumericComparison = {
      operator: '<',
      left: { kind: 'cell', questionId: 'q1', cellId: 'a' },
      comparand: { kind: 'literal', value: 1000 },
    };
    const r = evaluateComparisonWithFailSafe(cmp, baseCtx);
    expect(r.satisfied).toBe(true);
  });

  it('6 연산자 모두', () => {
    const mkCmp = (op: NumericComparison['operator']): NumericComparison => ({
      operator: op,
      left: { kind: 'literal', value: 10 } as never, // 캐스팅: 임시 literal 좌변 헬퍼 미사용
      right: { kind: 'literal', value: 10 },
    });
    // 우리 LeftOperand 는 literal 좌변을 직접 지원 안 함. 대신 cell 만 두 개 셋업.
    const ctx: LookupEvalCtx = {
      ...baseCtx,
      responses: { q1: { x: '10' } },
    };
    const mk = (op: NumericComparison['operator']): NumericComparison => ({
      operator: op,
      left: { kind: 'cell', questionId: 'q1', cellId: 'x' },
      right: { kind: 'literal', value: 10 },
    });
    expect(evaluateComparisonWithFailSafe(mk('=='), ctx).satisfied).toBe(true);
    expect(evaluateComparisonWithFailSafe(mk('!='), ctx).satisfied).toBe(false);
    expect(evaluateComparisonWithFailSafe(mk('<'), ctx).satisfied).toBe(false);
    expect(evaluateComparisonWithFailSafe(mk('<='), ctx).satisfied).toBe(true);
    expect(evaluateComparisonWithFailSafe(mk('>'), ctx).satisfied).toBe(false);
    expect(evaluateComparisonWithFailSafe(mk('>='), ctx).satisfied).toBe(true);
  });

  it('0 나누기 → fail-safe SHOW + divide-by-zero', () => {
    const ctx: LookupEvalCtx = {
      ...baseCtx,
      responses: { q1: { a: '100', b: '0' } },
    };
    const cmp: NumericComparison = {
      operator: '<',
      left: {
        kind: 'binop',
        op: '/',
        left: { kind: 'cell', questionId: 'q1', cellId: 'a' },
        right: { kind: 'cell', questionId: 'q1', cellId: 'b' },
      },
      right: { kind: 'literal', value: 1000 },
    };
    const r = evaluateComparisonWithFailSafe(cmp, ctx);
    expect(r.satisfied).toBe(true);
    expect(r.failSafeShow).toBe(true);
    expect(r.reason).toBe('divide-by-zero');
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL**

Run: `pnpm vitest run tests/unit/lib/lookup/evaluate-comparison.test.ts`

Expected: FAIL — 모듈 not found.

- [ ] **Step 3: 구현**

```ts
// src/lib/lookup/evaluate-comparison.ts
import type { NumericComparison } from '@/types/survey';
import { evaluateLeftOperand } from './evaluate-arith';
import { evaluateRightOperand } from './evaluate-lookup';
import type { FailReason, LookupEvalCtx } from './types';

export type ComparisonResult = {
  satisfied: boolean;       // 조건 평가 결과 (fail-safe 적용 후)
  failSafeShow: boolean;    // true 면 평가 실패로 SHOW 됨
  reason?: FailReason;      // failSafeShow 일 때만 채워짐
  // 빌더 디버그용 raw 값
  debug?: { leftValue?: number; rightValue?: number };
};

export function evaluateComparisonWithFailSafe(
  cmp: NumericComparison,
  ctx: LookupEvalCtx,
): ComparisonResult {
  // 좌변
  let left;
  if (cmp.left) {
    left = evaluateLeftOperand(cmp.left, ctx);
  } else {
    // 하위 호환: left 없음 → 이 함수 단독으로는 평가 불가
    // (branch-logic 통합 단계에서 cellValue 컨텍스트로 wrap 됨)
    return { satisfied: true, failSafeShow: true, reason: 'cell-value-missing' };
  }
  if (!left.ok) {
    return { satisfied: true, failSafeShow: true, reason: left.reason };
  }

  // 우변 (right 우선, 없으면 comparand 하위 호환)
  const rightOp = cmp.right ?? (cmp.comparand ? cmp.comparand : null);
  if (!rightOp) {
    return { satisfied: true, failSafeShow: true, reason: 'lookup-not-found' };
  }
  const right = evaluateRightOperand(rightOp, ctx);
  if (!right.ok) {
    return { satisfied: true, failSafeShow: true, reason: right.reason };
  }

  const L = left.value;
  const R = right.value;
  let satisfied = false;
  switch (cmp.operator) {
    case '==': satisfied = L === R; break;
    case '!=': satisfied = L !== R; break;
    case '<':  satisfied = L < R; break;
    case '<=': satisfied = L <= R; break;
    case '>':  satisfied = L > R; break;
    case '>=': satisfied = L >= R; break;
  }
  return {
    satisfied,
    failSafeShow: false,
    debug: { leftValue: L, rightValue: R },
  };
}
```

- [ ] **Step 4: 테스트 재실행 → PASS**

Run: `pnpm vitest run tests/unit/lib/lookup/evaluate-comparison.test.ts`

Expected: PASS (6/6).

- [ ] **Step 5: 전체 unit 테스트 회귀 확인**

Run: `pnpm vitest run tests/unit/`

Expected: 기존 통과 테스트 + 새 28개 모두 PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/lookup/evaluate-comparison.ts tests/unit/lib/lookup/evaluate-comparison.test.ts
git commit -m "feat: 산술+룩업 비교 결합 + fail-safe 판정 + TDD 6케이스 추가"
```

---

## Phase 3 — Server Actions

### Task 8: `lookup-actions.ts` — saved_lookups CRUD + Copy

**Files:**
- Create: `src/actions/lookup-actions.ts`

> 기존 패턴 참고: `src/actions/contact-attrs-actions.ts` (auth + ownership 검증), `src/actions/saved-questions-actions.ts` 같은 파일이 있다면 그쪽.

- [ ] **Step 1: 의존 함수 위치 확인**

Run: `grep -rn "requireAuth\|requireSurveyOwner" src/actions/ | head -5`

Expected: auth helper 위치 확인 (예: `src/lib/auth/require-auth.ts`).

- [ ] **Step 2: 구현 (CRUD + Copy + survey-level)**

```ts
// src/actions/lookup-actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';

import { db } from '@/db';
import { savedLookups, surveys } from '@/db/schema/surveys';
import { requireAuth } from '@/lib/auth/require-auth';
import { requireSurveyOwner } from '@/lib/auth/require-survey-owner';
import type { SavedLookup, SurveyLookup } from '@/types/survey';

const SavedLookupInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: z.string().min(1).max(100),
  tags: z.array(z.string()).default([]),
  keyColumns: z.array(z.string().min(1)).min(1),
  valueColumn: z.string().min(1),
  rows: z.array(z.record(z.union([z.string(), z.number()]))),
});

export async function listSavedLookupsAction(params: {
  category?: string;
  search?: string;
} = {}): Promise<SavedLookup[]> {
  await requireAuth();

  let q = db.select().from(savedLookups);
  if (params.category) {
    q = q.where(eq(savedLookups.category, params.category)) as typeof q;
  }
  const rows = await q;
  const filtered = params.search
    ? rows.filter((r) =>
        r.name.toLowerCase().includes(params.search!.toLowerCase()) ||
        (r.description ?? '').toLowerCase().includes(params.search!.toLowerCase()),
      )
    : rows;
  return filtered.map(toSavedLookup);
}

export async function createSavedLookupAction(
  input: z.infer<typeof SavedLookupInputSchema>,
): Promise<SavedLookup> {
  await requireAuth();
  const parsed = SavedLookupInputSchema.parse(input);
  const [row] = await db
    .insert(savedLookups)
    .values({
      name: parsed.name,
      description: parsed.description,
      category: parsed.category,
      tags: parsed.tags,
      keyColumns: parsed.keyColumns,
      valueColumn: parsed.valueColumn,
      rows: parsed.rows,
    })
    .returning();
  revalidatePath('/admin/surveys', 'layout');
  return toSavedLookup(row);
}

export async function updateSavedLookupAction(
  id: string,
  input: Partial<z.infer<typeof SavedLookupInputSchema>>,
): Promise<SavedLookup> {
  await requireAuth();
  const parsed = SavedLookupInputSchema.partial().parse(input);
  const [row] = await db
    .update(savedLookups)
    .set({
      ...parsed,
      updatedAt: new Date(),
    })
    .where(eq(savedLookups.id, id))
    .returning();
  if (!row) throw new Error('saved lookup not found');
  revalidatePath('/admin/surveys', 'layout');
  return toSavedLookup(row);
}

export async function deleteSavedLookupAction(id: string): Promise<void> {
  await requireAuth();
  await db.delete(savedLookups).where(eq(savedLookups.id, id));
  revalidatePath('/admin/surveys', 'layout');
}

export async function copySavedLookupToSurveyAction(
  surveyId: string,
  savedLookupId: string,
): Promise<SurveyLookup> {
  await requireSurveyOwner(surveyId);
  const [saved] = await db.select().from(savedLookups).where(eq(savedLookups.id, savedLookupId));
  if (!saved) throw new Error('saved lookup not found');

  const newLookup: SurveyLookup = {
    id: nanoid(),
    name: saved.name,
    sourceSavedLookupId: saved.id,
    keyColumns: saved.keyColumns,
    valueColumn: saved.valueColumn,
    rows: saved.rows,
  };

  const [survey] = await db.select({ lookups: surveys.lookups }).from(surveys).where(eq(surveys.id, surveyId));
  const next = [...(survey?.lookups ?? []), newLookup];

  await db.update(surveys).set({ lookups: next, updatedAt: new Date() }).where(eq(surveys.id, surveyId));
  await db.update(savedLookups).set({ usageCount: sql`${savedLookups.usageCount} + 1` }).where(eq(savedLookups.id, savedLookupId));

  revalidatePath(`/admin/surveys/${surveyId}`, 'layout');
  return newLookup;
}

export async function upsertSurveyLookupAction(
  surveyId: string,
  lookup: SurveyLookup,
): Promise<SurveyLookup> {
  await requireSurveyOwner(surveyId);
  const [survey] = await db.select({ lookups: surveys.lookups }).from(surveys).where(eq(surveys.id, surveyId));
  const list = survey?.lookups ?? [];
  const idx = list.findIndex((l) => l.id === lookup.id);
  const next = idx >= 0
    ? list.map((l, i) => (i === idx ? lookup : l))
    : [...list, { ...lookup, id: lookup.id || nanoid() }];

  await db.update(surveys).set({ lookups: next, updatedAt: new Date() }).where(eq(surveys.id, surveyId));
  revalidatePath(`/admin/surveys/${surveyId}`, 'layout');
  return next[idx >= 0 ? idx : next.length - 1];
}

export async function deleteSurveyLookupAction(
  surveyId: string,
  surveyLookupId: string,
): Promise<void> {
  await requireSurveyOwner(surveyId);
  const [survey] = await db.select({ lookups: surveys.lookups }).from(surveys).where(eq(surveys.id, surveyId));
  const next = (survey?.lookups ?? []).filter((l) => l.id !== surveyLookupId);
  await db.update(surveys).set({ lookups: next, updatedAt: new Date() }).where(eq(surveys.id, surveyId));
  revalidatePath(`/admin/surveys/${surveyId}`, 'layout');
}

function toSavedLookup(row: typeof savedLookups.$inferSelect): SavedLookup {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category,
    tags: row.tags,
    keyColumns: row.keyColumns,
    valueColumn: row.valueColumn,
    rows: row.rows,
    usageCount: row.usageCount,
    isPreset: row.isPreset,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
```

- [ ] **Step 3: 타입 체크 + 빌드**

Run: `pnpm tsc --noEmit`

Expected: PASS.

> auth helper 경로가 다르면 실제 프로젝트에 맞춰 import 수정.

- [ ] **Step 4: 커밋**

```bash
git add src/actions/lookup-actions.ts
git commit -m "feat: saved_lookups CRUD + 설문 LUT Copy/upsert/delete server actions 추가"
```

---

### Task 9: Integration test — lookup-actions

**Files:**
- Create: `tests/integration/lookup-actions.test.ts`

> 패턴 참고: `tests/integration/` 의 기존 server action 테스트. 메모 `vitest_tests_dir_only` — `tests/integration/` 디렉토리만 vitest 가 픽업.

- [ ] **Step 1: 기존 integration 테스트 셋업 패턴 read**

Run: `ls tests/integration/ | head -5 && cat tests/integration/$(ls tests/integration/ | grep -v fixtures | head -1) 2>/dev/null | head -40`

Expected: db setup / cleanup 패턴 확인 (보통 beforeAll / afterAll 로 surveys 와 user fixture 생성).

- [ ] **Step 2: 테스트 작성**

```ts
// tests/integration/lookup-actions.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db';
import { savedLookups, surveys } from '@/db/schema/surveys';
import { eq } from 'drizzle-orm';
import {
  createSavedLookupAction,
  listSavedLookupsAction,
  copySavedLookupToSurveyAction,
  upsertSurveyLookupAction,
  deleteSurveyLookupAction,
  deleteSavedLookupAction,
} from '@/actions/lookup-actions';

// auth helpers 모킹은 setup.ts 또는 vi.mock 으로 처리.
// 기존 다른 server action 통합 테스트가 사용하는 패턴 그대로 재사용.

let surveyId: string;
let savedLookupId: string;

beforeAll(async () => {
  // 테스트 설문 생성 (기존 헬퍼 또는 raw insert)
  const [row] = await db
    .insert(surveys)
    .values({
      title: 'lookup test survey',
      slug: 'lookup-test-' + Date.now(),
      lookups: [],
    } as never)
    .returning();
  surveyId = row.id;
});

afterAll(async () => {
  await db.delete(surveys).where(eq(surveys.id, surveyId));
  if (savedLookupId) {
    await db.delete(savedLookups).where(eq(savedLookups.id, savedLookupId));
  }
});

describe('lookup-actions integration', () => {
  it('createSavedLookupAction → listSavedLookupsAction 으로 조회', async () => {
    const created = await createSavedLookupAction({
      name: 'avg-airfare-2026',
      category: 'finance',
      tags: ['항공'],
      keyColumns: ['대륙'],
      valueColumn: '2026년도_적용액',
      rows: [
        { 대륙: '유럽', '2026년도_적용액': 2470000 },
        { 대륙: '아시아', '2026년도_적용액': 800000 },
      ],
    });
    savedLookupId = created.id;

    const list = await listSavedLookupsAction({ category: 'finance' });
    expect(list.find((l) => l.id === savedLookupId)).toBeDefined();
  });

  it('copySavedLookupToSurveyAction → surveys.lookups 에 사본 추가 + usageCount 증가', async () => {
    const copied = await copySavedLookupToSurveyAction(surveyId, savedLookupId);
    expect(copied.sourceSavedLookupId).toBe(savedLookupId);
    expect(copied.id).not.toBe(savedLookupId);

    const [survey] = await db.select({ lookups: surveys.lookups }).from(surveys).where(eq(surveys.id, surveyId));
    expect(survey.lookups).toHaveLength(1);

    const [saved] = await db.select().from(savedLookups).where(eq(savedLookups.id, savedLookupId));
    expect(saved.usageCount).toBe(1);
  });

  it('upsertSurveyLookupAction → 행 수정', async () => {
    const [survey] = await db.select({ lookups: surveys.lookups }).from(surveys).where(eq(surveys.id, surveyId));
    const existing = survey.lookups[0];
    const updated = await upsertSurveyLookupAction(surveyId, {
      ...existing,
      rows: [...existing.rows, { 대륙: '북미', '2026년도_적용액': 2210000 }],
    });
    expect(updated.rows).toHaveLength(3);
  });

  it('deleteSurveyLookupAction → 사본 제거', async () => {
    const [survey] = await db.select({ lookups: surveys.lookups }).from(surveys).where(eq(surveys.id, surveyId));
    await deleteSurveyLookupAction(surveyId, survey.lookups[0].id);
    const [after] = await db.select({ lookups: surveys.lookups }).from(surveys).where(eq(surveys.id, surveyId));
    expect(after.lookups).toHaveLength(0);
  });

  it('deleteSavedLookupAction → 보관함 삭제', async () => {
    await deleteSavedLookupAction(savedLookupId);
    const remaining = await listSavedLookupsAction({ category: 'finance' });
    expect(remaining.find((l) => l.id === savedLookupId)).toBeUndefined();
    savedLookupId = ''; // afterAll cleanup 스킵
  });
});
```

- [ ] **Step 3: 실행 → PASS**

Run: `pnpm vitest run tests/integration/lookup-actions.test.ts`

Expected: PASS (5/5).

- [ ] **Step 4: 커밋**

```bash
git add tests/integration/lookup-actions.test.ts
git commit -m "test: lookup-actions CRUD + Copy 흐름 integration test 5케이스 추가"
```

---

## Phase 4 — 보관함 UI

### Task 10: `lookup-edit-modal.tsx` — 인라인 테이블 + 붙여넣기

**Files:**
- Create: `src/components/survey-builder/lookup-edit-modal.tsx`

- [ ] **Step 1: shadcn Dialog + Table 컴포넌트 위치 확인**

Run: `ls src/components/ui/dialog.tsx src/components/ui/table.tsx 2>&1`

Expected: 두 파일 존재.

- [ ] **Step 2: 구현**

```tsx
// src/components/survey-builder/lookup-edit-modal.tsx
'use client';

import { useState, useCallback, ChangeEvent } from 'react';
import { Trash2, Plus, ClipboardPaste } from 'lucide-react';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseNumericInput } from '@/utils/numeric-input';
import type { SavedLookup, SurveyLookup } from '@/types/survey';

type LookupDraft = Pick<SavedLookup, 'name' | 'description' | 'category' | 'tags' | 'keyColumns' | 'valueColumn' | 'rows'>;

interface Props {
  isOpen: boolean;
  initialValue?: Partial<LookupDraft>;
  onClose: () => void;
  onSave: (draft: LookupDraft) => Promise<void> | void;
}

export function LookupEditModal({ isOpen, initialValue, onClose, onSave }: Props) {
  const [name, setName] = useState(initialValue?.name ?? '');
  const [description, setDescription] = useState(initialValue?.description ?? '');
  const [category, setCategory] = useState(initialValue?.category ?? 'custom');
  const [keyColumns, setKeyColumns] = useState<string[]>(initialValue?.keyColumns ?? ['키']);
  const [valueColumn, setValueColumn] = useState(initialValue?.valueColumn ?? '값');
  const [rows, setRows] = useState<Array<Record<string, string | number>>>(
    initialValue?.rows ?? [],
  );
  const [error, setError] = useState<string | null>(null);

  const allColumns = [...keyColumns, valueColumn];

  const handleAddRow = () => {
    const empty: Record<string, string | number> = {};
    allColumns.forEach((c) => (empty[c] = ''));
    setRows([...rows, empty]);
  };

  const handleCellChange = (rowIdx: number, col: string, value: string) => {
    const next = [...rows];
    next[rowIdx] = { ...next[rowIdx], [col]: value };
    setRows(next);
  };

  const handleDeleteRow = (rowIdx: number) => {
    setRows(rows.filter((_, i) => i !== rowIdx));
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
    const parsed = lines.map((line) => {
      const cells = line.split('\t');
      const row: Record<string, string | number> = {};
      allColumns.forEach((col, idx) => {
        row[col] = cells[idx] ?? '';
      });
      return row;
    });
    setRows([...rows, ...parsed]);
  }, [rows, allColumns]);

  const validate = (): string | null => {
    if (!name.trim()) return '이름을 입력하세요';
    if (keyColumns.length === 0 || keyColumns.some((k) => !k.trim())) return '키 컬럼 이름을 모두 입력하세요';
    if (!valueColumn.trim()) return '값 컬럼 이름을 입력하세요';
    if (rows.length === 0) return '최소 한 개의 행이 필요합니다';
    for (const [i, r] of rows.entries()) {
      for (const k of keyColumns) {
        if (!String(r[k] ?? '').trim()) return `${i + 1}행: ${k} 가 비어있습니다`;
      }
      const v = parseNumericInput(String(r[valueColumn] ?? ''));
      if (v === null) return `${i + 1}행: ${valueColumn} 가 숫자가 아닙니다`;
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    // 직렬화: 키 컬럼 string, 값 컬럼 number
    const normalizedRows = rows.map((r) => {
      const out: Record<string, string | number> = {};
      for (const k of keyColumns) out[k] = String(r[k] ?? '').trim();
      out[valueColumn] = parseNumericInput(String(r[valueColumn] ?? ''))!;
      return out;
    });
    await onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      tags: initialValue?.tags ?? [],
      keyColumns: keyColumns.map((k) => k.trim()),
      valueColumn: valueColumn.trim(),
      rows: normalizedRows,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>외부 데이터 (LUT) 편집</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label>설명 (선택)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Label>키 컬럼</Label>
              <div className="flex flex-wrap gap-2">
                {keyColumns.map((k, i) => (
                  <Input
                    key={i}
                    value={k}
                    onChange={(e) => {
                      const next = [...keyColumns];
                      next[i] = e.target.value;
                      setKeyColumns(next);
                    }}
                    className="w-32"
                  />
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setKeyColumns([...keyColumns, '키' + (keyColumns.length + 1)])}
                >
                  + 키 컬럼
                </Button>
              </div>
            </div>
            <div className="flex-1">
              <Label>값 컬럼</Label>
              <Input value={valueColumn} onChange={(e) => setValueColumn(e.target.value)} />
            </div>
          </div>

          <div onPaste={handlePaste}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {allColumns.map((c) => (
                    <th key={c} className="border px-2 py-1 bg-gray-50 text-sm">{c}</th>
                  ))}
                  <th className="border px-2 py-1 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri}>
                    {allColumns.map((c) => (
                      <td key={c} className="border p-0">
                        <Input
                          value={String(row[c] ?? '')}
                          onChange={(e) => handleCellChange(ri, c, e.target.value)}
                          className="border-0 rounded-none h-8"
                        />
                      </td>
                    ))}
                    <td className="border text-center">
                      <button onClick={() => handleDeleteRow(ri)} className="text-gray-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={handleAddRow}>
                <Plus size={14} className="mr-1" /> 행 추가
              </Button>
              <span className="text-xs text-gray-500 self-center">
                <ClipboardPaste size={12} className="inline mr-1" />
                엑셀 영역을 복사 후 표 위에 붙여넣으면 자동 채워집니다.
              </span>
            </div>
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={handleSave}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: 빌드/타입 체크**

Run: `pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 4: 커밋**

```bash
git add src/components/survey-builder/lookup-edit-modal.tsx
git commit -m "feat: LUT 인라인 편집 모달 + 엑셀 붙여넣기 행 자동 채움 구현"
```

---

### Task 11: `lookup-csv-import.tsx` — 4-step 엑셀/CSV 업로드 다이얼로그

**Files:**
- Create: `src/components/survey-builder/lookup-csv-import.tsx`

> exceljs 의존성 확인 필요. 컨택 업로드에서 이미 사용 중일 것.

- [ ] **Step 1: exceljs 사용 위치 확인**

Run: `grep -rn "from 'exceljs'" src/ | head -3`

Expected: 컨택 업로드 모듈에서 사용 중. import 패턴 확인.

- [ ] **Step 2: 구현**

```tsx
// src/components/survey-builder/lookup-csv-import.tsx
'use client';

import { useState, ChangeEvent } from 'react';
import ExcelJS from 'exceljs';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { parseNumericInput } from '@/utils/numeric-input';

type Step = 'pick-file' | 'map-columns' | 'preview' | 'done';

interface ImportResult {
  keyColumns: string[];
  valueColumn: string;
  rows: Array<Record<string, string | number>>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (result: ImportResult) => void;
}

export function LookupCsvImport({ isOpen, onClose, onImport }: Props) {
  const [step, setStep] = useState<Step>('pick-file');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep('pick-file');
    setHeaders([]); setRawRows([]);
    setSelectedKeys([]); setSelectedValue('');
    setError(null);
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      let parsed: { headers: string[]; rows: string[][] };
      if (f.name.endsWith('.csv')) {
        const text = await f.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        parsed = {
          headers: lines[0].split(',').map((s) => s.trim()),
          rows: lines.slice(1).map((l) => l.split(',').map((s) => s.trim())),
        };
      } else {
        const buf = await f.arrayBuffer();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf);
        const ws = wb.worksheets[0];
        const allRows: string[][] = [];
        ws.eachRow((row) => {
          allRows.push((row.values as unknown[]).slice(1).map((v) => String(v ?? '').trim()));
        });
        parsed = { headers: allRows[0] ?? [], rows: allRows.slice(1) };
      }
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);
      setStep('map-columns');
    } catch (err) {
      setError(`파일 읽기 실패: ${(err as Error).message}`);
    }
  };

  const handleConfirmMapping = () => {
    if (selectedKeys.length === 0) { setError('키 컬럼을 1개 이상 선택하세요'); return; }
    if (!selectedValue) { setError('값 컬럼을 선택하세요'); return; }
    if (selectedKeys.includes(selectedValue)) { setError('값 컬럼은 키 컬럼과 다른 컬럼이어야 합니다'); return; }
    setError(null);
    setStep('preview');
  };

  const buildResult = (): ImportResult | null => {
    const rows: Array<Record<string, string | number>> = [];
    for (const [i, raw] of rawRows.entries()) {
      const row: Record<string, string | number> = {};
      for (const k of selectedKeys) {
        const idx = headers.indexOf(k);
        const v = String(raw[idx] ?? '').trim();
        if (!v) { setError(`${i + 1}행: 키 ${k} 가 비어있습니다`); return null; }
        row[k] = v;
      }
      const vIdx = headers.indexOf(selectedValue);
      const numeric = parseNumericInput(String(raw[vIdx] ?? ''));
      if (numeric === null) { setError(`${i + 1}행: ${selectedValue} 가 숫자가 아닙니다`); return null; }
      row[selectedValue] = numeric;
      rows.push(row);
    }
    return { keyColumns: selectedKeys, valueColumn: selectedValue, rows };
  };

  const handleConfirmPreview = () => {
    const result = buildResult();
    if (!result) return;
    onImport(result);
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>엑셀/CSV 에서 LUT 가져오기 ({step})</DialogTitle>
        </DialogHeader>

        {step === 'pick-file' && (
          <div className="space-y-2">
            <Label>파일 선택 (.xlsx / .csv)</Label>
            <input type="file" accept=".xlsx,.csv" onChange={handleFile} />
          </div>
        )}

        {step === 'map-columns' && (
          <div className="space-y-3">
            <div>
              <Label>키 컬럼 (다중 선택)</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {headers.map((h) => (
                  <label key={h} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedKeys.includes(h)}
                      onChange={(e) => {
                        setSelectedKeys(
                          e.target.checked
                            ? [...selectedKeys, h]
                            : selectedKeys.filter((k) => k !== h),
                        );
                      }}
                    />
                    {h}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>값 컬럼</Label>
              <Select value={selectedValue} onValueChange={setSelectedValue}>
                <SelectTrigger><SelectValue placeholder="컬럼 선택" /></SelectTrigger>
                <SelectContent>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-2">
            <Label>미리보기 ({rawRows.length} 행)</Label>
            <table className="w-full text-sm border-collapse border">
              <thead>
                <tr>
                  {[...selectedKeys, selectedValue].map((c) => (
                    <th key={c} className="border px-2 py-1 bg-gray-50">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawRows.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    {[...selectedKeys, selectedValue].map((c) => (
                      <td key={c} className="border px-2 py-1">{r[headers.indexOf(c)] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rawRows.length > 10 && <div className="text-xs text-gray-500">처음 10행만 표시</div>}
          </div>
        )}

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <DialogFooter>
          {step === 'pick-file' && <Button variant="ghost" onClick={onClose}>취소</Button>}
          {step === 'map-columns' && (
            <>
              <Button variant="ghost" onClick={() => setStep('pick-file')}>이전</Button>
              <Button onClick={handleConfirmMapping}>다음</Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="ghost" onClick={() => setStep('map-columns')}>이전</Button>
              <Button onClick={handleConfirmPreview}>적용</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: 빌드 체크**

Run: `pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 4: 커밋**

```bash
git add src/components/survey-builder/lookup-csv-import.tsx
git commit -m "feat: 엑셀/CSV 4-step 업로드 다이얼로그 (파일→매핑→미리보기→적용) 구현"
```

---

### Task 12: `lookup-library-section.tsx` + `question-library-panel` 컴포지션

**Files:**
- Create: `src/components/survey-builder/lookup-library-section.tsx`
- Modify: `src/components/survey-builder/question-library-panel.tsx` (LookupLibrarySection 컴포지션)

- [ ] **Step 1: 기존 `question-library-panel.tsx` 구조 read**

Run: `cat src/components/survey-builder/question-library-panel.tsx | head -80`

Expected: 카테고리 트리 렌더 부분 + 하단 "내보내기/가져오기" 위치 확인.

- [ ] **Step 2: `LookupLibrarySection` 작성**

```tsx
// src/components/survey-builder/lookup-library-section.tsx
'use client';

import { useEffect, useState } from 'react';
import { Database, Plus, Upload, ChevronRight, ChevronDown } from 'lucide-react';

import {
  listSavedLookupsAction,
  createSavedLookupAction,
  copySavedLookupToSurveyAction,
} from '@/actions/lookup-actions';
import { Button } from '@/components/ui/button';
import { useSurveyBuilderStore } from '@/stores/survey-store';
import type { SavedLookup } from '@/types/survey';

import { LookupEditModal } from './lookup-edit-modal';
import { LookupCsvImport } from './lookup-csv-import';

const LUT_CATEGORIES = [
  { key: 'finance', label: '재무 참조 LUT', icon: '💰' },
  { key: 'demographics', label: '인구통계 LUT', icon: '👥' },
  { key: 'custom', label: '사용자 정의 LUT', icon: '📂' },
];

export function LookupLibrarySection() {
  const surveyId = useSurveyBuilderStore((s) => s.currentSurvey.id);
  const [items, setItems] = useState<SavedLookup[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editOpen, setEditOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [editInitial, setEditInitial] = useState<Partial<SavedLookup> | undefined>();

  const reload = async () => {
    const list = await listSavedLookupsAction();
    setItems(list);
  };

  useEffect(() => { void reload(); }, []);

  const countBy = (cat: string) => items.filter((i) => i.category === cat).length;

  const handleNew = () => { setEditInitial(undefined); setEditOpen(true); };
  const handleCsvImported = (result: { keyColumns: string[]; valueColumn: string; rows: Array<Record<string, string | number>> }) => {
    setEditInitial({ ...result, name: '', category: 'custom', tags: [] });
    setEditOpen(true);
  };

  const handleSave = async (draft: Omit<SavedLookup, 'id' | 'usageCount' | 'isPreset' | 'createdAt' | 'updatedAt'>) => {
    await createSavedLookupAction(draft);
    setEditOpen(false);
    await reload();
  };

  const handleLoad = async (savedLookupId: string) => {
    if (!surveyId) return;
    await copySavedLookupToSurveyAction(surveyId, savedLookupId);
    await reload();
  };

  return (
    <div className="border-t pt-3 mt-3">
      <div className="px-3 py-2 text-sm font-semibold flex items-center gap-2">
        <Database size={14} /> 외부 데이터
      </div>

      {LUT_CATEGORIES.map((cat) => {
        const list = items.filter((i) => i.category === cat.key);
        const isOpen = expanded[cat.key];
        return (
          <div key={cat.key}>
            <button
              className="w-full px-3 py-1.5 flex items-center justify-between text-sm hover:bg-gray-50"
              onClick={() => setExpanded({ ...expanded, [cat.key]: !isOpen })}
            >
              <span className="flex items-center gap-1">
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </span>
              <span className="text-gray-500 text-xs">{list.length}</span>
            </button>
            {isOpen && (
              <ul className="pl-7 pr-3 pb-2 space-y-1">
                {list.map((lut) => (
                  <li key={lut.id} className="flex items-center justify-between group">
                    <span className="text-sm truncate" title={lut.name}>{lut.name}</span>
                    <button
                      className="opacity-0 group-hover:opacity-100 text-xs text-blue-600 hover:underline"
                      onClick={() => void handleLoad(lut.id)}
                    >
                      불러오기
                    </button>
                  </li>
                ))}
                {list.length === 0 && (
                  <li className="text-xs text-gray-400">등록된 항목 없음</li>
                )}
              </ul>
            )}
          </div>
        );
      })}

      <div className="px-3 pt-2 flex gap-2">
        <Button variant="outline" size="sm" onClick={handleNew}>
          <Plus size={12} className="mr-1" /> 새 LUT
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}>
          <Upload size={12} className="mr-1" /> 엑셀 가져오기
        </Button>
      </div>

      <LookupEditModal
        isOpen={editOpen}
        initialValue={editInitial}
        onClose={() => setEditOpen(false)}
        onSave={handleSave}
      />
      <LookupCsvImport
        isOpen={csvOpen}
        onClose={() => setCsvOpen(false)}
        onImport={handleCsvImported}
      />
    </div>
  );
}
```

- [ ] **Step 3: `question-library-panel.tsx` 에 컴포지션**

`question-library-panel.tsx` 맨 아래 (혹은 "내보내기/가져오기" 버튼 바로 위) 에 다음 import + 렌더 추가:

```tsx
import { LookupLibrarySection } from './lookup-library-section';

// 카테고리 트리 JSX 마지막에 추가:
<LookupLibrarySection />
```

- [ ] **Step 4: 빌더 페이지에서 시각 확인 (수동)**

Run: `pnpm dev` 로 dev 서버 띄우고 `/admin/surveys/<id>/edit` 진입 → 보관함 탭 → "외부 데이터" 섹션 노출 + "+ 새 LUT" 클릭 시 모달 오픈.

Expected: UI 정상 렌더, 카테고리 펼치기 OK, "새 LUT" 모달 오픈, 저장 후 목록에 반영.

- [ ] **Step 5: 커밋**

```bash
git add src/components/survey-builder/lookup-library-section.tsx src/components/survey-builder/question-library-panel.tsx
git commit -m "feat: 보관함 패널 하단에 외부 데이터 LUT 섹션 컴포지션 추가"
```

---

## Phase 5 — 조건 에디터 UI

### Task 13: `sample-contact-selector.tsx` + `left-operand-editor.tsx`

**Files:**
- Create: `src/components/survey-builder/sample-contact-selector.tsx`
- Create: `src/components/survey-builder/left-operand-editor.tsx`

- [ ] **Step 1: 컨택 attrs context + actions 확인**

Run: `grep -n "ContactAttrsProvider\|lookupContactAttrs\|listContactsForSurvey" src/lib/survey/contact-attrs-context.tsx src/actions/contact-attrs-actions.ts 2>/dev/null | head -10`

Expected: `lookupContactAttrs(token)` 같은 단일 조회 + 목록 server action 위치.

- [ ] **Step 2: `SampleContactSelector` 구현**

```tsx
// src/components/survey-builder/sample-contact-selector.tsx
'use client';

import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSurveyBuilderStore } from '@/stores/survey-store';
// 기존 컨택 목록 server action 이름이 다르면 교체
import { listContactsForSampleAction } from '@/actions/contact-attrs-actions';

interface Props {
  value: string | null;            // contactId
  onChange: (contactId: string | null, attrs: Record<string, string>) => void;
}

export function SampleContactSelector({ value, onChange }: Props) {
  const surveyId = useSurveyBuilderStore((s) => s.currentSurvey.id);
  const [list, setList] = useState<Array<{ id: string; label: string; attrs: Record<string, string> }>>([]);

  useEffect(() => {
    if (!surveyId) return;
    void (async () => {
      const rows = await listContactsForSampleAction(surveyId, 50);
      setList(rows);
    })();
  }, [surveyId]);

  return (
    <Select
      value={value ?? '__none__'}
      onValueChange={(v) => {
        if (v === '__none__') { onChange(null, {}); return; }
        const found = list.find((r) => r.id === v);
        onChange(v, found?.attrs ?? {});
      }}
    >
      <SelectTrigger className="w-64"><SelectValue placeholder="테스트 컨택 선택" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">미선택 (익명)</SelectItem>
        {list.map((r) => (
          <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

> 만약 `listContactsForSampleAction` 이 없으면 `src/actions/contact-attrs-actions.ts` 에 추가:
>
> ```ts
> export async function listContactsForSampleAction(surveyId: string, limit = 50) {
>   await requireSurveyOwner(surveyId);
>   const rows = await db.select().from(contactTargets).where(eq(contactTargets.surveyId, surveyId)).limit(limit);
>   return rows.map((r) => ({
>     id: r.id,
>     label: `${r.email ?? r.bizNumber ?? r.id.slice(0, 8)}`,
>     attrs: (r.attrs as Record<string, string>) ?? {},
>   }));
> }
> ```

- [ ] **Step 3: `LeftOperandEditor` 구현**

```tsx
// src/components/survey-builder/left-operand-editor.tsx
'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useSurveyBuilderStore } from '@/stores/survey-store';
import type { CellRef, LeftOperand, Question, TableCell } from '@/types/survey';

interface Props {
  value: LeftOperand;
  onChange: (next: LeftOperand) => void;
}

function collectInputCells(questions: Question[]): Array<{ label: string; cellRef: CellRef }> {
  const out: Array<{ label: string; cellRef: CellRef }> = [];
  for (const q of questions) {
    if (q.type !== 'table' || !q.tableRowsData) continue;
    for (const row of q.tableRowsData) {
      for (const c of row.cells ?? []) {
        if ((c as TableCell).type === 'input') {
          out.push({
            label: `${q.title} > ${row.label ?? row.id.slice(0, 6)} / ${c.label ?? c.id.slice(0, 6)}`,
            cellRef: { kind: 'cell', questionId: q.id, cellId: c.id },
          });
        }
      }
    }
  }
  return out;
}

export function LeftOperandEditor({ value, onChange }: Props) {
  const questions = useSurveyBuilderStore((s) => s.currentSurvey.questions);
  const cells = collectInputCells(questions);

  const findLabel = (ref: CellRef) =>
    cells.find((c) => c.cellRef.questionId === ref.questionId && c.cellRef.cellId === ref.cellId)?.label ?? '미선택';

  const isBinop = value.kind === 'binop';

  const onModeChange = (mode: 'cell' | 'binop') => {
    if (mode === 'cell') {
      onChange({ kind: 'cell', questionId: '', cellId: '' });
    } else {
      onChange({
        kind: 'binop',
        op: '/',
        left: { kind: 'cell', questionId: '', cellId: '' },
        right: { kind: 'cell', questionId: '', cellId: '' },
      });
    }
  };

  const renderCellSelect = (ref: CellRef, on: (next: CellRef) => void) => (
    <Select
      value={`${ref.questionId}::${ref.cellId}`}
      onValueChange={(v) => {
        const [q, c] = v.split('::');
        on({ kind: 'cell', questionId: q, cellId: c });
      }}
    >
      <SelectTrigger className="w-full"><SelectValue placeholder="셀 선택" /></SelectTrigger>
      <SelectContent>
        {cells.map((c) => (
          <SelectItem key={`${c.cellRef.questionId}::${c.cellRef.cellId}`} value={`${c.cellRef.questionId}::${c.cellRef.cellId}`}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-2">
      <RadioGroup
        value={isBinop ? 'binop' : 'cell'}
        onValueChange={(v) => onModeChange(v as 'cell' | 'binop')}
        className="flex gap-4"
      >
        <Label className="flex items-center gap-1"><RadioGroupItem value="cell" /> 단일 셀</Label>
        <Label className="flex items-center gap-1"><RadioGroupItem value="binop" /> 셀 산술 (셀 + 셀/숫자)</Label>
      </RadioGroup>

      {!isBinop && renderCellSelect(value, (next) => onChange(next))}

      {isBinop && (
        <div className="grid grid-cols-[1fr_80px_1fr] gap-2 items-center">
          {renderCellSelect(value.left, (next) => onChange({ ...value, left: next }))}
          <Select
            value={value.op}
            onValueChange={(op) => onChange({ ...value, op: op as '/' | '*' | '+' | '-' })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(['+', '-', '*', '/'] as const).map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {value.right.kind === 'cell' ? (
            renderCellSelect(value.right, (next) => onChange({ ...value, right: next }))
          ) : (
            <Input
              type="number"
              value={value.right.value}
              onChange={(e) => onChange({
                ...value,
                right: { kind: 'literal', value: Number(e.target.value) },
              })}
            />
          )}
          <span />
          <Select
            value={value.right.kind}
            onValueChange={(k) => onChange({
              ...value,
              right: k === 'cell'
                ? { kind: 'cell', questionId: '', cellId: '' }
                : { kind: 'literal', value: 0 },
            })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cell">셀</SelectItem>
              <SelectItem value="literal">숫자</SelectItem>
            </SelectContent>
          </Select>
          <span />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 빌드 체크**

Run: `pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/components/survey-builder/sample-contact-selector.tsx src/components/survey-builder/left-operand-editor.tsx src/actions/contact-attrs-actions.ts
git commit -m "feat: 테스트 모드 sample 컨택 셀렉터 + 좌변 단일셀/binop 에디터 추가"
```

---

### Task 14: `lookup-selector.tsx` + `lookup-key-mapping-editor.tsx` + `lookup-comparand-editor.tsx`

**Files:**
- Create: `src/components/survey-builder/lookup-selector.tsx`
- Create: `src/components/survey-builder/lookup-key-mapping-editor.tsx`
- Create: `src/components/survey-builder/lookup-comparand-editor.tsx`

- [ ] **Step 1: 구현 — `lookup-selector.tsx`**

```tsx
// src/components/survey-builder/lookup-selector.tsx
'use client';

import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useSurveyBuilderStore } from '@/stores/survey-store';
import type { SurveyLookup } from '@/types/survey';
import { LookupEditModal } from './lookup-edit-modal';
import { upsertSurveyLookupAction } from '@/actions/lookup-actions';
import { nanoid } from 'nanoid';

interface Props {
  value: string;   // surveyLookupId
  onChange: (id: string, lookup: SurveyLookup) => void;
}

export function LookupSelector({ value, onChange }: Props) {
  const surveyId = useSurveyBuilderStore((s) => s.currentSurvey.id);
  const lookups = useSurveyBuilderStore((s) => s.currentSurvey.lookups ?? []);
  const refetch = useSurveyBuilderStore((s) => s.refetchSurvey ?? (() => {}));
  const [editOpen, setEditOpen] = useState(false);

  const handleQuickCreate = async (draft: Omit<SurveyLookup, 'id'>) => {
    if (!surveyId) return;
    const saved = await upsertSurveyLookupAction(surveyId, { ...draft, id: nanoid() });
    setEditOpen(false);
    await refetch();
    onChange(saved.id, saved);
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Select
          value={value || '__none__'}
          onValueChange={(v) => {
            if (v === '__none__') return;
            const found = lookups.find((l) => l.id === v);
            if (found) onChange(v, found);
          }}
        >
          <SelectTrigger className="flex-1"><SelectValue placeholder="설문에 등록된 LUT 선택" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" disabled>— 미선택 —</SelectItem>
            {lookups.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>+ 새 LUT</Button>
      </div>
      {lookups.length === 0 && (
        <div className="text-xs text-gray-500">
          이 설문에 등록된 LUT 이 없습니다. 보관함에서 불러오거나 직접 만드세요.
        </div>
      )}
      <LookupEditModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={(draft) => handleQuickCreate({
          name: draft.name,
          keyColumns: draft.keyColumns,
          valueColumn: draft.valueColumn,
          rows: draft.rows,
        })}
      />
    </div>
  );
}
```

- [ ] **Step 2: 구현 — `lookup-key-mapping-editor.tsx`**

```tsx
// src/components/survey-builder/lookup-key-mapping-editor.tsx
'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useSurveyBuilderStore } from '@/stores/survey-store';

interface Props {
  lutKeys: string[];
  value: Array<{ lutKey: string; attrsKey: string }>;
  onChange: (next: Array<{ lutKey: string; attrsKey: string }>) => void;
}

export function LookupKeyMappingEditor({ lutKeys, value, onChange }: Props) {
  const contactColumns = useSurveyBuilderStore((s) => s.currentSurvey.contactColumns?.columns ?? []);

  // value 를 lutKeys 와 동기화 (lutKey 변동 시)
  const normalized = lutKeys.map((k) => value.find((v) => v.lutKey === k) ?? { lutKey: k, attrsKey: '' });

  const setRow = (lutKey: string, attrsKey: string) => {
    const next = normalized.map((r) => (r.lutKey === lutKey ? { ...r, attrsKey } : r));
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">키 매핑</div>
      {normalized.map((row) => {
        const isInColumns = contactColumns.some((c) => c.key === row.attrsKey);
        return (
          <div key={row.lutKey} className="grid grid-cols-[120px_1fr] gap-2 items-center">
            <div className="text-sm">LUT 키 「{row.lutKey}」</div>
            <div className="flex items-center gap-2">
              <Select
                value={row.attrsKey || '__custom__'}
                onValueChange={(v) => setRow(row.lutKey, v === '__custom__' ? '' : v)}
              >
                <SelectTrigger className="w-48"><SelectValue placeholder="컨택 속성 선택" /></SelectTrigger>
                <SelectContent>
                  {contactColumns.map((c) => (
                    <SelectItem key={c.key} value={c.key}>{c.label ?? c.key}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">직접 입력…</SelectItem>
                </SelectContent>
              </Select>
              {!isInColumns && (
                <Input
                  value={row.attrsKey}
                  placeholder="attrs 키 직접 입력"
                  onChange={(e) => setRow(row.lutKey, e.target.value)}
                  className="w-40"
                />
              )}
              {row.attrsKey && !isInColumns && (
                <span className="text-xs text-amber-600">
                  ⚠ 컨택 컬럼에 없는 키입니다. 응답 시 attrs 에 이 키가 없으면 fail-safe SHOW 됩니다.
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: 구현 — `lookup-comparand-editor.tsx`**

```tsx
// src/components/survey-builder/lookup-comparand-editor.tsx
'use client';

import { useSurveyBuilderStore } from '@/stores/survey-store';
import type { RightOperand } from '@/types/survey';

import { LookupSelector } from './lookup-selector';
import { LookupKeyMappingEditor } from './lookup-key-mapping-editor';

interface Props {
  value: Extract<RightOperand, { kind: 'lookup' }>;
  onChange: (next: Extract<RightOperand, { kind: 'lookup' }>) => void;
}

export function LookupComparandEditor({ value, onChange }: Props) {
  const lookups = useSurveyBuilderStore((s) => s.currentSurvey.lookups ?? []);
  const selected = lookups.find((l) => l.id === value.surveyLookupId);

  return (
    <div className="space-y-3 border rounded p-3 bg-gray-50/50">
      <div className="text-sm font-medium">외부 데이터 룩업</div>

      <LookupSelector
        value={value.surveyLookupId}
        onChange={(id, lookup) => onChange({
          ...value,
          surveyLookupId: id,
          keyMapping: lookup.keyColumns.map((k) => ({ lutKey: k, attrsKey: '' })),
        })}
      />

      {selected && (
        <>
          <LookupKeyMappingEditor
            lutKeys={selected.keyColumns}
            value={value.keyMapping}
            onChange={(km) => onChange({ ...value, keyMapping: km })}
          />
          <div className="text-xs text-gray-600">
            비교 대상: 「{selected.valueColumn}」
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 빌드 체크**

Run: `pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/components/survey-builder/lookup-selector.tsx src/components/survey-builder/lookup-key-mapping-editor.tsx src/components/survey-builder/lookup-comparand-editor.tsx
git commit -m "feat: 조건 에디터용 LUT 셀렉터·키 매핑·우변 룩업 컴포넌트 추가"
```

---

### Task 15: `numeric-comparison-editor.tsx` 통합

**Files:**
- Modify: `src/components/survey-builder/numeric-comparison-editor.tsx`

- [ ] **Step 1: 기존 파일 read**

Run: `cat src/components/survey-builder/numeric-comparison-editor.tsx | head -80`

Expected: 현재 literal 우변 입력만 있는 구조 확인.

- [ ] **Step 2: 좌변/우변 토글 + sub-component 위임 구조로 재작성**

`numeric-comparison-editor.tsx` 본체를 다음 골격으로 교체 (기존 export 시그니처 유지):

```tsx
'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { NumericComparison, LeftOperand, RightOperand } from '@/types/survey';

import { LeftOperandEditor } from './left-operand-editor';
import { LookupComparandEditor } from './lookup-comparand-editor';

interface Props {
  value: NumericComparison;
  onChange: (next: NumericComparison) => void;
}

export function NumericComparisonEditor({ value, onChange }: Props) {
  const left: LeftOperand = value.left ?? { kind: 'cell', questionId: '', cellId: '' };
  const right: RightOperand =
    value.right ??
    (value.comparand
      ? { kind: 'literal', value: value.comparand.value }
      : { kind: 'literal', value: 0 });

  const updateRightKind = (kind: 'literal' | 'lookup') => {
    const next: RightOperand =
      kind === 'literal'
        ? { kind: 'literal', value: 0 }
        : { kind: 'lookup', surveyLookupId: '', keyMapping: [] };
    onChange({ ...value, right: next, comparand: undefined });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">좌변</Label>
        <LeftOperandEditor value={left} onChange={(l) => onChange({ ...value, left: l })} />
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">비교</Label>
        <Select
          value={value.operator}
          onValueChange={(op) => onChange({ ...value, operator: op as NumericComparison['operator'] })}
        >
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(['==', '!=', '<', '<=', '>', '>='] as const).map((op) => (
              <SelectItem key={op} value={op}>{op}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium">우변</Label>
        <RadioGroup
          value={right.kind}
          onValueChange={(v) => updateRightKind(v as 'literal' | 'lookup')}
          className="flex gap-4 mb-2"
        >
          <Label className="flex items-center gap-1"><RadioGroupItem value="literal" /> 직접 입력 값</Label>
          <Label className="flex items-center gap-1"><RadioGroupItem value="lookup" /> 외부 데이터 룩업</Label>
        </RadioGroup>

        {right.kind === 'literal' && (
          <Input
            type="number"
            value={right.value}
            onChange={(e) => onChange({
              ...value,
              right: { kind: 'literal', value: Number(e.target.value) },
              comparand: undefined,
            })}
          />
        )}
        {right.kind === 'lookup' && (
          <LookupComparandEditor
            value={right}
            onChange={(r) => onChange({ ...value, right: r, comparand: undefined })}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 호환성 — 기존 호출처에서 깨지는지 확인**

Run: `grep -rn "NumericComparisonEditor" src/ --include='*.tsx'`

Expected: 호출처가 1-2곳. 시그니처 (value/onChange) 동일하므로 깨지지 않음.

- [ ] **Step 4: 타입 체크 + 수동 UI 검증**

Run: `pnpm tsc --noEmit && pnpm dev`

Expected: tsc PASS. 빌더에서 표시 조건 카드 열어서 좌변/우변 토글 시 sub-component 정상 렌더.

- [ ] **Step 5: 커밋**

```bash
git add src/components/survey-builder/numeric-comparison-editor.tsx
git commit -m "feat: 비교 에디터에 좌변 산술 + 우변 LUT 룩업 토글 통합"
```

---

## Phase 6 — Branch Logic + Snapshot + Save Actions

### Task 16: `branch-logic.ts` 시그니처 일반화 + lookup 통합

**Files:**
- Modify: `src/utils/branch-logic.ts` (`evaluateNumericComparison` 시그니처 변경 + 호출처 컨텍스트 주입)

- [ ] **Step 1: 호출처 매핑**

Run: `grep -n "evaluateNumericComparison" src/utils/branch-logic.ts`

Expected: 두 곳 (라인 ~1224, ~1407).

- [ ] **Step 2: 새 wrapper 함수 추가**

`evaluateNumericComparison` 정의 바로 아래에 새 wrapper 추가:

```ts
// src/utils/branch-logic.ts (상단 import 보강)
import { evaluateComparisonWithFailSafe, type ComparisonResult } from '@/lib/lookup/evaluate-comparison';
import type { LookupEvalCtx } from '@/lib/lookup/types';
import type { NumericComparison, SurveyLookup } from '@/types/survey';

/**
 * 조건 평가 컨텍스트. branch-logic 호출처에서 응답 전체 + 컨택 attrs + LUT 목록 주입.
 */
export type BranchEvalCtx = {
  responses: Record<string, Record<string, string | undefined>>;
  contactAttrs: Record<string, string | undefined>;
  lookups: SurveyLookup[];
};

/**
 * 신규 진입점. fail-safe 적용 후 satisfied 만 반환.
 * - cmp.left 없으면 (기존 데이터) cellValue 를 cell-impersonation 으로 평가.
 */
export function evaluateNumericComparisonV2(
  cmp: NumericComparison,
  cellValue: string,
  ctx: BranchEvalCtx,
): ComparisonResult {
  // 하위 호환: left 없는 기존 데이터는 cellValue 를 "anon cell" 로 wrap
  if (!cmp.left) {
    const fakeQ = '__current__';
    const fakeC = '__current__';
    const wrapped: NumericComparison = {
      ...cmp,
      left: { kind: 'cell', questionId: fakeQ, cellId: fakeC },
    };
    const evalCtx: LookupEvalCtx = {
      ...ctx,
      responses: {
        ...ctx.responses,
        [fakeQ]: { ...(ctx.responses[fakeQ] ?? {}), [fakeC]: cellValue },
      },
    };
    return evaluateComparisonWithFailSafe(wrapped, evalCtx);
  }
  return evaluateComparisonWithFailSafe(cmp, ctx);
}
```

- [ ] **Step 3: 기존 호출처 호출 변환**

기존 `evaluateNumericComparison(cellValue, numericComparison)` 호출 두 곳을 `evaluateNumericComparisonV2(numericComparison, cellValue, ctx)` 로 변경.

`ctx` 는 함수 시그니처를 따라 호출 체인에서 전파해야 함. `getBranchRuleForResponse` 가 root 진입점이라면 시그니처에 `ctx` 추가:

```ts
export function getBranchRuleForResponse(
  question: Question,
  response: unknown,
  ctx?: BranchEvalCtx, // optional: 없으면 lookup 우변 평가 시 fail-safe SHOW
): BranchRule | null {
  // ... 기존 분기 + 내부에서 ctx 전파
}
```

그리고 displayCondition 평가 함수 (`evaluateQuestionCondition` 같은 이름) 도 동일하게 ctx 받게 확장.

`isChecked = evaluateNumericComparison(...)` 부분을 다음으로 교체:

```ts
const result = evaluateNumericComparisonV2(numericComparison, strValue, ctx ?? { responses: {}, contactAttrs: {}, lookups: [] });
isChecked = result.satisfied;
```

(line 1224 와 line 1407 두 곳 모두)

- [ ] **Step 4: 호출 체인 변환 — 응답 페이지 / 빌더 호출처**

Run: `grep -rn "getBranchRuleForResponse\|evaluateQuestionCondition" src/ --include='*.ts' --include='*.tsx' | head -20`

각 호출처에서 `ctx` 인자 전달. 응답 페이지 (`/survey/[id]/page.tsx` 또는 거기서 사용하는 hook) 에서는 다음과 같이 빌드:

```ts
const evalCtx: BranchEvalCtx = {
  responses,                                    // 응답자가 입력한 응답 전체
  contactAttrs: contactAttrsCtx.attrs ?? {},   // ContactAttrsProvider 에서 가져옴
  lookups: snapshot.lookups ?? [],             // snapshot 의 LUT
};
```

빌더 미리보기에서는 `responses` + 빌더 store 의 `sampleContact?.attrs` + `currentSurvey.lookups`.

- [ ] **Step 5: 타입 체크**

Run: `pnpm tsc --noEmit`

Expected: PASS (호출처 수정 누락 없으면).

- [ ] **Step 6: 기존 numeric-comparison 테스트 회귀**

Run: `pnpm vitest run`

Expected: 기존 단위 + 신규 lookup 단위 + integration 모두 PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/utils/branch-logic.ts src/app/survey/ src/components/ 2>/dev/null
git commit -m "feat: branch-logic 에 LookupEvalCtx 주입 + 룩업 비교 평가 통합"
```

---

### Task 17: Snapshot builder + Survey save explicit fields

**Files:**
- Modify: `src/lib/survey/snapshot-builder.ts`
- Modify: `src/actions/survey-save-actions.ts` (6~7곳 explicit field — 메모 `survey_save_explicit_fields`)

- [ ] **Step 1: snapshot-builder 확인**

Run: `grep -n "snapshot\|lookups\|contactColumns" src/lib/survey/snapshot-builder.ts | head -20`

Expected: 기존 snapshot 구조 + contactColumns 포함 패턴 확인.

- [ ] **Step 2: snapshot 에 `lookups` 추가**

`src/lib/survey/snapshot-builder.ts` 의 snapshot 객체 빌드 부분에서 `contactColumns` 옆에 추가:

```ts
lookups: survey.lookups ?? [],
```

snapshot 타입에도 동일하게 (보통 `SurveySnapshot` 인터페이스):

```ts
export interface SurveySnapshot {
  // ...기존 필드
  contactColumns?: ContactColumnScheme;
  lookups: SurveyLookup[];
}
```

- [ ] **Step 3: survey-save-actions explicit field 6~7곳 점검**

Run: `grep -n "contactColumns\|lookups" src/actions/survey-save-actions.ts`

`contactColumns` 가 등장하는 모든 곳에 `lookups` 도 같이 set/select 되도록 추가. 보통:
- `createSurvey` insert values
- `updateSurvey` update set
- `duplicateSurvey` 복사 시 lookups 도 복사
- `publishSnapshot` 시점 (이미 snapshot-builder 가 처리하면 OK)

각 위치에서 `lookups: survey.lookups ?? []` 또는 `lookups: input.lookups ?? existing.lookups ?? []` 패턴으로 explicit 하게.

- [ ] **Step 4: 타입 체크 + 빌드**

Run: `pnpm tsc --noEmit && pnpm build`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/survey/snapshot-builder.ts src/actions/survey-save-actions.ts
git commit -m "feat: snapshot 과 survey-save-actions 에 lookups 필드 explicit 포함"
```

---

### Task 18: Integration test — displayCondition with lookup E2E

**Files:**
- Create: `tests/integration/display-condition-with-lookup.test.ts`

- [ ] **Step 1: 테스트 작성**

```ts
// tests/integration/display-condition-with-lookup.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db';
import { surveys, questions } from '@/db/schema/surveys';
import { eq } from 'drizzle-orm';
import { buildSurveySnapshot } from '@/lib/survey/snapshot-builder';
import { evaluateNumericComparisonV2 } from '@/utils/branch-logic';
import type { NumericComparison, SurveyLookup } from '@/types/survey';

let surveyId: string;

const LUT: SurveyLookup = {
  id: 'lut-airfare',
  name: 'avg',
  keyColumns: ['대륙'],
  valueColumn: '적용액',
  rows: [
    { 대륙: '유럽', 적용액: 2470000 },
    { 대륙: '아시아', 적용액: 800000 },
  ],
};

beforeAll(async () => {
  const [s] = await db.insert(surveys).values({
    title: 'lookup-e2e',
    slug: 'lookup-e2e-' + Date.now(),
    lookups: [LUT],
  } as never).returning();
  surveyId = s.id;
});

afterAll(async () => {
  await db.delete(surveys).where(eq(surveys.id, surveyId));
});

describe('displayCondition with lookup E2E', () => {
  it('snapshot 에 lookups 포함', async () => {
    const snap = await buildSurveySnapshot(surveyId);
    expect(snap.lookups).toHaveLength(1);
    expect(snap.lookups[0].id).toBe('lut-airfare');
  });

  it('binop / lookup 조건 평가: 1인당 출장비 ≤ 평균항공비 → 만족', () => {
    const cmp: NumericComparison = {
      operator: '<=',
      left: {
        kind: 'binop',
        op: '/',
        left: { kind: 'cell', questionId: 'q1', cellId: 'expense' },
        right: { kind: 'cell', questionId: 'q1', cellId: 'people' },
      },
      right: {
        kind: 'lookup',
        surveyLookupId: 'lut-airfare',
        keyMapping: [{ lutKey: '대륙', attrsKey: '개최대륙' }],
      },
    };
    const result = evaluateNumericComparisonV2(cmp, '__unused__', {
      responses: { q1: { expense: '1000000', people: '2' } },
      contactAttrs: { 개최대륙: '유럽' },
      lookups: [LUT],
    });
    // 500000 ≤ 2470000 → true
    expect(result.satisfied).toBe(true);
    expect(result.failSafeShow).toBe(false);
  });

  it('attrs 누락 → fail-safe SHOW', () => {
    const cmp: NumericComparison = {
      operator: '<=',
      left: { kind: 'cell', questionId: 'q1', cellId: 'expense' },
      right: {
        kind: 'lookup',
        surveyLookupId: 'lut-airfare',
        keyMapping: [{ lutKey: '대륙', attrsKey: '개최대륙' }],
      },
    };
    const result = evaluateNumericComparisonV2(cmp, '__unused__', {
      responses: { q1: { expense: '500000' } },
      contactAttrs: {}, // 익명
      lookups: [LUT],
    });
    expect(result.satisfied).toBe(true);
    expect(result.failSafeShow).toBe(true);
    expect(result.reason).toBe('attrs-key-missing');
  });
});
```

- [ ] **Step 2: 실행 → PASS**

Run: `pnpm vitest run tests/integration/display-condition-with-lookup.test.ts`

Expected: PASS (3/3).

- [ ] **Step 3: 커밋**

```bash
git add tests/integration/display-condition-with-lookup.test.ts
git commit -m "test: snapshot 로드 → lookup 비교 평가 E2E integration test 3케이스"
```

---

## Phase 7 — 빌더 디버그 패널

### Task 19: `condition-debug-panel.tsx` + 빌더 테스트 모드 통합

**Files:**
- Create: `src/components/survey-builder/condition-debug-panel.tsx`
- Modify: `src/components/survey-builder/question-test-card.tsx` (또는 빌더 미리보기 컨테이너 — sample contact selector + debug panel 마운트)

- [ ] **Step 1: `ConditionDebugPanel` 구현**

```tsx
// src/components/survey-builder/condition-debug-panel.tsx
'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ComparisonResult } from '@/lib/lookup/evaluate-comparison';

interface Props {
  conditionLabel: string;
  result: ComparisonResult;
}

const REASON_LABELS: Record<string, string> = {
  'attrs-key-missing': 'attrs 키 비어있음',
  'lookup-not-found': '설문에 LUT 등록 안 됨',
  'lookup-row-not-matched': 'LUT 행 매칭 실패',
  'lookup-value-missing': 'LUT 값 컬럼 누락',
  'cell-value-missing': '셀 응답 없음',
  'cell-value-not-number': '셀 응답이 숫자 아님',
  'divide-by-zero': '0 으로 나누기',
};

export function ConditionDebugPanel({ conditionLabel, result }: Props) {
  const { satisfied, failSafeShow, reason, debug } = result;

  return (
    <div className={`border rounded p-3 text-sm ${failSafeShow ? 'bg-amber-50 border-amber-200' : satisfied ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center gap-2 font-medium">
        {failSafeShow ? (
          <AlertTriangle size={14} className="text-amber-600" />
        ) : satisfied ? (
          <CheckCircle2 size={14} className="text-green-600" />
        ) : (
          <span className="text-gray-500">✕</span>
        )}
        <span>{conditionLabel}</span>
        <span className="ml-auto text-xs">
          {failSafeShow ? '평가 불가 → fail-safe SHOW' : satisfied ? '충족 → SHOW' : '미충족 → HIDE'}
        </span>
      </div>

      {debug && debug.leftValue !== undefined && (
        <div className="text-xs text-gray-700 mt-1">
          좌변: {debug.leftValue} · 우변: {debug.rightValue}
        </div>
      )}

      {failSafeShow && reason && (
        <div className="text-xs text-amber-700 mt-1">
          사유: {REASON_LABELS[reason] ?? reason}
          <span className="text-gray-500 ml-2">(실제 응답자에게는 이 안내가 표시되지 않습니다)</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 빌더 미리보기에 sample contact selector + debug panel 마운트**

`question-test-card.tsx` (또는 빌더 테스트 모드 진입점) 상단에 추가:

```tsx
import { SampleContactSelector } from './sample-contact-selector';
import { ConditionDebugPanel } from './condition-debug-panel';
import { evaluateNumericComparisonV2 } from '@/utils/branch-logic';

// 컴포넌트 내부:
const [sampleContactId, setSampleContactId] = useState<string | null>(null);
const [sampleAttrs, setSampleAttrs] = useState<Record<string, string>>({});

// JSX 상단:
<div className="flex items-center gap-2 mb-2">
  <span className="text-xs text-gray-500">테스트 컨택:</span>
  <SampleContactSelector
    value={sampleContactId}
    onChange={(id, attrs) => { setSampleContactId(id); setSampleAttrs(attrs); }}
  />
</div>

// 질문 렌더 후, displayCondition 이 있다면:
{question.displayCondition?.conditions?.map((c, idx) => {
  const cmp = c.tableConditions?.numericComparison ?? c.additionalConditions?.numericComparison;
  if (!cmp) return null;
  const result = evaluateNumericComparisonV2(cmp, '', {
    responses: testResponses,
    contactAttrs: sampleAttrs,
    lookups: currentSurvey.lookups ?? [],
  });
  return (
    <ConditionDebugPanel
      key={idx}
      conditionLabel={c.name ?? `조건 ${idx + 1}`}
      result={result}
    />
  );
})}
```

- [ ] **Step 3: 수동 UI 검증**

Run: `pnpm dev` + 빌더 진입 → 표시 조건 있는 질문에서 테스트 모드 → sample contact 선택 → debug panel 노출 확인.

Expected:
- attrs 채워진 컨택 선택 시 좌변/우변 raw 값 표시
- attrs 비어있는 컨택 또는 익명 선택 시 amber "fail-safe SHOW" + 사유

- [ ] **Step 4: 커밋**

```bash
git add src/components/survey-builder/condition-debug-panel.tsx src/components/survey-builder/question-test-card.tsx
git commit -m "feat: 빌더 테스트 모드에 sample 컨택 셀렉터 + 조건 평가 디버그 패널 마운트"
```

---

## Phase 8 — 최종 검증

### Task 20: 통합 검증 + 수동 응답 페이지 검증

**Files:** (검증만)

- [ ] **Step 1: 전체 테스트 회귀**

Run: `pnpm vitest run`

Expected: 모든 테스트 PASS. 회귀 0건.

- [ ] **Step 2: 타입 체크 + 빌드**

Run: `pnpm tsc --noEmit && pnpm build`

Expected: 둘 다 PASS. (메모 `lint_infra_broken` — ESLint 깨져 있어 lint 는 스킵)

- [ ] **Step 3: 수동 시나리오 — 운영자 흐름**

Run: `pnpm dev`. 빌더 진입.

체크리스트:
- [ ] 보관함 패널 하단에 "외부 데이터" 섹션 노출
- [ ] "+ 새 LUT" → 모달에서 키/값 컬럼 + 행 입력 + 저장 → 보관함 목록에 추가됨
- [ ] 엑셀 셀 영역 복사 → 모달 표에 paste → 행 자동 채움
- [ ] "엑셀 가져오기" → 파일 선택 → 컬럼 매핑 → 미리보기 → 적용 → 모달 prefill 됨
- [ ] LUT 항목 "불러오기" → 현재 설문의 lookups 에 사본 추가됨
- [ ] 표시 조건 카드에서 우변 = "외부 데이터 룩업" 선택 → LUT 셀렉터 + 키 매핑 + 비교 대상 노출
- [ ] 좌변 = "셀 산술" 선택 → 셀A, 연산자, 셀B/숫자 입력
- [ ] 저장 후 다시 열어도 값 유지

- [ ] **Step 4: 수동 시나리오 — 응답자 흐름**

publish 후 `/survey/<slug>?invite=<token>` 진입.

체크리스트 (컨택 attrs.개최대륙=유럽, 출장비/인원 셀이 있는 설문):
- [ ] 출장비 1000000, 인원 2 입력 → 1인당 500000 → LUT 유럽 적용액 2470000 → 조건 만족 → 후속 질문 SHOW
- [ ] 출장비 5000000, 인원 1 입력 → 1인당 5000000 → 조건 불만족 → 후속 질문 HIDE
- [ ] 인원 0 입력 → 0 나누기 → fail-safe SHOW (응답자에게는 사유 미표시)
- [ ] invite 없이 익명 진입 → attrs 없음 → fail-safe SHOW (응답자에게는 사유 미표시)

- [ ] **Step 5: 빌더 테스트 모드 — sample 컨택 셀렉터 디버그 확인**

빌더 미리보기에서 다음 컨택 시나리오 디버그 패널 표시 확인:
- [ ] attrs.개최대륙=유럽인 컨택: 좌변/우변 raw 값 + 충족/미충족
- [ ] attrs.개최대륙 비어있는 컨택: amber "attrs 키 비어있음" + fail-safe SHOW
- [ ] "미선택 (익명)": 동일하게 fail-safe SHOW

- [ ] **Step 6: 최종 커밋 + PR 준비**

이슈 발견되면 별도 fix 커밋. 모두 PASS 면:

```bash
git log --oneline main..HEAD | head -25  # 변경 commit 목록 확인
git status                               # working tree clean 확인
```

Expected: 20개 task 분 commit + clean working tree.

PR description 초안 작성용 핵심 포인트:
- 변경 요약: NumericComparison 좌변 1단계 binop + 우변 LUT lookup variant
- 신규 자산: saved_lookups + surveys.lookups + 5 pure evaluators + 9 UI 컴포넌트
- 영향 범위: displayCondition 만 (BranchRule 적용은 후속)
- 회귀 확인: 기존 numeric comparison 단위 테스트 + integration 회귀 0
- snapshot 정합: publish 시점 LUT freeze

---

## Self-Review Summary

- **Spec coverage:** D1~D8 모두 task 매핑됨 (D1→T1, D2→T2, D3→T2, D4→T12, D5→T10/T11, D6→T13~T15, D7→T7/T19, D8→T8 권한 검증).
- **Placeholder scan:** "TBD" 없음. 모든 코드 블록 완결. auth helper import 경로만 프로젝트 실제 위치 확인 후 대체 (T8 주석 명시).
- **Type consistency:** `LeftOperand`, `RightOperand`, `SurveyLookup`, `SavedLookup`, `EvalResult`, `LookupEvalCtx`, `ComparisonResult` 전 task 일관.
- **Out of scope:** spec 의 out-of-scope 항목 (2단계 산술, Reference 모델, BranchRule, 다국어, fuzzy matching) 모두 plan 에서도 제외 유지.
