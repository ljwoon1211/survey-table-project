/**
 * Cleaning Export Renderers
 *
 * 데이터 컨텐츠 기록 로직 — sheet builder가 조합해서 사용한다.
 * - Semi-long 데이터 행 렌더링 (border, depth1 스타일, cellIds 숨김 기록 등)
 * - 연속 빈 행 Excel outline 그룹핑
 * - 체크박스 그룹에 대한 label 수식 (TEXTJOIN 대체 패턴) + 데이터 유효성 + H1 병합
 *
 * 의존: primitives + types + format.
 */
import ExcelJS from 'exceljs';

import type {
  DataRowMeta,
  ExpandedColumn,
  SemiLongRow,
} from './cleaning-export-types';
import {
  HEADER_ROW_COUNT,
  LIGHT_BLUE_FILL,
  THICK_BOTTOM_BORDER,
  UNEXPOSED_FONT,
  UNEXPOSED_MARKER,
} from './cleaning-export-types';

import { isNonDataDepth1 } from './cleaning-export-format';

import {
  addRow,
  getExcelColumnLetter,
  setCellValue,
  setCellValueChunked,
} from './cleaning-export-primitives';

// ============================================================
// Semi-Long Data Row Rendering
// ============================================================

export function writeSemiLongDataRows(
  ws: ExcelJS.Worksheet,
  dataRows: SemiLongRow[],
  colCount: number,
  metaColCount: number,
  idColCount: number,
  hiddenStartCol: number,
  rowOffset = 0,
) {
  let prevResponseId = '';
  let depth1Counter = 0;
  let prevDepth1 = '';
  const measureStartCol = metaColCount + idColCount + 1;

  for (const semiRow of dataRows) {
    if (prevResponseId && semiRow.responseId !== prevResponseId) {
      const prevExcelRow = ws.getRow(ws.rowCount);
      for (let c = 1; c <= colCount; c++) {
        prevExcelRow.getCell(c).border = THICK_BOTTOM_BORDER;
      }
      depth1Counter = 0;
      prevDepth1 = '';
    }

    if (semiRow.depth1Value !== prevDepth1 && semiRow.depth1Value !== '' && !isNonDataDepth1(semiRow.depth1Value)) {
      depth1Counter++;
      prevDepth1 = semiRow.depth1Value;
    }

    const excelRow = addRow(ws, [
      semiRow.responseId,
      semiRow.rowLabel || semiRow.seqNum,
      ...semiRow.identifierValues,
      ...semiRow.measurementValues,
    ]);

    setCellValueChunked(excelRow, hiddenStartCol, semiRow.cellIds.join(','));
    setCellValue(excelRow.getCell(hiddenStartCol + 2), semiRow.questionId);
    setCellValue(excelRow.getCell(hiddenStartCol + 3), semiRow.rowIndex);

    if (depth1Counter % 2 === 0) {
      for (let c = 1; c <= colCount; c++) {
        excelRow.getCell(c).fill = LIGHT_BLUE_FILL;
      }
    }

    prevResponseId = semiRow.responseId;

    if (semiRow.isUnexposed === 'question' || semiRow.isUnexposed === 'row') {
      for (let c = measureStartCol; c <= colCount; c++) {
        excelRow.getCell(c).font = UNEXPOSED_FONT;
      }
    } else if (semiRow.unexposedColumns.size > 0) {
      for (const mi of semiRow.unexposedColumns) {
        excelRow.getCell(measureStartCol + mi).font = UNEXPOSED_FONT;
      }
    }
  }

  if (dataRows.length > 0) {
    const lastExcelRow = ws.getRow(HEADER_ROW_COUNT + rowOffset + dataRows.length);
    for (let c = 1; c <= colCount; c++) {
      lastExcelRow.getCell(c).border = THICK_BOTTOM_BORDER;
    }
  }
}

// ============================================================
// Empty Row Grouping (Excel Outline)
// ============================================================

