/**
 * Cleaning Export 시트 렌더링
 *
 * ExcelJS 워크시트에 헤더·데이터·수식·스타일을 적용하고,
 * 개별 시트(응답자목록, 일반문항, Wide 테이블, Semi-Long 테이블)를 생성한다.
 */
import ExcelJS from 'exceljs';

import type {
  CheckboxOption,
  Question,
  QuestionGroup,
  TableCell,
  TableColumn,
} from '@/types/survey';
import {
  shouldDisplayColumn,
  shouldDisplayQuestion,
  shouldDisplayRow,
} from '@/utils/branch-logic';

import { isCellInputable } from './excel-export-utils';
import type { ResponseData } from './flat-excel-export';

import type {
  ClassifiedCells,
  DataRowMeta,
  ExpandedColumn,
  SemiLongRow,
} from './cleaning-export-types';
import {
  HEADER_BORDER,
  HEADER_FILL,
  HEADER_FONT,
  HEADER_ROW_COUNT,
  LIGHT_BLUE_FILL,
  TAB_COLOR_SEMI_LONG,
  TAB_COLOR_WIDE,
  THICK_BOTTOM_BORDER,
  TITLE_ROW_OFFSET,
  UNEXPOSED_FONT,
  UNEXPOSED_MARKER,
} from './cleaning-export-types';

import {
  buildSemiLongHeaders,
  expandGeneralCheckboxQuestion,
  formatExpandedCellValue,
  formatGeneralQuestionValue,
  isNonDataDepth1,
} from './cleaning-export-format';

// ============================================================
// Excel Cell / Row Helpers (semi-long 전용)
// ============================================================

/**
 * XML 1.0에서 허용하지 않는 제어 문자를 제거한다.
 */
function stripInvalidXmlChars(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFFFE\uFFFF]/g, '');
}

/** ws.addRow() 래퍼 — 문자열 값의 XML 무효 문자를 자동 제거 */
function addRow(ws: ExcelJS.Worksheet, values: (string | number | null | undefined)[]): ExcelJS.Row {
  return ws.addRow(values.map((v) => (typeof v === 'string' ? stripInvalidXmlChars(v) : v)));
}

/** 셀에 문자열 값 설정 — XML 무효 문자 자동 제거 */
function setCellValue(cell: ExcelJS.Cell, value: string | number | null | undefined) {
  cell.value = typeof value === 'string' ? stripInvalidXmlChars(value) : (value ?? null);
}

const EXCEL_MAX_CELL_CHARS = 32767;

/**
 * Excel 셀 문자열 제한(32,767자) 초과 시 여러 셀에 분할 기록.
 */
function setCellValueChunked(row: ExcelJS.Row, startCol: number, value: string) {
  if (value.length <= EXCEL_MAX_CELL_CHARS) {
    setCellValue(row.getCell(startCol), value);
    return;
  }
  let offset = 0;
  let col = startCol;
  while (offset < value.length) {
    setCellValue(row.getCell(col), value.slice(offset, offset + EXCEL_MAX_CELL_CHARS));
    offset += EXCEL_MAX_CELL_CHARS;
    col++;
  }
}

export function sanitizeSheetName(name: string, existingNames: Set<string>): string {
  let safe = name.replace(/[\\/?*[\]]/g, '');
  if (safe.length > 31) safe = safe.slice(0, 28) + '...';
  let final = safe;
  let counter = 2;
  while (existingNames.has(final)) {
    const suffix = `(${counter})`;
    final = safe.slice(0, 31 - suffix.length) + suffix;
    counter++;
  }
  existingNames.add(final);
  return final;
}

// ============================================================
// Column Width Auto-fit
// ============================================================

/** 텍스트의 표시 너비를 추정 (CJK 문자 1.8배) */
function getTextWidth(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const str = String(value);
  let width = 0;
  for (const char of str) {
    const code = char.codePointAt(0) ?? 0;
    if (
      (code >= 0x1100 && code <= 0x11FF) ||
      (code >= 0x3000 && code <= 0x9FFF) ||
      (code >= 0xAC00 && code <= 0xD7AF) ||
      (code >= 0xF900 && code <= 0xFAFF) ||
      (code >= 0xFF00 && code <= 0xFFEF)
    ) {
      width += 1.8;
    } else {
      width += 1;
    }
  }
  return width;
}

