# 모바일 테이블 선택형 카드 렌더링 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 테이블에 뿌리를 둔 선택형 질문(radio/checkbox/ranking 내장 테이블 = Case A, 그리고 `type='table'` 매트릭스 = B)을 모바일에서 가로 스크롤 없이 세로 카드로 렌더하고, 테이블 text/image/video 셀을 셀 단위로 `숨기기/바로표시/자세히` 지정할 수 있게 한다.

**Architecture:** `TableCell.mobileDisplay` 1개 필드(기본 `hidden`)로 셀별 표시를 제어한다. 공유 컴포넌트 `MobileDisplayCells`(인라인 + "자세히" expander)와 `MobileOptionCard`(라벨 헤더 + 표시 셀 + 선택 컨트롤 슬롯)를 추출해 Case A·순위형·매트릭스가 재사용한다. 데스크톱 렌더(`TablePreview`/`InteractiveTableResponse`)와 응답 저장 shape는 변경하지 않는다.

**Tech Stack:** Next.js 16 / React 19 / TypeScript strict / TailwindCSS 4 / Zustand / vitest(jsdom) + @testing-library/react. 빌드 검증은 `pnpm tsc`/`pnpm build`(ESLint 인프라 깨짐으로 lint 미사용), 단위/컴포넌트 테스트는 `pnpm vitest run`.

**Spec:** `docs/superpowers/specs/2026-06-02-mobile-table-choice-cards-design.md`

**브랜치:** `feat/mobile-table-choice-cards` (이미 생성됨, 스펙 커밋 적재됨)

---

## File Structure

신규:
- `src/utils/mobile-display-cells.ts` — display 셀 분류 순수 util
- `tests/unit/utils/mobile-display-cells.test.ts` — util 테스트
- `src/components/survey-response/mobile-card-shared.tsx` — `MobileDisplayCells` + `MobileOptionCard`
- `tests/unit/survey/mobile-card-shared.test.tsx` — 공유 컴포넌트 테스트
- `tests/unit/survey/choice-table-response-mobile.test.tsx` — Case A 모바일 분기 테스트
- `tests/unit/survey/mobile-row-card-display.test.tsx` — 매트릭스 카드 표시 셀 회귀 테스트

수정:
- `src/types/survey.ts` — `TableCell.mobileDisplay` 필드 추가
- `src/components/survey-response/choice-table-response.tsx` — 모바일 분기
- `src/components/survey-response/ranking-question.tsx` — 모바일 참고 카드
- `src/components/survey-builder/mobile-row-card.tsx` — 표시 셀 렌더 주입
- `src/components/survey-builder/cell-content-modal.tsx` — 셀 토글 UI/저장

---

## Task 1: `mobileDisplay` 필드 + 분류 util

**Files:**
- Modify: `src/types/survey.ts` (TableCell, line ~319 부근 `textPosition` 다음)
- Create: `src/utils/mobile-display-cells.ts`
- Test: `tests/unit/utils/mobile-display-cells.test.ts`

- [ ] **Step 1: 타입 필드 추가**

`src/types/survey.ts` 의 `TableCell` 인터페이스에서 `textPosition?: ...` 줄 바로 다음에 추가:

