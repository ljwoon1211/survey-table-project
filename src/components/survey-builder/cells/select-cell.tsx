'use client';

import React, { useCallback } from 'react';

import { Input } from '@/components/ui/input';

import type { InteractiveCellProps } from './types';

/** 드롭다운 셀 (인터랙티브) */
export const SelectCell = React.memo(function SelectCell({
  cell,
  cellResponse,
  onUpdateValue,
}: InteractiveCellProps) {
  const handleSelectChange = useCallback(
    (optionId: string) => {
      if (optionId === 'other-option') {
        onUpdateValue({ optionId, otherValue: '', hasOther: true });
      } else {
        onUpdateValue(optionId);
      }
    },
    [onUpdateValue],
  );

  const handleOtherInput = useCallback(
    (otherValue: string) => {
      onUpdateValue({ optionId: 'other-option', otherValue, hasOther: true });
    },
    [onUpdateValue],
  );

  if (!cell.selectOptions || cell.selectOptions.length === 0) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <span className="text-sm">선택 옵션 없음</span>
      </div>
    );
  }

  const selectedValue =
    typeof cellResponse === 'object' && (cellResponse as { optionId?: string })?.optionId
      ? (cellResponse as { optionId: string }).optionId
      : (cellResponse as string) || '';

  const isOtherSelected = selectedValue === 'other-option';
  const otherValue =
    typeof cellResponse === 'object' && (cellResponse as { otherValue?: string })?.otherValue
      ? (cellResponse as { otherValue: string }).otherValue
      : '';

  return (
    <div className="flex w-full flex-col space-y-2">
      {cell.content && cell.content.trim() && (
        <div className="mb-2 text-sm font-medium break-words whitespace-pre-wrap text-gray-700">
          {cell.content}
        </div>
      )}

      <select
        value={selectedValue}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="w-full rounded border border-gray-300 p-2 text-base focus:ring-2 focus:ring-blue-500 focus:outline-none"
      >
        <option value="">선택하세요...</option>
        {cell.selectOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      {isOtherSelected && (
        <Input
          placeholder="기타 내용 입력..."
          value={otherValue}
          onChange={(e) => handleOtherInput(e.target.value)}
          className="h-8 text-xs"
        />
      )}
    </div>
  );
});