const AUTO_FIT_MIN_WIDTH = 4;
const AUTO_FIT_MAX_WIDTH = 50;
const AUTO_FIT_PADDING = 2;
const AUTO_FIT_SAMPLE_ROWS = 200;

function autoFitColumnWidths(ws: ExcelJS.Worksheet): void {
  const colCount = ws.columnCount;
  const maxWidths = new Array<number>(colCount).fill(0);

  for (let r = 1; r <= Math.min(HEADER_ROW_COUNT, ws.rowCount); r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= colCount; c++) {
      if (!ws.getColumn(c).hidden) {
        maxWidths[c - 1] = Math.max(maxWidths[c - 1], getTextWidth(row.getCell(c).value));
      }
    }
  }

  const dataEnd = Math.min(ws.rowCount, HEADER_ROW_COUNT + AUTO_FIT_SAMPLE_ROWS);
  for (let r = HEADER_ROW_COUNT + 1; r <= dataEnd; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= colCount; c++) {
      if (!ws.getColumn(c).hidden) {
        maxWidths[c - 1] = Math.max(maxWidths[c - 1], getTextWidth(row.getCell(c).value));
      }
    }
  }

  for (let c = 1; c <= colCount; c++) {
    if (!ws.getColumn(c).hidden) {
      ws.getColumn(c).width = Math.min(
        AUTO_FIT_MAX_WIDTH,
        Math.max(AUTO_FIT_MIN_WIDTH, maxWidths[c - 1] + AUTO_FIT_PADDING),
      );
    }
  }
}

// ============================================================
// Excel Column Letter
// ============================================================

/** Excel 열 번호(1-based)를 열 문자(A, B, ..., AA, AB, ...)로 변환 */
function getExcelColumnLetter(colNum: number): string {
  let result = '';
  let n = colNum;
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

// ============================================================
// Shared Sheet Rendering
// ============================================================

function applyHeaderStyle(ws: ExcelJS.Worksheet, colCount: number, rowOffset = 0) {
  for (let r = 1 + rowOffset; r <= HEADER_ROW_COUNT + rowOffset; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.border = HEADER_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    }
    row.height = 24;
  }
}

function setupHiddenColumns(ws: ExcelJS.Worksheet, hiddenStartCol: number, count: number, rowOffset = 0) {
  const labels = ['__cell_ids__', '__cell_ids_2__', '__question_id__', '__row_index__'];
  for (let i = 0; i < count; i++) {
    setCellValue(ws.getRow(1 + rowOffset).getCell(hiddenStartCol + i), labels[i]);
    setCellValue(ws.getRow(2 + rowOffset).getCell(hiddenStartCol + i), labels[i]);
    setCellValue(ws.getRow(3 + rowOffset).getCell(hiddenStartCol + i), labels[i]);
    ws.getColumn(hiddenStartCol + i).hidden = true;
  }
}

function applyAutoFilterAndFreeze(ws: ExcelJS.Worksheet, colCount: number, freezeXSplit: number, rowOffset = 0) {
  const headerEnd = HEADER_ROW_COUNT + rowOffset;
  const lastRow = ws.rowCount;
  if (lastRow > headerEnd) {
    ws.autoFilter = { from: { row: headerEnd, column: 1 }, to: { row: lastRow, column: colCount } };
  }
  ws.views = [{ state: 'frozen', xSplit: freezeXSplit, ySplit: headerEnd }];
}

/** 헤더의 특정 열을 세로 병합하여 한 번만 표시 */
function mergeHeaderCells(ws: ExcelJS.Worksheet, col: number, rowOffset = 0): void {
  ws.mergeCells(1 + rowOffset, col, HEADER_ROW_COUNT + rowOffset, col);
  ws.getRow(1 + rowOffset).getCell(col).alignment = { vertical: 'middle', horizontal: 'center' };
}

// ============================================================
// Semi-Long Data Row Rendering
// ============================================================