```ts
  // 모바일 카드에서 이 셀(text/image/video 표시 셀)을 어떻게 노출할지.
  // 미지정 = 'hidden' (기존 동작: 카드 미노출). 입력 셀은 이 값을 무시하고 항상 컨트롤로 렌더된다.
  mobileDisplay?: 'hidden' | 'inline' | 'collapsed';
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/unit/utils/mobile-display-cells.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { TableCell } from '@/types/survey';
import { splitMobileDisplayCells } from '@/utils/mobile-display-cells';

function cell(partial: Partial<TableCell>): TableCell {
  return { id: Math.random().toString(36).slice(2), content: '', type: 'text', ...partial } as TableCell;
}

describe('splitMobileDisplayCells', () => {
  it('inline / collapsed 로 분류하고 hidden·미지정은 제외', () => {
    const cells = [
      cell({ id: 'a', type: 'text', mobileDisplay: 'inline', content: '정의' }),
      cell({ id: 'b', type: 'text', mobileDisplay: 'collapsed', content: '예시' }),
      cell({ id: 'c', type: 'text', mobileDisplay: 'hidden', content: '숨김' }),
      cell({ id: 'd', type: 'text', content: '미지정' }),
    ];
    const { inline, collapsed } = splitMobileDisplayCells(cells);
    expect(inline.map((c) => c.id)).toEqual(['a']);
    expect(collapsed.map((c) => c.id)).toEqual(['b']);
  });

  it('입력 셀 타입은 mobileDisplay 와 무관하게 제외', () => {
    const cells = [
      cell({ id: 'r', type: 'radio', mobileDisplay: 'inline' }),
      cell({ id: 'i', type: 'input', mobileDisplay: 'collapsed' }),
      cell({ id: 'co', type: 'choice_opt', mobileDisplay: 'inline' }),
    ];
    const { inline, collapsed } = splitMobileDisplayCells(cells);
    expect(inline).toEqual([]);
    expect(collapsed).toEqual([]);
  });

  it('isHidden·continuation 셀 제외', () => {
    const cells = [
      cell({ id: 'h', type: 'text', mobileDisplay: 'inline', isHidden: true }),
      cell({ id: 'k', type: 'text', mobileDisplay: 'inline', _isContinuation: true }),
    ];
    const { inline, collapsed } = splitMobileDisplayCells(cells);
    expect(inline).toEqual([]);
    expect(collapsed).toEqual([]);
  });

  it('image/video 도 표시 셀로 분류', () => {
    const cells = [
      cell({ id: 'img', type: 'image', mobileDisplay: 'inline', imageUrl: 'x' }),
      cell({ id: 'vid', type: 'video', mobileDisplay: 'collapsed', videoUrl: 'y' }),
    ];
    const { inline, collapsed } = splitMobileDisplayCells(cells);
    expect(inline.map((c) => c.id)).toEqual(['img']);
    expect(collapsed.map((c) => c.id)).toEqual(['vid']);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm vitest run tests/unit/utils/mobile-display-cells.test.ts`
Expected: FAIL — `splitMobileDisplayCells` 모듈 없음.

- [ ] **Step 4: util 구현**

`src/utils/mobile-display-cells.ts`:

```ts
import type { TableCell } from '@/types/survey';

export interface SplitDisplayCells {
  inline: TableCell[];
  collapsed: TableCell[];
}

const DISPLAY_CELL_TYPES = new Set(['text', 'image', 'video']);

/**
 * 셀 배열(보통 한 행의 cells)에서 모바일 카드에 표시할 display 셀(text/image/video)을
 * mobileDisplay 설정에 따라 분류한다.
 * - 입력 셀 타입 / isHidden / _isContinuation 은 제외
 * - mobileDisplay 'hidden' 또는 미지정 → 어느 목록에도 포함하지 않음(기본 숨김)
 */
export function splitMobileDisplayCells(cells: TableCell[]): SplitDisplayCells {
  const inline: TableCell[] = [];
  const collapsed: TableCell[] = [];
  for (const cell of cells) {
    if (cell.isHidden || cell._isContinuation) continue;
    if (!DISPLAY_CELL_TYPES.has(cell.type)) continue;
    if (cell.mobileDisplay === 'inline') inline.push(cell);
    else if (cell.mobileDisplay === 'collapsed') collapsed.push(cell);
  }
  return { inline, collapsed };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm vitest run tests/unit/utils/mobile-display-cells.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: 커밋**

```bash
git add src/types/survey.ts src/utils/mobile-display-cells.ts tests/unit/utils/mobile-display-cells.test.ts
git commit -m "feat: TableCell mobileDisplay 필드 및 셀 분류 util 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 공유 컴포넌트 `MobileDisplayCells` + `MobileOptionCard`

