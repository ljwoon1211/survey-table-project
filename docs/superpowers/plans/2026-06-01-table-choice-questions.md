# 테이블 렌더링 radio/checkbox 질문 (Case A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 본질은 단일 radio/checkbox 변수지만 설명 테이블(정의·예시·이미지)을 띄워야 하는 질문을, 타입을 `radio`/`checkbox`로 유지한 채 내장 테이블의 `choice_opt` 셀을 옵션 소스로 쓰도록 만들어 분석/SPSS export 가 일반 radio/checkbox 처럼 깨끗하게 동작하게 한다.

**Architecture:** 순위형 Case 2 (`ranking_opt` + `resolveRankingOptions`)를 radio/checkbox 로 미러링한다. 새 셀 타입 `choice_opt` 을 추가하고, 옵션 소스 추상화 `src/utils/choice-source.ts` 의 `resolveChoiceOptions(question)` 가 셀→`QuestionOption[]` 로 변환한다. 응답은 **일반 radio/checkbox 와 동일 shape**(radio=값1개, checkbox=값배열, 값=`cell.id`)로 저장하므로 집계 로직은 그대로 두고, 옵션 메타를 읽는 소비처만 `resolveChoiceOptions` 로 교체한다.

**핵심 설계 결정 (스펙 정련):**
- 스펙은 `Question.optionsSource` 플래그 추가를 제안했으나, **DB 컬럼/마이그레이션/save-actions/schema-types 변경을 피하기 위해 "choice_opt 셀 존재 여부"로 table-source 를 파생**한다. 단일 진실 = 셀. `isChoiceTableSource(question) = (radio|checkbox) && choice_opt 셀이 1개 이상`. 빌더 토글은 빈 테이블 스캐폴드 생성/제거로 상태를 표현하고, 저장 검증이 "choice_opt 셀 ≥ 1" 을 강제하므로 빈 table-source 질문은 영속될 수 없다.
- "기타(직접입력) 셀"(`isOtherChoiceCell`)은 순위형의 sentinel(`__other__`) 방식이 아니라 **기존 radio/checkbox 의 `allowTextInput` 사이드카 텍스트 경로(`__optTexts__`)를 재사용**한다. `isOtherChoiceCell=true` → 해석 시 `allowTextInput=true` + 기본 라벨 "기타 (직접 입력)" 로 매핑. 별도 분석/SPSS 경로 불필요.
- 응답 렌더는 순위형(테이블=읽기전용 참고 + 별도 입력 UI)과 달리 **선택 input 이 테이블 셀 안에** 있어야 하므로, `TablePreview` 에 `renderCell` 오버라이드 prop 을 추가하고 `choice_opt` 셀만 인터랙티브 input 으로 렌더하는 `ChoiceTableResponse` 를 만든다.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Zustand, Drizzle ORM, vitest (`tests/**/*.test.{ts,tsx}` only). Lint 인프라는 깨져 있으므로(`pnpm lint` 실패) `pnpm tsc --noEmit` + `pnpm vitest` + `pnpm build` 로 검증.

**비목표:** Case B(테이블 내부 다중 논리그룹/MRSETS), 기존 `type='table'` 질문 자동 마이그레이션, select/multiselect 의 table 소스화.

---

## File Structure

생성:
- `src/utils/choice-source.ts` — 옵션 소스 추상화 (`ranking-source.ts` 미러)
- `src/components/survey-builder/choice-opt-cell-tab.tsx` — 셀 편집 모달의 choice_opt 탭 (`ranking-opt-cell-tab.tsx` 미러)
- `src/components/survey-response/choice-table-response.tsx` — 테이블 내장 radio/checkbox 응답 렌더
- `tests/unit/lib/choice-source.test.ts` — choice-source 단위 테스트
- `tests/integration/choice-table-response.test.ts` — 응답 shape + 분기 통합 테스트

수정 (데이터 모델):
- `src/types/survey.ts` — `TableCell.type` 에 `'choice_opt'`, `TableCell` 에 `choiceLabel`/`isOtherChoiceCell`/`branchRule`/`allowTextInput`/`textInputPlaceholder` 추가
- `src/db/schema/schema-types.ts` — 동일 `TableCell` 필드 동기화

수정 (빌더):
- `src/components/survey-builder/cell-content-modal.tsx` — choice_opt 탭 등록/저장
- `src/components/survey-builder/question-basic-tab.tsx` — radio/checkbox "설명 테이블" 토글 + needsOptions/showTableEditor 분기
- `src/components/survey-builder/question-edit-modal.tsx` — choice table-source 검증
- `src/utils/table-cell-code-generator.ts` — `INTERACTIVE_CELL_TYPES` 에 choice_opt
- `src/utils/drag-copy-utils.ts` — `TYPE_SPECIFIC_KEYS.choice_opt`
- `src/utils/cell-library-helpers.ts` — preview/saveable/label
- `src/components/survey-builder/table-preview.tsx` — `renderCell` 오버라이드 prop

수정 (응답):
- `src/components/survey-response/question-input.tsx` — RadioQuestion/CheckboxQuestion 에 table-source 분기

수정 (분석/SPSS/분기):
- `src/lib/analytics/analyzer.ts` — `resolveChoiceOptions` 어댑터
- `src/lib/analytics/spss-excel-export.ts` — checkbox/radio 컬럼 생성 + buildDataRows
- `src/lib/spss/sav-builder.ts` — VALUE LABELS
- `src/lib/analytics/data-transformer.ts` — 응답값 변환
- `src/utils/branch-logic.ts` — radio/checkbox 분기 평가

---

## Phase 1 — 데이터 모델

### Task 1: TableCell 에 choice_opt 타입 + 필드 추가

**Files:**
- Modify: `src/types/survey.ts` (TableCell, 라인 251~313 영역)
- Modify: `src/db/schema/schema-types.ts` (TableCell 축약 정의, 라인 91~129 영역)

- [ ] **Step 1: `src/types/survey.ts` TableCell.type 유니온에 choice_opt 추가**

`type:` 유니온(현재 `'ranking_opt'` 로 끝남)을 수정:

```typescript
  type:
    | 'text'
    | 'image'
    | 'video'
    | 'checkbox'
    | 'radio'
    | 'select'
    | 'input'
    | 'ranking'
    | 'ranking_opt'
    | 'choice_opt'; // Case A: 이 셀이 질문 레벨 radio/checkbox 의 옵션 소스로 사용됨
```