/**
 * 연속된 빈 행을 Excel Outline(그룹화)으로 접어둔다.
 * - 빈 행: 모든 measurementValues가 null 또는 UNEXPOSED_MARKER
 * - 같은 응답 내에서만 연속 그룹화 (응답 경계를 넘지 않음)
 * - 연속 2행 이상일 때만 그룹화
 */
export function applyEmptyRowGrouping(
  ws: ExcelJS.Worksheet,
  dataRows: SemiLongRow[],
  rowOffset: number,
) {
  if (dataRows.length === 0) return;

  const dataStartRow = HEADER_ROW_COUNT + rowOffset + 1;

  // 각 행이 "빈 행"인지 판별
  const isEmpty = (row: SemiLongRow): boolean =>
    row.measurementValues.every((v) => v === null || v === UNEXPOSED_MARKER);

  // 연속 빈 행 구간 수집 (응답 경계에서 끊기)
  type Span = { start: number; end: number };
  const spans: Span[] = [];
  let spanStart = -1;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const isEmptyRow = isEmpty(row);
    const isResponseBoundary = i > 0 && dataRows[i].responseId !== dataRows[i - 1].responseId;

    if (isResponseBoundary && spanStart !== -1) {
      // 응답 경계 → 이전 구간 종결
      if (i - 1 - spanStart >= 1) spans.push({ start: spanStart, end: i - 1 });
      spanStart = isEmptyRow ? i : -1;
    } else if (isEmptyRow) {
      if (spanStart === -1) spanStart = i;
    } else {
      if (spanStart !== -1) {
        if (i - 1 - spanStart >= 1) spans.push({ start: spanStart, end: i - 1 });
        spanStart = -1;
      }
    }
  }
  // 마지막 구간 처리
  if (spanStart !== -1 && dataRows.length - 1 - spanStart >= 1) {
    spans.push({ start: spanStart, end: dataRows.length - 1 });
  }

  // Excel 행에 outlineLevel 적용
  for (const span of spans) {
    for (let i = span.start; i <= span.end; i++) {
      const excelRow = ws.getRow(dataStartRow + i);
      excelRow.outlineLevel = 1;
    }
  }

  if (spans.length > 0) {
    ws.properties.outlineLevelRow = 1;
  }
}

// ============================================================
// Checkbox Formula / Hidden / Validation / H1 Merge
// ============================================================

/**
 * label 열에 TEXTJOIN 수식을 삽입한다.
 * 미노출 행(이미 텍스트 값이 들어간 행)은 건너뛴다.
 */
