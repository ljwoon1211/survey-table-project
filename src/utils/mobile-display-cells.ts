import type { TableCell } from '@/types/survey';

export interface SplitDisplayCells {
  inline: TableCell[];
  collapsed: TableCell[];
}

const DISPLAY_CELL_TYPES = new Set(['text', 'image', 'video']);

/**
 * 셀 배열(보통 한 행의 cells)에서 모바일 카드에 표시할 display 셀(text/image/video)을
 * mobileDisplay 설정에 따라 분류한다.
 * - 입력 셀 타입 / isHidden / _isContinuation 은 제외
 * - mobileDisplay 'hidden' 또는 미지정 → 어느 목록에도 포함하지 않음(기본 숨김)
 */
export function splitMobileDisplayCells(cells: TableCell[]): SplitDisplayCells {
  const inline: TableCell[] = [];
  const collapsed: TableCell[] = [];
  for (const cell of cells) {
    if (cell.isHidden || cell._isContinuation) continue;
    if (!DISPLAY_CELL_TYPES.has(cell.type)) continue;
    if (cell.mobileDisplay === 'inline') inline.push(cell);
    else if (cell.mobileDisplay === 'collapsed') collapsed.push(cell);
  }
  return { inline, collapsed };
}
