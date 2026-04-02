/**
 * pretext 기반 행 높이 사전 계산 훅
 * DOM 접근 없이 각 행의 높이를 순수 산술로 계산
 */
import { useMemo } from 'react';

import { prepare, layout } from '@chenglou/pretext';
import type { PreparedText } from '@chenglou/pretext';

import type { TableCell, TableRow } from '@/types/survey';

// 셀 렌더링 상수 (CSS와 동기화 필요)
const MIN_ROW_HEIGHT = 44;
const CELL_PADDING_Y = 24; // py-3 = 12px × 2
const CELL_PADDING_X = 24; // px-3 = 12px × 2
const OPTION_HEIGHT = 28; // 체크박스/라디오 한 줄 높이
const SELECT_HEIGHT = 36; // 드롭다운 높이
const IMAGE_HEIGHT = 120; // 기본 이미지 높이
const VIDEO_HEIGHT = 80; // 비디오 링크 높이
const LINE_HEIGHT = 20; // 텍스트 라인 높이

// 프로젝트 폰트 (globals.css --font-sans와 일치)
const TABLE_FONT = '14px Pretendard';

/**
 * 셀 타입에 따른 높이 계산
 */
function computeCellHeight(
  cell: TableCell,
  colWidth: number,
  preparedCache: Map<string, PreparedText>,
  cacheKey: string,
): number {
  const contentWidth = colWidth - CELL_PADDING_X;

  switch (cell.type) {
    case 'text': {
      const prepared = preparedCache.get(cacheKey);
      if (prepared && contentWidth > 0) {
        const { height } = layout(prepared, contentWidth, LINE_HEIGHT);
        return height + CELL_PADDING_Y;
      }
      return MIN_ROW_HEIGHT;
    }

    case 'input':
      return MIN_ROW_HEIGHT;

    case 'checkbox': {
      const count = cell.checkboxOptions?.length ?? 1;
      return count * OPTION_HEIGHT + CELL_PADDING_Y;
    }

    case 'radio': {
      const count = cell.radioOptions?.length ?? 1;
      return count * OPTION_HEIGHT + CELL_PADDING_Y;
    }

    case 'select':
      return SELECT_HEIGHT + CELL_PADDING_Y;

    case 'image':
      return IMAGE_HEIGHT + CELL_PADDING_Y;

    case 'video':
      return VIDEO_HEIGHT + CELL_PADDING_Y;

    default:
      return MIN_ROW_HEIGHT;
  }
}

interface UseRowHeightsOptions {
  displayRows: TableRow[];
  columnWidths: number[];
  /** pretext font 문자열 (기본: "14px Pretendard") */
  font?: string;
}

/**
 * 행별 높이를 pretext로 사전 계산
 *
 * - prepare(): 텍스트 변경 시에만 재실행 (Map 캐시)
 * - layout(): 열 너비 변경 시마다 호출해도 ~0.09ms/500개
 *
 * @returns rowHeights — 각 행의 계산된 높이 (px)
 */
export function useRowHeights({
  displayRows,
  columnWidths,
  font = TABLE_FONT,
}: UseRowHeightsOptions): number[] {
  // 1단계: prepare 캐시 — 텍스트 내용이 바뀔 때만 재생성
  const preparedCache = useMemo(() => {
    const cache = new Map<string, PreparedText>();

    for (const row of displayRows) {
      for (let colIdx = 0; colIdx < row.cells.length; colIdx++) {
        const cell = row.cells[colIdx];
        if (!cell || cell.isHidden) continue;

        // text 타입만 pretext로 측정 (나머지는 공식 기반)
        if (cell.type === 'text' && cell.content) {
          cache.set(`${row.id}-${colIdx}`, prepare(cell.content, font));
        }
      }
    }

    return cache;
  }, [displayRows, font]);

  // 2단계: 행 높이 계산 — 열 너비 변경 시에도 재계산 (layout은 순수 산술)
  const rowHeights = useMemo(() => {
    return displayRows.map((row) => {
      let maxHeight = MIN_ROW_HEIGHT;

      for (let colIdx = 0; colIdx < row.cells.length; colIdx++) {
        const cell = row.cells[colIdx];
        if (!cell || cell.isHidden) continue;

        const colWidth = columnWidths[colIdx] ?? 150;
        const cacheKey = `${row.id}-${colIdx}`;
        const cellHeight = computeCellHeight(cell, colWidth, preparedCache, cacheKey);

        maxHeight = Math.max(maxHeight, cellHeight);
      }

      return maxHeight;
    });
  }, [displayRows, columnWidths, preparedCache]);

  return rowHeights;
}
