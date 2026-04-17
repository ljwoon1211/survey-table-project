import type { CSSProperties } from 'react';

import { cn } from '@/lib/utils';
import type { TableColumn, TableRow } from '@/types/survey';

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
// flex-col 기반:
//   세로 정렬 → justify-start/center/end (main axis)
//   가로 정렬 → items-start/center/end (cross axis) + text-left/center/right (텍스트용)

const H_ITEMS_MAP = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
} as const;

const V_JUSTIFY_MAP = {
  top: 'justify-start',
  middle: 'justify-center',
  bottom: 'justify-end',
} as const;

export function getAlignmentClasses(
  horizontalAlign?: 'left' | 'center' | 'right',
  verticalAlign?: 'top' | 'middle' | 'bottom',
): string {
  return cn(
    'flex flex-col',
    V_JUSTIFY_MAP[verticalAlign || 'top'],
    H_ITEMS_MAP[horizontalAlign || 'left'],
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

// ── Sticky 좌측 열 판정 ──

// 좌측 sticky 대상 셀 타입: 정적 셀 + radio (사용자 요구: "인터랙티브(radio 제외)가 아닌 경우")
const STICKY_ELIGIBLE_CELL_TYPES = new Set(['text', 'image', 'video', 'radio']);
const MIN_COLUMNS_FOR_STICKY = 4;

export interface StickyLeftInfo {
  stickyColCount: number;
  leftOffsets: number[];
}

/**
 * 좌측부터 연속된 정적(text/image/video) 셀로만 이루어진 열의 개수를 계산한다.
 * 인터랙티브 셀(radio/checkbox/select/input)이 나오면 경계. colspan으로 경계를 가로지르는 셀도 경계로 간주.
 *
 * 가드:
 * - 열이 MIN_COLUMNS_FOR_STICKY 미만이면 비활성 (가로 스크롤이 없거나 적음)
 * - 전체 열이 sticky 대상이 되어 가로 스크롤 의미가 없어지면 비활성
 */
export function computeStickyLeftColumns(
  visibleColumns: TableColumn[],
  visibleRows: TableRow[],
): StickyLeftInfo {
  const leftOffsets: number[] = [];
  let acc = 0;
  for (const col of visibleColumns) {
    leftOffsets.push(acc);
    acc += col.width || 150;
  }

  if (visibleColumns.length < MIN_COLUMNS_FOR_STICKY) {
    return { stickyColCount: 0, leftOffsets };
  }

  let stickyColCount = 0;
  for (let colIdx = 0; colIdx < visibleColumns.length; colIdx++) {
    let ok = true;
    for (const row of visibleRows) {
      const cell = row.cells[colIdx];
      if (!cell) continue;
      // colspan으로 점유돼 숨겨진 셀은 건너뜀 (colspan 자체는 경계 위반 아님 — 각 열 독립 판정)
      if (cell.isHidden) continue;
      if (cell._isContinuation) continue;
      if (!STICKY_ELIGIBLE_CELL_TYPES.has(cell.type)) {
        ok = false;
        break;
      }
    }
    if (!ok) break;
    stickyColCount++;
  }

  // 가로 스크롤 의미가 남지 않으면 비활성
  if (stickyColCount > visibleColumns.length - 2) {
    return { stickyColCount: 0, leftOffsets };
  }

  return { stickyColCount, leftOffsets };
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
