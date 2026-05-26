# 표시 조건 에디터 정리 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `table-cell-check` 표시 조건 에디터의 자동 비교 노출을 펼치기 패턴으로 바꾸고, `NumericComparisonEditor` 의 "셀 산술" 좌변 탭을 신규 작성 경로에서 제거. `conditionType` 에 `'expression'` placeholder 추가.

**Architecture:** 데이터 모델 변경 최소화 (union 1개 추가). 기존 `binop` 데이터는 read-only 라벨로 표시하되 평가 경로는 그대로 유지. 다중 행 셀 타입 가드는 `detectCellTypeKind` 헬퍼로 일원화.

**Tech Stack:** Next.js 16 · React 19 · TypeScript strict · vitest (jsdom) · shadcn/ui (Switch, Button, Label)

**Spec:** [docs/superpowers/specs/2026-05-26-display-condition-cleanup-design.md](../specs/2026-05-26-display-condition-cleanup-design.md)

---

## 사전 컨텍스트

### 변경 대상 파일
- `src/types/survey.ts` — `QuestionCondition.conditionType` union
- `src/utils/cell-type-detector.ts` — **신규**. `detectCellTypeKind` 헬퍼
- `src/components/survey-builder/numeric-comparison-editor.tsx` — 좌변 탭 제거 + binop read-only 인라인 라벨
- `src/components/survey-builder/question-condition-editor.tsx` — 펼치기 패턴, conditionType 옵션 추가
- `tests/unit/utils/cell-type-detector.test.ts` — **신규**. 헬퍼 단위 테스트

### 기존 작동 메커니즘 (변경 안 함)
- `branch-logic.ts:1456-1462`: `numericComparison` 있으면 `evaluateNumericComparisonV2` 호출, 없으면 `expectedValues` 매칭, 둘 다 없으면 `isChecked = true` (통과 모드).
- `evaluateNumericComparisonV2`: `comparison.left` 가 정의되어 있으면 그걸로 좌변 계산, 아니면 outer `cellValue` 사용.
- `LeftOperandEditor` 의 binop 탭 UI 는 신규 작성 경로에서 진입 불가하게 막되, 컴포넌트 자체는 read-only 라벨용으로 남겨두지 않음 (인라인 라벨로 대체).

### 검증 명령
- 타입: `pnpm exec tsc --noEmit`
- 단위 테스트: `pnpm exec vitest run tests/unit/utils/cell-type-detector.test.ts`
- 회귀 (기존 numeric 평가): `pnpm exec vitest run tests/unit/utils/branch-logic-numeric.test.ts`
- 빌드: `pnpm build`

ESLint 는 메모리 `feedback_lint_infra_broken` 에 따라 환경 깨짐 — tsc + vitest + build 로 대체 검증.

---

## Task 1: conditionType union 에 'expression' 추가

**Files:**
- Modify: `src/types/survey.ts:152`

- [ ] **Step 1: union 확장**

`src/types/survey.ts:152` 의 라인:
```ts
  conditionType: 'value-match' | 'table-cell-check' | 'custom'; // 조건 타입
```
다음으로 교체:
```ts
  conditionType: 'value-match' | 'table-cell-check' | 'expression' | 'custom'; // 조건 타입
```

- [ ] **Step 2: 타입 컴파일 검증**

Run: `pnpm exec tsc --noEmit`
Expected: 통과. `question-condition-editor.tsx:401` 의 `as 'value-match' | 'table-cell-check' | 'custom'` 캐스팅이 union 좁히기로 남아있어도 컴파일 OK (Task 6 에서 확장).

- [ ] **Step 3: 커밋**

```bash
git add src/types/survey.ts
git commit -m "feat: conditionType union 에 expression placeholder 추가"
```

---

## Task 2: detectCellTypeKind 헬퍼 + 단위 테스트 (TDD)

