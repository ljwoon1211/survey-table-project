/**
 * Semi-Long Excel Export — 데이터 클리닝용 엑셀 내보내기
 *
 * 테이블 문항의 식별자 셀(text)은 행으로, 측정 셀(input 등)은 열로 유지하는
 * Semi-Long 형식으로 변환한다. 사람이 이상치 탐지 및 데이터 클리닝하기 위한 용도.
 *
 * - exceljs 사용 (셀 스타일, 조건부 서식, AutoFilter, Freeze Panes 지원)
 * - 미노출/미응답 구분 (3단계: 질문/행/열)
 * - 재업로드 매핑용 숨김 열 포함
 */
import ExcelJS from 'exceljs';

import type {
  CheckboxOption,
  Question,
  QuestionGroup,
  QuestionOption,
  RadioOption,
  Survey,
  TableCell,
  TableColumn,
  TableRow,
} from '@/types/survey';
import {
  shouldDisplayColumn,
  shouldDisplayQuestion,
  shouldDisplayRow,
} from '@/utils/branch-logic';

import type { ResponseData } from './flat-excel-export';

// ============================================================
// Types
// ============================================================

interface ClassifiedCells {
  identifiers: { colIndex: number; cell: TableCell; label: string }[];
  measurements: { colIndex: number; cell: TableCell; label: string }[];
}

interface SemiLongRow {
  responseId: string;
  seqNum: number;
  identifierValues: string[];
  measurementValues: (string | number | null)[];
  depth1Value: string;
  questionId: string;
  rowIndex: number;
  cellIds: string[];
  isUnexposed: 'question' | 'row' | false;
  unexposedColumns: Set<number>;
}

export type ProgressCallback = (current: number, total: number, sheetName: string) => void;

// ============================================================
// Constants
// ============================================================

const LIGHT_BLUE_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFDCE6F1' },
};

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF4472C4' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 10,
};

const UNEXPOSED_FONT: Partial<ExcelJS.Font> = {
  color: { argb: 'FF999999' },
  size: 10,
};

const THICK_BOTTOM_BORDER: Partial<ExcelJS.Borders> = {
  bottom: { style: 'thick', color: { argb: 'FF333333' } },
};

const SEMI_LONG_THRESHOLD_ROWS = 50;
const SEMI_LONG_THRESHOLD_MEASUREMENT_COLS = 20;
const LARGE_TABLE_ROW_THRESHOLD = 100;
const HEADER_ROW_COUNT = 3;
const UNEXPOSED_MARKER = '[미노출]';
const NO_ANSWER_MARKER = '[전체 미응답]';

const TAB_COLOR_WIDE = { argb: 'FF70AD47' };
const TAB_COLOR_SEMI_LONG = { argb: 'FF4472C4' };

// ============================================================
// Shared Value Parsing Helpers
// ============================================================

type OptionLike = { id: string; value: string; label: string };

/** id/value 기반 O(1) 옵션 검색용 Map 생성 */
function buildOptionMap(options: OptionLike[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const o of options) {
    map.set(o.id, o.label);
    map.set(o.value, o.label);
  }
  return map;
}

function resolveOptionLabel(optionMap: Map<string, string>, key: string): string {
  return optionMap.get(key) ?? key;
}

/** checkbox 응답 → { selectedIds, otherText } 파싱 */
function parseCheckboxRawValue(rawValue: unknown): { selectedIds: string[]; otherText?: string } {
  if (Array.isArray(rawValue)) {
    return { selectedIds: rawValue as string[] };
  }
  if (typeof rawValue === 'object' && rawValue !== null) {
    const obj = rawValue as Record<string, unknown>;
    return {
      selectedIds: Array.isArray(obj.selectedValues) ? (obj.selectedValues as string[]) : [],
      otherText: obj.otherValue ? String(obj.otherValue) : undefined,
    };
  }
  return { selectedIds: [] };
}

/** radio/select 단일선택 응답 → { optionId, otherText } 파싱 */
function parseSingleChoiceRawValue(rawValue: unknown): { optionId: string; otherText?: string } {
  if (typeof rawValue === 'string') {
    return { optionId: rawValue };
  }
  if (typeof rawValue === 'object' && rawValue !== null) {
    const obj = rawValue as Record<string, unknown>;
    return {
      optionId: String(obj.selectedValue ?? obj.optionId ?? ''),
      otherText: obj.otherValue ? String(obj.otherValue) : undefined,
    };
  }
  return { optionId: String(rawValue) };
}

