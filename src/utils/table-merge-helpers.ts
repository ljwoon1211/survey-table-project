import { Question, TableRow } from '@/types/survey';

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
  colIndex?: number,
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
  colIndex?: number,
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

/**
 * 가시 행 기준으로 rowspan을 재계산하여 새로운 행 배열을 반환
 *
 * 원본 rows에서 병합 시작 셀(rowspan > 1)을 식별하고,
 * 해당 병합이 커버하는 범위 중 visibleRowIds에 포함된 행 수로 rowspan을 재조정.
 *
 * @param originalRows 원본 전체 행 배열
 * @param visibleRowIds 표시할 행 ID Set
 * @returns 재계산된 셀 병합이 적용된 가시 행 배열 (deep copy)
 */
export function recalculateRowspansForVisibleRows(
  originalRows: TableRow[],
  visibleRowIds: Set<string>,
): TableRow[] {
  // 가시 행만 deep copy
  const visibleRows = originalRows
    .filter((row) => visibleRowIds.has(row.id))
    .map((row) => ({
      ...row,
      cells: row.cells.map((cell) => ({ ...cell })),
    }));

  if (visibleRows.length === 0) return visibleRows;

  // 열 개수 (첫 번째 행 기준)
  const colCount = visibleRows[0].cells.length;

  // 각 열에 대해 병합 재계산
  for (let colIdx = 0; colIdx < colCount; colIdx++) {
    // 1. 원본에서 병합 그룹 식별 (rowspan > 1인 셀 기준)
    interface MergeGroup {
      startOrigIdx: number;
      endOrigIdx: number; // exclusive
      cellContent: typeof originalRows[0]['cells'][0]; // 병합 시작 셀의 내용 참조
    }
    const mergeGroups: MergeGroup[] = [];

    for (let r = 0; r < originalRows.length; r++) {
      const cell = originalRows[r].cells[colIdx];
      if (cell && cell.rowspan && cell.rowspan > 1 && !cell.isHidden) {
        mergeGroups.push({
          startOrigIdx: r,
          endOrigIdx: r + cell.rowspan,
          cellContent: cell,
        });
      }
    }

    // 2. 각 병합 그룹에 대해, 가시 행 중 해당 범위에 속하는 행들을 찾아 재계산
    for (const group of mergeGroups) {
      // 이 그룹 범위에 속하는 원본 행 ID들
      const groupOrigRowIds = new Set<string>();
      for (let r = group.startOrigIdx; r < group.endOrigIdx && r < originalRows.length; r++) {
        groupOrigRowIds.add(originalRows[r].id);
      }

      // 가시 행 중 이 그룹에 속하는 행들의 인덱스 (visibleRows 기준)
      const visibleInGroup: number[] = [];
      for (let v = 0; v < visibleRows.length; v++) {
        if (groupOrigRowIds.has(visibleRows[v].id)) {
          visibleInGroup.push(v);
        }
      }

      if (visibleInGroup.length === 0) continue;

      // 첫 번째 가시 행에 병합 시작 셀 배치
      const firstVisibleIdx = visibleInGroup[0];
      const firstCell = visibleRows[firstVisibleIdx].cells[colIdx];
      firstCell.isHidden = false;
      firstCell.content = group.cellContent.content;
      firstCell.type = group.cellContent.type;
      firstCell.rowspan = visibleInGroup.length > 1 ? visibleInGroup.length : undefined;

      // 나머지 가시 행의 해당 열 셀은 isHidden
      for (let i = 1; i < visibleInGroup.length; i++) {
        const hiddenCell = visibleRows[visibleInGroup[i]].cells[colIdx];
        hiddenCell.isHidden = true;
        hiddenCell.rowspan = undefined;
      }
    }
  }

  return visibleRows;
}