**Files:**
- Create: `src/utils/cell-type-detector.ts`
- Create: `tests/unit/utils/cell-type-detector.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/unit/utils/cell-type-detector.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { Question } from '@/types/survey';
import { detectCellTypeKind } from '@/utils/cell-type-detector';

function makeQuestion(
  rows: Array<{ id: string; cells: Array<Partial<Question['tableRowsData'][number]['cells'][number]>> }>,
): Question {
  return {
    id: 'q1',
    surveyId: 's1',
    type: 'table',
    title: 't',
    required: false,
    order: 0,
    tableColumns: [
      { id: 'c0', label: '0' },
      { id: 'c1', label: '1' },
    ],
    tableRowsData: rows.map((r) => ({
      id: r.id,
      label: r.id,
      cells: r.cells.map((c, i) => ({
        id: `${r.id}-${i}`,
        content: '',
        type: 'text' as const,
        ...c,
      })),
    })),
  } as unknown as Question;
}

describe('detectCellTypeKind', () => {
  it('단일 행, number input 셀 → numeric-input', () => {
    const q = makeQuestion([
      { id: 'r1', cells: [{ type: 'text' }, { type: 'input', inputType: 'number' }] },
    ]);
    expect(detectCellTypeKind(q, ['r1'], 1)).toBe('numeric-input');
  });

  it('단일 행, text input 셀 → text-input', () => {
    const q = makeQuestion([
      { id: 'r1', cells: [{ type: 'text' }, { type: 'input', inputType: 'text' }] },
    ]);
    expect(detectCellTypeKind(q, ['r1'], 1)).toBe('text-input');
  });

  it('단일 행, inputType 미지정 input → text-input', () => {
    const q = makeQuestion([
      { id: 'r1', cells: [{ type: 'text' }, { type: 'input' }] },
    ]);
    expect(detectCellTypeKind(q, ['r1'], 1)).toBe('text-input');
  });

  it('단일 행, radio 셀 → option', () => {
    const q = makeQuestion([
      { id: 'r1', cells: [{ type: 'text' }, { type: 'radio' }] },
    ]);
    expect(detectCellTypeKind(q, ['r1'], 1)).toBe('option');
  });

  it('단일 행, checkbox 셀 → option', () => {
    const q = makeQuestion([
      { id: 'r1', cells: [{ type: 'text' }, { type: 'checkbox' }] },
    ]);
    expect(detectCellTypeKind(q, ['r1'], 1)).toBe('option');
  });

  it('단일 행, select 셀 → option', () => {
    const q = makeQuestion([
      { id: 'r1', cells: [{ type: 'text' }, { type: 'select' }] },
    ]);
    expect(detectCellTypeKind(q, ['r1'], 1)).toBe('option');
  });

  it('단일 행, image 셀 → unsupported', () => {
    const q = makeQuestion([
      { id: 'r1', cells: [{ type: 'text' }, { type: 'image' }] },
    ]);
    expect(detectCellTypeKind(q, ['r1'], 1)).toBe('unsupported');
  });

  it('단일 행, ranking 셀 → unsupported', () => {
    const q = makeQuestion([
      { id: 'r1', cells: [{ type: 'text' }, { type: 'ranking' }] },
    ]);
    expect(detectCellTypeKind(q, ['r1'], 1)).toBe('unsupported');
  });

  it('두 행, 같은 column 둘 다 number input → numeric-input', () => {
    const q = makeQuestion([
      { id: 'r1', cells: [{ type: 'text' }, { type: 'input', inputType: 'number' }] },
      { id: 'r2', cells: [{ type: 'text' }, { type: 'input', inputType: 'number' }] },
    ]);
    expect(detectCellTypeKind(q, ['r1', 'r2'], 1)).toBe('numeric-input');
  });

  it('두 행, 같은 column 이지만 종류가 섞임 → mixed', () => {
    const q = makeQuestion([
      { id: 'r1', cells: [{ type: 'text' }, { type: 'input', inputType: 'number' }] },
      { id: 'r2', cells: [{ type: 'text' }, { type: 'radio' }] },
    ]);
    expect(detectCellTypeKind(q, ['r1', 'r2'], 1)).toBe('mixed');
  });

  it('두 행, number input 과 text input 섞임 → mixed', () => {
    const q = makeQuestion([
      { id: 'r1', cells: [{ type: 'text' }, { type: 'input', inputType: 'number' }] },
      { id: 'r2', cells: [{ type: 'text' }, { type: 'input', inputType: 'text' }] },
    ]);
    expect(detectCellTypeKind(q, ['r1', 'r2'], 1)).toBe('mixed');
  });

  it('question 이 undefined → unsupported', () => {
    expect(detectCellTypeKind(undefined, ['r1'], 1)).toBe('unsupported');
  });

  it('rowIds 가 비어있음 → unsupported', () => {
    const q = makeQuestion([
      { id: 'r1', cells: [{ type: 'text' }, { type: 'input', inputType: 'number' }] },
    ]);
    expect(detectCellTypeKind(q, [], 1)).toBe('unsupported');
  });

  it('colIndex 가 undefined → unsupported', () => {
    const q = makeQuestion([
      { id: 'r1', cells: [{ type: 'text' }, { type: 'input', inputType: 'number' }] },
    ]);
    expect(detectCellTypeKind(q, ['r1'], undefined)).toBe('unsupported');
  });

  it('존재하지 않는 rowId → unsupported', () => {
    const q = makeQuestion([
      { id: 'r1', cells: [{ type: 'text' }, { type: 'input', inputType: 'number' }] },
    ]);
    expect(detectCellTypeKind(q, ['ghost'], 1)).toBe('unsupported');
  });

  it('colIndex 가 범위 밖 → unsupported', () => {
    const q = makeQuestion([
      { id: 'r1', cells: [{ type: 'text' }, { type: 'input', inputType: 'number' }] },
    ]);
    expect(detectCellTypeKind(q, ['r1'], 99)).toBe('unsupported');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run tests/unit/utils/cell-type-detector.test.ts`
