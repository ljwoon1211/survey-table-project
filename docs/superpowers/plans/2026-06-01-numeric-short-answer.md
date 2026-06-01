# 단답형 질문 "숫자만 입력" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 테이블 셀의 "숫자만 입력" 기능(입력 제한 + 숫자 초기값 + 조건 숫자 비교)을 일반 단답형(`type:'text'`) 질문에 동일 적용하고, SPSS export 자동 Numeric 처리와 analytics 숫자 통계까지 확장한다.

**Architecture:** `Question` 에 셀과 동일한 `inputType`/`emptyDefault` 필드를 추가하고 전용 DB 컬럼 2개로 영속화한다. 저장 경로(save-actions·loader·snapshot)와 빌더 UI·응답 렌더링은 기존 셀 구현(`cells/input-cell.tsx`, `cell-content-modal.tsx`)을 그대로 재활용한다. 조건 숫자 비교(C)는 expression 조건 모드가 이미 지원하므로 신규 평가 코드 없음. SPSS·analytics 는 `parseNumericInput` 으로 빈값만 missing 처리하고 실제 0 은 유효값으로 포함한다.

**Tech Stack:** Next.js 16 / React 19 / Drizzle ORM (PostgreSQL/Supabase) / Zustand / TypeScript strict / vitest. (ESLint 인프라 깨짐 → `tsc + vitest + build` 로 검증, vitest 는 `tests/` 만 include)

**설계 문서:** `docs/superpowers/specs/2026-06-01-numeric-short-answer-design.md`

---

## File Structure

생성:
- `supabase/migrations/0030_question_input_type.sql` — `questions.input_type`, `questions.empty_default` 컬럼 추가
- `src/lib/analytics/numeric-stats.ts` — 숫자 배열 → 통계(count/sum/mean/min/max/median) 순수 함수
- `tests/unit/lib/numeric-stats.test.ts` — numeric-stats 단위 테스트

수정:
- `src/types/survey.ts` — `Question` 에 `inputType`, `emptyDefault`
- `src/db/schema/surveys.ts` — 컬럼 2개
- `src/db/schema/schema-types.ts` — DB-derived question 타입에 2필드
- `src/lib/versioning/snapshot-builder.ts` — snapshot 타입 + 매핑
- `src/actions/survey-save-actions.ts` — 2개 함수 × (insert values + onConflict set)
- `src/data/surveys.ts` — 로더 매핑
- `src/components/survey-builder/question-edit-modal.tsx` — formData hydrate
- `src/components/survey-builder/question-basic-tab.tsx` — 빌더 UI
- `src/components/survey-response/question-input.tsx` — `TextResponseInput` 응답 렌더링
- `src/lib/spss/sav-builder.ts` — `resolveVarType`/`resolveMeasure`
- `src/lib/analytics/spss-excel-export.ts` — `SPSSExportColumn.numericText`, 컬럼 생성, text 변환
- `src/lib/spss/data-transformer.ts` — numeric text 변환 헬퍼(테스트 대상)
- `src/lib/analytics/types.ts` — `NumericStats` + `TextAnalytics.numericStats`
- `src/lib/analytics/analyzer.ts` — `analyzeText` 숫자 통계
- `src/components/analytics/charts/text-responses.tsx` — 숫자 통계 카드

---

## Task 1: 타입 + DB 컬럼 + 마이그레이션 + 파생 타입

**Files:**
- Modify: `src/types/survey.ts:459-462`
- Modify: `src/db/schema/surveys.ts:134-138`
- Create: `supabase/migrations/0030_question_input_type.sql`
- Modify: `src/db/schema/schema-types.ts:286` (question 타입 끝)
- Modify: `src/lib/versioning/snapshot-builder.ts:58` (snapshot 타입) 및 `:118` (매핑)

- [ ] **Step 1: `Question` 타입에 필드 추가**

`src/types/survey.ts` 의 `// 단답형(text) 타입용` 블록 (현재 460-462행) 을 다음으로 교체:

