'use client';

import React from 'react';

import type { TableCell } from '@/types/survey';

import { CheckboxCell } from './checkbox-cell';
import { ImageCell } from './image-cell';
import { InputCell } from './input-cell';
import { RadioCell } from './radio-cell';
import { RankingCell } from './ranking-cell';
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
}: InteractiveCellProps) {
  switch (cell.type) {
    case 'checkbox':
      return <CheckboxCell cell={cell} cellResponse={cellResponse} onUpdateValue={onUpdateValue} />;
    case 'radio':
      return <RadioCell cell={cell} cellResponse={cellResponse} onUpdateValue={onUpdateValue} />;
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
}

export const InteractiveCell = React.memo(function InteractiveCell({
  cell,
  questionId,
  isTestMode,
  value,
  onChange,
}: InteractiveCellContainerProps) {
  const { cellResponse, updateValue } = useCellResponse(
    questionId,
    cell.id,
    isTestMode,
    value,
    onChange,
  );

  return <CellRouter cell={cell} cellResponse={cellResponse} onUpdateValue={updateValue} />;
});