- [ ] **Step 2: `src/types/survey.ts` TableCell 에 choice_opt 전용 필드 추가**

`isOtherRankingCell?` 필드 정의 바로 아래(라인 300 근처)에 추가:

```typescript
  // choice_opt 셀 (type='choice_opt') — Case A radio/checkbox 옵션 소스
  // 옵션 라벨. 선택 열 셀은 보통 content 가 비어 있어(라벨은 다른 열) 명시적으로 지정.
  choiceLabel?: string;
  // 이 셀을 "기타 (직접 입력)" 옵션으로 사용 — 해석 시 allowTextInput=true 로 매핑.
  isOtherChoiceCell?: boolean;
  // 이 옵션 선택 시 분기. (resolveChoiceOptions 가 QuestionOption.branchRule 로 전달)
  branchRule?: BranchRule;
  // 선택 시 사이드카 텍스트 입력 (radio/checkbox 옵션과 동일 의미). __optTexts__ 로 저장됨.
  allowTextInput?: boolean;
  textInputPlaceholder?: string;
```

> `exportLabel`/`optionCode`/`spssNumericCode` 는 TableCell 에 이미 존재하므로 재사용.

- [ ] **Step 3: `src/db/schema/schema-types.ts` TableCell 동기화**

schema-types 의 TableCell `type` 유니온에 `'choice_opt'` 를 추가하고, 위 5개 필드(`choiceLabel`, `isOtherChoiceCell`, `branchRule`, `allowTextInput`, `textInputPlaceholder`)를 동일하게 추가한다. (이 정의는 Drizzle `NewQuestion['tableRowsData']` 타이핑에 쓰이므로 누락 시 save-actions 에서 타입 에러.)

- [ ] **Step 4: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: PASS (새 optional 필드만 추가했으므로 기존 코드 영향 없음)

- [ ] **Step 5: Commit**

```bash
git add src/types/survey.ts src/db/schema/schema-types.ts
git commit -m "feat: TableCell choice_opt 타입 및 옵션 소스 필드 추가"
```

---

## Phase 2 — 옵션 소스 추상화 (TDD)

### Task 2: choice-source.ts + 단위 테스트

**Files:**
- Create: `src/utils/choice-source.ts`
- Test: `tests/unit/lib/choice-source.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/lib/choice-source.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import type { Question, TableCell, TableRow } from '@/types/survey';
import {
  collectChoiceOptCells,
  hasExistingOtherChoiceCell,
  isChoiceTableSource,
  resolveChoiceOptions,
} from '@/utils/choice-source';

function cell(partial: Partial<TableCell>): TableCell {
  return { id: 'c', content: '', type: 'text', ...partial } as TableCell;
}
function row(cells: TableCell[]): TableRow {
  return { id: 'r', label: '', cells };
}
function q(partial: Partial<Question>): Question {
  return {
    id: 'q1',
    type: 'radio',
    title: 'Q',
    required: false,
    order: 0,
    ...partial,
  } as Question;
}

describe('choice-source', () => {
  it('manual 소스(choice_opt 셀 없음)는 question.options 를 그대로 반환', () => {
    const question = q({
      type: 'radio',
      options: [{ id: 'o1', label: 'A', value: 'a' }],
    });
    expect(resolveChoiceOptions(question)).toEqual([{ id: 'o1', label: 'A', value: 'a' }]);
    expect(isChoiceTableSource(question)).toBe(false);
  });

  it('choice_opt 셀이 있으면 셀에서 옵션을 수집 (value=cell.id, label=choiceLabel)', () => {
    const question = q({
      type: 'checkbox',
      tableRowsData: [
        row([
          cell({ id: 'lbl1', type: 'text', content: '컴퓨터 비전' }),
          cell({ id: 'sel1', type: 'choice_opt', choiceLabel: '컴퓨터 비전', spssNumericCode: 1 }),
        ]),
        row([
          cell({ id: 'lbl2', type: 'text', content: '음성 처리' }),
          cell({ id: 'sel2', type: 'choice_opt', choiceLabel: '음성 처리', spssNumericCode: 2 }),
        ]),
      ],
    });
    expect(isChoiceTableSource(question)).toBe(true);
    expect(resolveChoiceOptions(question)).toEqual([
      { id: 'sel1', value: 'sel1', label: '컴퓨터 비전', optionCode: undefined, spssNumericCode: 1, branchRule: undefined, allowTextInput: undefined, textInputPlaceholder: undefined },
      { id: 'sel2', value: 'sel2', label: '음성 처리', optionCode: undefined, spssNumericCode: 2, branchRule: undefined, allowTextInput: undefined, textInputPlaceholder: undefined },
    ]);
  });

  it('choiceLabel 없으면 content, 둘 다 없으면 fallback', () => {
    const question = q({
      type: 'radio',
      tableRowsData: [row([cell({ id: 's', type: 'choice_opt', content: '본문라벨' })])],
    });
    expect(resolveChoiceOptions(question)[0].label).toBe('본문라벨');
  });

  it('spssNumericCode 없으면 수집 순서 1-based 인덱스로 폴백', () => {
    const question = q({
      type: 'radio',
      tableRowsData: [
        row([cell({ id: 'a', type: 'choice_opt', choiceLabel: 'A' })]),
        row([cell({ id: 'b', type: 'choice_opt', choiceLabel: 'B' })]),
      ],
    });
    const opts = resolveChoiceOptions(question);
    expect(opts[0].spssNumericCode).toBe(1);
    expect(opts[1].spssNumericCode).toBe(2);
  });

  it('isHidden 셀(rowspan/colspan continuation)은 제외', () => {
    const question = q({
      type: 'radio',
      tableRowsData: [
        row([
          cell({ id: 'a', type: 'choice_opt', choiceLabel: 'A' }),
          cell({ id: 'b', type: 'choice_opt', choiceLabel: 'B', isHidden: true }),
        ]),
      ],
    });
    expect(collectChoiceOptCells(question.tableRowsData)).toHaveLength(1);
  });

  it('isOtherChoiceCell 셀은 allowTextInput=true + 기본 라벨로 해석', () => {
    const question = q({
      type: 'radio',
      tableRowsData: [row([cell({ id: 'o', type: 'choice_opt', isOtherChoiceCell: true })])],
    });
    const opt = resolveChoiceOptions(question)[0];
    expect(opt.allowTextInput).toBe(true);
    expect(opt.label).toBe('기타 (직접 입력)');
  });

  it('branchRule/allowTextInput/textInputPlaceholder 를 셀에서 옵션으로 전달', () => {
    const branch = { id: 'br', value: 's', action: 'end' as const };
    const question = q({
      type: 'radio',
      tableRowsData: [
        row([
          cell({
            id: 's',
            type: 'choice_opt',
            choiceLabel: 'A',
            branchRule: branch,
            allowTextInput: true,
            textInputPlaceholder: '상세',
          }),
        ]),
      ],
    });
    const opt = resolveChoiceOptions(question)[0];
    expect(opt.branchRule).toEqual(branch);
    expect(opt.allowTextInput).toBe(true);
    expect(opt.textInputPlaceholder).toBe('상세');
  });

  it('hasExistingOtherChoiceCell 는 excludeCellId 를 제외하고 검사', () => {
    const rows = [
      row([cell({ id: 'o', type: 'choice_opt', isOtherChoiceCell: true })]),
    ];
    expect(hasExistingOtherChoiceCell(rows)).toBe(true);
    expect(hasExistingOtherChoiceCell(rows, 'o')).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm vitest run tests/unit/lib/choice-source.test.ts`