function writeSemiLongDataRows(
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
function applyEmptyRowGrouping(
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
// Checkbox Formula / Hidden / Validation
// ============================================================

/**
 * label 열에 TEXTJOIN 수식을 삽입한다.
 * 미노출 행(이미 텍스트 값이 들어간 행)은 건너뛴다.
 */
function applyCheckboxFormulas(
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
      labelCell.value = { formula, date1904: false } as ExcelJS.CellFormulaValue;
    }
  }
}

/**
 * 숨김 열 설정 + binary 열에 데이터 유효성 검사(드롭다운) 적용
 */
function applyHiddenAndValidation(
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
function mergeExpandedH1Headers(
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

// ============================================================
// Sheet Generators
// ============================================================

export function buildIndexSheet(
  workbook: ExcelJS.Workbook,
  responses: ResponseData[],
  sheetNames: Set<string>,
) {
  const name = sanitizeSheetName('응답자목록', sheetNames);
  const ws = workbook.addWorksheet(name, { properties: { tabColor: TAB_COLOR_WIDE } });

  const h1 = ['response_id', '시작 시간', '완료 시간', '소요 시간(초)', '상태', 'User Agent'];
  const h2 = ['response_id', 'datetime', 'datetime', 'number(초)', 'enum', 'string'];
  const h3 = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
  addRow(ws, h1);
  addRow(ws, h2);
  addRow(ws, h3);
  applyHeaderStyle(ws, h1.length);
  mergeHeaderCells(ws, 1);

  for (const resp of responses) {
    const startedAt = resp.startedAt ? new Date(resp.startedAt) : null;
    const completedAt = resp.completedAt ? new Date(resp.completedAt) : null;
    const durationSec =
      startedAt && completedAt
        ? Math.round((completedAt.getTime() - startedAt.getTime()) / 1000)
        : '';

    addRow(ws, [
      resp.id,
      startedAt?.toLocaleString('ko-KR') ?? '',
      completedAt?.toLocaleString('ko-KR') ?? '',
      durationSec,
      resp.isCompleted ? '완료' : '미완료',
      resp.userAgent ?? '',
    ]);
  }

  applyAutoFilterAndFreeze(ws, h1.length, 1);
  autoFitColumnWidths(ws);
}

export function buildGeneralQuestionsSheet(
  workbook: ExcelJS.Workbook,
  survey: { questions: Question[]; groups?: QuestionGroup[] },
  responses: ResponseData[],
  sheetNames: Set<string>,
) {
  const generalQuestions = survey.questions
    .filter((q) => q.type !== 'table' && !(q.type === 'notice' && !q.requiresAcknowledgment))
    .sort((a, b) => a.order - b.order);

  if (generalQuestions.length === 0) return;

  const name = sanitizeSheetName('일반문항', sheetNames);
  const ws = workbook.addWorksheet(name, { properties: { tabColor: TAB_COLOR_WIDE } });

  interface GeneralCol {
    question: Question;
    expanded: ExpandedColumn | null;
  }

  const generalCols: GeneralCol[] = [];
  for (const q of generalQuestions) {
    const cbExpanded = expandGeneralCheckboxQuestion(q);
    if (cbExpanded) {
      generalCols.push({ question: q, expanded: cbExpanded.label });
      for (const bin of cbExpanded.binaries) {
        generalCols.push({ question: q, expanded: bin });
      }
      if (cbExpanded.otherText) {
        generalCols.push({ question: q, expanded: cbExpanded.otherText });
      }
    } else {
      generalCols.push({ question: q, expanded: null });
    }
  }

  const h1 = ['response_id', ...generalCols.map((gc) => gc.expanded?.h1Label ?? gc.question.title)];
  const h2 = ['response_id', ...generalCols.map((gc) => gc.expanded?.h2Label ?? gc.question.type)];
  const h3 = ['response_id', ...generalCols.map((gc) => gc.expanded?.h3Label ?? (gc.question.questionCode ?? gc.question.id))];
  addRow(ws, h1);
  addRow(ws, h2);
  addRow(ws, h3);
  applyHeaderStyle(ws, h1.length);
  mergeHeaderCells(ws, 1);

  const allQuestions = survey.questions;
  const allGroups = survey.groups;

  const dataRowMetas: DataRowMeta[] = [];

  for (const resp of responses) {
    const allResponses = resp.questionResponses;
    const row: (string | number | null)[] = [resp.id];

    for (const gc of generalCols) {
      const q = gc.question;
      if (!shouldDisplayQuestion(q, allResponses, allQuestions, allGroups)) {
        row.push(UNEXPOSED_MARKER);
      } else if (gc.expanded) {
        row.push(formatExpandedCellValue(gc.expanded, allResponses[q.id]));
      } else {
        row.push(formatGeneralQuestionValue(q, allResponses[q.id]));
      }
    }

    const excelRow = addRow(ws, row);
    for (let c = 1; c < row.length; c++) {
      if (row[c] === UNEXPOSED_MARKER) {
        excelRow.getCell(c + 1).font = UNEXPOSED_FONT;
      }
    }

    dataRowMetas.push({ isUnexposed: false, depth1Value: '' });
  }

  // 체크박스 수식/숨김/드롭다운 적용
  const hasCheckbox = generalCols.some((gc) => gc.expanded);
  if (hasCheckbox) {
    const allExpanded: ExpandedColumn[] = generalCols.map((gc) => {
      if (gc.expanded) return gc.expanded;
      return {
        cell: { id: gc.question.id, type: 'text' as const, content: '' } as TableCell,
        colIndex: -1, columnKind: 'value' as const, checkboxOptionIndex: null,
        h1Label: gc.question.title, h2Label: gc.question.type,
        h3Label: gc.question.questionCode ?? gc.question.id,
        cellId: gc.question.id, visible: true,
      };
    });

    const measureStartCol = 2;
    applyCheckboxFormulas(ws, allExpanded, measureStartCol, dataRowMetas);
    applyHiddenAndValidation(ws, allExpanded, measureStartCol, responses.length);

    // h1 병합: 같은 질문의 연속 열
    let mergeStart = measureStartCol;
    let prevQId: string | null | undefined = generalCols[0]?.question.id;
    for (let i = 1; i <= generalCols.length; i++) {
      const currQId = i < generalCols.length ? generalCols[i].question.id : null;
      if (currQId !== prevQId) {
        const mergeEnd = measureStartCol + i - 1;
        if (mergeEnd > mergeStart) {
          ws.mergeCells(1, mergeStart, 1, mergeEnd);
          ws.getRow(1).getCell(mergeStart).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        }
        mergeStart = measureStartCol + i;
        prevQId = currQId;
      }
    }
  }

  applyAutoFilterAndFreeze(ws, h1.length, 1);
  autoFitColumnWidths(ws);
}

export function buildWideTableSheet(
  workbook: ExcelJS.Workbook,
  question: Question,
  responses: ResponseData[],
  allQuestions: Question[],
  sheetNames: Set<string>,
  allGroups?: QuestionGroup[],
) {
  const rows = question.tableRowsData ?? [];
  const columns = question.tableColumns ?? [];

  const sheetLabel = question.questionCode ?? question.title.slice(0, 30);
  const name = sanitizeSheetName(sheetLabel, sheetNames);
  const ws = workbook.addWorksheet(name, { properties: { tabColor: TAB_COLOR_WIDE } });

  interface WideExpandedCol {
    rowIdx: number;
    colIdx: number;
    cell: TableCell;
    rowLabel: string;
    expanded: ExpandedColumn;
  }

  const wideCols: WideExpandedCol[] = [];
  for (let ri = 0; ri < rows.length; ri++) {
    for (let ci = 0; ci < rows[ri].cells.length; ci++) {
      const cell = rows[ri].cells[ci];
      if (cell.isHidden || cell._isContinuation) continue;
      if (!isCellInputable(cell)) continue;

      const rowLabel = rows[ri].label || `행${ri + 1}`;
      const colLabel = columns[ci]?.label ?? '';
      const cellCode = cell.cellCode ?? `r${ri}_c${ci}`;

      if (cell.type === 'checkbox' && cell.checkboxOptions && cell.checkboxOptions.length > 0) {
        const opts = cell.checkboxOptions;
        wideCols.push({
          rowIdx: ri, colIdx: ci, cell, rowLabel,
          expanded: {
            cell, colIndex: ci, columnKind: 'label', checkboxOptionIndex: null,
            h1Label: rowLabel, h2Label: opts.map((o: CheckboxOption) => o.label).join(' | '),
            h3Label: cellCode, cellId: cell.id, visible: true,
          },
        });
        for (let oi = 0; oi < opts.length; oi++) {
          const opt = opts[oi];
          wideCols.push({
            rowIdx: ri, colIdx: ci, cell, rowLabel,
            expanded: {
              cell, colIndex: ci, columnKind: 'binary', checkboxOptionIndex: oi,
              optionValue: opt.value,
              spssNumericCode: opt.spssNumericCode ?? (oi + 1),
              optionLabel: opt.label,
              h1Label: rowLabel, h2Label: opt.label,
              h3Label: `${cellCode}_${opt.optionCode ?? String(oi + 1)}`,
              cellId: cell.id, visible: false,
            },
          });
        }
        if (opts.some((o: CheckboxOption) => o.hasOther)) {
          wideCols.push({
            rowIdx: ri, colIdx: ci, cell, rowLabel,
            expanded: {
              cell, colIndex: ci, columnKind: 'other-text', checkboxOptionIndex: null,
              h1Label: rowLabel, h2Label: '기타 입력',
              h3Label: `${cellCode}_etc`, cellId: cell.id, visible: false,
            },
          });
        }
      } else {
        wideCols.push({
          rowIdx: ri, colIdx: ci, cell, rowLabel,
          expanded: {
            cell, colIndex: ci, columnKind: 'value', checkboxOptionIndex: null,
            h1Label: rowLabel, h2Label: colLabel,
            h3Label: cellCode, cellId: cell.id, visible: true,
          },
        });
      }
    }
  }

  const expandedList = wideCols.map((wc) => wc.expanded);

  const ro = TITLE_ROW_OFFSET;

  const titleRow = ws.addRow([question.title]);
  titleRow.font = { bold: true, size: 11 };
  titleRow.height = 28;

  const h1 = ['response_id', ...expandedList.map((ec) => ec.h1Label)];
  const h2 = ['response_id', ...expandedList.map((ec) => ec.h2Label)];
  const h3 = ['response_id', ...expandedList.map((ec) => ec.h3Label)];
  addRow(ws, h1);
  addRow(ws, h2);
  addRow(ws, h3);
  applyHeaderStyle(ws, h1.length, ro);
  mergeHeaderCells(ws, 1, ro);

  ws.mergeCells(1, 1, 1, h1.length);

  const hiddenStartCol = h1.length + 1;
  setupHiddenColumns(ws, hiddenStartCol, 3, ro);

  const dataRowMetas: DataRowMeta[] = [];

  for (const resp of responses) {
    const allResponses = resp.questionResponses;
    const tableResponse = (allResponses[question.id] ?? {}) as Record<string, unknown>;
    const isExposed = shouldDisplayQuestion(question, allResponses, allQuestions, allGroups);

    const unexposedRowIndices = new Set<number>();
    const unexposedColIndices = new Set<number>();
    if (isExposed) {
      for (let ri = 0; ri < rows.length; ri++) {
        if (!shouldDisplayRow(rows[ri], allResponses, allQuestions)) unexposedRowIndices.add(ri);
      }
      for (let ci = 0; ci < columns.length; ci++) {
        if (!shouldDisplayColumn(columns[ci], allResponses, allQuestions)) unexposedColIndices.add(ci);
      }
    }

    const dataRow: (string | number | null)[] = [resp.id];
    const cellIdsRow: string[] = [];

    for (const wc of wideCols) {
      const ec = wc.expanded;
      const isUnexposed = !isExposed || unexposedRowIndices.has(wc.rowIdx) || unexposedColIndices.has(wc.colIdx);

      if (ec.columnKind === 'binary') {
        cellIdsRow.push(`${wc.cell.id}:${ec.optionValue}`);
      } else if (ec.columnKind === 'other-text') {
        cellIdsRow.push(`${wc.cell.id}:etc`);
      } else {
        cellIdsRow.push(wc.cell.id);
      }

      if (isUnexposed) {
        dataRow.push(UNEXPOSED_MARKER);
      } else {
        dataRow.push(formatExpandedCellValue(ec, tableResponse[wc.cell.id]));
      }
    }

    const excelRow = addRow(ws, dataRow);
    setCellValueChunked(excelRow, hiddenStartCol, cellIdsRow.join(','));
    setCellValue(excelRow.getCell(hiddenStartCol + 2), question.id);

    for (let c = 1; c < dataRow.length; c++) {
      if (dataRow[c] === UNEXPOSED_MARKER) excelRow.getCell(c + 1).font = UNEXPOSED_FONT;
    }

    dataRowMetas.push({ isUnexposed: false, depth1Value: '' });
  }

  const measureStartCol = 2;
  applyCheckboxFormulas(ws, expandedList, measureStartCol, dataRowMetas, ro);
  applyHiddenAndValidation(ws, expandedList, measureStartCol, responses.length, ro);
  mergeExpandedH1Headers(ws, expandedList, measureStartCol, ro);

  applyAutoFilterAndFreeze(ws, h1.length, 1, ro);
  autoFitColumnWidths(ws);
}

export function buildSemiLongSheet(
  workbook: ExcelJS.Workbook,
  question: Question,
  classified: ClassifiedCells,
  expandedColumns: ExpandedColumn[],
  dataRows: SemiLongRow[],
  sheetNames: Set<string>,
  sheetNameOverride?: string,
  options?: { tabColor?: { argb: string }; titleSuffix?: string },
) {
  const sheetLabel = sheetNameOverride
    ?? (question.questionCode ?? question.title.slice(0, 30));
  const name = sanitizeSheetName(sheetLabel, sheetNames);
  const tabColor = options?.tabColor ?? TAB_COLOR_SEMI_LONG;
  const ws = workbook.addWorksheet(name, { properties: { tabColor } });
  const ro = TITLE_ROW_OFFSET;

  const titleText = options?.titleSuffix
    ? `${question.title} — ${options.titleSuffix}`
    : question.title;
  const titleRow = ws.addRow([titleText]);
  titleRow.font = { bold: true, size: 11 };
  titleRow.height = 28;

  const { h1, h2, h3 } = buildSemiLongHeaders(classified, expandedColumns);
  addRow(ws, h1);
  addRow(ws, h2);
  addRow(ws, h3);
  applyHeaderStyle(ws, h1.length, ro);
  mergeHeaderCells(ws, 1, ro);
  mergeHeaderCells(ws, 2, ro);

  const idColCount = classified.identifiers.length;

  const hiddenStartCol = h1.length + 1;
  setupHiddenColumns(ws, hiddenStartCol, 4, ro);

  const metaColCount = 2;
  const measureStartCol = metaColCount + idColCount + 1;

  writeSemiLongDataRows(ws, dataRows, h1.length, metaColCount, idColCount, hiddenStartCol, ro);

  // Semi-Long용 DataRowMeta 변환
  const dataRowMetas: DataRowMeta[] = dataRows.map((r) => ({
    isUnexposed: r.isUnexposed,
    depth1Value: r.depth1Value,
  }));

  // varying label 열: computedLabels 값을 먼저 셀에 기록
  for (let ri = 0; ri < dataRows.length; ri++) {
    const semiRow = dataRows[ri];
    if (!semiRow.computedLabels) continue;
    const excelRowNum = HEADER_ROW_COUNT + ro + 1 + ri;
    for (const [ei, label] of semiRow.computedLabels) {
      setCellValue(ws.getRow(excelRowNum).getCell(measureStartCol + ei), label);
    }
  }

  applyCheckboxFormulas(ws, expandedColumns, measureStartCol, dataRowMetas, ro);
  applyHiddenAndValidation(ws, expandedColumns, measureStartCol, dataRows.length, ro);
  mergeExpandedH1Headers(ws, expandedColumns, measureStartCol, ro);

  ws.mergeCells(1, 1, 1, h1.length);

  applyAutoFilterAndFreeze(ws, h1.length, 2, ro);
  autoFitColumnWidths(ws);
  applyEmptyRowGrouping(ws, dataRows, ro);
}
