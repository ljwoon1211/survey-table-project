'use client';

import React, { useCallback } from 'react';

import { Input } from '@/components/ui/input';

import type { InteractiveCellProps } from './types';

/** 텍스트 입력 셀 (인터랙티브) */
export const InputCell = React.memo(function InputCell({
  cell,
  cellResponse,
  onUpdateValue,
}: InteractiveCellProps) {
  const textValue = (cellResponse as string) || '';

  const handleChange = useCallback(
    (value: string) => onUpdateValue(value),
    [onUpdateValue],
  );

  return (
    <div className="flex w-full flex-col space-y-1.5">
      {cell.content && cell.content.trim() && (
        <div className="mb-2 text-sm font-medium break-words whitespace-pre-wrap text-gray-700">
          {cell.content}
        </div>
      )}

      <Input
        type="text"
        value={textValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={cell.placeholder || '답변을 입력하세요...'}
        maxLength={cell.inputMaxLength}
        className="w-full text-base"
      />

      {cell.inputMaxLength && (
        <div className="flex justify-end">
          <p className="text-xs text-gray-500">
            <span
              className={
                textValue.length >= cell.inputMaxLength ? 'font-medium text-red-500' : ''
              }
            >
              {textValue.length}
            </span>
            {' / '}
            {cell.inputMaxLength}자
          </p>
        </div>
      )}
    </div>
  );
});