```ts
  // 단답형(text) 타입용
  placeholder?: string; // 입력 필드 placeholder
  // 단답형 prefill 템플릿 — {{attrs_key}} 포함 가능. (0022 마이그레이션)
  defaultValueTemplate?: string | null;
  // 단답형 숫자 입력 모드 — 셀 input 과 동일 의미. 'number' 면 응답자가 숫자만 입력 가능.
  inputType?: 'text' | 'number';
  // 숫자 모드 첫 진입 시 입력란 자동 채움 값(선택). 토큰 prefill 없을 때만 적용.
  emptyDefault?: number;
```

- [ ] **Step 2: Drizzle 스키마 컬럼 추가**

`src/db/schema/surveys.ts` 의 `defaultValueTemplate: text('default_value_template'),` (138행) 바로 아래에 추가:

```ts
  // 단답형 숫자 입력 모드 — 0030 마이그레이션
  inputType: text('input_type'), // 'text' | 'number'
  emptyDefault: doublePrecision('empty_default'), // 숫자 모드 초기값
```

`doublePrecision` 가 이 파일 상단 import 에 없으면 drizzle import 에 추가:
파일 상단 `import { ... } from 'drizzle-orm/pg-core';` 목록에 `doublePrecision` 포함.

- [ ] **Step 3: 마이그레이션 SQL 작성**

`supabase/migrations/0030_question_input_type.sql` 생성:

```sql
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "input_type" text;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "empty_default" double precision;
```

- [ ] **Step 4: 마이그레이션 적용 (Supabase MCP)**

`_journal.json` 이 0019 에서 멈춰 있고 0020~0029 는 MCP 로 직접 적용된 패턴이므로 `pnpm db:migrate` 를 쓰지 말고 Supabase MCP `apply_migration` 으로 위 SQL 을 적용한다 (name: `question_input_type`).

적용 후 확인: `questions` 테이블에 `input_type`, `empty_default` 컬럼 존재.

- [ ] **Step 5: 파생 타입(schema-types) 추가**

`src/db/schema/schema-types.ts` 의 question 타입 (286행 `defaultValueTemplate?: string | null;` 바로 위 또는 아래, `}` 직전) 에 추가:

```ts
  inputType?: 'text' | 'number';
  emptyDefault?: number;
```

- [ ] **Step 6: snapshot 타입 + 매핑 추가**

`src/lib/versioning/snapshot-builder.ts`:
- 58행 `defaultValueTemplate?: string | null;` 아래에 추가:
```ts
  inputType?: 'text' | 'number';
  emptyDefault?: number;
```
- 118행 `defaultValueTemplate: q.defaultValueTemplate,` 아래에 추가:
```ts
      inputType: q.inputType,
      emptyDefault: q.emptyDefault,
```

- [ ] **Step 7: 타입 검증**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음 (신규 필드 미사용이라 통과해야 함)

- [ ] **Step 8: Commit**

```bash
git add src/types/survey.ts src/db/schema/surveys.ts src/db/schema/schema-types.ts src/lib/versioning/snapshot-builder.ts supabase/migrations/0030_question_input_type.sql
git commit -m "feat: 단답형 질문 inputType/emptyDefault 타입 및 컬럼 추가"
```

---

## Task 2: 저장 경로 배관 (save-actions / loader / edit-modal)

**Files:**
- Modify: `src/actions/survey-save-actions.ts:238` 및 `:279` 및 `:540` 및 `:581`
- Modify: `src/data/surveys.ts:157`
- Modify: `src/components/survey-builder/question-edit-modal.tsx:162`

- [ ] **Step 1: save-actions insert values (함수 1)**

`src/actions/survey-save-actions.ts` 238행 `defaultValueTemplate: question.defaultValueTemplate ?? null,` 아래에 추가:

```ts
          inputType: question.inputType ?? null,
          emptyDefault: question.emptyDefault ?? null,
```

- [ ] **Step 2: save-actions onConflict set (함수 1)**

279행 `defaultValueTemplate: sql\`excluded.default_value_template\`,` 아래에 추가:

```ts
              inputType: sql`excluded.input_type`,
              emptyDefault: sql`excluded.empty_default`,
```