function formatCheckboxLabels(
  optionMap: Map<string, string>,
  rawValue: unknown,
): string | null {
  const { selectedIds, otherText } = parseCheckboxRawValue(rawValue);
  const labels = selectedIds.map((id) => resolveOptionLabel(optionMap, id)).filter(Boolean);
  if (otherText) labels.push(`기타: ${otherText}`);
  return labels.length > 0 ? labels.join(', ') : null;
}

function formatSingleChoiceLabel(
  optionMap: Map<string, string>,
  rawValue: unknown,
): string {
  const { optionId, otherText } = parseSingleChoiceRawValue(rawValue);
  const label = resolveOptionLabel(optionMap, optionId);
  return otherText ? `${label} (기타: ${otherText})` : label;
}

// ============================================================
// Cell/Question Value Formatting
// ============================================================

function formatCellValueForCleaning(
  cell: TableCell,
  rawValue: unknown,
): string | number | null {
  if (rawValue === undefined || rawValue === null || rawValue === '') return null;

  switch (cell.type) {
    case 'checkbox':
      return formatCheckboxLabels(
        buildOptionMap((cell.checkboxOptions ?? []) as OptionLike[]),
        rawValue,
      );

    case 'radio':
      return formatSingleChoiceLabel(
        buildOptionMap((cell.radioOptions ?? []) as OptionLike[]),
        rawValue,
      );

    case 'select':
      return formatSingleChoiceLabel(
        buildOptionMap((cell.selectOptions ?? []) as OptionLike[]),
        rawValue,
      );

    case 'input': {
      const val = typeof rawValue === 'string' ? rawValue.trim() : String(rawValue);
      const num = Number(val);
      if (val !== '' && !isNaN(num)) return num;
      return val || null;
    }

    default:
      return String(rawValue);
  }
}

function formatGeneralQuestionValue(
  question: Question,
  rawValue: unknown,
): string | number | null {
  if (rawValue === undefined || rawValue === null || rawValue === '') return null;

  switch (question.type) {
    case 'radio':
    case 'select':
      return formatSingleChoiceLabel(
        buildOptionMap((question.options ?? []) as OptionLike[]),
        rawValue,
      );

    case 'checkbox':
      return formatCheckboxLabels(
        buildOptionMap((question.options ?? []) as OptionLike[]),
        rawValue,
      );

    case 'multiselect': {
      if (!question.selectLevels) return String(rawValue);
      if (typeof rawValue === 'object' && rawValue !== null && !Array.isArray(rawValue)) {
        const obj = rawValue as Record<string, string>;
        return question.selectLevels
          .map((level) => {
            const val = obj[level.id];
            if (!val) return '';
            const map = buildOptionMap(level.options as OptionLike[]);
            return resolveOptionLabel(map, val);
          })
          .filter(Boolean)
          .join(' > ');
      }
      return String(rawValue);
    }

    case 'text':
    case 'textarea': {
      const val = typeof rawValue === 'string' ? rawValue.trim() : String(rawValue);
      return val || null;
    }

    case 'notice': {
      if (typeof rawValue === 'object' && rawValue !== null) {
        return (rawValue as Record<string, unknown>).acknowledged ? '동의' : '미동의';
      }
      return String(rawValue);
    }

    default:
      return String(rawValue);
  }
}

// ============================================================
// Small Helpers
// ============================================================

function isCellInputable(cell: TableCell): boolean {
  return cell.type === 'checkbox' || cell.type === 'radio' || cell.type === 'select' || cell.type === 'input';
}

function isNonDataDepth1(value: string): boolean {
  return value === '-' || value === NO_ANSWER_MARKER;
}

/**
 * XML 1.0에서 허용하지 않는 제어 문자를 제거한다.
 * exceljs가 sharedStrings.xml에 쓸 때 이 문자들이 포함되면 Excel이 파일을 손상으로 판단한다.
 * 허용: \x09(탭), \x0A(LF), \x0D(CR), \x20 이상
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

function sanitizeSheetName(name: string, existingNames: Set<string>): string {
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

function extractQuestionNumber(title: string): string | null {
  const match = title.match(/^(Q[\d]+-[\d]+|Q[\d]+)/i);
  return match ? match[1].toUpperCase() : null;
}

/** 측정 셀의 h2 헤더 라벨 생성 (옵션 목록 표시) */
function getMeasurementH2Label(cell: TableCell, fallbackLabel: string): string {
  if (cell.type === 'checkbox' && cell.checkboxOptions?.length) {
    return cell.checkboxOptions.map((o: CheckboxOption) => o.label).join(' | ');
  }
  if (cell.type === 'radio' && cell.radioOptions?.length) {
    return cell.radioOptions.map((o: RadioOption) => o.label).join(' | ');
  }
  if (cell.type === 'select' && cell.selectOptions?.length) {
    return cell.selectOptions.map((o: QuestionOption) => o.label).join(' | ');
  }
  return fallbackLabel;
}

