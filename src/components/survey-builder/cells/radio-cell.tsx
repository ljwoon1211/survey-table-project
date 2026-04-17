'use client';

import React, { useCallback } from 'react';
import { flushSync } from 'react-dom';

import { Input } from '@/components/ui/input';

import type { InteractiveCellProps } from './types';

/** 라디오 셀 (인터랙티브) */
export const RadioCell = React.memo(function RadioCell({
  cell,
  cellResponse,
  onUpdateValue,
}: InteractiveCellProps) {
  const handleRadioChange = useCallback(
    (optionId: string) => {
      const isCurrentlySelected = (() => {
        if (typeof cellResponse === 'object' && cellResponse !== null && 'optionId' in (cellResponse as Record<string, unknown>)) {
          return (cellResponse as { optionId: string }).optionId === optionId;
        }
        return cellResponse === optionId;
      })();

      if (isCurrentlySelected) {
        flushSync(() => onUpdateValue(''));
        return;
      }

      const isOther = optionId === 'other-option';
      flushSync(() =>
        onUpdateValue(isOther ? { optionId, otherValue: '', hasOther: true } : optionId),
      );
    },
    [cellResponse, onUpdateValue],
  );

  const handleOtherInput = useCallback(
    (optionId: string, otherValue: string) => {
      if (
        typeof cellResponse === 'object' &&
        cellResponse !== null &&
        'optionId' in (cellResponse as Record<string, unknown>) &&
        (cellResponse as { optionId: string }).optionId === optionId
      ) {
        onUpdateValue({
          ...(cellResponse as { optionId: string; otherValue?: string }),
          otherValue,
        });
      }
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
    <div className="space-y-2">
      {cell.content && cell.content.trim() && (
        <div className="mb-3 text-sm font-medium whitespace-pre-wrap [overflow-wrap:anywhere] text-gray-700">
          {cell.content}
        </div>
      )}

      {cell.radioOptions.map((option) => {
        const optionKey = option.value ?? option.id;
        const isSelected = (() => {
          if (typeof cellResponse === 'object' && cellResponse !== null && 'optionId' in (cellResponse as Record<string, unknown>)) {
            return (cellResponse as { optionId: string }).optionId === optionKey;
          }
          return cellResponse === optionKey;
        })();

        const otherValue =
          typeof cellResponse === 'object' &&
          (cellResponse as { optionId: string; otherValue?: string })?.optionId === optionKey
            ? (cellResponse as { otherValue?: string }).otherValue || ''
            : '';

        return (
          <div key={option.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id={`${cell.id}-${option.id}`}
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
            {optionKey === 'other-option' && isSelected && (
              <div className="ml-6">
                <Input
                  placeholder="기타 내용 입력..."
                  value={otherValue}
                  onChange={(e) => handleOtherInput(optionKey, e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