- [ ] **Step 3: save-actions insert values (함수 2)**

540행 `defaultValueTemplate: question.defaultValueTemplate ?? null,` 아래에 동일 추가:

```ts
          inputType: question.inputType ?? null,
          emptyDefault: question.emptyDefault ?? null,
```

- [ ] **Step 4: save-actions onConflict set (함수 2)**

581행 `defaultValueTemplate: sql\`excluded.default_value_template\`,` 아래에 동일 추가:

```ts
              inputType: sql`excluded.input_type`,
              emptyDefault: sql`excluded.empty_default`,
```

- [ ] **Step 5: 로더 매핑**

`src/data/surveys.ts` 157행 `defaultValueTemplate: q.defaultValueTemplate ?? undefined,` 아래에 추가:

```ts
        inputType: (q.inputType as 'text' | 'number' | null) ?? undefined,
        emptyDefault: q.emptyDefault ?? undefined,
```

- [ ] **Step 6: edit-modal hydrate**

`src/components/survey-builder/question-edit-modal.tsx` 162행 `defaultValueTemplate: question.defaultValueTemplate ?? null,` 아래에 추가 (저장은 `...currentFormData` spread 라 hydrate 만으로 전달됨):

```ts
        inputType: question.inputType ?? 'text',
        emptyDefault: question.emptyDefault,
```

- [ ] **Step 7: 타입 검증**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 8: Commit**

```bash
git add src/actions/survey-save-actions.ts src/data/surveys.ts src/components/survey-builder/question-edit-modal.tsx
git commit -m "feat: 단답형 inputType/emptyDefault 저장 경로 배관"
```

---

## Task 3: 빌더 UI (question-basic-tab)

**Files:**
- Modify: `src/components/survey-builder/question-basic-tab.tsx:431-485` (`type === 'text'` 블록)

빌더는 셀 모달과 동일 동작: "숫자만 입력" 체크 시 `inputType='number'`, 해제 시 `'text'` + `emptyDefault` 정리. 숫자 모드 + 토큰 prefill 비어있을 때만 초기값 입력 활성화.

- [ ] **Step 1: import 추가**

`src/components/survey-builder/question-basic-tab.tsx` 상단 import 블록에 추가:

```ts
import { isPartialNumericInput, parseNumericInput } from '@/utils/numeric-input';
```

- [ ] **Step 2: 응답값 prefill `</div>` 닫힘 뒤, `type==='text'` 프래그먼트 닫기(`</>`) 직전에 UI 삽입**

`defaultValueTemplate` 블록(448-483행)의 닫는 `</div>` 다음, `</>` (485행) 직전에 추가:

```tsx
            <div className="space-y-2">
              <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="text-input-type-number"
                    checked={formData.inputType === 'number'}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData((prev) => ({
                        ...prev,
                        inputType: checked ? 'number' : 'text',
                        emptyDefault: checked ? prev.emptyDefault : undefined,
                      }));
                    }}
                    className="mt-0.5 h-4 w-4"
                  />
                  <label
                    htmlFor="text-input-type-number"
                    className="flex-1 cursor-pointer text-sm"
                  >
                    <span className="font-medium">숫자만 입력</span>
                    <p className="mt-0.5 text-xs text-gray-500">
                      체크 시 응답자는 숫자만 입력할 수 있고, 분기 조건(expression)에서 비교
                      연산자 (=, ≠, ≥, ≤, &gt;, &lt;) 를 사용할 수 있습니다.
                    </p>
                  </label>
                </div>

                {formData.inputType === 'number' && (
                  <div className="ml-7 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      id="text-empty-default-enabled"
                      checked={formData.emptyDefault !== undefined}
                      disabled={(formData.defaultValueTemplate ?? '').trim().length > 0}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          emptyDefault: e.target.checked ? (prev.emptyDefault ?? 0) : undefined,
                        }))
                      }
                      className="h-4 w-4"
                    />
                    <label htmlFor="text-empty-default-enabled" className="cursor-pointer">
                      응답자 입력란 초기값
                    </label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={formData.emptyDefault !== undefined ? String(formData.emptyDefault) : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (isPartialNumericInput(v)) {
                          setFormData((prev) => ({
                            ...prev,
                            emptyDefault: v === '' ? 0 : (parseNumericInput(v) ?? prev.emptyDefault ?? 0),
                          }));
                        }
                      }}
                      disabled={
                        formData.emptyDefault === undefined ||
                        (formData.defaultValueTemplate ?? '').trim().length > 0
                      }
                      className="h-8 w-24"
                      aria-label="초기값"
                    />
                    {(formData.defaultValueTemplate ?? '').trim().length > 0 && (
                      <span className="text-xs text-gray-400">토큰 prefill 사용 중 (우선)</span>
                    )}
                  </div>
                )}
              </div>
            </div>
```