Expected: FAIL — `Cannot find module '@/utils/choice-source'`

- [ ] **Step 3: `src/utils/choice-source.ts` 구현**

```typescript
import type { Question, QuestionOption, TableCell, TableRow } from '@/types/survey';

/**
 * tableRowsData 에서 유효한 `choice_opt` 셀을 순서대로 수집.
 * rowspan/colspan continuation 으로 숨겨진 셀(isHidden)은 제외.
 * Case A 옵션 소스 변환 / 유효성 검사 / 카운트 등이 공유하는 단일 진실.
 */
export function collectChoiceOptCells(tableRowsData: TableRow[] | undefined): TableCell[] {
  if (!tableRowsData) return [];
  const cells: TableCell[] = [];
  for (const row of tableRowsData) {
    for (const cell of row.cells) {
      if (cell.type !== 'choice_opt') continue;
      if (cell.isHidden) continue;
      cells.push(cell);
    }
  }
  return cells;
}

/** choice_opt 셀의 표시 라벨: choiceLabel > content > fallback. */
function buildChoiceOptLabel(cell: TableCell, fallback: string): string {
  return (cell.choiceLabel ?? '').trim() || (cell.content ?? '').trim() || fallback;
}

/**
 * radio/checkbox 질문이 "테이블 내장 옵션 소스"인지.
 * choice_opt 셀이 1개 이상이면 table-source 로 본다 (별도 플래그/컬럼 없음).
 */
export function isChoiceTableSource(question: Question): boolean {
  if (question.type !== 'radio' && question.type !== 'checkbox') return false;
  return collectChoiceOptCells(question.tableRowsData).length > 0;
}

/**
 * radio/checkbox 질문의 옵션 소스를 통합 반환.
 * - choice_opt 셀 없음(manual): question.options 그대로
 * - choice_opt 셀 있음(table): 셀을 QuestionOption 으로 변환
 *   - id/value: cell.id (UUID — 셀 이동/라벨 변경에 강건. 응답값도 cell.id)
 *   - label: choiceLabel > content > '(라벨 없음)'
 *   - spssNumericCode: cell.spssNumericCode 우선, 없으면 수집 순서 1-based 인덱스
 *   - branchRule / allowTextInput / textInputPlaceholder: 셀에서 전달
 *   - isOtherChoiceCell=true → allowTextInput=true + 기본 라벨 "기타 (직접 입력)"
 */
export function resolveChoiceOptions(question: Question): QuestionOption[] {
  const cells = collectChoiceOptCells(question.tableRowsData);
  if (cells.length === 0) return question.options ?? [];

  return cells.map((cell, idx) => {
    const isOther = cell.isOtherChoiceCell === true;
    return {
      id: cell.id,
      value: cell.id,
      label: buildChoiceOptLabel(cell, isOther ? '기타 (직접 입력)' : '(라벨 없음)'),
      optionCode: cell.optionCode,
      spssNumericCode: cell.spssNumericCode ?? idx + 1,
      branchRule: cell.branchRule,
      allowTextInput: isOther ? true : cell.allowTextInput,
      textInputPlaceholder: cell.textInputPlaceholder,
    };
  });
}

/**
 * 같은 tableRowsData 내에 isOtherChoiceCell=true 인 유효 choice_opt 셀이 있는지.
 * excludeCellId 가 있으면 해당 셀은 제외 (자기 자신 검사 제외용).
 */
export function hasExistingOtherChoiceCell(
  rows: TableRow[] | undefined,
  excludeCellId?: string,
): boolean {
  if (!rows) return false;
  return rows.some((row) =>
    row.cells.some(
      (c) =>
        c.id !== excludeCellId
        && c.type === 'choice_opt'
        && !c.isHidden
        && c.isOtherChoiceCell === true,
    ),
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run tests/unit/lib/choice-source.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/choice-source.ts tests/unit/lib/choice-source.test.ts
git commit -m "feat: choice-source 옵션 소스 추상화 추가"
```

---

## Phase 3 — 빌더 UI

### Task 3: 셀 타입 등록 지점 미러링

**Files:**
- Modify: `src/utils/table-cell-code-generator.ts` (라인 7)
- Modify: `src/utils/drag-copy-utils.ts` (라인 36 근처)
- Modify: `src/utils/cell-library-helpers.ts` (라인 157~158, 192~201, 218 근처)

- [ ] **Step 1: INTERACTIVE_CELL_TYPES 에 choice_opt 추가**

`src/utils/table-cell-code-generator.ts`:

```typescript
export const INTERACTIVE_CELL_TYPES = new Set(['checkbox', 'radio', 'select', 'input', 'ranking_opt', 'choice_opt']);
```

- [ ] **Step 2: drag-copy 타입별 키 추가**

`src/utils/drag-copy-utils.ts` 의 `TYPE_SPECIFIC_KEYS` 객체에 추가:

```typescript
  choice_opt: ['choiceLabel', 'isOtherChoiceCell', 'branchRule', 'allowTextInput', 'textInputPlaceholder'],
```

- [ ] **Step 3: cell-library-helpers 미러링**

`getCellPreviewText` 의 switch 에 `ranking_opt` 케이스 옆에 추가:

```typescript
    case 'choice_opt':
      return cell.choiceLabel || cell.content || '(보기 옵션)';
```

`isCellSaveable` 에 `ranking_opt` 분기 옆에 추가:

```typescript
  if (cell.type === 'choice_opt') {
    if (cell.isOtherChoiceCell === true) return true;
    return !!((cell.choiceLabel ?? '').trim() || (cell.content ?? '').trim() || cell.imageUrl || cell.videoUrl);
  }
```

`CELL_TYPE_LABELS` 에 추가:

```typescript
  choice_opt: '보기 옵션',
```

- [ ] **Step 4: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/table-cell-code-generator.ts src/utils/drag-copy-utils.ts src/utils/cell-library-helpers.ts
git commit -m "feat: choice_opt 셀 타입 빌더 유틸 등록"
```

### Task 4: choice-opt 셀 편집 탭

**Files:**
- Create: `src/components/survey-builder/choice-opt-cell-tab.tsx`

- [ ] **Step 1: 컴포넌트 작성** (`ranking-opt-cell-tab.tsx` 미러 + branchRule/allowTextInput)

```tsx
'use client';

import React from 'react';

import { Tag } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface ChoiceOptCellTabProps {
  choiceLabel: string;
  onChoiceLabelChange: (v: string) => void;
  spssNumericCode: number | '';
  onSpssNumericCodeChange: (v: number | '') => void;
  isOtherChoiceCell: boolean;
  onIsOtherChoiceCellChange: (v: boolean) => void;
  allowTextInput: boolean;
  onAllowTextInputChange: (v: boolean) => void;
}

/**
 * cell-content-modal 의 '보기 옵션' (Case A choice_opt) 탭.
 * 이 셀은 질문 레벨 radio/checkbox 의 옵션 소스로 사용된다.
 */
export function ChoiceOptCellTab({
  choiceLabel,
  onChoiceLabelChange,
  spssNumericCode,
  onSpssNumericCodeChange,
  isOtherChoiceCell,
  onIsOtherChoiceCellChange,
  allowTextInput,
  onAllowTextInputChange,
}: ChoiceOptCellTabProps) {
  const isOther = isOtherChoiceCell === true;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex items-start gap-2">
          <Tag className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-medium text-emerald-900">보기 옵션 소스 (Case A)</p>
            <p className="mt-1 text-xs text-emerald-700">
              이 셀은 질문(단일/복수 선택)의 보기로 사용됩니다. 응답자는 이 셀에서 선택하며,
              응답은 일반 radio/checkbox 와 동일하게 저장됩니다.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Label className="text-sm font-medium">이 셀을 &quot;기타 (직접 입력)&quot;로 사용</Label>
        <Switch checked={isOther} onCheckedChange={onIsOtherChoiceCellChange} />
      </div>

      <div className="flex items-center justify-between gap-4">
        <Label className="text-sm font-medium">선택 시 텍스트 입력 받기</Label>
        <Switch
          checked={isOther ? true : allowTextInput}
          disabled={isOther}
          onCheckedChange={onAllowTextInputChange}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="choice-opt-label" className="text-sm font-medium">
          옵션 라벨
        </Label>
        <Input
          id="choice-opt-label"
          value={choiceLabel}
          onChange={(e) => onChoiceLabelChange(e.target.value)}
          placeholder='옵션 라벨 (비워두면 셀 본문 텍스트가 사용됨)'
        />
        <p className="text-xs text-gray-500">
          선택 열 셀은 보통 비어 있으므로(라벨이 다른 열에 있음) 분석/SPSS 라벨을 여기에 명시하세요.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="choice-opt-spss-code" className="text-sm font-medium">
          응답값 (선택)
        </Label>
        <Input
          id="choice-opt-spss-code"
          type="number"
          inputMode="numeric"
          value={spssNumericCode}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') onSpssNumericCodeChange('');
            else {
              const n = parseInt(v, 10);
              if (!Number.isNaN(n)) onSpssNumericCodeChange(n);
            }
          }}
          placeholder='(비워두면 자동: 수집 순서 기반 1-based 인덱스)'
          className="w-64"
        />
        <p className="text-xs text-gray-500">
          SPSS 변수의 값으로 기록됩니다. 셀 순서가 바뀌어도 값이 유지되길 원하면 명시하세요.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/survey-builder/choice-opt-cell-tab.tsx
git commit -m "feat: choice_opt 셀 편집 탭 컴포넌트 추가"
```

### Task 5: cell-content-modal 에 choice_opt 탭 연결

**Files:**
- Modify: `src/components/survey-builder/cell-content-modal.tsx`

- [ ] **Step 1: ContentType 유니온에 choice_opt 추가** (라인 124~134)

```typescript
  | 'ranking_opt'
  | 'choice_opt';
```

- [ ] **Step 2: choice_opt 셀 state 추가** (ranking_opt state 옆, 라인 172~179 근처)

```typescript
  const [choiceLabel, setChoiceLabel] = useState<string>(cell.choiceLabel || '');
  const [isOtherChoiceCell, setIsOtherChoiceCell] = useState<boolean>(cell.isOtherChoiceCell === true);
  const [choiceAllowTextInput, setChoiceAllowTextInput] = useState<boolean>(cell.allowTextInput === true);
```

(`cellSpssNumericCode` state 는 ranking_opt 와 공유 — 이미 존재.)

- [ ] **Step 3: TabsList 컬럼 수 증가 + TabsTrigger 추가** (라인 754, 787~790)

`grid-cols-9` → `grid-cols-10` 으로 변경하고, ranking_opt 트리거 다음에:

```tsx
<TabsTrigger value="choice_opt" className="flex items-center gap-2">
  <Tag className="h-4 w-4" />
  보기 옵션
