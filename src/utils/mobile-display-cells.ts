import type { TableCell } from '@/types/survey';

export interface SplitDisplayCells {
  inline: TableCell[];
  collapsed: TableCell[];
}

const DISPLAY_CELL_TYPES = new Set<TableCell['type']>(['text', 'image', 'video']);

function isMobileDisplayCell(cell: TableCell): boolean {
  return (
    !cell.isHidden &&
    !cell._isContinuation &&
    DISPLAY_CELL_TYPES.has(cell.type) &&
    (cell.mobileDisplay === 'inline' || cell.mobileDisplay === 'collapsed')
  );
}

/**
 * 셀 배열(보통 한 행의 cells)에서 모바일 카드에 표시할 display 셀(text/image/video)을
 * mobileDisplay 설정에 따라 분류한다.
 * - 입력 셀 타입(radio, checkbox, select, input, ranking, ranking_opt, choice_opt) / isHidden / _isContinuation 은 제외
 *   (입력 셀은 응답 컨트롤로 렌더링되므로 표시 콘텐츠가 아님)
 * - mobileDisplay 'hidden' 또는 미지정 → 어느 목록에도 포함하지 않음(기본 숨김)
 */
export function splitMobileDisplayCells(cells: TableCell[]): SplitDisplayCells {
  const inline: TableCell[] = [];
  const collapsed: TableCell[] = [];
  for (const cell of cells) {
    if (!isMobileDisplayCell(cell)) continue;
    if (cell.mobileDisplay === 'inline') {
      inline.push(cell);
    } else {
      collapsed.push(cell);
    }
  }
  return { inline, collapsed };
}

export function hasMobileDisplayCells(cells: TableCell[]): boolean {
  return cells.some(isMobileDisplayCell);
}