- [ ] **Step 3: 타입 검증**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음. (`Input` 은 이 파일에서 이미 import 됨 — 확인)

- [ ] **Step 4: Commit**

```bash
git add src/components/survey-builder/question-basic-tab.tsx
git commit -m "feat: 단답형 빌더에 숫자만 입력 설정 UI 추가"
```

---

## Task 4: 응답 렌더링 (TextResponseInput)

**Files:**
- Modify: `src/components/survey-response/question-input.tsx:481-514`

`cells/input-cell.tsx` 로직 재활용: 숫자 모드 입력 제한 + 토큰 prefill 없을 때 emptyDefault 자동 채움.

- [ ] **Step 1: import 추가**

`src/components/survey-response/question-input.tsx` 상단에 (없으면) 추가:

```ts
import { isPartialNumericInput } from '@/utils/numeric-input';
```

(이미 `useEffect` import 되어 있는지 확인. `TextResponseInput` 이 useEffect 사용 중이므로 존재함.)

- [ ] **Step 2: `TextResponseInput` 본문 교체**

481-514행 `TextResponseInput` 함수를 다음으로 교체:

```tsx
function TextResponseInput({
  question,
  value,
  onChange,
  attrs,
}: {
  question: Question;
  value: unknown;
  onChange: (v: unknown) => void;
  attrs: Record<string, string>;
}) {
  const template = question.defaultValueTemplate ?? '';
  const isPrefilled = template.trim().length > 0;
  const prefilledValue = isPrefilled ? substituteTokens(template, attrs) : '';
  const currentValue = typeof value === 'string' ? value : '';
  const inputValue = isPrefilled ? prefilledValue : currentValue;
  const isNumberMode = question.inputType === 'number';

  useEffect(() => {
    if (isPrefilled && value !== prefilledValue) {
      onChange(prefilledValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPrefilled, prefilledValue]);

  // 숫자 모드 + emptyDefault 정의 + 토큰 prefill 아님 + 값 미존재 → 첫 진입 시 자동 채움.
  // 응답자가 지워 빈 문자열이 되면 재채움하지 않음(의도 보존).
  useEffect(() => {
    if (
      !isPrefilled &&
      isNumberMode &&
      typeof question.emptyDefault === 'number' &&
      (value === undefined || value === null)
    ) {
      onChange(String(question.emptyDefault));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, isPrefilled, isNumberMode, question.emptyDefault]);

  return (
    <Input
      type="text"
      inputMode={isNumberMode ? 'decimal' : undefined}
      placeholder={
        question.placeholder || (isNumberMode ? '숫자만 입력하세요...' : '답변을 입력하세요...')
      }
      value={inputValue}
      onChange={(e) => {
        const v = e.target.value;
        if (isNumberMode && !isPartialNumericInput(v)) return;
        onChange(v);
      }}
      className="w-full text-base"
      disabled={isPrefilled}
      data-prefilled={isPrefilled || undefined}
    />
  );
}
```