Expected: FAIL — `Cannot find module '@/utils/cell-type-detector'`

- [ ] **Step 3: 헬퍼 구현**

`src/utils/cell-type-detector.ts`:
```ts
import type { Question } from '@/types/survey';

export type CellTypeKind =
  | 'numeric-input'
  | 'text-input'
  | 'option'
  | 'mixed'
  | 'unsupported';

function classifySingleCell(
  question: Question,
  rowId: string,
  colIndex: number,
): CellTypeKind {
  const row = question.tableRowsData?.find((r) => r.id === rowId);
  if (!row) return 'unsupported';
  const cell = row.cells?.[colIndex];
  if (!cell) return 'unsupported';
  if (cell.type === 'input') {
    return cell.inputType === 'number' ? 'numeric-input' : 'text-input';
  }
  if (cell.type === 'radio' || cell.type === 'checkbox' || cell.type === 'select') {
    return 'option';
  }
  return 'unsupported';
}

/**
 * 선택된 행 그룹의 column 셀 타입을 분류한다.
 * 모든 행에서 동일 종류여야 그 종류, 아니면 'mixed'.
 *
 * 입력 가드:
 * - question 이 없거나 rowIds 가 비어있거나 colIndex 미지정 → 'unsupported'
 * - 행/셀이 존재하지 않거나 분류 불가 셀(image, video, text, ranking 등) 포함 → 'unsupported'
 */
export function detectCellTypeKind(
  question: Question | undefined,
  rowIds: string[],
  colIndex: number | undefined,
): CellTypeKind {
  if (!question) return 'unsupported';
  if (rowIds.length === 0) return 'unsupported';
  if (colIndex === undefined) return 'unsupported';

  const kinds = rowIds.map((rid) => classifySingleCell(question, rid, colIndex));
  if (kinds.some((k) => k === 'unsupported')) return 'unsupported';

  const first = kinds[0];
  return kinds.every((k) => k === first) ? first : 'mixed';
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm exec vitest run tests/unit/utils/cell-type-detector.test.ts`
Expected: 16개 모두 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/utils/cell-type-detector.ts tests/unit/utils/cell-type-detector.test.ts
git commit -m "feat: detectCellTypeKind 헬퍼와 단위 테스트 추가"
```

---

## Task 3: NumericComparisonEditor 간소화 + binop read-only 라벨

**Files:**
- Modify: `src/components/survey-builder/numeric-comparison-editor.tsx`

기존 코드의 `LeftOperandEditor` import / `좌변` 섹션 / `sourceQuestionId` prop 을 제거하고, `value.left` 가 들어있으면 read-only 라벨을 인라인으로 렌더한다.

- [ ] **Step 1: 헬퍼 import 추가 (binop 라벨용)**

`numeric-comparison-editor.tsx` 상단의 import 블록에서 `LeftOperandEditor` import 라인을 제거하고, 같은 위치에 store import 를 추가:

기존 (15-16번째 줄):
```ts
import { LeftOperandEditor } from './left-operand-editor';
import { LookupComparandEditor } from './lookup-comparand-editor';
```
교체:
```ts
import { useSurveyBuilderStore } from '@/stores/survey-store';
import { LookupComparandEditor } from './lookup-comparand-editor';
```

- [ ] **Step 2: Props 에서 sourceQuestionId 제거**

기존:
```ts
interface NumericComparisonEditorProps {
  value?: NumericComparison;
  onChange: (value: NumericComparison) => void;
  idPrefix: string;
  sourceQuestionId?: string;
}
```
교체:
```ts
interface NumericComparisonEditorProps {
  value?: NumericComparison;
  onChange: (value: NumericComparison) => void;
  idPrefix: string;
}
```

함수 시그니처 `({ value, onChange, idPrefix, sourceQuestionId })` 에서도 `sourceQuestionId` 제거.

- [ ] **Step 3: BinopReadonlyLabel 인라인 컴포넌트 추가**

`numeric-comparison-editor.tsx` 의 `OPERATOR_OPTIONS` 정의 바로 아래에 추가:

```tsx
function formatCellRef(
  cellRef: { questionId: string; cellId: string },
  questions: ReturnType<typeof useSurveyBuilderStore.getState>['currentSurvey']['questions'],
): string {
  const q = questions.find((x) => x.id === cellRef.questionId);
  if (!q) return '(삭제된 셀)';
  for (const row of q.tableRowsData ?? []) {
    for (const cell of row.cells ?? []) {
      if (cell.id === cellRef.cellId) {
        const cellLabel = cell.exportLabel ?? cell.cellCode ?? cell.id.slice(0, 6);
        const rowLabel = row.label?.trim() || row.id.slice(0, 6);
        return `${q.title} > ${rowLabel} / ${cellLabel}`;
      }
    }
  }
  return '(삭제된 셀)';
}