function hasNonMetaKeys(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).some((key) => !key.startsWith('__'));
}

// ============================================================
// Cell Classification
// ============================================================

function classifyTableCells(
  rows: TableRow[],
  columns: TableColumn[],
): ClassifiedCells {
  if (!rows.length || !rows[0].cells.length) {
    return { identifiers: [], measurements: [] };
  }

  const firstRow = rows[0];
  const identifiers: ClassifiedCells['identifiers'] = [];
  const measurements: ClassifiedCells['measurements'] = [];
  let passedIdentifiers = false;

  for (let i = 0; i < firstRow.cells.length; i++) {
    const cell = firstRow.cells[i];
    if (cell.isHidden || cell._isContinuation) continue;

    if (!passedIdentifiers && !isCellInputable(cell)) {
      identifiers.push({
        colIndex: i,
        cell,
        label: columns[i]?.label || `식별자${identifiers.length + 1}`,
      });
    } else {
      passedIdentifiers = true;
      if (isCellInputable(cell)) {
        measurements.push({
          colIndex: i,
          cell,
          label: columns[i]?.label || `측정${measurements.length + 1}`,
        });
      }
    }
  }

  return { identifiers, measurements };
}

function shouldUseSemiLong(
  rows: TableRow[],
  measurements: ClassifiedCells['measurements'],
  identifiers: ClassifiedCells['identifiers'],
): boolean {
  if (identifiers.length === 0) return false;
  return measurements.length > SEMI_LONG_THRESHOLD_MEASUREMENT_COLS || rows.length > SEMI_LONG_THRESHOLD_ROWS;
}

// ============================================================
// Semi-Long Data Building
// ============================================================

function extractIdentifierValues(
  rows: TableRow[],
  rowIndex: number,
  identifierColIndices: number[],
  rowspanTracker: Map<number, { value: string; remaining: number }>,
): string[] {
  const row = rows[rowIndex];
  const values: string[] = [];

  for (const colIdx of identifierColIndices) {
    const tracker = rowspanTracker.get(colIdx);
    if (tracker && tracker.remaining > 0) {
      values.push(tracker.value);
      tracker.remaining--;
      continue;
    }

    const cell = row.cells[colIdx];
    if (!cell || cell.isHidden || cell._isContinuation) {
      values.push('');
      continue;
    }

    const value = cell.content || '';
    values.push(value);

    if (cell.rowspan && cell.rowspan > 1) {
      rowspanTracker.set(colIdx, { value, remaining: cell.rowspan - 1 });
    }
  }

  return values;
}

function getVisibleRows(
  rows: TableRow[],
  tableResponse: Record<string, unknown>,
  dynamicRowConfigs?: { groupId: string; enabled: boolean }[],
): TableRow[] {
  if (!dynamicRowConfigs?.length) return rows;

  const enabledGroupIds = new Set(
    dynamicRowConfigs.filter((g) => g.enabled).map((g) => g.groupId),
  );
  const selectedRowIds = new Set(
    (tableResponse.__selectedRowIds as string[] | undefined) ?? [],
  );

  return rows.filter((row) => {
    if (!row.dynamicGroupId) return true;
    if (!enabledGroupIds.has(row.dynamicGroupId)) return false;
    return selectedRowIds.has(row.id);
  });
}

