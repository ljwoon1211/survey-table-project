'use client';

import React, { useCallback } from 'react';

import { Input } from '@/components/ui/input';

import type { InteractiveCellProps } from './types';

/** 체크박스 셀 (인터랙티브) */
export const CheckboxCell = React.memo(function CheckboxCell({
  cell,
  cellResponse,
  onUpdateValue,
}: InteractiveCellProps) {
  const cellResponseArray = Array.isArray(cellResponse) ? cellResponse : [];
  const currentCount = cellResponseArray.length;
  const { maxSelections, minSelections } = cell;
  const isMaxReached =
    maxSelections !== undefined && maxSelections > 0 && currentCount >= maxSelections;
  const isMinNotMet =
    minSelections !== undefined && minSelections > 0 && currentCount < minSelections;

  const canSelect = useCallback(
    (optionId: string) => {
      const isChecked = cellResponseArray.some((item) => {
        if (typeof item === 'object' && item !== null && 'optionId' in item) {
          return (item as { optionId: string }).optionId === optionId;
        }
        return item === optionId;
      });
      return isChecked || !isMaxReached;
    },
    [cellResponseArray, isMaxReached],
  );

  const handleCheckboxChange = useCallback(
    (optionId: string, checked: boolean) => {
      const current = (Array.isArray(cellResponse) ? cellResponse : []) as (
        | string
        | { optionId: string; otherValue?: string; hasOther?: boolean }
      )[];
      let updated: typeof current;
      const isOther = optionId === 'other-option';

      if (checked) {
        if (maxSelections !== undefined && maxSelections > 0 && current.length >= maxSelections) return;
        updated = isOther
          ? [...current, { optionId, otherValue: '', hasOther: true }]
          : [...current, optionId];
      } else {
        updated = current.filter((item) => {
          if (typeof item === 'object' && item !== null && 'optionId' in item) {
            return (item as { optionId: string }).optionId !== optionId;
          }
          return item !== optionId;
        });
      }
      onUpdateValue(updated);
    },
    [cellResponse, maxSelections, onUpdateValue],
  );

  const handleOtherInput = useCallback(
    (optionId: string, otherValue: string) => {
      if (!Array.isArray(cellResponse)) return;
      const updated = (
        cellResponse as (string | { optionId: string; otherValue?: string })[]
      ).map((item) => {
        if (typeof item === 'object' && item !== null && 'optionId' in item && item.optionId === optionId) {
          return { ...item, otherValue };
        }
        return item;
      });
      onUpdateValue(updated);
    },
    [cellResponse, onUpdateValue],
  );

  if (!cell.checkboxOptions || cell.checkboxOptions.length === 0) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <span className="text-sm">체크박스 없음</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {cell.content && cell.content.trim() && (
        <div className="mb-3 text-sm font-medium break-words whitespace-pre-wrap text-gray-700">
          {cell.content}
        </div>
      )}

      {cell.checkboxOptions.map((option) => {
        const isChecked = cellResponseArray.some((item) => {
          if (typeof item === 'object' && item !== null && 'optionId' in item) {
            return (item as { optionId: string }).optionId === option.id;
          }
          return item === option.id;
        });

        const otherValue =
          (
            cellResponseArray.find(
              (item) =>
                typeof item === 'object' &&
                item !== null &&
                'optionId' in item &&
                (item as { optionId: string }).optionId === option.id,
            ) as { optionId: string; otherValue?: string } | undefined
          )?.otherValue || '';

        const disabled = !canSelect(option.id);

        return (
          <div key={option.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`${cell.id}-${option.id}`}
                checked={isChecked}
                disabled={disabled}
                onChange={(e) => handleCheckboxChange(option.id, e.target.checked)}
                className={`rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${
                  disabled ? 'cursor-not-allowed opacity-50' : ''
                }`}
              />
              <label
                htmlFor={`${cell.id}-${option.id}`}
                className={`text-base select-none ${
                  disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                }`}
              >
                {option.label}
              </label>
            </div>
            {option.id === 'other-option' && isChecked && (
              <div className="ml-6">
                <Input
                  placeholder="기타 내용 입력..."
                  value={otherValue}
                  onChange={(e) => handleOtherInput(option.id, e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>
        );
      })}

      {(maxSelections !== undefined || minSelections !== undefined) && (
        <div className="mt-2 border-t border-gray-200 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">
              {maxSelections !== undefined && maxSelections > 0
                ? `${currentCount}/${maxSelections}개 선택됨`
                : `${currentCount}개 선택됨`}
            </span>
            {isMinNotMet && (
              <span className="text-orange-600">최소 {minSelections}개 이상</span>
            )}
            {isMaxReached && <span className="text-blue-600">최대 도달</span>}
          </div>
        </div>
      )}
    </div>
  );
});
