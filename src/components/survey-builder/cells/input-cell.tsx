'use client';

import React, { useCallback, useEffect } from 'react';

import { Input } from '@/components/ui/input';
import { useContactAttrs } from '@/lib/survey/contact-attrs-context';
import { substituteTokens } from '@/lib/survey/substitute-tokens';
import { isPartialNumericInput } from '@/utils/numeric-input';

import { CellContentLayout } from './cell-content-layout';
import type { InteractiveCellProps } from './types';

/** 텍스트 입력 셀 (인터랙티브) */
export const InputCell = React.memo(function InputCell({
  cell,
  cellResponse,
  onUpdateValue,
}: InteractiveCellProps) {
  const attrs = useContactAttrs();
  const template = cell.defaultValueTemplate ?? '';
  const isPrefilled = template.trim().length > 0;
  const prefilledValue = isPrefilled ? substituteTokens(template, attrs) : '';
  const currentValue = (cellResponse as string) || '';
  const textValue = isPrefilled ? prefilledValue : currentValue;

  useEffect(() => {
    if (isPrefilled && currentValue !== prefilledValue) {
      onUpdateValue(prefilledValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPrefilled, prefilledValue]);

  // 숫자 모드 여부: inputType이 'number'일 때만 활성화
  const isNumberMode = cell.inputType === 'number';

  const handleChange = useCallback(
    (value: string) => {
      if (isNumberMode && !isPartialNumericInput(value)) {
        return; // 유효하지 않은 문자는 거부, 기존 값 유지. 자동 0 prepend 안 함.
      }
      onUpdateValue(value);
    },
    [onUpdateValue, isNumberMode],
  );

  return (
    <CellContentLayout content={cell.content} position={cell.textPosition}>
      <div className="flex w-full flex-col space-y-1.5">
        <Input
          type="text"
          inputMode={isNumberMode ? 'decimal' : undefined}
          value={textValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={cell.placeholder || (isNumberMode ? '숫자만 입력하세요...' : '답변을 입력하세요...')}
          maxLength={cell.inputMaxLength}
          className="w-full text-base"
          disabled={isPrefilled}
          data-prefilled={isPrefilled || undefined}
        />

        {cell.inputMaxLength && !isPrefilled && (
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
    </CellContentLayout>
  );
});