- [ ] **Step 3: 타입 검증**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add src/components/survey-response/question-input.tsx
git commit -m "feat: 단답형 응답 입력에 숫자 모드 제한 및 초기값 적용"
```

---

## Task 5: 숫자 통계 순수 함수 + 테스트 (TDD)

**Files:**
- Create: `src/lib/analytics/numeric-stats.ts`
- Create: `tests/unit/lib/numeric-stats.test.ts`
- Modify: `src/lib/analytics/types.ts:57` (TextAnalytics 끝)

- [ ] **Step 1: 타입 정의 추가**

`src/lib/analytics/types.ts` 의 `TextAnalytics` 인터페이스 (40-57행) 닫기 `}` 직전에 필드 추가하고, 인터페이스 위에 `NumericStats` 정의:

```ts
// 숫자 단답형 통계 (빈값 제외, 실제 0 포함)
export interface NumericStats {
  count: number; // 유효 숫자 응답 수
  sum: number;
  mean: number;
  min: number;
  max: number;
  median: number;
}
```

`TextAnalytics` 의 `wordFrequency?` 필드 아래(닫기 `}` 직전)에 추가:

```ts
  // inputType==='number' 인 단답형에만 존재
  numericStats?: NumericStats;
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/unit/lib/numeric-stats.test.ts` 생성:

```ts
import { describe, expect, it } from 'vitest';

import { computeNumericStats } from '@/lib/analytics/numeric-stats';