</TabsTrigger>
```

- [ ] **Step 4: TabsContent 추가** (ranking_opt TabsContent 다음, 라인 1135 근처)

```tsx
<TabsContent value="choice_opt" className="space-y-4">
  <ChoiceOptCellTab
    choiceLabel={choiceLabel}
    onChoiceLabelChange={setChoiceLabel}
    spssNumericCode={cellSpssNumericCode}
    onSpssNumericCodeChange={setCellSpssNumericCode}
    isOtherChoiceCell={isOtherChoiceCell}
    onIsOtherChoiceCellChange={setIsOtherChoiceCell}
    allowTextInput={choiceAllowTextInput}
    onAllowTextInputChange={setChoiceAllowTextInput}
  />
</TabsContent>
```

import 추가:

```typescript
import { ChoiceOptCellTab } from './choice-opt-cell-tab';
```

- [ ] **Step 5: 저장 검증 추가** (ranking_opt 검증 옆, 라인 284~307 근처)

```typescript
if (contentType === 'choice_opt' && isOtherChoiceCell) {
  const hostQuestion = questions.find((qq) => qq.id === currentQuestionId);
  if (hasExistingOtherChoiceCell(hostQuestion?.tableRowsData, cell.id)) {
    alert('이 질문에는 이미 "기타"로 지정된 보기 옵션 셀이 있습니다. 질문당 최대 1개만 지정할 수 있습니다.');
    return;
  }
}
```

import 추가:

```typescript
import { hasExistingOtherChoiceCell } from '@/utils/choice-source';
```

- [ ] **Step 6: 저장 속성 추가** (ranking_opt 속성 저장 옆, 라인 359~374 근처, 반환 셀 객체에)

```typescript
  choiceLabel:
    contentType === 'choice_opt' && choiceLabel.trim().length > 0 ? choiceLabel.trim() : undefined,
  isOtherChoiceCell: contentType === 'choice_opt' && isOtherChoiceCell ? true : undefined,
  allowTextInput:
    contentType === 'choice_opt' && choiceAllowTextInput && !isOtherChoiceCell ? true : undefined,
```

> `spssNumericCode` 저장은 기존 ranking_opt 조건에 choice_opt 를 OR 로 포함하도록 확장:
> `(contentType === 'ranking_opt' && !isOtherRankingCell) || contentType === 'choice_opt'` 일 때 저장.

- [ ] **Step 7: 타입 체크 + 빌드**

Run: `pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/survey-builder/cell-content-modal.tsx
git commit -m "feat: 셀 편집 모달에 choice_opt 보기 옵션 탭 연결"
```

### Task 6: question-basic-tab 토글 + 분기, edit-modal 검증

**Files:**
- Modify: `src/components/survey-builder/question-basic-tab.tsx` (라인 126~132, 489 근처)
- Modify: `src/components/survey-builder/question-edit-modal.tsx` (라인 198~225 근처)

- [ ] **Step 1: question-basic-tab 분기 조건 확장** (라인 126~132)

```typescript
  const isRankingTableSource =
    question.type === 'ranking' && formData.rankingConfig?.optionsSource === 'table';
  // radio/checkbox: tableColumns 가 있으면 설명 테이블 모드 (choice_opt 옵션 소스)
  const isChoiceTableMode =
    (question.type === 'radio' || question.type === 'checkbox')
    && (formData.tableColumns?.length ?? 0) > 0;

  const needsOptions =
    ['radio', 'checkbox', 'select', 'ranking'].includes(question.type)
    && !isRankingTableSource
    && !isChoiceTableMode;

  const showTableEditor = question.type === 'table' || isRankingTableSource || isChoiceTableMode;
```

- [ ] **Step 2: radio/checkbox "설명 테이블" 토글 UI 추가** (옵션 입력 섹션 근처, 예: 라인 489 RankingConfigEditor 블록 옆)

토글 ON 시 빈 테이블 스캐폴드(1열 "선택" + 1행 choice_opt 셀) 생성, OFF 시 테이블 제거. 정확한 스캐폴드 헬퍼는 빌더의 기존 테이블 생성 유틸(`use-table-editor` 의 행/열 생성 패턴)을 따른다. 최소 스캐폴드:

```tsx
{(question.type === 'radio' || question.type === 'checkbox') && (
  <div className="space-y-2 rounded-md border border-gray-200 bg-white p-3">
    <div className="flex items-center justify-between gap-4">
      <Label className="flex items-center gap-2 text-sm font-medium">
        <TableIcon className="h-4 w-4" />
        설명 테이블로 보기 구성
      </Label>
      <Switch
        checked={isChoiceTableMode}
        onCheckedChange={(on) => {
          if (on) {
            setFormData((prev) => ({
              ...prev,
              options: [],
              tableColumns: prev.tableColumns?.length
                ? prev.tableColumns
                : [
                    { id: crypto.randomUUID(), label: '항목' },
                    { id: crypto.randomUUID(), label: '선택' },
                  ],
              tableRowsData: prev.tableRowsData?.length
                ? prev.tableRowsData
                : [
                    {
                      id: crypto.randomUUID(),
                      label: '',
                      cells: [
                        { id: crypto.randomUUID(), type: 'text', content: '' },
                        { id: crypto.randomUUID(), type: 'choice_opt', content: '', choiceLabel: '' },
                      ],
                    },
                  ],
            }));
          } else {
            setFormData((prev) => ({ ...prev, tableColumns: [], tableRowsData: [] }));
          }
        }}
      />
    </div>
    <p className="text-xs text-gray-500">
      켜면 행마다 설명을 넣고 &quot;선택&quot; 열 셀을 보기로 지정합니다. 셀을 클릭 → &quot;보기 옵션&quot; 탭에서 라벨/코드를 설정하세요.
    </p>
  </div>
)}
```

import 에 `TableIcon`(lucide `Table`), `Switch`, `Label`, `crypto` 사용 가능 여부 확인(브라우저 `crypto.randomUUID` 사용 — 프로젝트의 `generateId()` 유틸이 있으면 그것을 사용).

> 프로젝트에 ID 생성 헬퍼(`generateId`)가 있으면 `crypto.randomUUID()` 대신 사용. 빌더 다른 곳의 행/열 생성 코드를 grep 하여 동일 패턴 채택.

- [ ] **Step 3: question-edit-modal 검증** (라인 198~225)

```typescript
  const isRankingTableSource =
    question.type === 'ranking' && currentFormData.rankingConfig?.optionsSource === 'table';
  const isChoiceTableSource =
    (question.type === 'radio' || question.type === 'checkbox')
    && collectChoiceOptCells(currentFormData.tableRowsData).length > 0;

  const needsOptions =
    ['radio', 'checkbox', 'select', 'ranking'].includes(question.type)
    && !isRankingTableSource
    && !isChoiceTableSource;