**Files:**
- Create: `src/components/survey-response/mobile-card-shared.tsx`
- Test: `tests/unit/survey/mobile-card-shared.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/survey/mobile-card-shared.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { TableCell } from '@/types/survey';
import { MobileDisplayCells, MobileOptionCard } from '@/components/survey-response/mobile-card-shared';

function cell(partial: Partial<TableCell>): TableCell {
  return { id: Math.random().toString(36).slice(2), content: '', type: 'text', ...partial } as TableCell;
}

describe('MobileDisplayCells', () => {
  it('inline 셀은 바로 보이고, collapsed 셀은 "자세히" 토글 후 보인다', () => {
    const cells = [
      cell({ id: 'a', type: 'text', mobileDisplay: 'inline', content: '바로보임' }),
      cell({ id: 'b', type: 'text', mobileDisplay: 'collapsed', content: '접힘내용' }),
    ];
    render(<MobileDisplayCells cells={cells} />);
    expect(screen.getByText('바로보임')).toBeInTheDocument();
    expect(screen.queryByText('접힘내용')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /자세히/ }));
    expect(screen.getByText('접힘내용')).toBeInTheDocument();
  });

  it('표시 셀이 없으면 아무것도 렌더하지 않는다', () => {
    const { container } = render(<MobileDisplayCells cells={[cell({ type: 'text', content: 'x' })]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('MobileOptionCard', () => {
  it('라벨/컨트롤을 렌더하고 헤더 클릭 시 onToggle 호출', () => {
    const onToggle = vi.fn();
    render(
      <MobileOptionCard
        label="① 컴퓨터 비전"
        cells={[]}
        control={<input type="checkbox" aria-label="선택" />}
        onToggle={onToggle}
      />,
    );
    expect(screen.getByText('① 컴퓨터 비전')).toBeInTheDocument();
    fireEvent.click(screen.getByText('① 컴퓨터 비전'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('컨트롤 클릭은 onToggle 로 전파되지 않는다', () => {
    const onToggle = vi.fn();
    render(
      <MobileOptionCard
        label="옵션"
        cells={[]}
        control={<input type="checkbox" aria-label="선택" />}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByLabelText('선택'));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm vitest run tests/unit/survey/mobile-card-shared.test.tsx`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 컴포넌트 구현**

`src/components/survey-response/mobile-card-shared.tsx`:

```tsx
'use client';

import React, { useState } from 'react';

import { ChevronDown } from 'lucide-react';

import { useContactAttrs } from '@/lib/survey/contact-attrs-context';
import { substituteTokens } from '@/lib/survey/substitute-tokens';
import { cn } from '@/lib/utils';
import type { TableCell } from '@/types/survey';
import { splitMobileDisplayCells } from '@/utils/mobile-display-cells';

/** text/image/video 표시 셀 1개의 읽기 전용 콘텐츠 */
function DisplayCellContent({ cell }: { cell: TableCell }) {
  const attrs = useContactAttrs();
  if (cell.type === 'image' && cell.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={cell.imageUrl} alt="" className="max-w-full rounded-md" />;
  }
  if (cell.type === 'video' && cell.videoUrl) {
    return (
      <a
        href={cell.videoUrl}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-medium text-blue-600 underline"
      >
        동영상 보기
      </a>
    );
  }
  const text = (cell.content ?? '').trim();
  if (!text) return null;
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600 [overflow-wrap:anywhere]">
      {substituteTokens(text, attrs)}
    </div>
  );
}

/** mobileDisplay 에 따라 inline 은 바로, collapsed 는 "자세히" 접기 안에 렌더 */
export function MobileDisplayCells({ cells }: { cells: TableCell[] }) {
  const { inline, collapsed } = splitMobileDisplayCells(cells);
  const [open, setOpen] = useState(false);

  if (inline.length === 0 && collapsed.length === 0) return null;

  return (
    <div className="space-y-2">
      {inline.map((c) => (
        <DisplayCellContent key={c.id} cell={c} />
      ))}
      {collapsed.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
          >
            자세히
            <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
          </button>
          {open && (
            <div className="mt-2 space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
              {collapsed.map((c) => (
                <DisplayCellContent key={c.id} cell={c} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface MobileOptionCardProps {
  /** 카드 헤더 라벨 */
  label: React.ReactNode;
  /** 행의 전체 셀 — 표시 셀(text/image/video)만 자동 추출해 렌더 */
  cells: TableCell[];
  /** 선택/입력 컨트롤 슬롯 (체크박스/라디오 등). 클릭은 onToggle 로 전파되지 않음 */
  control?: React.ReactNode;
  /** 표시 셀 아래 추가 영역 (예: 사이드카 텍스트 입력) */
  footer?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  /** 헤더 줄 탭 시 호출 (Case A 선택 토글). 미지정이면 헤더는 비인터랙티브 */
  onToggle?: () => void;
}

export function MobileOptionCard({
  label,
  cells,
  control,
  footer,
  selected,
  disabled,
  onToggle,
}: MobileOptionCardProps) {
  const interactive = Boolean(onToggle) && !disabled;
  return (
    <div
      className={cn(
        'rounded-2xl border bg-white p-4 transition-all',
        selected ? 'border-blue-500 ring-2 ring-blue-500/15' : 'border-gray-200',
        disabled && 'opacity-50',
      )}
    >
      <div
        className={cn('flex items-center gap-3', interactive && 'cursor-pointer')}
        onClick={interactive ? onToggle : undefined}
      >
        {control != null && (
          <span onClick={(e) => e.stopPropagation()} className="flex shrink-0 items-center">
            {control}
          </span>
        )}
        <div className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-gray-900">
          {label}
        </div>
      </div>
      <div className="mt-2">
        <MobileDisplayCells cells={cells} />
      </div>
      {footer != null && <div className="mt-2">{footer}</div>}
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run tests/unit/survey/mobile-card-shared.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/components/survey-response/mobile-card-shared.tsx tests/unit/survey/mobile-card-shared.test.tsx
git commit -m "feat: 모바일 공유 카드 컴포넌트 MobileDisplayCells/MobileOptionCard 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Case A — `ChoiceTableResponse` 모바일 분기

**Files:**
- Modify: `src/components/survey-response/choice-table-response.tsx`
- Test: `tests/unit/survey/choice-table-response-mobile.test.tsx`

참고: 현재 파일은 데스크톱 `TablePreview` 경로만 있다(스펙 6.2). `useMobileView()` 가 true 일 때 카드 리스트를 렌더하도록 분기를 추가한다. `useMobileView` 는 SSR/mount 전 false 를 반환하므로 데스크톱이 기본.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/survey/choice-table-response-mobile.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Question } from '@/types/survey';
import { ChoiceTableResponse } from '@/components/survey-response/choice-table-response';

// 모바일 뷰 강제
vi.mock('@/hooks/use-media-query', () => ({
  useMobileView: () => true,
  useMediaQuery: () => true,
}));

function question(): Question {
  return {
    id: 'q1',
    type: 'checkbox',
    title: '보유 기술',
    required: false,
    order: 0,
    tableColumns: [
      { id: 'c0', label: '기술', width: 100 },
      { id: 'c1', label: '정의', width: 200 },
      { id: 'c2', label: '선택', width: 60 },
    ],
    tableRowsData: [
      {
        id: 'r1',
        cells: [
          { id: 'r1c0', type: 'text', content: '① 컴퓨터 비전', mobileDisplay: 'hidden' },
          { id: 'r1c1', type: 'text', content: '이미지 정보 추출', mobileDisplay: 'collapsed' },
          { id: 'r1c2', type: 'choice_opt', content: '', choiceLabel: '① 컴퓨터 비전' },
        ],
      },
      {
        id: 'r2',
        cells: [
          { id: 'r2c0', type: 'text', content: '② 음성 처리', mobileDisplay: 'hidden' },
          { id: 'r2c1', type: 'text', content: '음성 분석', mobileDisplay: 'collapsed' },
          { id: 'r2c2', type: 'choice_opt', content: '', choiceLabel: '② 음성 처리' },
        ],
      },
    ],
  } as unknown as Question;
}

describe('ChoiceTableResponse (mobile)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('옵션 라벨을 카드로 렌더하고 체크 시 onChange 로 cell.id 전달', () => {
    const onChange = vi.fn();
    render(<ChoiceTableResponse question={question()} value={[]} onChange={onChange} />);
    expect(screen.getByText('① 컴퓨터 비전')).toBeInTheDocument();
    expect(screen.getByText('② 음성 처리')).toBeInTheDocument();
    // 표시 셀 정의는 "자세히" 안에 있어 처음엔 안 보임
    expect(screen.queryByText('이미지 정보 추출')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText(/① 컴퓨터 비전|선택/)[0]);
    expect(onChange).toHaveBeenCalledWith(['r1c2']);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm vitest run tests/unit/survey/choice-table-response-mobile.test.tsx`
Expected: FAIL — 모바일에서도 TablePreview 가 렌더돼 옵션 라벨 카드가 없음.

- [ ] **Step 3: 모바일 분기 구현**

`src/components/survey-response/choice-table-response.tsx` 전체를 아래로 교체:

```tsx
'use client';

import React, { useMemo } from 'react';

import { TablePreview } from '@/components/survey-builder/table-preview';
import { useMobileView } from '@/hooks/use-media-query';
import type { Question, TableCell } from '@/types/survey';
import { resolveChoiceOptions } from '@/utils/choice-source';

import { MobileOptionCard } from './mobile-card-shared';
import { OptionTextInput } from './option-text-input';

interface ChoiceTableResponseProps {
  question: Question;
  /** radio: string | null, checkbox: string[] */
  value: unknown;
  onChange: (value: string | string[] | null) => void;
}

/**
 * 테이블 내장 radio/checkbox(Case A) 응답 렌더.
 * - 데스크톱: tableRowsData 의 choice_opt 셀만 인터랙티브 input 으로 바꾼 TablePreview
 * - 모바일: 행마다 MobileOptionCard (라벨 + 표시 셀 + 체크/라디오 컨트롤)
 * 응답은 일반 radio/checkbox shape(radio=cell.id | null, checkbox=cell.id[])로 저장한다.
 */
export function ChoiceTableResponse({ question, value, onChange }: ChoiceTableResponseProps) {
  const isCheckbox = question.type === 'checkbox';
  const isMobile = useMobileView();
  const options = useMemo(() => resolveChoiceOptions(question), [question]);

  const selectedIds: string[] = useMemo(() => {
    if (isCheckbox) return Array.isArray(value) ? (value as string[]) : [];
    return typeof value === 'string' && value ? [value] : [];
  }, [isCheckbox, value]);

  const minSel = question.minSelections;
  const maxSel = question.maxSelections;

  const toggle = (cellId: string, checked: boolean) => {
    if (!isCheckbox) {
      onChange(checked ? cellId : null);
      return;
    }
    let next = selectedIds.slice();
    if (checked) {
      if (maxSel !== undefined && maxSel > 0 && next.length >= maxSel) return;
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
      isCheckbox && !checked && maxSel !== undefined && maxSel > 0 && selectedIds.length >= maxSel;

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

  const showCounter = isCheckbox && (minSel !== undefined || maxSel !== undefined);

  const counter = showCounter ? (
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
  ) : null;

  if (isMobile) {
    return (
      <div className="space-y-2">
        {(question.tableRowsData ?? []).map((row) => {
          const choiceCell = row.cells.find((c) => c.type === 'choice_opt' && !c.isHidden);
          if (!choiceCell) return null;
          const opt = options.find((o) => o.value === choiceCell.id);
          const checked = selectedIds.includes(choiceCell.id);
          const disabled =
            isCheckbox &&
            !checked &&
            maxSel !== undefined &&
            maxSel > 0 &&
            selectedIds.length >= maxSel;
          return (
            <MobileOptionCard
              key={row.id}
              label={opt?.label ?? '(라벨 없음)'}
              cells={row.cells}
              selected={checked}
              disabled={disabled}
              onToggle={() => toggle(choiceCell.id, !checked)}
              control={
                <input
                  type={isCheckbox ? 'checkbox' : 'radio'}
                  name={question.id}
                  aria-label={opt?.label ?? '선택'}
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => toggle(choiceCell.id, e.target.checked)}
                  className="h-5 w-5"
                />
              }
              footer={
                opt?.allowTextInput && checked ? (
                  <OptionTextInput questionId={question.id} option={opt} className="w-full" />
                ) : null
              }
            />
          );
        })}
        {counter}
      </div>
    );
  }

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
      {counter}
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run tests/unit/survey/choice-table-response-mobile.test.tsx`
Expected: PASS.

- [ ] **Step 5: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/components/survey-response/choice-table-response.tsx tests/unit/survey/choice-table-response-mobile.test.tsx
git commit -m "feat: Case A 라디오/체크박스 테이블 모바일 카드 분기 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 순위형 — `RankingQuestion` 모바일 참고 카드

**Files:**
- Modify: `src/components/survey-response/ranking-question.tsx`

스펙 6.3: 상단 `RankingDropdownStack` 은 모바일에서도 유지하고, 하단 내장 테이블(`hasEmbeddedTable`)만 모바일에서 `TablePreview` 대신 `MobileOptionCard` 리스트(컨트롤 없음, 참고 표시 전용)로 렌더한다.

- [ ] **Step 1: 모바일 분기 구현**

`src/components/survey-response/ranking-question.tsx` 상단 import 에 추가:

```ts
import { useMobileView } from '@/hooks/use-media-query';
import { resolveRankingOptions } from '@/utils/ranking-source';
import { MobileOptionCard } from './mobile-card-shared';
```

(`resolveRankingOptions` 는 이미 import 되어 있으면 중복 추가하지 말 것.)

컴포넌트 본문 상단(`const config = ...` 다음 줄)에 추가:

```ts
  const isMobile = useMobileView();
```

`hasEmbeddedTable ? (...) : (...)` 의 **참(true) 분기**를 아래로 교체:

기존:
```tsx
      {hasEmbeddedTable ? (
        <TablePreview
          tableTitle={question.tableTitle}
          columns={question.tableColumns}
          rows={question.tableRowsData}
          tableHeaderGrid={question.tableHeaderGrid}
          hideColumnLabels={question.hideColumnLabels}
        />
      ) : (
```

교체:
```tsx
      {hasEmbeddedTable ? (
        isMobile ? (
          <div className="space-y-2">
            {(question.tableRowsData ?? []).map((row) => {
              const optCell = row.cells.find((c) => c.type === 'ranking_opt' && !c.isHidden);
              if (!optCell) return null;
              // resolveRankingOptions 는 항상 id=cell.id 를 부여(기타 셀 포함).
              // value 는 기타 셀일 때 RANKING_OTHER_VALUE 로 바뀌므로 id 로 매칭한다.
              const opt = rawOptions.find((o) => o.id === optCell.id);
              return (
                <MobileOptionCard
                  key={row.id}
                  label={opt?.label ?? optCell.content ?? optCell.rankingLabel ?? '(라벨 없음)'}
                  cells={row.cells}
                />
              );
            })}
          </div>
        ) : (
          <TablePreview
            tableTitle={question.tableTitle}
            columns={question.tableColumns}
            rows={question.tableRowsData}
            tableHeaderGrid={question.tableHeaderGrid}
            hideColumnLabels={question.hideColumnLabels}
          />
        )
      ) : (
```

(닫는 괄호 구조 주의: 기존 `: (` 이후 수동 옵션 목록 분기는 그대로 둔다.)

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음. (`rawOptions` 는 `resolveRankingOptions(question)` 결과로 이미 본문에 존재. 라벨 매칭은 `o.id === optCell.id` — `resolveRankingOptions` 가 항상 `id=cell.id` 를 부여하므로 일반·기타 셀 모두 안전.)

- [ ] **Step 3: 빌드 확인**

Run: `pnpm build`
Expected: 성공.

- [ ] **Step 4: 커밋**

```bash
git add src/components/survey-response/ranking-question.tsx
git commit -m "feat: 순위형 내장 테이블 모바일 참고 카드 렌더 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> 확인됨: `src/utils/ranking-source.ts` 의 `resolveRankingOptions` 는 일반/기타 셀 모두 `id: cell.id` 를 부여하고, 일반 셀은 `value: cell.id`, 기타 셀(`isOtherRankingCell`)은 `value: RANKING_OTHER_VALUE`. 따라서 라벨 매칭은 `o.id === optCell.id` 가 정확하다.

---

## Task 5: 매트릭스(B) — `MobileRowCard` 표시 셀 주입

**Files:**
- Modify: `src/components/survey-builder/mobile-row-card.tsx`
- Test: `tests/unit/survey/mobile-row-card-display.test.tsx`

스펙 6.4: 매트릭스 카드에도 표시 셀(inline/collapsed)을 노출한다. 기본 `hidden` 이라 미설정 기존 설문은 동작 동일(회귀 없음). 입력 셀 레이아웃(단위쌍/섹션 헤더)은 보존한다.

- [ ] **Step 1: 회귀 + 신규 동작 테스트 작성**

`tests/unit/survey/mobile-row-card-display.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { TableColumn, TableRow } from '@/types/survey';
import { MobileRowCard } from '@/components/survey-builder/mobile-row-card';

const columns: TableColumn[] = [
  { id: 'c0', label: '항목', width: 100 },
  { id: 'c1', label: '설명', width: 200 },
  { id: 'c2', label: '점수', width: 100 },
];

function row(mobileDisplay?: 'hidden' | 'inline' | 'collapsed'): TableRow {
  return {
    id: 'r1',
    label: '가격',
    cells: [
      { id: 'r1c0', type: 'radio', radioOptions: [{ id: 'o', label: '가격', value: 'v' }] } as never,
      { id: 'r1c1', type: 'text', content: '가격 설명', mobileDisplay } as never,
      { id: 'r1c2', type: 'input' } as never,
    ],
  } as TableRow;
}