function buildSemiLongRows(
  question: Question,
  responses: ResponseData[],
  classified: ClassifiedCells,
  allQuestions: Question[],
  allGroups?: QuestionGroup[],
): SemiLongRow[] {
  const allRows = question.tableRowsData ?? [];
  const columns = question.tableColumns ?? [];
  const result: SemiLongRow[] = [];

  const identifierColIndices = classified.identifiers.map((id) => id.colIndex);
  const measurementColIndices = classified.measurements.map((m) => m.colIndex);

  // 원본 행 인덱스 O(1) 조회용 Map
  const rowIndexMap = new Map<TableRow, number>();
  for (let i = 0; i < allRows.length; i++) rowIndexMap.set(allRows[i], i);

  for (const resp of responses) {
    const allResponses = resp.questionResponses;
    const tableResponse = (allResponses[question.id] ?? {}) as Record<string, unknown>;

    // 질문 수준 미노출 체크
    if (!shouldDisplayQuestion(question, allResponses, allQuestions, allGroups)) {
      result.push({
        responseId: resp.id,
        seqNum: 0,
        identifierValues: classified.identifiers.map(() => ''),
        measurementValues: classified.measurements.map(() => UNEXPOSED_MARKER),
        depth1Value: '',
        questionId: question.id,
        rowIndex: -1,
        cellIds: measurementColIndices.map((ci) => allRows[0]?.cells[ci]?.id ?? ''),
        isUnexposed: 'question',
        unexposedColumns: new Set(),
      });
      continue;
    }

    const rows = getVisibleRows(allRows, tableResponse, question.dynamicRowConfigs);

    // 열 수준 미노출 (응답자별 1회)
    const unexposedColumnIndices = new Set<number>();
    for (let mi = 0; mi < measurementColIndices.length; mi++) {
      const column = columns[measurementColIndices[mi]];
      if (column && !shouldDisplayColumn(column, allResponses, allQuestions)) {
        unexposedColumnIndices.add(mi);
      }
    }

    // 미응답 + 대형 테이블 → 요약 행
    if (!hasNonMetaKeys(tableResponse) && allRows.length > LARGE_TABLE_ROW_THRESHOLD) {
      result.push({
        responseId: resp.id,
        seqNum: 0,
        identifierValues: [NO_ANSWER_MARKER, ...classified.identifiers.slice(1).map(() => '')],
        measurementValues: classified.measurements.map(() => null),
        depth1Value: NO_ANSWER_MARKER,
        questionId: question.id,
        rowIndex: -1,
        cellIds: measurementColIndices.map((ci) => allRows[0]?.cells[ci]?.id ?? ''),
        isUnexposed: false,
        unexposedColumns: new Set(),
      });
      continue;
    }

    // rowspan tracker는 원본 allRows 기준으로 추적해야 정확함.
    // 필터된 rows에서 추적하면 동적 행 제거 시 remaining 카운트가 어긋남.
    const rowspanTracker = new Map<number, { value: string; remaining: number }>();
    const visibleRowSet = new Set(rows);
    let seqNum = 0;
    let prevDepth1 = '';

    for (let origRi = 0; origRi < allRows.length; origRi++) {
      const row = allRows[origRi];
      // 원본 순서대로 rowspan을 추적하되, 비가시 행은 식별자만 소비하고 출력 건너뜀
      const identifierValues = extractIdentifierValues(allRows, origRi, identifierColIndices, rowspanTracker);
      if (!visibleRowSet.has(row)) continue;

      const originalRowIndex = origRi;
      const isRowExposed = shouldDisplayRow(row, allResponses, allQuestions);
      const depth1Value = identifierValues[0] || '';

      if (depth1Value !== prevDepth1) {
        seqNum = 0;
        prevDepth1 = depth1Value;
      }
      seqNum++;

      if (!isRowExposed) {
        result.push({
          responseId: resp.id,
          seqNum,
          identifierValues,
          measurementValues: classified.measurements.map(() => UNEXPOSED_MARKER),
          depth1Value,
          questionId: question.id,
          rowIndex: originalRowIndex,
          cellIds: measurementColIndices.map((ci) => row.cells[ci]?.id ?? ''),
          isUnexposed: 'row',
          unexposedColumns: new Set(),
        });
        continue;
      }

      const measurementValues: (string | number | null)[] = [];
      const cellIds: string[] = [];

      for (let mi = 0; mi < measurementColIndices.length; mi++) {
        const cell = row.cells[measurementColIndices[mi]];
        cellIds.push(cell?.id ?? '');

        if (unexposedColumnIndices.has(mi)) {
          measurementValues.push(UNEXPOSED_MARKER);
        } else if (!cell) {
          measurementValues.push(null);
        } else {
          measurementValues.push(formatCellValueForCleaning(cell, tableResponse[cell.id]));
        }
      }

      result.push({
        responseId: resp.id,
        seqNum,
        identifierValues,
        measurementValues,
        depth1Value,
        questionId: question.id,
        rowIndex: originalRowIndex,
        cellIds,
        isUnexposed: false,
        unexposedColumns: unexposedColumnIndices,
      });
    }
  }

  return result;
}