```

그리고 "테이블 모드인데 choice_opt 셀이 없음" 검증 (radio/checkbox + tableColumns 있는데 choice_opt 0개):

```typescript
  const choiceTableModeButEmpty =
    (question.type === 'radio' || question.type === 'checkbox')
    && (currentFormData.tableColumns?.length ?? 0) > 0
    && collectChoiceOptCells(currentFormData.tableRowsData).length === 0;
  if (choiceTableModeButEmpty) {
    errors.options =
      '설명 테이블에 "보기 옵션" 셀이 최소 1개는 있어야 합니다. 선택 열 셀을 클릭 → "보기 옵션" 탭으로 저장하세요.';
  }
```

import 추가:

```typescript
import { collectChoiceOptCells } from '@/utils/choice-source';
```

- [ ] **Step 4: 타입 체크 + 빌드**

Run: `pnpm tsc --noEmit && pnpm build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/survey-builder/question-basic-tab.tsx src/components/survey-builder/question-edit-modal.tsx
git commit -m "feat: radio/checkbox 설명 테이블 토글 및 검증 추가"
```

---

## Phase 4 — 응답 렌더링

### Task 7: TablePreview 에 renderCell 오버라이드 prop 추가

**Files:**
- Modify: `src/components/survey-builder/table-preview.tsx` (라인 32~48 props, 라인 268 셀 렌더)

- [ ] **Step 1: prop 추가 + 셀 렌더 분기**

`TablePreviewProps` 에 추가:

```typescript
  /** 셀 콘텐츠 렌더 오버라이드. undefined 반환 시 기본 PreviewCell 로 폴백. */
  renderCell?: (cell: TableCell) => React.ReactNode;
```

(import 에 `TableCell` 타입 추가.)

함수 시그니처 구조분해에 `renderCell` 추가하고, 라인 268 의 `<PreviewCell cell={cell} />` 를 교체:

```tsx
{(() => {
  const override = renderCell?.(cell);
  return override !== undefined && override !== null ? override : <PreviewCell cell={cell} />;
})()}
```

- [ ] **Step 2: 타입 체크 (회귀 없음 확인)**

Run: `pnpm tsc --noEmit`
Expected: PASS — 기존 호출부는 renderCell 미지정이므로 동작 불변.

- [ ] **Step 3: Commit**

```bash
git add src/components/survey-builder/table-preview.tsx
git commit -m "feat: TablePreview renderCell 오버라이드 prop 추가"
```

### Task 8: ChoiceTableResponse 컴포넌트

**Files:**
- Create: `src/components/survey-response/choice-table-response.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
'use client';

import React, { useMemo } from 'react';

import { TablePreview } from '@/components/survey-builder/table-preview';
import type { Question, TableCell } from '@/types/survey';
import { resolveChoiceOptions } from '@/utils/choice-source';

import { OptionTextInput } from './option-text-input';

interface ChoiceTableResponseProps {
  question: Question;
  /** radio: string | null, checkbox: string[] */
  value: unknown;
  onChange: (value: string | string[] | null) => void;
}

/**
 * 테이블 내장 radio/checkbox(Case A) 응답 렌더.
 * tableRowsData 의 choice_opt 셀만 인터랙티브 input 으로 바꾸고, 응답은
 * 일반 radio/checkbox shape(radio=cell.id | null, checkbox=cell.id[])로 저장한다.
 */
