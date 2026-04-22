import type { Question, QuestionOption, TableCell, TableRow } from '@/types/survey';

/**
 * tableRowsData 에서 유효한 `ranking_opt`(rnk) 셀을 순서대로 수집.
 * rowspan/colspan continuation 으로 숨겨진 셀(isHidden)은 제외.
 * Case 2 옵션 소스 변환 / 유효성 검사 / UI 카운트 등 여러 곳에서 공유하는 단일 진실.
 */
export function collectRankingOptCells(
  tableRowsData: TableRow[] | undefined,
): TableCell[] {
  if (!tableRowsData) return [];
  const cells: TableCell[] = [];
  for (const row of tableRowsData) {
    for (const cell of row.cells) {
      if (cell.type !== 'ranking_opt') continue;
      if (cell.isHidden) continue;
      cells.push(cell);
    }
  }
  return cells;
}

/**
 * 순위형 질문의 옵션 소스를 통합 반환.
 * - 수동 (optionsSource !== 'table'): question.options 그대로
 * - 테이블 옵션 (optionsSource === 'table'): 자신의 tableRowsData 에서 'ranking_opt' 셀을 옵션으로 수집
 *   - id/value: cell.id (UUID — 셀 이동/라벨 변경에 강건)
 *   - label: cell.rankingLabel || cell.content || '(라벨 없음)'
 *   - spssNumericCode: 셀의 spssNumericCode 우선, 없으면 수집 순서 1-based 인덱스
 */
export function resolveRankingOptions(question: Question): QuestionOption[] {
  if (question.rankingConfig?.optionsSource !== 'table') {
    return question.options ?? [];
  }

  const cells = collectRankingOptCells(question.tableRowsData);
  return cells.map((cell, idx) => {
    const label =
      (cell.rankingLabel ?? '').trim() || (cell.content ?? '').trim() || '(라벨 없음)';
    return {
      id: cell.id,
      value: cell.id,
      label,
      spssNumericCode: cell.spssNumericCode ?? idx + 1,
    };
  });
}