// ============================================================
// Shared Sheet Rendering
// ============================================================

function applyHeaderStyle(ws: ExcelJS.Worksheet, colCount: number) {
  for (let r = 1; r <= HEADER_ROW_COUNT; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    }
    row.height = 24;
  }
}

function setupHiddenColumns(ws: ExcelJS.Worksheet, hiddenStartCol: number, count: number) {
  const labels = ['__cell_ids__', '__question_id__', '__row_index__'];
  for (let i = 0; i < count; i++) {
    setCellValue(ws.getRow(1).getCell(hiddenStartCol + i), labels[i]);
    setCellValue(ws.getRow(2).getCell(hiddenStartCol + i), labels[i]);
    setCellValue(ws.getRow(3).getCell(hiddenStartCol + i), labels[i]);
    ws.getColumn(hiddenStartCol + i).hidden = true;
  }
}

function applyAutoFilterAndFreeze(ws: ExcelJS.Worksheet, colCount: number, freezeXSplit: number) {
  const lastRow = ws.rowCount;
  if (lastRow > HEADER_ROW_COUNT) {
    ws.autoFilter = { from: { row: HEADER_ROW_COUNT, column: 1 }, to: { row: lastRow, column: colCount } };
  }
  ws.views = [{ state: 'frozen', xSplit: freezeXSplit, ySplit: HEADER_ROW_COUNT }];
}

/**
 * Semi-Long 데이터 행을 워크시트에 렌더링한다.
 * buildSemiLongTableSheet과 buildMergedSemiLongSheet 공통 로직.
 */
