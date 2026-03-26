import type { TableCell, TableColumn, TableRow } from '@/types/survey';

/** 입력 가능한 셀 타입 (SPSS 변수 생성 대상) */
export const INTERACTIVE_CELL_TYPES = new Set(['checkbox', 'radio', 'select', 'input']);

/** 셀이 자동생성 대상인지 판별 (모든 타입, hidden만 제외) */
function isAutoGeneratable(cell: TableCell): boolean {
  return !cell.isHidden;
}

/** 기존 cellCode가 있고 isCustomCellCode가 undefined이면 커스텀으로 간주 (기존 데이터 보호) */
function isEffectivelyCustom(cell: TableCell): boolean {
  if (cell.isCustomCellCode === true) return true;
  if (cell.isCustomCellCode === undefined && cell.cellCode) return true;
  return false;
}

function isEffectivelyCustomLabel(cell: TableCell): boolean {
  if (cell.isCustomExportLabel === true) return true;
  if (cell.isCustomExportLabel === undefined && cell.exportLabel) return true;
  return false;
}

// ── 셀코드 생성 ──

/** 셀코드 자동생성: questionCode_rowCode_columnCode */
export function generateCellCode(
  questionCode: string | undefined,
  rowCode: string | undefined,
  columnCode: string | undefined,
): string | undefined {
  if (!questionCode || !rowCode || !columnCode) return undefined;
  return `${questionCode}_${rowCode}_${columnCode}`;
}

/** exportLabel 자동생성: questionTitle_columnLabel_rowLabel */
export function generateExportLabel(
  questionTitle: string | undefined,
  columnLabel: string | undefined,
  rowLabel: string | undefined,
): string | undefined {
  if (!questionTitle || !columnLabel || !rowLabel) return undefined;
  return `${questionTitle}_${columnLabel}_${rowLabel}`;
}

// ── SPSS 변수 타입 / 측정 수준 자동 판단 ──

/** 셀 타입 기반 SPSS 변수 타입 자동 판단 */
export function inferSpssVarType(
  cellType: TableCell['type'],
): TableCell['spssVarType'] {
  switch (cellType) {
    case 'checkbox':
    case 'radio':
    case 'select':
      return 'Numeric';
    case 'input':
      return 'String';
    default:
      return undefined;
  }
}

/** 셀 타입 기반 SPSS 측정 수준 자동 판단 */
export function inferSpssMeasure(
  cellType: TableCell['type'],
): TableCell['spssMeasure'] {
  switch (cellType) {
    case 'checkbox':
    case 'radio':
    case 'select':
      return 'Nominal';
    case 'input':
      return 'Continuous';
    default:
      return undefined;
  }
}

// ── 일괄 생성 함수들 ──

/** 단일 셀에 자동생성값 적용 */
function applyAutoCodeToCell(
  cell: TableCell,
  questionCode: string | undefined,
  questionTitle: string | undefined,
  rowCode: string | undefined,
  rowLabel: string | undefined,
  columnCode: string | undefined,
  columnLabel: string | undefined,
): TableCell {
  if (!isAutoGeneratable(cell)) return cell;
  if (isEffectivelyCustom(cell) && isEffectivelyCustomLabel(cell)) return cell;

  const updates: Partial<TableCell> = {};

  if (!isEffectivelyCustom(cell)) {
    updates.cellCode = generateCellCode(questionCode, rowCode, columnCode);
    updates.isCustomCellCode = false;
  }

  if (!isEffectivelyCustomLabel(cell)) {
    updates.exportLabel = generateExportLabel(questionTitle, columnLabel, rowLabel);
    updates.isCustomExportLabel = false;
  }

  // 변수 타입/측정 수준이 아직 없으면 자동 설정 (interactive 셀만)
  if (!cell.spssVarType && INTERACTIVE_CELL_TYPES.has(cell.type)) {
    updates.spssVarType = inferSpssVarType(cell.type);
  }
  if (!cell.spssMeasure && INTERACTIVE_CELL_TYPES.has(cell.type)) {
    updates.spssMeasure = inferSpssMeasure(cell.type);
  }

  return { ...cell, ...updates };
}

/** 전체 테이블의 셀코드/라벨 일괄 자동생성 */
export function generateAllCellCodes(
  questionCode: string | undefined,
  questionTitle: string | undefined,
  columns: TableColumn[],
  rows: TableRow[],
): TableRow[] {
  return rows.map((row) => ({
    ...row,
    cells: row.cells.map((cell, colIdx) => {
      const col = columns[colIdx];
      return applyAutoCodeToCell(
        cell,
        questionCode,
        questionTitle,
        row.rowCode,
        row.label,
        col?.columnCode,
        col?.label,
      );
    }),
  }));
}

/** 특정 행의 셀코드 재계산 (rowCode 변경 시) */
export function generateCellCodesForRow(
  questionCode: string | undefined,
  questionTitle: string | undefined,
  columns: TableColumn[],
  row: TableRow,
): TableRow {
  return {
    ...row,
    cells: row.cells.map((cell, colIdx) => {
      const col = columns[colIdx];
      return applyAutoCodeToCell(
        cell,
        questionCode,
        questionTitle,
        row.rowCode,
        row.label,
        col?.columnCode,
        col?.label,
      );
    }),
  };
}

/** 특정 열의 셀코드 재계산 (columnCode 변경 시) */
export function generateCellCodesForColumn(
  questionCode: string | undefined,
  questionTitle: string | undefined,
  column: TableColumn,
  colIdx: number,
  rows: TableRow[],
): TableRow[] {
  return rows.map((row) => ({
    ...row,
    cells: row.cells.map((cell, cIdx) => {
      if (cIdx !== colIdx) return cell;
      return applyAutoCodeToCell(
        cell,
        questionCode,
        questionTitle,
        row.rowCode,
        row.label,
        column.columnCode,
        column.label,
      );
    }),
  }));
}

/** 셀 복사/붙여넣기 시 새 위치 기준으로 셀코드 재생성 */
export function regenerateCellCodeForPaste(
  cell: TableCell,
  questionCode: string | undefined,
  questionTitle: string | undefined,
  rowCode: string | undefined,
  rowLabel: string | undefined,
  columnCode: string | undefined,
  columnLabel: string | undefined,
): TableCell {
  if (!isAutoGeneratable(cell)) return cell;

  return {
    ...cell,
    cellCode: generateCellCode(questionCode, rowCode, columnCode),
    isCustomCellCode: false,
    exportLabel: generateExportLabel(questionTitle, columnLabel, rowLabel),
    isCustomExportLabel: false,
  };
}
