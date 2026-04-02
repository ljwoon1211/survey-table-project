import type { CSSProperties } from 'react';

import { cn } from '@/lib/utils';
import type { TableColumn } from '@/types/survey';

// ── grid-template-columns 생성 ──

export function buildGridTemplateCols(columns: TableColumn[]): string {
  return columns.map((col) => `${col.width || 150}px`).join(' ');
}

export function buildGridTemplateColsWithRowHeader(
  rowHeaderWidth: number,
  columns: TableColumn[],
): string {
  return `${rowHeaderWidth}px ${buildGridTemplateCols(columns)}`;
}

// ── 전체 테이블 너비 계산 ──

export function calcTotalWidth(columns: TableColumn[]): number {
  return columns.reduce((sum, col) => sum + (col.width || 150), 0);
}

// ── 셀 grid span 스타일 ──

export function getGridSpanStyle(
  colspan?: number,
  rowspan?: number,
): CSSProperties | undefined {
  const cs = colspan && colspan > 1 ? `span ${colspan}` : undefined;
  const rs = rowspan && rowspan > 1 ? `span ${rowspan}` : undefined;
  if (!cs && !rs) return undefined;
  return {
    ...(cs && { gridColumn: cs }),
    ...(rs && { gridRow: rs }),
  };
}

// ── 셀 정렬 Tailwind 클래스 ──

const H_ALIGN_MAP = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
} as const;

const V_ALIGN_MAP = {
  top: 'items-start',
  middle: 'items-center',
  bottom: 'items-end',
} as const;

export function getAlignmentClasses(
  horizontalAlign?: 'left' | 'center' | 'right',
  verticalAlign?: 'top' | 'middle' | 'bottom',
): string {
  return cn(
    'flex',
    H_ALIGN_MAP[horizontalAlign || 'left'],
    V_ALIGN_MAP[verticalAlign || 'top'],
  );
}

// ── ARIA 속성 ──

export function getGridCellAria(
  role: 'gridcell' | 'columnheader' | 'rowheader' = 'gridcell',
  colspan?: number,
  rowspan?: number,
): Record<string, string | number> {
  const attrs: Record<string, string | number> = { role };
  if (colspan && colspan > 1) attrs['aria-colspan'] = colspan;
  if (rowspan && rowspan > 1) attrs['aria-rowspan'] = rowspan;
  return attrs;
}

// ── Grid 컨테이너 공통 스타일 ──

export function getGridContainerStyle(
  columns: TableColumn[],
  extraWidth?: number,
): CSSProperties {
  const totalWidth = calcTotalWidth(columns) + (extraWidth || 0);
  return {
    display: 'grid',
    gridTemplateColumns: extraWidth
      ? buildGridTemplateColsWithRowHeader(extraWidth, columns)
      : buildGridTemplateCols(columns),
    width: `${totalWidth}px`,
    minWidth: `${totalWidth}px`,
  };
}

// ── 행 hover/완료 상태 클래스 ──

export function getRowCellClasses(completed: boolean): string {
  return completed ? 'bg-green-50/40' : 'bg-white';
}

export function getHeaderCellClasses(): string {
  return 'bg-gray-50 px-4 py-3 text-center font-semibold text-gray-800';
}

export function getBodyCellClasses(
  horizontalAlign?: 'left' | 'center' | 'right',
  verticalAlign?: 'top' | 'middle' | 'bottom',
): string {
  return cn(
    'min-w-0 p-3',
    getAlignmentClasses(horizontalAlign, verticalAlign),
  );
}
