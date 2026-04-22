'use client';

import React from 'react';

import type { TableCell } from '@/types/survey';
import { getOptionsLayout } from '@/utils/options-layout';

interface CellOptionsContainerProps {
  cell: TableCell;
  /** 옵션 리스트 — 그리드 컨테이너 안에 렌더됨 */
  children: React.ReactNode;
  /** 옵션 그리드 밖에 렌더할 추가 요소 (예: 선택 개수 제한 안내) */
  footer?: React.ReactNode;
}

/**
 * 테이블 셀(radio/checkbox/ranking 등) 옵션 리스트 공용 래퍼.
 * - 셀 콘텐츠(cell.content) 제목 줄을 옵션 리스트 위에 표시
 * - cell.optionsColumns 에 따라 세로/가로/N열 그리드 컨테이너 제공
 * - 하위 options.map(...) 결과물만 children 으로 전달하면 됨
 * - footer 는 그리드 밖(세로 스택 끝)에 렌더 → 선택 개수 제한 같은 메타 UI 배치용
 */
export function CellOptionsContainer({ cell, children, footer }: CellOptionsContainerProps) {
  const layout = getOptionsLayout(cell.optionsColumns);
  const hasTitle = !!cell.content && cell.content.trim().length > 0;

  return (
    <div className="space-y-2">
      {hasTitle && (
        <div className="mb-3 text-sm font-medium whitespace-pre-wrap [overflow-wrap:anywhere] text-gray-700">
          {cell.content}
        </div>
      )}
      <div className={layout.className} style={layout.style}>
        {children}
      </div>
      {footer}
    </div>
  );
}