describe('computeNumericStats', () => {
  it('빈 문자열은 제외하고 실제 0 은 포함한다', () => {
    const stats = computeNumericStats(['0', '', '10', '  ', '5']);
    expect(stats).not.toBeNull();
    expect(stats!.count).toBe(3); // '0', '10', '5'
    expect(stats!.sum).toBe(15);
    expect(stats!.min).toBe(0);
    expect(stats!.max).toBe(10);
    expect(stats!.mean).toBe(5);
  });

  it('비숫자 값은 제외한다', () => {
    const stats = computeNumericStats(['abc', '3', 'N/A', '7']);
    expect(stats!.count).toBe(2);
    expect(stats!.sum).toBe(10);
  });

  it('짝수 개수의 중앙값은 두 가운데 값의 평균', () => {
    const stats = computeNumericStats(['1', '2', '3', '4']);
    expect(stats!.median).toBe(2.5);
  });

  it('홀수 개수의 중앙값은 가운데 값', () => {
    const stats = computeNumericStats(['3', '1', '2']);
    expect(stats!.median).toBe(2);
  });

  it('음수와 소수도 처리한다', () => {
    const stats = computeNumericStats(['-1.5', '2.5']);
    expect(stats!.sum).toBe(1);
    expect(stats!.min).toBe(-1.5);
    expect(stats!.max).toBe(2.5);
  });

  it('유효 숫자가 없으면 null 을 반환한다', () => {
    expect(computeNumericStats(['', 'abc', '  '])).toBeNull();
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm vitest run tests/unit/lib/numeric-stats.test.ts`
Expected: FAIL — `computeNumericStats` 모듈 없음

- [ ] **Step 4: 구현 작성**

`src/lib/analytics/numeric-stats.ts` 생성:

```ts
import type { NumericStats } from './types';
import { parseNumericInput } from '@/utils/numeric-input';

/**
 * 문자열 응답 배열에서 숫자 통계를 계산한다.
 * - 빈값/공백/비숫자는 제외하되, 실제 입력된 0 은 유효값으로 포함한다.
 * - 유효 숫자가 하나도 없으면 null.
 */
export function computeNumericStats(rawValues: Array<string | null | undefined>): NumericStats | null {
  const nums: number[] = [];
  for (const raw of rawValues) {
    if (raw == null) continue;
    const n = parseNumericInput(String(raw));
    if (n !== null) nums.push(n);
  }
  if (nums.length === 0) return null;

  const sorted = [...nums].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((s, n) => s + n, 0);
  const mid = Math.floor(count / 2);
  const median = count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  return {
    count,
    sum,
    mean: sum / count,
    min: sorted[0],
    max: sorted[count - 1],
    median,
  };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm vitest run tests/unit/lib/numeric-stats.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/analytics/numeric-stats.ts tests/unit/lib/numeric-stats.test.ts src/lib/analytics/types.ts
git commit -m "feat: 숫자 단답형 통계 계산 순수 함수 추가"
```

---

## Task 6: analyzer + analytics UI 연결

**Files:**
- Modify: `src/lib/analytics/analyzer.ts:285-295` (`analyzeText` return)
- Modify: `src/components/analytics/charts/text-responses.tsx:38-54`

- [ ] **Step 1: analyzer import 추가**

`src/lib/analytics/analyzer.ts` 상단 import 에 추가:

```ts
import { computeNumericStats } from './numeric-stats';
```

- [ ] **Step 2: `analyzeText` 에 numericStats 계산**

`analyzeText` 의 `return {` (285행) 직전에 추가:

```ts
  const numericStats =
    question.inputType === 'number'
      ? computeNumericStats(textResponses.map((r) => r.value))
      : undefined;
```

그리고 return 객체의 `wordFrequency,` 아래에 추가:

```ts
    numericStats: numericStats ?? undefined,
```

- [ ] **Step 3: 통계 카드 렌더링**

`src/components/analytics/charts/text-responses.tsx` 의 통계 요약 그리드(38-54행) 바로 아래에 추가:

```tsx
    {data.numericStats && (
      <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[
          { label: '응답 수', value: data.numericStats.count },
          { label: '합계', value: data.numericStats.sum },
          { label: '평균', value: Math.round(data.numericStats.mean * 100) / 100 },
          { label: '최소', value: data.numericStats.min },
          { label: '최대', value: data.numericStats.max },
          { label: '중앙값', value: data.numericStats.median },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-blue-50 p-3">
            <span className="text-xs text-gray-500">{s.label}</span>
            <p className="mt-1 text-lg font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>
    )}
```

- [ ] **Step 4: 타입 검증 + 기존 analytics 테스트**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/analyzer.ts src/components/analytics/charts/text-responses.tsx
git commit -m "feat: 숫자 단답형 analytics 통계 집계 및 표시"
```

---

## Task 7: SPSS 자동 Numeric 처리 + 테스트

**Files:**
- Modify: `src/lib/spss/sav-builder.ts:73-79` (resolveVarType text case), `:92-120` (resolveMeasure)
- Modify: `src/lib/analytics/spss-excel-export.ts:25-69` (SPSSExportColumn), `:362-370` (컬럼 생성), `:667-668` (text 변환)
- Modify: `src/lib/spss/data-transformer.ts` (numeric text 변환 헬퍼 + export)
- Modify: `tests/unit/domains/spss/data-transformer.test.ts` (numeric text 변환 테스트)

- [ ] **Step 1: data-transformer 에 numeric text 변환 헬퍼 + 실패 테스트**

`tests/unit/domains/spss/data-transformer.test.ts` 의 import 목록에 `transformNumericText` 추가하고, 파일 끝에 describe 추가:

```ts
describe('transformNumericText', () => {
  it('빈값/공백/비숫자는 null, 실제 0 은 0 으로 변환', () => {
    expect(transformNumericText('')).toBeNull();
    expect(transformNumericText('   ')).toBeNull();
    expect(transformNumericText('abc')).toBeNull();
    expect(transformNumericText(null)).toBeNull();
    expect(transformNumericText('0')).toBe(0);
    expect(transformNumericText('12.5')).toBe(12.5);
    expect(transformNumericText('-3')).toBe(-3);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm vitest run tests/unit/domains/spss/data-transformer.test.ts`
Expected: FAIL — `transformNumericText` 없음

- [ ] **Step 3: data-transformer 헬퍼 구현**

`src/lib/spss/data-transformer.ts` 상단 import 에 추가:
```ts
import { parseNumericInput } from '@/utils/numeric-input';
```
`transformText` 함수 아래에 추가:

```ts
/**
 * 숫자 단답형(inputType==='number') 응답을 number|null 로 변환한다.
 * 빈값/비숫자는 null(system-missing), 실제 0 은 0 으로 보존.
 */
export function transformNumericText(value: unknown): number | null {
  if (value == null) return null;
  return parseNumericInput(String(value));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run tests/unit/domains/spss/data-transformer.test.ts`
Expected: PASS

- [ ] **Step 5: SPSSExportColumn 에 numericText 플래그**

`src/lib/analytics/spss-excel-export.ts` 의 `SPSSExportColumn` 인터페이스 (25-69행) 의 `optionId?: string;` 아래에 추가:

```ts
  // 'text' 컬럼 전용: 숫자 단답형(question.inputType==='number') 이면 Numeric 변수로 처리
  numericText?: boolean;
```

- [ ] **Step 6: 컬럼 생성 시 numericText 세팅**

같은 파일 362-369행 `else { columns.push({ ... type: q.type === 'text' ... }) }` 의 push 객체에 추가:

```ts
        numericText: q.type === 'text' && q.inputType === 'number',
```

- [ ] **Step 7: text 변환 분기**

같은 파일 667-668행 `case 'text': return transformText(rawValue as string | null);` 를 교체:

```ts
        case 'text':
          return col.numericText
            ? transformNumericText(rawValue)
            : transformText(rawValue as string | null);
```

`transformNumericText` 를 이 파일 import 에 추가 (기존 `transformText` import 옆).

- [ ] **Step 8: resolveVarType — text 숫자 모드 Numeric**

`src/lib/spss/sav-builder.ts` resolveVarType 의 자동 판단 switch 에서 `case 'text':` 분기를 교체. 현재:
```ts
    case 'text':
    case 'other-text':
    ...
      return VariableType.String;
```
`'text'` 만 별도 분기로 분리:
```ts
    case 'text':
      return col.numericText || question?.inputType === 'number'
        ? VariableType.Numeric
        : VariableType.String;
    case 'other-text':
    ...
      return VariableType.String;
```

- [ ] **Step 9: resolveMeasure — 숫자 단답형 Continuous**

`src/lib/spss/sav-builder.ts` resolveMeasure 의 오버라이드 체크 직후(질문 spssMeasure 분기 다음), `return VariableMeasure.Nominal;` 폴백 직전에 추가:

```ts
  if (col.type === 'text' && (col.numericText || question?.inputType === 'number')) {
    return VariableMeasure.Continuous;
  }
```

- [ ] **Step 10: 타입 + 기존 SPSS 통합 테스트**

Run: `pnpm tsc --noEmit && pnpm vitest run tests/integration/spss tests/unit/domains/spss`
Expected: 기존 테스트 그대로 PASS + 신규 PASS

- [ ] **Step 11: Commit**

```bash
git add src/lib/spss/sav-builder.ts src/lib/analytics/spss-excel-export.ts src/lib/spss/data-transformer.ts tests/unit/domains/spss/data-transformer.test.ts
git commit -m "feat: 숫자 단답형 SPSS 자동 Numeric 변수 처리"
```

---

## Task 8: 전체 검증 + 수동 확인

- [ ] **Step 1: 전체 타입 검증**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 2: 전체 단위 테스트**

Run: `pnpm vitest run`
Expected: 전부 PASS (신규 포함, 회귀 0)

- [ ] **Step 3: 빌드**

Run: `pnpm build`
Expected: 성공

- [ ] **Step 4: 수동 확인 (dev 서버)**

1. 빌더에서 단답형 질문 생성 → "숫자만 입력" 체크 → 초기값 0 설정 → 저장
2. 테스트 모드: 입력란에 0 자동 채움, 문자 입력 거부, 지우면 빈값 가능 확인
3. 토큰 prefill 입력 시 초기값 입력란 비활성화 + readonly 동작 확인
4. 발행 후 `/survey/[id]` 응답 페이지에서 동일 동작 확인 (snapshot 반영)
5. expression 표시 조건에서 해당 질문을 숫자 비교(`>` 등)로 설정 → 분기 동작 확인
6. analytics: 숫자 단답형 응답 수집 후 통계 카드(합계/평균/0 포함) 확인
7. SPSS .sav export: 해당 변수가 Numeric/Continuous 로, 0 은 0, 빈값은 system-missing 으로 기록 확인

- [ ] **Step 5: 최종 정리**

verification-before-completion 스킬로 결과(테스트/빌드 출력) 검증 후 완료 보고.
```

