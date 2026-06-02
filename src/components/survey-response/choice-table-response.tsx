'use client';

import { useMemo, type ReactNode } from 'react';

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
  const optionByValue = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  );

  const selectedIds: string[] = useMemo(() => {
    if (isCheckbox) return Array.isArray(value) ? (value as string[]) : [];
    return typeof value === 'string' && value ? [value] : [];
  }, [isCheckbox, value]);

  const minSel = question.minSelections;
  const maxSel = question.maxSelections;
  const isMaxSelectionReached =
    isCheckbox && maxSel !== undefined && maxSel > 0 && selectedIds.length >= maxSel;

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

  const getChoiceCellState = (cell: TableCell) => {
    const checked = selectedIds.includes(cell.id);
    return {
      checked,
      disabled: isMaxSelectionReached && !checked,
      option: optionByValue.get(cell.id),
    };
  };

  const renderCell = (cell: TableCell): ReactNode => {
    if (cell.type !== 'choice_opt' || cell.isHidden) return undefined;
    const { checked, disabled, option } = getChoiceCellState(cell);

    return (
      <div className="flex flex-col items-center gap-2">
        <input
          type={isCheckbox ? 'checkbox' : 'radio'}
          name={question.id}
          aria-label={option?.label ?? '선택'}
          checked={checked}
          disabled={disabled}
          onChange={(e) => toggle(cell.id, e.target.checked)}
          className="h-4 w-4"
        />
        {option?.allowTextInput && checked && (
          <OptionTextInput questionId={question.id} option={option} className="w-full" />
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
        {(question.tableRowsData ?? []).flatMap((row) =>
          row.cells
            .filter((c) => c.type === 'choice_opt' && !c.isHidden)
            .map((choiceCell) => {
              const { checked, disabled, option } = getChoiceCellState(choiceCell);
              // 카드 제목: choiceLabel > content > exportLabel 순. 선택 라벨이 비어도
              // (라벨이 다른 열 셀에 있는 경우) 셀 exportLabel 로 제목을 식별할 수 있게 한다.
              const cardLabel =
                choiceCell.choiceLabel?.trim() ||
                (choiceCell.content ?? '').trim() ||
                choiceCell.exportLabel?.trim() ||
                '(라벨 없음)';
              return (
                <MobileOptionCard
                  key={choiceCell.id}
                  label={cardLabel}
                  cells={row.cells}
                  selected={checked}
                  disabled={disabled}
                  onToggle={() => toggle(choiceCell.id, !checked)}
                  control={
                    <input
                      type={isCheckbox ? 'checkbox' : 'radio'}
                      name={question.id}
                      aria-label={cardLabel}
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => toggle(choiceCell.id, e.target.checked)}
                      className="h-5 w-5"
                    />
                  }
                  footer={
                    option?.allowTextInput && checked ? (
                      <OptionTextInput
                        questionId={question.id}
                        option={option}
                        className="w-full"
                      />
                    ) : null
                  }
                />
              );
            }),
        )}
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
