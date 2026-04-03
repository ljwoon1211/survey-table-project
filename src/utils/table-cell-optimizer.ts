import type { TableCell, TableColumn, TableRow } from '@/types/survey';

import { stripOptionCodes } from './option-code-generator';
import { inferSpssMeasure, inferSpssVarType } from './table-cell-code-generator';

/**
 * 저장 시 자동 재생성 가능한 셀 필드를 제거하여 DB 크기를 최적화한다.
 * 로드 시 generateAllCellCodes()로 복원된다.
 *
 * 제거 대상:
 * - cellCode (isCustomCellCode === false일 때)
 * - exportLabel (isCustomExportLabel === false일 때)
 * - isCustomCellCode (false일 때)
 * - isCustomExportLabel (false일 때)
 * - spssVarType (자동 추론값과 동일할 때)
 * - spssMeasure (자동 추론값과 동일할 때)
 */
function stripCell(cell: TableCell): TableCell {
  // hidden 셀이나 자동생성 대상이 아닌 셀은 그대로 반환
  if (cell.isHidden) return cell;

  const stripped = { ...cell };

  // cellCode: isCustomCellCode가 명시적으로 false일 때만 제거
  // undefined && cellCode 존재 → 커스텀으로 간주 (기존 데이터 보호)
  if (stripped.isCustomCellCode === false) {
    delete stripped.cellCode;
    delete stripped.isCustomCellCode;
  }

  // exportLabel: isCustomExportLabel가 명시적으로 false일 때만 제거
  if (stripped.isCustomExportLabel === false) {
    delete stripped.exportLabel;
    delete stripped.isCustomExportLabel;
  }

  // spssVarType: 자동 추론값과 동일하면 제거
  const inferredVarType = inferSpssVarType(cell.type);
  if (stripped.spssVarType !== undefined && stripped.spssVarType === inferredVarType) {
    delete stripped.spssVarType;
  }

  // spssMeasure: 자동 추론값과 동일하면 제거
  const inferredMeasure = inferSpssMeasure(cell.type);
  if (stripped.spssMeasure !== undefined && stripped.spssMeasure === inferredMeasure) {
    delete stripped.spssMeasure;
  }

  // 셀 내부 옵션의 자동생성 필드 제거
  if (stripped.checkboxOptions && stripped.checkboxOptions.length > 0) {
    stripped.checkboxOptions = stripOptionCodes(stripped.checkboxOptions);
  }
  if (stripped.radioOptions && stripped.radioOptions.length > 0) {
    stripped.radioOptions = stripOptionCodes(stripped.radioOptions);
  }
  if (stripped.selectOptions && stripped.selectOptions.length > 0) {
    stripped.selectOptions = stripOptionCodes(stripped.selectOptions);
  }

  return stripped;
}

/**
 * 질문의 tableRowsData에서 자동 재생성 가능한 필드를 제거한다.
 * question.tableColumns는 변경하지 않는다.
 */
export function stripTableRowsData(
  tableRowsData: TableRow[],
  _columns?: TableColumn[],
): TableRow[] {
  return tableRowsData.map((row) => ({
    ...row,
    cells: row.cells.map((cell) => stripCell(cell)),
  }));
}
