'use client';

import React, { useCallback } from 'react';
import { flushSync } from 'react-dom';

import { Input } from '@/components/ui/input';
import { useSurveyResponseStore } from '@/stores/survey-response-store';

import { CellOptionsContainer } from './cell-options-container';
import type { InteractiveCellProps } from './types';

// useSyncExternalStore 안정 참조 — selector 내부 `?? {}` 사용 시 무한 루프 경고 회피
const EMPTY_OPTION_TEXTS: Record<string, string> = {};

/** 라디오 셀 (인터랙티브) */
export const RadioCell = React.memo(function RadioCell({
  cell,
  cellResponse,
  onUpdateValue,
  questionId,
  groupName,
}: InteractiveCellProps) {
  const optionTexts =
    useSurveyResponseStore((s) => s.optionTexts[questionId]) ?? EMPTY_OPTION_TEXTS;
  const setOptionText = useSurveyResponseStore((s) => s.setOptionText);

  const handleRadioChange = useCallback(
    (optionId: string) => {
      const isCurrentlySelected = cellResponse === optionId;

      if (isCurrentlySelected) {
        flushSync(() => onUpdateValue(''));
        return;
      }

      flushSync(() => onUpdateValue(optionId));
    },
    [cellResponse, onUpdateValue],
  );

  if (!cell.radioOptions || cell.radioOptions.length === 0) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <span className="text-sm">라디오 버튼 없음</span>
      </div>
    );
  }

  return (
    <CellOptionsContainer cell={cell}>
      {cell.radioOptions.map((option) => {
        const optionKey = option.value ?? option.id;
        const isSelected = cellResponse === optionKey;

        return (
          <div key={option.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id={`${cell.id}-${option.id}`}
                name={groupName ?? `${cell.id}-radio`}
                checked={isSelected}
                onChange={() => {}}
                onClick={() => handleRadioChange(optionKey)}
                className="cursor-pointer border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor={`${cell.id}-${option.id}`}
                className="cursor-pointer text-base select-none"
              >
                {option.label}
              </label>
            </div>
            {option.allowTextInput && isSelected && (
              <Input
                value={optionTexts[option.id] ?? ''}
                onChange={(e) => setOptionText(questionId, option.id, e.target.value)}
                placeholder={option.textInputPlaceholder || '상세 기재'}
                className="ml-6"
              />
            )}
          </div>
        );
      })}
    </CellOptionsContainer>
  );
});