function BinopReadonlyLabel({ left }: { left: NonNullable<NumericComparison['left']> }) {
  const questions = useSurveyBuilderStore((s) => s.currentSurvey.questions);

  let summary: string;
  if (left.kind === 'cell') {
    summary = formatCellRef(left, questions);
  } else {
    const leftLabel = formatCellRef(left.left, questions);
    const rightLabel =
      left.right.kind === 'literal'
        ? String(left.right.value)
        : formatCellRef(left.right, questions);
    summary = `${leftLabel} ${left.op} ${rightLabel}`;
  }

  return (
    <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs">
      <p className="font-semibold text-amber-900">
        이전 버전 &lsquo;셀 산술&rsquo; 좌변 (편집 불가)
      </p>
      <p className="font-mono text-amber-800">{summary}</p>
      <p className="text-amber-700">
        다시 만들려면 위 [×] 버튼으로 비교 조건을 해제 후 다시 추가하세요.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: 좌변 섹션 JSX 교체**

기존 (124-131번째 줄 부근):
```tsx
      <div className="space-y-1">
        <Label className="text-xs text-slate-600">좌변 (응답값 또는 산술)</Label>
        <LeftOperandEditor
          value={left}
          onChange={emitLeft}
          sourceQuestionId={sourceQuestionId}
        />
      </div>
```
교체:
```tsx
      {left !== undefined && <BinopReadonlyLabel left={left} />}
```

`emitLeft` 함수 (95-97번째 줄) 도 사용처가 사라졌으므로 제거.

- [ ] **Step 5: 타입 컴파일 + 호출자 확인**

`question-condition-editor.tsx` 의 `NumericComparisonEditor` 사용처 2곳 (`:541-557` 메인, `:683-695` 추가) 에 `sourceQuestionId={...}` prop 이 있다면 같이 제거.

Run: `pnpm exec tsc --noEmit`
Expected: 통과.

- [ ] **Step 6: 회귀 — 기존 numeric 평가 테스트**

Run: `pnpm exec vitest run tests/unit/utils/branch-logic-numeric.test.ts`
Expected: 기존 테스트 모두 PASS (평가 로직 무변경).

- [ ] **Step 7: 커밋**

```bash
git add src/components/survey-builder/numeric-comparison-editor.tsx src/components/survey-builder/question-condition-editor.tsx
git commit -m "refactor: NumericComparisonEditor 좌변 탭 제거 + binop read-only 라벨 인라인"
```

---

## Task 4: 메인 조건의 펼치기 패턴 적용

**Files:**
- Modify: `src/components/survey-builder/question-condition-editor.tsx:531-578` 부근

기존: 행/열 선택 직후 자동으로 NumericComparisonEditor 또는 TableOptionSelector 노출.
변경: 펼치기 버튼 (`+ 값 비교 조건 추가 ▾` / 펼친 후 `[×]`) 으로 감싸기 + `detectCellTypeKind` 분기.

- [ ] **Step 1: 헬퍼/아이콘 import**

`question-condition-editor.tsx` 상단 import 블록 수정:

기존:
```ts
import { AlertCircle, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
```
교체:
```ts
import { AlertCircle, ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react';
```

기존:
```ts
import { getMergedRowIds, getRowMergeInfo } from '@/utils/table-merge-helpers';
```
바로 아래에 추가:
```ts
import { detectCellTypeKind } from '@/utils/cell-type-detector';
```

- [ ] **Step 2: isNumericInputCell 함수 제거**

`question-condition-editor.tsx:25-38` 의 `isNumericInputCell` 함수를 삭제. (호출처는 Step 4 에서 `detectCellTypeKind` 로 교체)

- [ ] **Step 3: 메인 조건 펼치기 블록으로 교체**

기존 메인 조건의 비교 에디터 노출 블록 (`:531-578`):
```tsx
                            {/* 확인할 옵션 선택 (숫자 셀이면 NumericComparisonEditor, 아니면 TableOptionSelector) */}
                            {condition.tableConditions?.rowIds &&
                              condition.tableConditions.rowIds.length > 0 &&
                              condition.tableConditions?.cellColumnIndex !== undefined &&
                              sourceQuestion &&
                              (isNumericInputCell(
                                sourceQuestion,
                                condition.tableConditions.rowIds,
                                condition.tableConditions.cellColumnIndex,
                              ) ? (
                                <NumericComparisonEditor ... />
                              ) : (
                                <TableOptionSelector ... />
                              ))}
```

다음으로 교체:
```tsx
                            {/* 값 비교 조건 — 펼치기 패턴 */}
                            {condition.tableConditions?.rowIds &&
                              condition.tableConditions.rowIds.length > 0 &&
                              condition.tableConditions?.cellColumnIndex !== undefined && (
                                (() => {
                                  const kind = detectCellTypeKind(
                                    sourceQuestion,
                                    condition.tableConditions.rowIds,
                                    condition.tableConditions.cellColumnIndex,
                                  );
                                  const hasComparison =
                                    !!condition.tableConditions.expectedValues ||
                                    !!condition.tableConditions.numericComparison;
                                  const disabled = kind === 'mixed' || kind === 'unsupported';

                                  // 접힘 상태 + 비교 미설정 → 펼치기 버튼
                                  if (!hasComparison) {
                                    return (
                                      <div className="space-y-1">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          disabled={disabled}
                                          onClick={() => {
                                            // 셀 타입에 따라 빈 기본값 설정
                                            if (kind === 'option') {
                                              updateCondition(condition.id, {
                                                tableConditions: {
                                                  ...condition.tableConditions!,
                                                  expectedValues: [],
                                                  numericComparison: undefined,
                                                },
                                              });
                                            } else if (kind === 'numeric-input') {
                                              updateCondition(condition.id, {
                                                tableConditions: {
                                                  ...condition.tableConditions!,
                                                  expectedValues: undefined,
                                                  numericComparison: {
                                                    operator: '==',
                                                    right: { kind: 'literal', value: 0 },
                                                  },
                                                },
                                              });
                                            }
                                          }}
                                        >
                                          <Plus className="mr-1 h-3 w-3" />
                                          값 비교 조건 추가
                                        </Button>
                                        {kind === 'mixed' && (
                                          <p className="text-xs text-amber-700">
                                            선택한 행들의 셀 타입이 달라 값 비교를 적용할 수
                                            없습니다. 행 그룹을 나눠 별도 조건으로 만드세요.
                                          </p>
                                        )}
                                        {kind === 'text-input' && (
                                          <p className="text-xs text-slate-500">
                                            텍스트 일치 매칭은 다음 업데이트에서 제공됩니다.
                                            지금은 응답 유무로만 검사합니다.
                                          </p>
                                        )}
                                        {kind === 'unsupported' && (
                                          <p className="text-xs text-slate-500">
                                            선택한 셀 타입은 값 비교를 지원하지 않습니다.
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }

                                  // 펼친 상태 — 셀 타입에 맞는 에디터 + 닫기 버튼
                                  return (
                                    <div className="space-y-2 rounded-md border border-slate-200 p-3">
                                      <div className="flex items-center justify-between">
                                        <Label className="text-sm font-medium">
                                          값 비교 조건
                                        </Label>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            updateCondition(condition.id, {
                                              tableConditions: {
                                                ...condition.tableConditions!,
                                                expectedValues: undefined,
                                                numericComparison: undefined,
                                              },
                                            });
                                          }}
                                          aria-label="값 비교 조건 해제"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                      {kind === 'numeric-input' ? (
                                        <NumericComparisonEditor
                                          idPrefix={`numeric-${condition.id}`}
                                          value={condition.tableConditions.numericComparison}
                                          onChange={(nc) => {
                                            updateCondition(condition.id, {
                                              tableConditions: {
                                                ...condition.tableConditions!,
                                                expectedValues: undefined,
                                                numericComparison: nc,
                                              },
                                            });
                                          }}
                                        />
                                      ) : kind === 'option' ? (
                                        <TableOptionSelector
                                          question={sourceQuestion!}
                                          rowIds={condition.tableConditions.rowIds}
                                          colIndex={condition.tableConditions.cellColumnIndex}
                                          expectedValues={condition.tableConditions.expectedValues}
                                          onChange={(values) => {
                                            updateCondition(condition.id, {
                                              tableConditions: {
                                                ...condition.tableConditions!,
                                                expectedValues: values,
                                                numericComparison: undefined,
                                              },
                                            });
                                          }}
                                          multipleRows={
                                            condition.tableConditions.rowIds.length > 1
                                          }
                                        />
                                      ) : (
                                        // text-input / mixed / unsupported 인데 이미 데이터가 있는 경우
                                        // (예: 셀 타입이 나중에 바뀜) — read-only 안내만
                                        <p className="text-xs text-amber-700">
                                          이 비교 조건은 더 이상 셀 타입과 일치하지 않습니다.
                                          [×] 로 해제하고 다시 추가해주세요.
                                        </p>
                                      )}
                                    </div>
                                  );
                                })()
                              )}
```

- [ ] **Step 4: 타입 컴파일**

Run: `pnpm exec tsc --noEmit`
Expected: 통과.

- [ ] **Step 5: 수동 검증**

`pnpm dev` 실행 후 빌더에서:
- 새 표시 조건 추가 → 테이블 질문 선택 → table-cell-check
- number input 셀이 있는 행 선택 + 열 인덱스 → "+ 값 비교 조건 추가" 버튼 보임
- 버튼 클릭 → NumericComparisonEditor 펼침 (좌변 탭 없음, 비교 + 우변만)
- [×] 클릭 → 다시 접힘
- radio 셀이 있는 행으로 바꾸면 → 펼치기 시 TableOptionSelector
- 행 두 개 선택했는데 셀 타입이 다르면 → 버튼 disabled + 안내 문구

- [ ] **Step 6: 커밋**

```bash
git add src/components/survey-builder/question-condition-editor.tsx
git commit -m "refactor: 메인 표시 조건에 값 비교 펼치기 패턴 적용"
```

---

## Task 5: 추가 조건(additionalConditions) 의 펼치기 패턴 적용

**Files:**
- Modify: `src/components/survey-builder/question-condition-editor.tsx:668-719` 부근

Task 4 와 동일한 패턴을 추가 조건 경로에 적용. `additionalConditions` 자체의 outer Switch (`:588-604`) 는 변경 안 함.

- [ ] **Step 1: 추가 조건 비교 에디터 노출 블록 교체**

기존 (`:668-719`):
```tsx
                                {/* 추가 조건 확인할 옵션 선택 (숫자 셀이면 NumericComparisonEditor, 아니면 TableOptionSelector) */}
                                {condition.additionalConditions &&
                                  condition.additionalConditions.cellColumnIndex !== undefined &&
                                  sourceQuestion &&
                                  (() => {
                                    const ac = condition.additionalConditions;
                                    const effectiveRowIds =
                                      (condition.tableConditions?.rowIds?.length ?? 0) > 0
                                        ? (condition.tableConditions?.rowIds ?? [])
                                        : sourceQuestion.tableRowsData?.map((r) => r.id) || [];
                                    return isNumericInputCell(...) ? (
                                      <NumericComparisonEditor ... />
                                    ) : ac.checkType === 'input' ? null : (
                                      <TableOptionSelector ... />
                                    );
                                  })()}
```

다음으로 교체:
```tsx
                                {/* 추가 조건 — 값 비교 펼치기 패턴 */}
                                {condition.additionalConditions &&
                                  condition.additionalConditions.cellColumnIndex !== undefined &&
                                  (() => {
                                    const ac = condition.additionalConditions!;
                                    const effectiveRowIds =
                                      (condition.tableConditions?.rowIds?.length ?? 0) > 0
                                        ? (condition.tableConditions?.rowIds ?? [])
                                        : sourceQuestion?.tableRowsData?.map((r) => r.id) || [];
                                    const kind = detectCellTypeKind(
                                      sourceQuestion,
                                      effectiveRowIds,
                                      ac.cellColumnIndex,
                                    );
                                    const hasComparison =
                                      !!ac.expectedValues || !!ac.numericComparison;
                                    const disabled = kind === 'mixed' || kind === 'unsupported';

                                    if (!hasComparison) {
                                      return (
                                        <div className="space-y-1">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={disabled}
                                            onClick={() => {
                                              if (kind === 'option') {
                                                updateCondition(condition.id, {
                                                  additionalConditions: {
                                                    ...ac,
                                                    expectedValues: [],
                                                    numericComparison: undefined,
                                                  },
                                                });
                                              } else if (kind === 'numeric-input') {
                                                updateCondition(condition.id, {
                                                  additionalConditions: {
                                                    ...ac,
                                                    expectedValues: undefined,
                                                    numericComparison: {
                                                      operator: '==',
                                                      right: { kind: 'literal', value: 0 },
                                                    },
                                                  },
                                                });
                                              }
                                            }}
                                          >
                                            <Plus className="mr-1 h-3 w-3" />
                                            값 비교 조건 추가
                                          </Button>
                                          {kind === 'mixed' && (
                                            <p className="text-xs text-amber-700">
                                              선택한 행들의 셀 타입이 달라 값 비교를 적용할 수
                                              없습니다.
                                            </p>
                                          )}
                                          {kind === 'text-input' && (
                                            <p className="text-xs text-slate-500">
                                              텍스트 일치 매칭은 다음 업데이트에서 제공됩니다.
                                              지금은 응답 유무로만 검사합니다.
                                            </p>
                                          )}
                                          {kind === 'unsupported' && (
                                            <p className="text-xs text-slate-500">
                                              선택한 셀 타입은 값 비교를 지원하지 않습니다.
                                            </p>
                                          )}
                                        </div>
                                      );
                                    }

                                    return (
                                      <div className="space-y-2 rounded-md border border-slate-200 p-3">
                                        <div className="flex items-center justify-between">
                                          <Label className="text-sm font-medium">
                                            값 비교 조건
                                          </Label>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              updateCondition(condition.id, {
                                                additionalConditions: {
                                                  ...ac,
                                                  expectedValues: undefined,
                                                  numericComparison: undefined,
                                                },
                                              });
                                            }}
                                            aria-label="값 비교 조건 해제"
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                        {kind === 'numeric-input' ? (
                                          <NumericComparisonEditor
                                            idPrefix={`numeric-additional-${condition.id}`}
                                            value={ac.numericComparison}
                                            onChange={(nc) => {
                                              updateCondition(condition.id, {
                                                additionalConditions: {
                                                  ...ac,
                                                  expectedValues: undefined,
                                                  numericComparison: nc,
                                                },
                                              });
                                            }}
                                          />
                                        ) : kind === 'option' && sourceQuestion ? (
                                          <TableOptionSelector
                                            question={sourceQuestion}
                                            rowIds={effectiveRowIds}
                                            colIndex={ac.cellColumnIndex}
                                            expectedValues={ac.expectedValues}
                                            onChange={(values) => {
                                              updateCondition(condition.id, {
                                                additionalConditions: {
                                                  ...ac,
                                                  expectedValues: values,
                                                  numericComparison: undefined,
                                                },
                                              });
                                            }}
                                            helpText="선택한 옵션들 중 하나가 선택되었는지 확인합니다."
                                            multipleRows={
                                              (condition.tableConditions?.rowIds?.length ?? 0) > 1 ||
                                              (condition.tableConditions?.rowIds?.length ?? 0) === 0
                                            }
                                          />
                                        ) : (
                                          <p className="text-xs text-amber-700">
                                            이 비교 조건은 더 이상 셀 타입과 일치하지 않습니다.
                                            [×] 로 해제하고 다시 추가해주세요.
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })()}
```

- [ ] **Step 2: 타입 컴파일**

Run: `pnpm exec tsc --noEmit`
Expected: 통과.

- [ ] **Step 3: 수동 검증**

빌더에서:
- 메인 조건 + 추가 조건 Switch 켜기 → 같은 펼치기 패턴이 추가 조건 영역에도 보이는지 확인
- 메인 / 추가 둘 다 펼치고 셀 타입 분기 각각 잘 작동하는지

- [ ] **Step 4: 커밋**

```bash
git add src/components/survey-builder/question-condition-editor.tsx
git commit -m "refactor: 추가 조건에도 값 비교 펼치기 패턴 적용"
```

---

## Task 6: conditionType 드롭다운에 expression placeholder 추가

**Files:**
- Modify: `src/components/survey-builder/question-condition-editor.tsx:392-410` 부근

- [ ] **Step 1: union 캐스팅 확장 + 옵션 추가**

기존 (`:393-408`):
```tsx
                          <select
                            id={`type-${condition.id}`}
                            value={condition.conditionType}
                            onChange={(e) =>
                              updateCondition(condition.id, {
                                conditionType: e.target.value as
                                  | 'value-match'
                                  | 'table-cell-check'
                                  | 'custom',
                              })
                            }
                            className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          >
                            <option value="value-match">값 일치 (radio, select, checkbox)</option>
                            <option value="table-cell-check">테이블 셀 체크 확인</option>
                          </select>
```

교체:
```tsx
                          <select
                            id={`type-${condition.id}`}
                            value={condition.conditionType}
                            onChange={(e) =>
                              updateCondition(condition.id, {
                                conditionType: e.target.value as
                                  | 'value-match'
                                  | 'table-cell-check'
                                  | 'expression'
                                  | 'custom',
                              })
                            }
                            className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          >
                            <option value="value-match">값 일치 (radio, select, checkbox)</option>
                            <option value="table-cell-check">테이블 셀 체크 확인</option>
                            <optgroup label="준비 중">
                              <option value="expression" disabled>
                                장기 계산식
                              </option>
                            </optgroup>
                          </select>
```

- [ ] **Step 2: expression 본문 안내 박스 (방어용)**

`{condition.conditionType === 'value-match' && (...)}` 블록 (`:726` 부근) 의 형제로 추가:

```tsx
                      {condition.conditionType === 'expression' && (
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                          본 조건 타입은 다음 업데이트에서 제공됩니다.
                        </div>
                      )}
```

(드롭다운에서 disabled 라 정상 경로로는 선택 불가지만, 데이터가 외부에서 주입된 케이스 대비)

- [ ] **Step 3: 타입 컴파일**

Run: `pnpm exec tsc --noEmit`
Expected: 통과.

- [ ] **Step 4: 수동 검증**

빌더 드롭다운에서 "장기 계산식 (준비 중)" 항목이 회색으로 disabled 표시되는지.

- [ ] **Step 5: 커밋**

```bash
git add src/components/survey-builder/question-condition-editor.tsx
git commit -m "feat: conditionType 드롭다운에 expression placeholder 추가"
```

---

## Task 7: 회귀 검증 + 빌드

**Files:**
- 없음 (검증만)

- [ ] **Step 1: 전체 단위 테스트**

Run: `pnpm exec vitest run`
Expected: 모두 PASS. 특히:
- `tests/unit/utils/branch-logic-numeric.test.ts` (기존 numeric 평가 결과 동일)
- `tests/unit/utils/cell-type-detector.test.ts` (Task 2 신규)

- [ ] **Step 2: 타입 컴파일 전체**

Run: `pnpm exec tsc --noEmit`
Expected: 통과.

- [ ] **Step 3: 프로덕션 빌드**

Run: `pnpm build`
Expected: 통과.

- [ ] **Step 4: 수동 회귀 시나리오 (개발 서버)**

`pnpm dev` 실행 후:
1. 기존 binop 데이터를 가진 설문이 있다면 빌더에서 열어 → read-only 라벨 뜨고 평가 정상 작동 확인 (없으면 skip)
2. 새 표시 조건 추가 → table-cell-check → 펼치기 패턴 작동 (Task 4 시나리오 재확인)
3. 추가 조건 켜기 → 펼치기 패턴 작동 (Task 5 시나리오 재확인)
4. conditionType 드롭다운에서 expression placeholder 확인 (Task 6)
5. 표시 조건이 설문 응답 페이지에서 정상 평가되는지 (preview 모드)

- [ ] **Step 5: 메모리 업데이트 안내**

작업 완료 시 `~/.claude/projects/-Users-ljwoon-study-next-study-survey-table-project/memory/` 에 메모 한 줄 추가 (PR 머지 후):

- 신규 메모리 파일: `project_display_condition_cleanup_done.md` — "표시 조건 펼치기 패턴 + expression placeholder main 머지"
- `project_display_condition_arithmetic_future.md` 의 "L1만 다듬기" 부분이 이번 작업으로 일부 충족됨을 반영

(이 단계는 작업 종료 후 별도 메시지에서 처리)

---

## Self-Review Notes

이 plan 작성 후 점검:

- ✅ Spec § 3.1 (`conditionType` union 'expression' 추가) → Task 1
- ✅ Spec § 3.2 (드롭다운 옵션 + 안내 박스) → Task 6
- ✅ Spec § 3.3 (펼치기 패턴 메인) → Task 4
- ✅ Spec § 3.3 (펼치기 패턴 추가 조건) → Task 5
- ✅ Spec § 3.4 (NumericComparisonEditor 간소화 + binop read-only) → Task 3
- ✅ Spec § 3.5 (detectCellTypeKind 헬퍼) → Task 2
- ✅ Spec § 5 (테스트 전략) → Task 2 (TDD), Task 7 (회귀)
- ✅ Spec § 6 (마이그레이션 없음 + 호환성) → Task 3 의 read-only 표시로 호환