function renderCard(r: TableRow) {
  return render(
    <MobileRowCard
      row={r}
      visibleColumns={columns}
      columnSectionMap={null}
      completed={false}
      hideColumnLabels={false}
      questionId="q1"
      isTestMode={false}
    />,
  );
}

describe('MobileRowCard 표시 셀', () => {
  it('미지정(기본 hidden) text 셀은 카드에 노출되지 않는다 (회귀)', () => {
    renderCard(row(undefined));
    expect(screen.queryByText('가격 설명')).not.toBeInTheDocument();
  });

  it('inline 지정 text 셀은 카드에 노출된다', () => {
    renderCard(row('inline'));
    expect(screen.getByText('가격 설명')).toBeInTheDocument();
  });

  it('collapsed 지정 text 셀은 "자세히" 토글 뒤 노출된다', () => {
    renderCard(row('collapsed'));
    expect(screen.queryByText('가격 설명')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /자세히/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm vitest run tests/unit/survey/mobile-row-card-display.test.tsx`
Expected: inline/collapsed 테스트 FAIL (현재 text 셀 전부 숨김), 회귀 테스트는 PASS.

- [ ] **Step 3: 표시 셀 렌더 주입**

`src/components/survey-builder/mobile-row-card.tsx`:

import 블록에 추가:
```ts
import { MobileDisplayCells } from '@/components/survey-response/mobile-card-shared';
```

`CardContent` 내부, `{inputCells.map(...)}` 블록이 끝난 직후(닫는 `)}` 다음, `</CardContent>` 전)에 표시 셀 블록 추가:

```tsx
        <MobileDisplayCells cells={row.cells} />
```

즉 최종 구조:
```tsx
      <CardContent className="space-y-3 p-4">
        {inputCells.map(({ cell, colIdx }, arrIdx) => {
          /* 기존 로직 그대로 */
        })}
        <MobileDisplayCells cells={row.cells} />
      </CardContent>
```

추가로, `inputCells.length === 0` 일 때 조기 `return null` 하는 기존 가드(파일 상단 `if (inputCells.length === 0) return null;`)는 **표시 셀만 있는 행도 렌더되도록** 보정한다. 해당 줄을 아래로 교체:

```tsx
  const { inline, collapsed } = splitMobileDisplayCells(row.cells);
  const hasDisplayCells = inline.length > 0 || collapsed.length > 0;
  if (inputCells.length === 0 && !hasDisplayCells) return null;
```

그리고 import 에 추가:
```ts
import { splitMobileDisplayCells } from '@/utils/mobile-display-cells';
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run tests/unit/survey/mobile-row-card-display.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/components/survey-builder/mobile-row-card.tsx tests/unit/survey/mobile-row-card-display.test.tsx
git commit -m "feat: 매트릭스 모바일 카드에 표시 셀 노출 지원 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 빌더 — 셀 모바일 표시 토글

**Files:**
- Modify: `src/components/survey-builder/cell-content-modal.tsx`

text/image/video 셀 편집 시 `숨기기 / 바로표시 / 자세히` 세그먼트 컨트롤을 노출하고 `mobileDisplay` 로 저장한다. 입력 셀에는 노출하지 않는다.

- [ ] **Step 1: 상태 추가**

`horizontalAlign` useState 선언(파일 line ~192) 부근에 추가:

```tsx
  const [mobileDisplay, setMobileDisplay] = useState<'hidden' | 'inline' | 'collapsed'>(
    cell.mobileDisplay ?? 'hidden',
  );
```

`cell` 변경 시 리셋하는 useEffect 들(line ~260, ~541 의 `setHorizontalAlign(cell.horizontalAlign || 'left')` 가 있는 두 곳) 각각에 같은 줄 추가:

```tsx
    setMobileDisplay(cell.mobileDisplay ?? 'hidden');
```

- [ ] **Step 2: 저장 객체에 필드 추가**

`updatedCell` 객체 조립부(line ~406 `horizontalAlign:` 인근)에 추가. 표시 셀 타입만 저장하고 기본값(`hidden`)은 undefined 로 절약:

```tsx
        // 모바일 카드 표시 (text/image/video 셀만; 기본 'hidden' 은 저장 안 함)
        mobileDisplay:
          (contentType === 'text' || contentType === 'image' || contentType === 'video') &&
          mobileDisplay !== 'hidden'
            ? mobileDisplay
            : undefined,
```

> 주의(메모리 [[feedback_survey_save_explicit_fields]] 패턴 아님 — 여기는 cell 객체 직접 조립): `cell-content-modal` 은 explicit 조립이므로 이 한 곳만 추가하면 된다. 다만 `contentType` 이 토글되어 표시 셀→입력 셀로 바뀌면 자동으로 undefined 가 되어 클리어됨(의도된 동작).

- [ ] **Step 3: 세그먼트 UI 추가**

"📐 컨텐츠 정렬" 섹션(line ~1293 `<div className="mt-6 border-t border-gray-200 pt-6">`) **직전**에 표시 셀 전용 섹션 추가:

```tsx
        {(contentType === 'text' || contentType === 'image' || contentType === 'video') && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <h3 className="mb-2 text-sm font-medium text-gray-900">📱 모바일 카드 표시</h3>
            <p className="mb-3 text-xs text-gray-500">
              좁은 화면(모바일) 카드에서 이 셀을 어떻게 보여줄지 선택합니다. 의미는 지정하지 않으며
              저작자가 결정합니다.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mobileDisplay === 'hidden' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMobileDisplay('hidden')}
                className="flex-1"
              >
                숨기기
              </Button>
              <Button
                type="button"
                variant={mobileDisplay === 'inline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMobileDisplay('inline')}
                className="flex-1"
              >
                바로표시
              </Button>
              <Button
                type="button"
                variant={mobileDisplay === 'collapsed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMobileDisplay('collapsed')}
                className="flex-1"
              >
                자세히
              </Button>
            </div>
          </div>
        )}
```

(`Button` 은 파일 상단에서 이미 import 됨 — 확인만.)

- [ ] **Step 4: 타입 체크 + 빌드**

Run: `pnpm tsc --noEmit && pnpm build`
Expected: 성공.

- [ ] **Step 5: 수동 검증**

1. `pnpm dev` 실행.
2. 빌더에서 테이블 질문의 text 셀 편집 → "📱 모바일 카드 표시"에서 `자세히` 선택 → 저장.
3. 입력 셀(radio/input) 편집 시 해당 섹션이 **안 보이는지** 확인.
4. 저장 후 다시 열었을 때 선택값이 유지되는지 확인.

- [ ] **Step 6: 커밋**

```bash
git add src/components/survey-builder/cell-content-modal.tsx
git commit -m "feat: 셀 편집 모달에 모바일 카드 표시 토글 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 통합 검증

**Files:** 없음(검증 전용)

- [ ] **Step 1: 전체 테스트**

Run: `pnpm vitest run`
Expected: 신규 테스트 포함 전체 PASS(기존 테스트 회귀 없음).

- [ ] **Step 2: 타입 + 빌드**

Run: `pnpm tsc --noEmit && pnpm build`
Expected: 성공.

- [ ] **Step 3: 실제 DB 수동 검증 (모바일 뷰)**

1. `pnpm dev` → 브라우저 DevTools 모바일 뷰(<768px)로 전환.
2. 스크린샷 Q2 같은 Case A 체크박스 질문(choice_opt) 응답 페이지 진입.
3. 확인: 가로 스크롤 없음 / 옵션 카드 세로 나열 / 체크 또는 카드 헤더 탭으로 선택 토글 / "자세히"로 정의·예시 펼침 / min·max 카운터 동작.
4. 기존 매트릭스(type='table') 질문이 모바일에서 이전과 동일하게 보이는지(표시 셀 미설정) 회귀 확인.
5. 데스크톱(≥768px)에서 세 케이스 모두 기존 테이블 렌더 유지 확인.

- [ ] **Step 4: 브랜치 마무리**

`superpowers:finishing-a-development-branch` 스킬로 머지/PR 옵션 진행(사용자 결정).

---

## Self-Review 결과

- **스펙 커버리지**: §4 데이터모델→T1, §5 빌더→T6, §6.1 공유컴포넌트→T2, §6.2 Case A→T3, §6.3 순위형→T4, §6.4 매트릭스→T5, §9 검증→T7. 누락 없음.
- **타입 일관성**: `mobileDisplay: 'hidden'|'inline'|'collapsed'`, `splitMobileDisplayCells`, `MobileOptionCard`/`MobileDisplayCells` 시그니처가 전 태스크에서 일치.
- **T4 매핑 확인됨**: `resolveRankingOptions` 는 항상 `id=cell.id` 부여 → 라벨 매칭 `o.id === optCell.id` 로 확정(일반·기타 셀 모두 안전).