function writeSemiLongDataRows(
  ws: ExcelJS.Worksheet,
  dataRows: SemiLongRow[],
  colCount: number,
  metaColCount: number,
  idColCount: number,
  hiddenStartCol: number,
) {
  let prevResponseId = '';
  let depth1Counter = 0;
  let prevDepth1 = '';
  const measureStartCol = metaColCount + idColCount + 1;

  for (const semiRow of dataRows) {
    // 1) 응답자 경계 체크를 먼저 수행 → depth1Counter 리셋
    if (prevResponseId && semiRow.responseId !== prevResponseId) {
      // 이전 행에 굵은 하단 테두리
      const prevExcelRow = ws.getRow(ws.rowCount);
      for (let c = 1; c <= colCount; c++) {
        prevExcelRow.getCell(c).border = THICK_BOTTOM_BORDER;
      }
      depth1Counter = 0;
      prevDepth1 = '';
    }

    // 2) depth1 변경 감지 (리셋된 카운터 기준)
    if (semiRow.depth1Value !== prevDepth1 && semiRow.depth1Value !== '' && !isNonDataDepth1(semiRow.depth1Value)) {
      depth1Counter++;
      prevDepth1 = semiRow.depth1Value;
    }

    // 3) 데이터 행 삽입
    const excelRow = addRow(ws, [
      semiRow.responseId,
      semiRow.seqNum,
      ...semiRow.identifierValues,
      ...semiRow.measurementValues,
    ]);

    // 숨김 열
    setCellValue(excelRow.getCell(hiddenStartCol), semiRow.cellIds.join(','));
    setCellValue(excelRow.getCell(hiddenStartCol + 1), semiRow.questionId);
    setCellValue(excelRow.getCell(hiddenStartCol + 2), semiRow.rowIndex);

    // 4) 색상밴드 (짝수 그룹만 파란 배경, 홀수는 기본 흰색 → fill 미설정)
    if (depth1Counter % 2 === 0) {
      for (let c = 1; c <= colCount; c++) {
        excelRow.getCell(c).fill = LIGHT_BLUE_FILL;
      }
    }

    prevResponseId = semiRow.responseId;

    // 5) 미노출 셀 서식
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

  // 마지막 행 하단 테두리
  if (dataRows.length > 0) {
    const lastExcelRow = ws.getRow(HEADER_ROW_COUNT + dataRows.length);
    for (let c = 1; c <= colCount; c++) {
      lastExcelRow.getCell(c).border = THICK_BOTTOM_BORDER;
    }
  }
}

/** Semi-Long 시트의 3행 헤더를 생성한다. */
function buildSemiLongHeaders(
  classified: ClassifiedCells,
  columns: TableColumn[],
): { h1: string[]; h2: string[]; h3: string[] } {
  const metaCols = ['response_id', '#'];
  const idLabels = classified.identifiers.map((id) => id.label);
  const measureLabels = classified.measurements.map((m) => m.label);

  const h1 = [...metaCols, ...idLabels, ...measureLabels];

  const h2 = [
    ...metaCols,
    ...idLabels,
    ...classified.measurements.map((m) =>
      getMeasurementH2Label(m.cell, columns[m.colIndex]?.label ?? ''),
    ),
  ];

  const h3 = [
    ...metaCols,
    ...classified.identifiers.map((_, i) => `id_${i + 1}`),
    ...classified.measurements.map((m) => m.cell.cellCode ?? `c${m.colIndex}`),
  ];

  return { h1, h2, h3 };
}

function setSemiLongColumnWidths(
  ws: ExcelJS.Worksheet,
  metaColCount: number,
  idColCount: number,
  measureColCount: number,
) {
  ws.getColumn(1).width = 24; // response_id
  ws.getColumn(2).width = 6;  // #
  for (let i = 0; i < idColCount; i++) {
    ws.getColumn(metaColCount + 1 + i).width = 14;
  }
  for (let i = 0; i < measureColCount; i++) {
    ws.getColumn(metaColCount + idColCount + 1 + i).width = 12;
  }
}

// ============================================================
// Sheet Generators
// ============================================================

function buildIndexSheet(
  workbook: ExcelJS.Workbook,
  responses: ResponseData[],
  sheetNames: Set<string>,
) {
  const name = sanitizeSheetName('응답자목록', sheetNames);
  const ws = workbook.addWorksheet(name, { properties: { tabColor: TAB_COLOR_WIDE } });

  const headers = ['response_id', '시작 시간', '완료 시간', '소요 시간(초)', '상태', 'User Agent'];
  addRow(ws, headers);
  addRow(ws, headers);
  addRow(ws, headers.map((_, i) => `V${i + 1}`));
  applyHeaderStyle(ws, headers.length);

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

  applyAutoFilterAndFreeze(ws, headers.length, 1);
  ws.getColumn(1).width = 24;
  ws.getColumn(2).width = 20;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 10;
  ws.getColumn(6).width = 40;
}

function buildGeneralQuestionsSheet(
  workbook: ExcelJS.Workbook,
  survey: Survey,
  responses: ResponseData[],
  sheetNames: Set<string>,
) {
  const generalQuestions = survey.questions
    .filter((q) => q.type !== 'table' && !(q.type === 'notice' && !q.requiresAcknowledgment))
    .sort((a, b) => a.order - b.order);

  if (generalQuestions.length === 0) return;

  const name = sanitizeSheetName('일반문항', sheetNames);
  const ws = workbook.addWorksheet(name, { properties: { tabColor: TAB_COLOR_WIDE } });

  const h1 = ['response_id', ...generalQuestions.map((q) => q.title)];
  const h2 = ['response_id', ...generalQuestions.map((q) => q.type)];
  const h3 = ['response_id', ...generalQuestions.map((q) => q.questionCode ?? q.id)];
  addRow(ws, h1);
  addRow(ws, h2);
  addRow(ws, h3);
  applyHeaderStyle(ws, h1.length);

  const allQuestions = survey.questions;
  const allGroups = survey.groups;

  for (const resp of responses) {
    const allResponses = resp.questionResponses;
    const row: (string | number | null)[] = [resp.id];

    for (const q of generalQuestions) {
      if (!shouldDisplayQuestion(q, allResponses, allQuestions, allGroups)) {
        row.push(UNEXPOSED_MARKER);
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
  }

  applyAutoFilterAndFreeze(ws, h1.length, 1);
  ws.getColumn(1).width = 24;
  for (let i = 2; i <= h1.length; i++) ws.getColumn(i).width = 16;
}

function buildWideTableSheet(
  workbook: ExcelJS.Workbook,
  question: Question,
  responses: ResponseData[],
  allQuestions: Question[],
  sheetNames: Set<string>,
  allGroups?: QuestionGroup[],
) {
  const rows = question.tableRowsData ?? [];
  const columns = question.tableColumns ?? [];

  const sheetLabel = question.questionCode
    ? `${question.questionCode}_${question.title}`.slice(0, 50)
    : question.title.slice(0, 50);
  const name = sanitizeSheetName(sheetLabel, sheetNames);
  const ws = workbook.addWorksheet(name, { properties: { tabColor: TAB_COLOR_WIDE } });

  const inputCells: { rowIdx: number; colIdx: number; cell: TableCell; rowLabel: string }[] = [];
  for (let ri = 0; ri < rows.length; ri++) {
    for (let ci = 0; ci < rows[ri].cells.length; ci++) {
      const cell = rows[ri].cells[ci];
      if (cell.isHidden || cell._isContinuation) continue;
      if (isCellInputable(cell)) {
        inputCells.push({ rowIdx: ri, colIdx: ci, cell, rowLabel: rows[ri].label || `행${ri + 1}` });
      }
    }
  }

  const h1 = ['response_id', ...inputCells.map((ic) => ic.rowLabel)];
  const h2 = ['response_id', ...inputCells.map((ic) => columns[ic.colIdx]?.label ?? '')];
  const h3 = ['response_id', ...inputCells.map((ic) => ic.cell.cellCode ?? `r${ic.rowIdx}_c${ic.colIdx}`)];
  addRow(ws, h1);
  addRow(ws, h2);
  addRow(ws, h3);
  applyHeaderStyle(ws, h1.length);

  const hiddenStartCol = h1.length + 1;
  setupHiddenColumns(ws, hiddenStartCol, 2);

  for (const resp of responses) {
    const allResponses = resp.questionResponses;
    const tableResponse = (allResponses[question.id] ?? {}) as Record<string, unknown>;
    const isExposed = shouldDisplayQuestion(question, allResponses, allQuestions, allGroups);

    // 행/열 수준 미노출
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

    for (const ic of inputCells) {
      cellIdsRow.push(ic.cell.id);
      if (!isExposed || unexposedRowIndices.has(ic.rowIdx) || unexposedColIndices.has(ic.colIdx)) {
        dataRow.push(UNEXPOSED_MARKER);
      } else {
        dataRow.push(formatCellValueForCleaning(ic.cell, tableResponse[ic.cell.id]));
      }
    }

    const excelRow = addRow(ws, dataRow);
    setCellValue(excelRow.getCell(hiddenStartCol), cellIdsRow.join(','));
    setCellValue(excelRow.getCell(hiddenStartCol + 1), question.id);

    for (let c = 1; c < dataRow.length; c++) {
      if (dataRow[c] === UNEXPOSED_MARKER) excelRow.getCell(c + 1).font = UNEXPOSED_FONT;
    }
  }

  applyAutoFilterAndFreeze(ws, h1.length, 1);
  ws.getColumn(1).width = 24;
  for (let i = 2; i <= h1.length; i++) ws.getColumn(i).width = 12;
}

/**
 * Semi-Long 시트 생성 (단일 또는 통합).
 * sheetNameOverride가 있으면 해당 이름 사용, 없으면 question에서 추출.
 */
function buildSemiLongSheet(
  workbook: ExcelJS.Workbook,
  question: Question,
  classified: ClassifiedCells,
  dataRows: SemiLongRow[],
  sheetNames: Set<string>,
  sheetNameOverride?: string,
) {
  const sheetLabel = sheetNameOverride
    ?? (question.questionCode
      ? `${question.questionCode}_${question.title}`.slice(0, 50)
      : question.title.slice(0, 50));
  const name = sanitizeSheetName(sheetLabel, sheetNames);
  const ws = workbook.addWorksheet(name, { properties: { tabColor: TAB_COLOR_SEMI_LONG } });

  const columns = question.tableColumns ?? [];
  const { h1, h2, h3 } = buildSemiLongHeaders(classified, columns);
  addRow(ws, h1);
  addRow(ws, h2);
  addRow(ws, h3);
  applyHeaderStyle(ws, h1.length);

  const hiddenStartCol = h1.length + 1;
  setupHiddenColumns(ws, hiddenStartCol, 3);

  const metaColCount = 2; // response_id, #
  const idColCount = classified.identifiers.length;
  const measureColCount = classified.measurements.length;

  writeSemiLongDataRows(ws, dataRows, h1.length, metaColCount, idColCount, hiddenStartCol);

  applyAutoFilterAndFreeze(ws, h1.length, metaColCount + idColCount);
  setSemiLongColumnWidths(ws, metaColCount, idColCount, measureColCount);
}

// ============================================================
// Workbook Generation
// ============================================================

/**
 * 같은 번호의 테이블 질문들을 그룹핑한다.
 */
function groupTableQuestions(questions: Question[]): { label: string; questions: Question[] }[] {
  const groups = new Map<string, Question[]>();
  const groupOrder: string[] = [];

  for (const q of questions) {
    const key = extractQuestionNumber(q.title) ?? q.id;
    if (!groups.has(key)) {
      groups.set(key, []);
      groupOrder.push(key);
    }
    groups.get(key)!.push(q);
  }

  return groupOrder.map((key) => {
    const qs = groups.get(key)!;
    const label = qs.length > 1
      ? `${key}_통합`
      : (qs[0].questionCode ?? key) + '_' + qs[0].title.replace(/^Q[\d]+-?[\d]*\.?\s*/, '').slice(0, 30);
    return { label, questions: qs };
  });
}

/**
 * 여러 question의 semi-long 데이터를 응답자 순서로 인터리브한다.
 */
function interleaveByResponse(
  perQuestionRows: SemiLongRow[][],
  responses: ResponseData[],
): SemiLongRow[] {
  // 응답자별 인덱스 맵으로 O(responses * avg_rows) 달성
  const byResponse = new Map<string, SemiLongRow[]>();
  for (const resp of responses) byResponse.set(resp.id, []);

  for (const qRows of perQuestionRows) {
    for (const row of qRows) {
      byResponse.get(row.responseId)?.push(row);
    }
  }

  const result: SemiLongRow[] = [];
  for (const resp of responses) {
    const rows = byResponse.get(resp.id);
    if (rows) result.push(...rows);
  }
  return result;
}

export async function generateCleaningWorkbook(
  survey: Survey,
  responses: ResponseData[],
  onProgress?: ProgressCallback,
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheetNames = new Set<string>();
  const allGroups = survey.groups;

  const tableQuestions = survey.questions
    .filter((q) => q.type === 'table' && q.tableRowsData && q.tableRowsData.length > 0)
    .sort((a, b) => a.order - b.order);

  const tableGroups = groupTableQuestions(tableQuestions);
  const totalSheets = 2 + tableGroups.length;
  let currentSheet = 0;

  // 1. 응답자목록
  onProgress?.(++currentSheet, totalSheets, '응답자목록');
  buildIndexSheet(workbook, responses, sheetNames);

  // 2. 일반문항
  onProgress?.(++currentSheet, totalSheets, '일반문항');
  buildGeneralQuestionsSheet(workbook, survey, responses, sheetNames);

  // 3. 테이블 문항
  for (const group of tableGroups) {
    onProgress?.(++currentSheet, totalSheets, group.label);

    if (group.questions.length > 1) {
      // 통합 시트 (문8-2 패턴)
      const firstQ = group.questions[0];
      const classified = classifyTableCells(firstQ.tableRowsData ?? [], firstQ.tableColumns ?? []);

      if (classified.identifiers.length === 0) {
        for (const q of group.questions) {
          buildWideTableSheet(workbook, q, responses, survey.questions, sheetNames, allGroups);
        }
      } else {
        const perQuestionRows = group.questions.map((q) => {
          const qClassified = classifyTableCells(q.tableRowsData ?? [], q.tableColumns ?? []);
          return buildSemiLongRows(q, responses, qClassified, survey.questions, allGroups);
        });
        const mergedRows = interleaveByResponse(perQuestionRows, responses);
        buildSemiLongSheet(workbook, firstQ, classified, mergedRows, sheetNames, group.label);
      }
    } else {
      const q = group.questions[0];
      const classified = classifyTableCells(q.tableRowsData ?? [], q.tableColumns ?? []);

      if (shouldUseSemiLong(q.tableRowsData ?? [], classified.measurements, classified.identifiers)) {
        const dataRows = buildSemiLongRows(q, responses, classified, survey.questions, allGroups);
        buildSemiLongSheet(workbook, q, classified, dataRows, sheetNames);
      } else {
        buildWideTableSheet(workbook, q, responses, survey.questions, sheetNames, allGroups);
      }
    }
  }

  return workbook;
}

export async function generateCleaningExcelBlob(
  survey: Survey,
  responses: ResponseData[],
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const workbook = await generateCleaningWorkbook(survey, responses, onProgress);
  // exceljs의 sharedStrings.xml 직렬화 버그 우회: inline string 사용
  const buffer = await workbook.xlsx.writeBuffer({ useSharedStrings: false });
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