export function ChoiceTableResponse({ question, value, onChange }: ChoiceTableResponseProps) {
  const isCheckbox = question.type === 'checkbox';
  const options = useMemo(() => resolveChoiceOptions(question), [question]);

  const selectedIds: string[] = useMemo(() => {
    if (isCheckbox) return Array.isArray(value) ? (value as string[]) : [];
    return typeof value === 'string' && value ? [value] : [];
  }, [isCheckbox, value]);

  const maxSelections = question.maxSelections;

  const toggle = (cellId: string, checked: boolean) => {
    if (!isCheckbox) {
      onChange(checked ? cellId : null);
      return;
    }
    let next = selectedIds.slice();
    if (checked) {
      if (maxSelections !== undefined && maxSelections > 0 && next.length >= maxSelections) return;
      next.push(cellId);
    } else {
      next = next.filter((id) => id !== cellId);
    }
    onChange(next);
  };

  const renderCell = (cell: TableCell): React.ReactNode => {
    if (cell.type !== 'choice_opt' || cell.isHidden) return undefined;
    const checked = selectedIds.includes(cell.id);
    const opt = options.find((o) => o.value === cell.id);
    const disabled =
      isCheckbox
      && !checked
      && maxSelections !== undefined
      && maxSelections > 0
      && selectedIds.length >= maxSelections;

    return (
      <div className="flex flex-col items-center gap-2">
        <input
          type={isCheckbox ? 'checkbox' : 'radio'}
          name={question.id}
          aria-label={opt?.label ?? '선택'}
          checked={checked}
          disabled={disabled}
          onChange={(e) => toggle(cell.id, e.target.checked)}
          className="h-4 w-4"
        />
        {opt?.allowTextInput && checked && (
          <OptionTextInput questionId={question.id} option={opt} className="w-full" />
        )}
      </div>
    );
  };

  const minSel = question.minSelections;
  const maxSel = question.maxSelections;
  const showCounter = isCheckbox && (minSel !== undefined || maxSel !== undefined);

  return (
    <div className="space-y-2">
      <TablePreview
        tableTitle={question.tableTitle}
        columns={question.tableColumns}
        rows={question.tableRowsData}
        tableHeaderGrid={question.tableHeaderGrid}
        hideColumnLabels={question.hideColumnLabels}
        renderCell={renderCell}
      />
      {showCounter && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-gray-600">
            {maxSel !== undefined && maxSel > 0
              ? `${selectedIds.length}/${maxSel}개 선택됨`
              : `${selectedIds.length}개 선택됨`}
          </span>
          {minSel !== undefined && minSel > 0 && selectedIds.length < minSel && (
            <span className="text-orange-600">최소 {minSel}개 이상 선택해주세요</span>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/survey-response/choice-table-response.tsx
git commit -m "feat: 테이블 내장 radio/checkbox 응답 렌더 ChoiceTableResponse 추가"
```

### Task 9: question-input 에 table-source 분기 연결

**Files:**
- Modify: `src/components/survey-response/question-input.tsx` (RadioQuestion 라인 177~247, CheckboxQuestion 라인 250~377)

- [ ] **Step 1: RadioQuestion 에 분기 추가** (옵션 목록 렌더 직전)

```tsx
  if (isChoiceTableSource(question)) {
    return (
      <ChoiceTableResponse
        question={question}
        value={value as string | null}
        onChange={(v) => onChange((v as string | null) ?? null)}
      />
    );
  }
```

- [ ] **Step 2: CheckboxQuestion 에 분기 추가** (옵션 목록 렌더 직전)

```tsx
  if (isChoiceTableSource(question)) {
    return (
      <ChoiceTableResponse
        question={question}
        value={value}
        onChange={(v) => onChange((Array.isArray(v) ? v : []) as MultiChoiceResponse)}
      />
    );
  }
```

import 추가:

```typescript
import { ChoiceTableResponse } from './choice-table-response';
import { isChoiceTableSource } from '@/utils/choice-source';
```

- [ ] **Step 3: 타입 체크 + 빌드**

Run: `pnpm tsc --noEmit && pnpm build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/survey-response/question-input.tsx
git commit -m "feat: radio/checkbox 응답에 테이블 소스 분기 연결"
```

---

## Phase 5 — 분석 · SPSS · 분기 어댑터

> 핵심: `question.options` 를 직접 읽던 choice-family 소비처를 `resolveChoiceOptions(question)` 로 교체. manual 질문은 동일 결과(question.options)를 받으므로 회귀 없음.

### Task 10: analyzer / data-transformer 어댑터

**Files:**
- Modify: `src/lib/analytics/analyzer.ts` (라인 165 analyzeSingleChoice, 라인 218 analyzeMultipleChoice)
- Modify: `src/lib/analytics/data-transformer.ts` (라인 41~43 transformSingleChoice)

- [ ] **Step 1: analyzer.ts 옵션 소스 교체**

analyzeSingleChoice(라인 165)와 analyzeMultipleChoice(라인 218)에서 `(question.options || [])` 를 다음으로 교체:

```typescript
const resolvedOptions = resolveChoiceOptions(question);
const distribution: OptionDistribution[] = resolvedOptions.map((opt) => ({
  label: opt.label,
  value: opt.value,
  count: counts[opt.value] || 0,
  percentage: totalResponses > 0 ? ((counts[opt.value] || 0) / totalResponses) * 100 : 0,
}));
```

import: `import { resolveChoiceOptions } from '@/utils/choice-source';`

- [ ] **Step 2: data-transformer.ts 교체**

`transformSingleChoice` / multi 에서 `question.options` 를 `resolveChoiceOptions(question)` 로 교체 (응답값=cell.id 매칭).

- [ ] **Step 3: 기존 analytics 테스트 회귀 확인**

Run: `pnpm vitest run`
Expected: PASS (manual 질문은 question.options 동일 반환 → 회귀 없음)

- [ ] **Step 4: Commit**

```bash
git add src/lib/analytics/analyzer.ts src/lib/analytics/data-transformer.ts
git commit -m "feat: 분석 집계가 resolveChoiceOptions 경유하도록 교체"
```

### Task 11: SPSS export 어댑터

**Files:**
- Modify: `src/lib/analytics/spss-excel-export.ts` (checkbox 라인 104~127, radio/select 라인 139~177, buildDataRows checkbox-item 라인 551~564)
- Modify: `src/lib/spss/sav-builder.ts` (single 라인 182, checkbox-item 라인 189~190)

- [ ] **Step 1: generateSPSSColumns checkbox/radio 옵션 소스 교체**

checkbox 컬럼 루프(`q.options` 순회)와 radio/select 의 옵션 순회를 `resolveChoiceOptions(q)` 로 교체. 각 옵션의 `optionCode`/`label`/`allowTextInput`/`value` 는 그대로 접근 (resolveChoiceOptions 가 동일 형태 반환). 기타(`_etc`)는 `allowTextInput` 사이드카(`_text`)로 처리되므로 table-source 기타 셀은 자동 커버됨.

```typescript
const opts = resolveChoiceOptions(q);
for (let i = 0; i < opts.length; i++) {
  const opt = opts[i];
  // ... 기존 로직에서 q.options[i] → opts[i]
}
```

- [ ] **Step 2: buildDataRows checkbox-item 교체** (라인 553)

```typescript
const resolved = resolveChoiceOptions(question);
if (col.optionIndex == null) return null;
const opt = resolved[col.optionIndex];
if (!opt) return null;
const isSelected = values != null && values.some((v) => {
  if (typeof v === 'object' && v !== null && 'hasOther' in v) {
    return v.selectedValue === opt.id || v.selectedValue === opt.value;
  }
  return v === opt.id || v === opt.value;
});
return isSelected ? (opt.spssNumericCode ?? col.optionIndex + 1) : null;
```

- [ ] **Step 3: sav-builder buildValueLabels 교체** (라인 182, 189)

`case 'single'`: `return optionsToValueLabels(resolveChoiceOptions(question));`
`case 'checkbox-item'`: `const opts = resolveChoiceOptions(question); const code = opts[col.optionIndex ?? 0]?.spssNumericCode ?? (col.optionIndex ?? 0) + 1;`

> `question` 이 undefined 일 수 있으면 가드: `question ? resolveChoiceOptions(question) : []`.

import 양쪽 파일에 `resolveChoiceOptions` 추가.

- [ ] **Step 4: SPSS 통합 테스트 회귀 확인**

Run: `pnpm vitest run tests/integration/spss`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/spss-excel-export.ts src/lib/spss/sav-builder.ts
git commit -m "feat: SPSS export 옵션 소스가 resolveChoiceOptions 경유하도록 교체"
```

### Task 12: branch-logic 어댑터 (분기 지원)

**Files:**
- Modify: `src/utils/branch-logic.ts` (getBranchRuleForRadio 라인 134~146, getBranchRuleForCheckbox 라인 152~170)

- [ ] **Step 1: 실패하는 통합 테스트 작성**

`tests/integration/choice-table-response.test.ts` (분기 부분):

```typescript
import { describe, expect, it } from 'vitest';

import type { Question } from '@/types/survey';
import { getBranchRule } from '@/utils/branch-logic';

function choiceTableQ(): Question {
  return {
    id: 'q1',
    type: 'radio',
    title: 'Q',
    required: false,
    order: 0,
    tableColumns: [{ id: 'c1', label: '선택' }],
    tableRowsData: [
      {
        id: 'r1',
        label: '',
        cells: [
          {
            id: 'cellA',
            type: 'choice_opt',
            content: '',
            choiceLabel: 'A',
            branchRule: { id: 'b1', value: 'cellA', action: 'end' },
          },
        ],
      },
    ],
  } as Question;
}

describe('choice table-source 분기', () => {
  it('선택된 choice_opt 셀의 branchRule 을 평가한다', () => {
    const q = choiceTableQ();
    // 응답값 = cellA (선택된 셀 id)
    const rule = getBranchRule(q, 'cellA');
    expect(rule?.action).toBe('end');
  });
});
```

> `getBranchRule` 의 실제 export 명/시그니처는 `branch-logic.ts` 를 확인해 맞춘다 (getBranchRuleForRadio 를 감싸는 디스패처가 있으면 그것을 사용).

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm vitest run tests/integration/choice-table-response.test.ts`
Expected: FAIL — table-source 옵션이 `question.options` 에 없어 매칭 실패(null).

- [ ] **Step 3: getBranchRuleForRadio / Checkbox 옵션 소스 교체**

두 함수에서 `question.options` 를 `resolveChoiceOptions(question)` 로 교체:

```typescript
function getBranchRuleForRadio(question: Question, response: unknown): BranchRule | null {
  const options = resolveChoiceOptions(question);
  if (!options.length) return null;
  const selectedValue =
    typeof response === 'object' && response !== null && 'selectedValue' in response
      ? (response as { selectedValue: string }).selectedValue
      : response;
  const selectedOption = options.find((opt) => opt.value === selectedValue);
  return selectedOption?.branchRule || null;
}
```

checkbox 도 동일하게 `resolveChoiceOptions(question)` 사용.

import: `import { resolveChoiceOptions } from '@/utils/choice-source';`

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run tests/integration/choice-table-response.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/branch-logic.ts tests/integration/choice-table-response.test.ts
git commit -m "feat: 테이블 소스 radio/checkbox 옵션별 분기 지원"
```

---

## Phase 6 — 응답 shape 통합 테스트 + 최종 검증

### Task 13: 응답 저장 shape 통합 테스트

**Files:**
- Modify: `tests/integration/choice-table-response.test.ts` (shape 검증 추가)

- [ ] **Step 1: 응답 shape 테스트 추가**

table-source radio 응답이 일반 radio 와 동일하게 단일 문자열(cell.id), checkbox 가 cell.id 배열로 저장/집계되는지 검증. analyzer 의 `analyzeSingleChoice`/`analyzeMultipleChoice` 를 table-source 질문 + 응답으로 호출해 distribution 의 count 가 옳은지 단언:

```typescript
import { analyzeQuestion } from '@/lib/analytics/analyzer';
// table-source checkbox 질문 + 응답 [{ q1: ['cellA','cellB'] }, { q1: ['cellA'] }]
// → cellA count=2, cellB count=1 인지 검증
```

> `analyzer` 의 실제 진입 함수명/시그니처는 analyzer.ts 를 확인해 맞춘다.

- [ ] **Step 2: 전체 테스트 + 타입 + 빌드**

Run: `pnpm vitest run && pnpm tsc --noEmit && pnpm build`
Expected: 전체 PASS

- [ ] **Step 3: Commit**

```bash
git add tests/integration/choice-table-response.test.ts
git commit -m "test: 테이블 소스 radio/checkbox 응답 shape 및 집계 검증"
```

### Task 14: 수동 E2E 검증 (빌더 → 응답 → 분석)

- [ ] **Step 1:** `pnpm dev` 로 띄우고 빌더에서 checkbox 질문 생성 → "설명 테이블로 보기 구성" 토글 ON.
- [ ] **Step 2:** 행 추가, 설명 열에 텍스트, 선택 열 셀을 "보기 옵션" 탭으로 라벨/코드 저장. 기타 셀 1개 지정.
- [ ] **Step 3:** 테스트 모드에서 Q2 같은 표가 렌더되고 선택 열 체크박스가 동작, 기타 선택 시 텍스트 입력 노출 확인.
- [ ] **Step 4:** 응답 제출 → 분석 대시보드에서 옵션별 분포가 일반 checkbox 처럼 집계되는지 확인.
- [ ] **Step 5:** SPSS/엑셀 export 에서 각 보기가 변수/값 라벨로, 기타 텍스트가 `_text` 변수로 나오는지 확인.

> 실패 시 `superpowers:systematic-debugging` 으로 근본 원인 분석. 스킵 금지.

---

## Self-Review (작성자 체크 — 실행 전 참고)

- **스펙 커버리지:** 데이터 모델(Task1)·옵션 추상화(Task2)·빌더(Task3~6)·응답(Task7~9)·분석/SPSS/분기(Task10~12)·테스트(Task2,12,13) 로 스펙 5개 섹션 + MVP 4기능(분기=Task12, 기타셀=Task2/5, 사이드카텍스트=Task2/8, min/max=Task8) 모두 매핑됨.
- **스펙 정련 명시:** `optionsSource` 플래그 → choice_opt 셀 존재 파생(Architecture 에 명시). 마이그레이션 불필요.
- **타입 일관성:** `choiceLabel`/`isOtherChoiceCell`/`branchRule`/`allowTextInput`/`textInputPlaceholder` 명칭이 Task1(정의)·Task2(resolver)·Task5(저장)·Task8(렌더) 전반에서 일치. `resolveChoiceOptions`/`collectChoiceOptCells`/`isChoiceTableSource`/`hasExistingOtherChoiceCell` 시그니처 일치.
- **알려진 확인 필요 지점(실행 중 grep 으로 정합):** `branch-logic.ts` 의 디스패처 export 명, `analyzer.ts` 진입 함수명, 빌더 ID 생성 헬퍼(`generateId` vs `crypto.randomUUID`). 각 Task 에 "실제 명칭 확인" 주석을 달아둠.
