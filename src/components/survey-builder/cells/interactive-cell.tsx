'use client';

import React from 'react';

import type { TableCell } from '@/types/survey';

import { CheckboxCell } from './checkbox-cell';
import { ImageCell } from './image-cell';
import { InputCell } from './input-cell';
import { RadioCell } from './radio-cell';
import { RankingCell } from './ranking-cell';
import { RankingOptCell } from './ranking-opt-cell';
import { SelectCell } from './select-cell';
import { TextCell } from './text-cell';
import type { InteractiveCellProps } from './types';
import { useCellResponse } from './use-cell-response';
import { VideoCell } from './video-cell';

// ── 내부 라우터 (cellResponse 주입 후 분기) ──

const CellRouter = React.memo(function CellRouter({
  cell,
  cellResponse,
  onUpdateValue,
  groupName,
}: InteractiveCellProps) {
  switch (cell.type) {
    case 'checkbox':
      return <CheckboxCell cell={cell} cellResponse={cellResponse} onUpdateValue={onUpdateValue} />;
    case 'radio':
      return <RadioCell cell={cell} cellResponse={cellResponse} onUpdateValue={onUpdateValue} groupName={groupName} />;
    case 'select':
      return <SelectCell cell={cell} cellResponse={cellResponse} onUpdateValue={onUpdateValue} />;
    case 'input':
      return <InputCell cell={cell} cellResponse={cellResponse} onUpdateValue={onUpdateValue} />;
    case 'image':
      return <ImageCell cell={cell} cellResponse={cellResponse} onUpdateValue={onUpdateValue} />;
    case 'video':
      return <VideoCell cell={cell} cellResponse={cellResponse} onUpdateValue={onUpdateValue} />;
    case 'ranking':
      return <RankingCell cell={cell} cellResponse={cellResponse} onUpdateValue={onUpdateValue} />;
    case 'ranking_opt':
      return <RankingOptCell cell={cell} cellResponse={cellResponse} onUpdateValue={onUpdateValue} />;
    case 'text':
    default:
      return <TextCell cell={cell} cellResponse={cellResponse} onUpdateValue={onUpdateValue} />;
  }
});

// ── 퍼블릭 컴포넌트: Zustand 구독 + 라우터 ──

interface InteractiveCellContainerProps {
  cell: TableCell;
  questionId: string;
  isTestMode: boolean;
  value?: Record<string, unknown>;
  onChange?: (value: Record<string, unknown>) => void;
  /**
   * Phase 5-D: 같은 행 + 같은 radioGroupName 셀들의 공통 HTML name 키.
   * 브라우저 native single-select 동작을 활성화한다 (시각적 처리).
   */
  groupName?: string;
  /**
   * Phase 5-D: 같은 그룹의 다른 셀 id 목록.
   * 이 셀이 응답될 때 sibling 셀들의 응답을 자동으로 빈값('')으로 클리어한다 (state 처리).
   */
  siblingCellIds?: string[];
}

export const InteractiveCell = React.memo(function InteractiveCell({
  cell,
  questionId,
  isTestMode,
  value,
  onChange,
  groupName,
  siblingCellIds,
}: InteractiveCellContainerProps) {
  const { cellResponse, updateValue } = useCellResponse(
    questionId,
    cell.id,
    isTestMode,
    value,
    onChange,
    siblingCellIds,
  );

  return (
    <CellRouter
      cell={cell}
      cellResponse={cellResponse}
      onUpdateValue={updateValue}
      groupName={groupName}
    />
  );
});
