import { Question, TableRow } from "@/types/survey";

/**
 * 병합된 행 ID들을 가져오는 헬퍼 함수
 * @param rowId 행 ID
 * @param tableRowsData 테이블 행 데이터
 * @param colIndex 열 인덱스 (선택사항)
 * @returns 병합된 행 ID 배열
 */
export function getMergedRowIds(
  rowId: string,
  tableRowsData: TableRow[] | undefined,
  colIndex?: number
): string[] {
  if (!tableRowsData) return [rowId];

  const rowIndex = tableRowsData.findIndex((r) => r.id === rowId);
  if (rowIndex === -1) return [rowId];

  // 열 인덱스가 지정되지 않았으면 해당 행만 반환
  if (colIndex === undefined) return [rowId];

  const row = tableRowsData[rowIndex];
  const cell = row?.cells[colIndex];

  // 셀이 숨겨진 경우 (다른 셀의 병합 영역에 포함됨)
  if (cell?.isHidden) {
    // 위쪽 행들을 확인하여 병합 시작 셀 찾기
    for (let r = 0; r < rowIndex; r++) {
      const checkRow = tableRowsData[r];
      const checkCell = checkRow?.cells[colIndex];
      if (checkCell && checkCell.rowspan && checkCell.rowspan > 1 && !checkCell.isHidden) {
        const isInMergedRange = rowIndex >= r && rowIndex < r + checkCell.rowspan;
        if (isInMergedRange) {
          const mergedRowIds: string[] = [];
          for (let i = 0; i < checkCell.rowspan; i++) {
            const mergedRow = tableRowsData[r + i];
            if (mergedRow) mergedRowIds.push(mergedRow.id);
          }
          return mergedRowIds;
        }
      }
    }
  }

  // 현재 행의 셀이 병합 시작 셀인 경우
  if (cell && cell.rowspan && cell.rowspan > 1 && !cell.isHidden) {
    const mergedRowIds: string[] = [];
    for (let i = 0; i < cell.rowspan; i++) {
      const mergedRow = tableRowsData[rowIndex + i];
      if (mergedRow) mergedRowIds.push(mergedRow.id);
    }
    return mergedRowIds;
  }

  // 다른 행의 병합된 셀에 포함되어 있는지 확인 (셀이 숨겨지지 않은 경우)
  if (!cell?.isHidden) {
    for (let r = 0; r < rowIndex; r++) {
      const checkRow = tableRowsData[r];
      const checkCell = checkRow?.cells[colIndex];
      if (checkCell && checkCell.rowspan && checkCell.rowspan > 1 && !checkCell.isHidden) {
        const isInMergedRange = rowIndex >= r && rowIndex < r + checkCell.rowspan;
        if (isInMergedRange) {
          const mergedRowIds: string[] = [];
          for (let i = 0; i < checkCell.rowspan; i++) {
            const mergedRow = tableRowsData[r + i];
            if (mergedRow) mergedRowIds.push(mergedRow.id);
          }
          return mergedRowIds;
        }
      }
    }
  }

  return [rowId];
}

export interface RowMergeInfo {
  isMerged: boolean;
  mergedRowIds: string[];
  mergeStartRowId: string | null;
}

/**
 * 행의 병합 정보를 가져오는 헬퍼 함수
 * @param rowId 행 ID
 * @param tableRowsData 테이블 행 데이터
 * @param colIndex 열 인덱스 (선택사항)
 * @returns 병합 정보 객체
 */
export function getRowMergeInfo(
  rowId: string,
  tableRowsData: TableRow[] | undefined,
  colIndex?: number
): RowMergeInfo {
  if (!tableRowsData || colIndex === undefined) {
    return { isMerged: false, mergedRowIds: [rowId], mergeStartRowId: null };
  }

  const rowIndex = tableRowsData.findIndex((r) => r.id === rowId);
  if (rowIndex === -1) {
    return { isMerged: false, mergedRowIds: [rowId], mergeStartRowId: null };
  }

  const row = tableRowsData[rowIndex];
  const cell = row?.cells[colIndex];

  // 셀이 숨겨진 경우 (다른 셀의 병합 영역에 포함됨)
  if (cell?.isHidden) {
    // 위쪽 행들을 확인하여 병합 시작 셀 찾기
    for (let r = 0; r < rowIndex; r++) {
      const checkRow = tableRowsData[r];
      const checkCell = checkRow?.cells[colIndex];
      if (checkCell && checkCell.rowspan && checkCell.rowspan > 1 && !checkCell.isHidden) {
        const isInMergedRange = rowIndex >= r && rowIndex < r + checkCell.rowspan;
        if (isInMergedRange) {
          const mergedRowIds: string[] = [];
          for (let i = 0; i < checkCell.rowspan; i++) {
            const mergedRow = tableRowsData[r + i];
            if (mergedRow) mergedRowIds.push(mergedRow.id);
          }
          return {
            isMerged: true,
            mergedRowIds,
            mergeStartRowId: tableRowsData[r].id,
          };
        }
      }
    }
  }

  // 현재 행의 셀이 병합 시작 셀인 경우
  if (cell && cell.rowspan && cell.rowspan > 1 && !cell.isHidden) {
    const mergedRowIds: string[] = [];
    for (let i = 0; i < cell.rowspan; i++) {
      const mergedRow = tableRowsData[rowIndex + i];
      if (mergedRow) mergedRowIds.push(mergedRow.id);
    }
    return {
      isMerged: true,
      mergedRowIds,
      mergeStartRowId: rowId,
    };
  }

  // 다른 행의 병합된 셀에 포함되어 있는지 확인 (셀이 숨겨지지 않은 경우)
  if (!cell?.isHidden) {
    for (let r = 0; r < rowIndex; r++) {
      const checkRow = tableRowsData[r];
      const checkCell = checkRow?.cells[colIndex];
      if (checkCell && checkCell.rowspan && checkCell.rowspan > 1 && !checkCell.isHidden) {
        const isInMergedRange = rowIndex >= r && rowIndex < r + checkCell.rowspan;
        if (isInMergedRange) {
          const mergedRowIds: string[] = [];
          for (let i = 0; i < checkCell.rowspan; i++) {
            const mergedRow = tableRowsData[r + i];
            if (mergedRow) mergedRowIds.push(mergedRow.id);
          }
          return {
            isMerged: true,
            mergedRowIds,
            mergeStartRowId: tableRowsData[r].id,
          };
        }
      }
    }
  }

  return { isMerged: false, mergedRowIds: [rowId], mergeStartRowId: null };
}