export function applyCheckboxFormulas(
  ws: ExcelJS.Worksheet,
  expandedColumns: ExpandedColumn[],
  startCol: number,
  dataRows: DataRowMeta[],
  rowOffset = 0,
) {
  interface LabelGroup {
    labelExcelCol: number;
    labelExpandedIndex: number;
    binaryExcelCols: number[];
    binaryLabels: string[];
    otherTextExcelCol?: number;
    isVarying: boolean;
  }

  const groups: LabelGroup[] = [];
  let currentGroup: LabelGroup | null = null;

  for (let i = 0; i < expandedColumns.length; i++) {
    const ec = expandedColumns[i];
    const excelCol = startCol + i;

    if (ec.columnKind === 'label') {
      currentGroup = {
        labelExcelCol: excelCol,
        labelExpandedIndex: i,
        binaryExcelCols: [],
        binaryLabels: [],
        isVarying: !!ec.isVaryingOptions,
      };
      groups.push(currentGroup);
    } else if (ec.columnKind === 'binary' && currentGroup) {
      currentGroup.binaryExcelCols.push(excelCol);
      currentGroup.binaryLabels.push(ec.optionLabel ?? '');
    } else if (ec.columnKind === 'other-text' && currentGroup) {
      currentGroup.otherTextExcelCol = excelCol;
    } else {
      currentGroup = null;
    }
  }

  if (groups.length === 0) return;

  for (let ri = 0; ri < dataRows.length; ri++) {
    const meta = dataRows[ri];
    if (meta.isUnexposed) continue;
    if (isNonDataDepth1(meta.depth1Value)) continue;

    const excelRowNum = HEADER_ROW_COUNT + rowOffset + 1 + ri;

    for (const group of groups) {
      const labelCell = ws.getRow(excelRowNum).getCell(group.labelExcelCol);
      if (labelCell.value === UNEXPOSED_MARKER) continue;

      // varying: 서버사이드 라벨 사용 (SemiLongRow.computedLabels로 이미 설정됨)
      if (group.isVarying) continue;

      // 수식 적용 직전의 셀 값 — formatExpandedCellValue로 계산된 label 문자열
      // autoFilter 캐시가 result를 참조하므로 result에 이 값을 함께 저장해야 필터가 정상 동작
      const precomputedResult = labelCell.value;

      const ifParts = group.binaryExcelCols.map((col, idx) => {
        const colLetter = getExcelColumnLetter(col);
        const label = group.binaryLabels[idx].replace(/"/g, '""');
        return `IF(IFERROR(${colLetter}${excelRowNum}>0,FALSE),", ${label}","")`;
      });

      if (group.otherTextExcelCol) {
        const otherCol = getExcelColumnLetter(group.otherTextExcelCol);
        ifParts.push(`IF(IFERROR(LEN(${otherCol}${excelRowNum})>0,FALSE),", 기타: "&${otherCol}${excelRowNum},"")`);
      }

      const concat = ifParts.join('&');
      const formula = `MID(${concat},3,9999)`;
      const result = typeof precomputedResult === 'string' || typeof precomputedResult === 'number'
        ? precomputedResult
        : undefined;
      labelCell.value = { formula, result, date1904: false } as ExcelJS.CellFormulaValue;
    }
  }
}

/**
 * 숨김 열 설정 + binary 열에 데이터 유효성 검사(드롭다운) 적용
 */
export function applyHiddenAndValidation(
  ws: ExcelJS.Worksheet,
  expandedColumns: ExpandedColumn[],
  startCol: number,
  dataRowCount: number,
  rowOffset = 0,
) {
  for (let i = 0; i < expandedColumns.length; i++) {
    const ec = expandedColumns[i];
    const excelCol = startCol + i;

    if (!ec.visible) {
      ws.getColumn(excelCol).hidden = true;
    }

    if (ec.columnKind === 'binary') {
      const code = ec.isVaryingOptions ? 1 : (ec.spssNumericCode ?? (ec.checkboxOptionIndex! + 1));
      for (let r = HEADER_ROW_COUNT + rowOffset + 1; r <= HEADER_ROW_COUNT + rowOffset + dataRowCount; r++) {
        ws.getRow(r).getCell(excelCol).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"0,${code}"`],
        };
      }
    }
  }
}

/**
 * h1 헤더에서 같은 원본 셀의 연속 열을 병합한다.
 */
export function mergeExpandedH1Headers(
  ws: ExcelJS.Worksheet,
  expandedColumns: ExpandedColumn[],
  startCol: number,
  rowOffset = 0,
) {
  if (expandedColumns.length === 0) return;

  const h1Row = 1 + rowOffset;
  let mergeStart = startCol;
  let prevCellId: string | null = expandedColumns[0].cellId;

  for (let i = 1; i <= expandedColumns.length; i++) {
    const currentCellId = i < expandedColumns.length ? expandedColumns[i].cellId : null;
    if (currentCellId !== prevCellId) {
      const mergeEnd = startCol + i - 1;
      if (mergeEnd > mergeStart) {
        ws.mergeCells(h1Row, mergeStart, h1Row, mergeEnd);
        ws.getRow(h1Row).getCell(mergeStart).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      }
      mergeStart = startCol + i;
      prevCellId = currentCellId;
    }
  }
}
