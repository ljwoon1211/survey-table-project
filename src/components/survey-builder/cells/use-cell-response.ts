import { useCallback, useEffect, useState } from 'react';

import { useTestResponseStore } from '@/stores/test-response-store';

/**
 * 셀 응답 값 관리 훅
 * - Zustand cell-level selector로 해당 셀만 구독
 * - 로컬 상태로 UI 즉시 반영 보장
 */
export function useCellResponse(
  questionId: string,
  cellId: string,
  isTestMode: boolean,
  externalValue?: Record<string, unknown>,
  externalOnChange?: (value: Record<string, unknown>) => void,
) {
  // cell-level selector: 해당 셀 값만 구독
  const storeResponse = useTestResponseStore(
    useCallback(
      (state) => {
        if (!isTestMode) return undefined;
        const qr = state.testResponses[questionId];
        if (typeof qr === 'object' && qr !== null) {
          return (qr as Record<string, unknown>)[cellId];
        }
        return undefined;
      },
      [isTestMode, questionId, cellId],
    ),
  );

  const valueFromProps = isTestMode ? storeResponse : externalValue?.[cellId];

  const [localResponse, setLocalResponse] = useState(valueFromProps);

  useEffect(() => {
    setLocalResponse(valueFromProps);
  }, [valueFromProps]);

  const updateTestResponse = useTestResponseStore((s) => s.updateTestResponse);

  const updateValue = useCallback(
    (cellValue: string | string[] | object) => {
      setLocalResponse(cellValue);

      if (isTestMode) {
        const currentState = useTestResponseStore.getState();
        const latestResponse =
          typeof currentState.testResponses[questionId] === 'object'
            ? currentState.testResponses[questionId]
            : {};
        updateTestResponse(questionId, {
          ...(latestResponse as Record<string, string | string[] | object>),
          [cellId]: cellValue,
        });
      } else if (externalOnChange) {
        externalOnChange({
          ...((externalValue || {}) as Record<string, unknown>),
          [cellId]: cellValue,
        });
      }
    },
    [isTestMode, questionId, cellId, updateTestResponse, externalOnChange, externalValue],
  );

  return { cellResponse: localResponse, updateValue };
}
