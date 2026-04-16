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

interface ExpandedColumn {
  cell: TableCell;
  colIndex: number;
  columnKind: 'label' | 'binary' | 'other-text' | 'value';
  checkboxOptionIndex: number | null;
  optionValue?: string;
  spssNumericCode?: number;
  optionLabel?: string;
  h1Label: string;
  h2Label: string;
  h3Label: string;
  cellId: string;
  visible: boolean;
}

interface SemiLongRow {
  responseId: string;
  seqNum: number;
  rowLabel: string;
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
// Expanded Cell Value Formatting (checkbox split)
// ============================================================

/**
 * ExpandedColumn 기반으로 체크박스 셀의 개별 옵션 값을 생성한다.
 * - binary: spssNumericCode(선택) / 0(미선택) / null(무응답)
 * - other-text: 기타 텍스트 / null
 * - label: null (수식으로 대체)
 * - value: 기존 formatCellValueForCleaning() 위임
 */
function formatExpandedCellValue(
  expandedCol: ExpandedColumn,
  rawValue: unknown,
): string | number | null {
  switch (expandedCol.columnKind) {
    case 'label':
      return null; // 수식 셀 — writeSemiLongDataRows/applyCheckboxFormulas에서 처리

    case 'binary': {
      // 무응답
      if (rawValue === undefined || rawValue === null || rawValue === '') return null;
      const { selectedIds } = parseCheckboxRawValue(rawValue);
      const isSelected = selectedIds.some((id) => id === expandedCol.optionValue);
      return isSelected ? (expandedCol.spssNumericCode ?? (expandedCol.checkboxOptionIndex! + 1)) : 0;
    }

    case 'other-text': {
      if (rawValue === undefined || rawValue === null || rawValue === '') return null;
      const { otherText } = parseCheckboxRawValue(rawValue);
      return otherText ?? null;
    }

    case 'value':
      return formatCellValueForCleaning(expandedCol.cell, rawValue);
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

/**
 * Excel 셀 문자열 제한(32,767자) 초과 시 여러 셀에 분할 기록.
 * startCol부터 오른쪽으로 필요한 만큼 셀을 사용한다.
 */
const EXCEL_MAX_CELL_CHARS = 32767;
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
  const match = title.match(/^(Q[\d]+[-_ ][\d]+(?:[-_ ][\d]+)*|Q[\d]+)/i);
  return match ? match[1].toUpperCase().replace(/[-\s]/g, '_') : null;
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

// ============================================================
// Checkbox Column Expansion
// ============================================================

function expandMeasurements(
  measurements: ClassifiedCells['measurements'],
  columns: TableColumn[],
): ExpandedColumn[] {
  const result: ExpandedColumn[] = [];

  for (const m of measurements) {
    const { cell, colIndex, label } = m;
    const colLabel = columns[colIndex]?.label ?? label;

    if (cell.type === 'checkbox' && cell.checkboxOptions && cell.checkboxOptions.length > 0) {
      const opts = cell.checkboxOptions;
      const cellCode = cell.cellCode ?? `c${colIndex}`;

      // 1) 보이는 라벨 합산 열
      result.push({
        cell,
        colIndex,
        columnKind: 'label',
        checkboxOptionIndex: null,
        h1Label: colLabel,
        h2Label: opts.map((o: CheckboxOption) => o.label).join(' | '),
        h3Label: cellCode,
        cellId: cell.id,
        visible: true,
      });

      // 2) 숨김 binary 열 (옵션별)
      for (let i = 0; i < opts.length; i++) {
        const opt = opts[i];
        const code = opt.spssNumericCode ?? (i + 1);
        result.push({
          cell,
          colIndex,
          columnKind: 'binary',
          checkboxOptionIndex: i,
          optionValue: opt.value,
          spssNumericCode: code,
          optionLabel: opt.label,
          h1Label: colLabel,
          h2Label: opt.label,
          h3Label: `${cellCode}_${opt.optionCode ?? String(i + 1)}`,
          cellId: cell.id,
          visible: false,
        });
      }

      // 3) 숨김 기타 텍스트 열 (hasOther 옵션이 있으면)
      if (opts.some((o: CheckboxOption) => o.hasOther)) {
        result.push({
          cell,
          colIndex,
          columnKind: 'other-text',
          checkboxOptionIndex: null,
          h1Label: colLabel,
          h2Label: '기타 입력',
          h3Label: `${cellCode}_etc`,
          cellId: cell.id,
          visible: false,
        });
      }
    } else {
      // 비체크박스 셀: 기존과 동일
      result.push({
        cell,
        colIndex,
        columnKind: 'value',
        checkboxOptionIndex: null,
        h1Label: colLabel,
        h2Label: getMeasurementH2Label(cell, colLabel),
        h3Label: cell.cellCode ?? `c${colIndex}`,
        cellId: cell.id,
        visible: true,
      });
    }
  }

  return result;
}

/** 일반문항 checkbox 질문을 ExpandedColumn 유사 구조로 확장 */
function expandGeneralCheckboxQuestion(
  question: Question,
): { label: ExpandedColumn; binaries: ExpandedColumn[]; otherText?: ExpandedColumn } | null {
  if (question.type !== 'checkbox' || !question.options || question.options.length === 0) {
    return null;
  }

  const opts = question.options;
  const qCode = question.questionCode ?? question.id;
  const dummyCell = { id: question.id, type: 'checkbox' as const, content: '' };

  const label: ExpandedColumn = {
    cell: dummyCell as TableCell,
    colIndex: -1,
    columnKind: 'label',
    checkboxOptionIndex: null,
    h1Label: question.title,
    h2Label: opts.map((o) => o.label).join(' | '),
    h3Label: qCode,
    cellId: question.id,
    visible: true,
  };

  const binaries: ExpandedColumn[] = opts.map((opt, i) => ({
    cell: dummyCell as TableCell,
    colIndex: -1,
    columnKind: 'binary' as const,
    checkboxOptionIndex: i,
    optionValue: opt.value,
    spssNumericCode: Number(opt.spssNumericCode) || (i + 1),
    optionLabel: opt.label,
    h1Label: question.title,
    h2Label: opt.label,
    h3Label: `${qCode}_${opt.optionCode ?? String(i + 1)}`,
    cellId: question.id,
    visible: false,
  }));

  const hasOther = question.allowOtherOption || opts.some((o) => o.hasOther);
  const otherText: ExpandedColumn | undefined = hasOther
    ? {
        cell: dummyCell as TableCell,
        colIndex: -1,
        columnKind: 'other-text',
        checkboxOptionIndex: null,
        h1Label: question.title,
        h2Label: '기타 입력',
        h3Label: `${qCode}_etc`,
        cellId: question.id,
        visible: false,
      }
    : undefined;

  return { label, binaries, otherText };
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
  expandedColumns: ExpandedColumn[],
  allQuestions: Question[],
  allGroups?: QuestionGroup[],
): SemiLongRow[] {
  const allRows = question.tableRowsData ?? [];
  const columns = question.tableColumns ?? [];
  const result: SemiLongRow[] = [];

  const identifierColIndices = classified.identifiers.map((id) => id.colIndex);

  // 원본 측정 셀 colIndex → 열 미노출 판단용 (확장 전 기준)
  const uniqueMeasurementColIndices = [...new Set(expandedColumns.map((ec) => ec.colIndex))];

  /** ExpandedColumn 기반 cellId 키 생성 */
  function buildCellIdKey(ec: ExpandedColumn, cellId: string): string {
    if (ec.columnKind === 'binary') return `${cellId}:${ec.optionValue}`;
    if (ec.columnKind === 'other-text') return `${cellId}:etc`;
    return cellId;
  }

  for (const resp of responses) {
    const allResponses = resp.questionResponses;
    const tableResponse = (allResponses[question.id] ?? {}) as Record<string, unknown>;

    // 질문 수준 미노출 체크
    if (!shouldDisplayQuestion(question, allResponses, allQuestions, allGroups)) {
      result.push({
        responseId: resp.id,
        seqNum: 0,
        rowLabel: '',
        identifierValues: classified.identifiers.map(() => ''),
        measurementValues: expandedColumns.map(() => UNEXPOSED_MARKER),
        depth1Value: '',
        questionId: question.id,
        rowIndex: -1,
        cellIds: expandedColumns.map((ec) => buildCellIdKey(ec, allRows[0]?.cells[ec.colIndex]?.id ?? '')),
        isUnexposed: 'question',
        unexposedColumns: new Set(),
      });
      continue;
    }

    const rows = getVisibleRows(allRows, tableResponse, question.dynamicRowConfigs);

    // 열 수준 미노출 (원본 colIndex 기준)
    const unexposedOrigColIndices = new Set<number>();
    for (const ci of uniqueMeasurementColIndices) {
      const column = columns[ci];
      if (column && !shouldDisplayColumn(column, allResponses, allQuestions)) {
        unexposedOrigColIndices.add(ci);
      }
    }
    // expandedColumns 인덱스 기준으로 변환
    const unexposedExpandedIndices = new Set<number>();
    for (let ei = 0; ei < expandedColumns.length; ei++) {
      if (unexposedOrigColIndices.has(expandedColumns[ei].colIndex)) {
        unexposedExpandedIndices.add(ei);
      }
    }

    // 미응답 + 대형 테이블 → 요약 행
    if (!hasNonMetaKeys(tableResponse) && allRows.length > LARGE_TABLE_ROW_THRESHOLD) {
      result.push({
        responseId: resp.id,
        seqNum: 0,
        rowLabel: NO_ANSWER_MARKER,
        identifierValues: [NO_ANSWER_MARKER, ...classified.identifiers.slice(1).map(() => '')],
        measurementValues: expandedColumns.map(() => null),
        depth1Value: NO_ANSWER_MARKER,
        questionId: question.id,
        rowIndex: -1,
        cellIds: expandedColumns.map((ec) => buildCellIdKey(ec, allRows[0]?.cells[ec.colIndex]?.id ?? '')),
        isUnexposed: false,
        unexposedColumns: new Set(),
      });
      continue;
    }

    // rowspan tracker는 원본 allRows 기준으로 추적해야 정확함.
    const rowspanTracker = new Map<number, { value: string; remaining: number }>();
    const visibleRowSet = new Set(rows);
    let seqNum = 0;
    let prevDepth1 = '';

    for (let origRi = 0; origRi < allRows.length; origRi++) {
      const row = allRows[origRi];
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

      const currentRowLabel = row.label || `행${originalRowIndex + 1}`;

      if (!isRowExposed) {
        result.push({
          responseId: resp.id,
          seqNum,
          rowLabel: currentRowLabel,
          identifierValues,
          measurementValues: expandedColumns.map(() => UNEXPOSED_MARKER),
          depth1Value,
          questionId: question.id,
          rowIndex: originalRowIndex,
          cellIds: expandedColumns.map((ec) => buildCellIdKey(ec, row.cells[ec.colIndex]?.id ?? '')),
          isUnexposed: 'row',
          unexposedColumns: new Set(),
        });
        continue;
      }

      const measurementValues: (string | number | null)[] = [];
      const cellIds: string[] = [];

      for (let ei = 0; ei < expandedColumns.length; ei++) {
        const ec = expandedColumns[ei];
        const cell = row.cells[ec.colIndex];
        cellIds.push(buildCellIdKey(ec, cell?.id ?? ''));

        if (unexposedExpandedIndices.has(ei)) {
          measurementValues.push(UNEXPOSED_MARKER);
        } else if (!cell) {
          measurementValues.push(null);
        } else {
          measurementValues.push(formatExpandedCellValue(ec, tableResponse[cell.id]));
        }
      }

      result.push({
        responseId: resp.id,
        seqNum,
        rowLabel: currentRowLabel,
        identifierValues,
        measurementValues,
        depth1Value,
        questionId: question.id,
        rowIndex: originalRowIndex,
        cellIds,
        isUnexposed: false,
        unexposedColumns: unexposedExpandedIndices,
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
  const labels = ['__cell_ids__', '__cell_ids_2__', '__question_id__', '__row_index__'];
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

/** 헤더 row 1~3의 특정 열을 세로 병합하여 한 번만 표시 */
function mergeHeaderCells(ws: ExcelJS.Worksheet, col: number): void {
  ws.mergeCells(1, col, HEADER_ROW_COUNT, col);
  ws.getRow(1).getCell(col).alignment = { vertical: 'middle', horizontal: 'center' };
}

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

/** 헤더 + 데이터 샘플링하여 열 너비 자동 조절 */
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

    // 3) 데이터 행 삽입 — B열은 행 라벨 (seqNum 대신)
    const excelRow = addRow(ws, [
      semiRow.responseId,
      semiRow.rowLabel || semiRow.seqNum,
      ...semiRow.identifierValues,
      ...semiRow.measurementValues,
    ]);

    // 숨김 열 (cellIds가 32767자 초과 시 2번째 셀에 이어서 기록)
    setCellValueChunked(excelRow, hiddenStartCol, semiRow.cellIds.join(','));
    setCellValue(excelRow.getCell(hiddenStartCol + 2), semiRow.questionId);
    setCellValue(excelRow.getCell(hiddenStartCol + 3), semiRow.rowIndex);

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

    // 6) 전체 행이 미노출/미응답이면 AutoFilter로 필터링 가능하도록 표시만 남김
    //    row.hidden은 AutoFilter와 충돌하여 Ctrl+Shift+9 해제 불가 → 사용하지 않음
  }

  // 마지막 행 하단 테두리
  if (dataRows.length > 0) {
    const lastExcelRow = ws.getRow(HEADER_ROW_COUNT + dataRows.length);
    for (let c = 1; c <= colCount; c++) {
      lastExcelRow.getCell(c).border = THICK_BOTTOM_BORDER;
    }
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
  dataRows: SemiLongRow[],
) {
  // label 열과 대응 binary 열의 Excel 열 번호를 매핑
  interface LabelGroup {
    labelExcelCol: number;
    binaryExcelCols: number[];
    binaryLabels: string[];
    otherTextExcelCol?: number;
  }

  const groups: LabelGroup[] = [];
  let currentGroup: LabelGroup | null = null;

  for (let i = 0; i < expandedColumns.length; i++) {
    const ec = expandedColumns[i];
    const excelCol = startCol + i;

    if (ec.columnKind === 'label') {
      currentGroup = { labelExcelCol: excelCol, binaryExcelCols: [], binaryLabels: [] };
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

  // 각 데이터 행에 수식 삽입
  for (let ri = 0; ri < dataRows.length; ri++) {
    const semiRow = dataRows[ri];
    // Semi-Long: 행 전체 미노출/미응답 요약은 수식 건너뛰기
    if (semiRow.isUnexposed) continue;
    if (isNonDataDepth1(semiRow.depth1Value)) continue;

    const excelRowNum = HEADER_ROW_COUNT + 1 + ri;

    for (const group of groups) {
      // Wide 시트에서 부분 미노출: label 셀에 이미 [미노출]이 들어가 있으면 건너뛰기
      const labelCell = ws.getRow(excelRowNum).getCell(group.labelExcelCol);
      if (labelCell.value === UNEXPOSED_MARKER) continue;

      // TEXTJOIN 없이 모든 Excel 버전 호환 수식:
      // 각 선택 항목에 ", " 접두사를 붙여 연결 → MID로 앞의 ", " 제거
      // 예: MID(IF(...)&IF(...)&..., 3, 9999)
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

/**
 * 숨김 열 설정 + binary 열에 데이터 유효성 검사(드롭다운) 적용
 */
function applyHiddenAndValidation(
  ws: ExcelJS.Worksheet,
  expandedColumns: ExpandedColumn[],
  startCol: number,
  dataRowCount: number,
) {
  for (let i = 0; i < expandedColumns.length; i++) {
    const ec = expandedColumns[i];
    const excelCol = startCol + i;

    // 숨김 열 처리
    if (!ec.visible) {
      ws.getColumn(excelCol).hidden = true;
    }

    // binary 열에 데이터 유효성 검사
    if (ec.columnKind === 'binary') {
      const code = ec.spssNumericCode ?? (ec.checkboxOptionIndex! + 1);
      for (let r = HEADER_ROW_COUNT + 1; r <= HEADER_ROW_COUNT + dataRowCount; r++) {
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
 * h1 헤더에서 같은 원본 셀의 연속 열(label+binary+other-text)을 병합한다.
 */
function mergeExpandedH1Headers(
  ws: ExcelJS.Worksheet,
  expandedColumns: ExpandedColumn[],
  startCol: number,
) {
  if (expandedColumns.length === 0) return;

  let mergeStart = startCol;
  let prevCellId: string | null = expandedColumns[0].cellId;

  for (let i = 1; i <= expandedColumns.length; i++) {
    const currentCellId = i < expandedColumns.length ? expandedColumns[i].cellId : null;
    if (currentCellId !== prevCellId) {
      const mergeEnd = startCol + i - 1;
      if (mergeEnd > mergeStart) {
        ws.mergeCells(1, mergeStart, 1, mergeEnd);
        ws.getRow(1).getCell(mergeStart).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      }
      mergeStart = startCol + i;
      prevCellId = currentCellId;
    }
  }
}

/** Semi-Long 시트의 3행 헤더를 생성한다. (ExpandedColumn 기반) */
function buildSemiLongHeaders(
  classified: ClassifiedCells,
  expandedColumns: ExpandedColumn[],
): { h1: string[]; h2: string[]; h3: string[] } {
  const metaCols = ['response_id', '행 라벨'];
  const idLabels = classified.identifiers.map((id) => id.label);

  const h1 = [...metaCols, ...idLabels, ...expandedColumns.map((ec) => ec.h1Label)];
  const h2 = [...metaCols, ...idLabels, ...expandedColumns.map((ec) => ec.h2Label)];
  const h3 = [
    ...metaCols,
    ...classified.identifiers.map((_, i) => `id_${i + 1}`),
    ...expandedColumns.map((ec) => ec.h3Label),
  ];

  return { h1, h2, h3 };
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

  // 체크박스 질문 확장 구조 준비
  interface GeneralCol {
    question: Question;
    expanded: ExpandedColumn | null; // null = 비체크박스 질문
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
  }

  // 체크박스 수식/숨김/드롭다운 적용
  const hasCheckbox = generalCols.some((gc) => gc.expanded);
  if (hasCheckbox) {
    const allExpanded: ExpandedColumn[] = generalCols.map((gc) => {
      if (gc.expanded) return gc.expanded;
      // 비체크박스: 더미 value 타입
      return {
        cell: { id: gc.question.id, type: 'text' as const, content: '' } as TableCell,
        colIndex: -1, columnKind: 'value' as const, checkboxOptionIndex: null,
        h1Label: gc.question.title, h2Label: gc.question.type,
        h3Label: gc.question.questionCode ?? gc.question.id,
        cellId: gc.question.id, visible: true,
      };
    });

    const measureStartCol = 2; // response_id 다음
    // label 셀 값이 [미노출]이면 수식 건너뜀
    const dummyRows: SemiLongRow[] = responses.map(() => ({
      responseId: '', seqNum: 0, rowLabel: '', identifierValues: [], measurementValues: [],
      depth1Value: '', questionId: '', rowIndex: -1, cellIds: [],
      isUnexposed: false, unexposedColumns: new Set<number>(),
    }));
    applyCheckboxFormulas(ws, allExpanded, measureStartCol, dummyRows);
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

  const sheetLabel = question.questionCode ?? question.title.slice(0, 30);
  const name = sanitizeSheetName(sheetLabel, sheetNames);
  const ws = workbook.addWorksheet(name, { properties: { tabColor: TAB_COLOR_WIDE } });

  // inputCells 수집 → 체크박스 확장 적용
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
        // label 열
        wideCols.push({
          rowIdx: ri, colIdx: ci, cell, rowLabel,
          expanded: {
            cell, colIndex: ci, columnKind: 'label', checkboxOptionIndex: null,
            h1Label: rowLabel, h2Label: opts.map((o: CheckboxOption) => o.label).join(' | '),
            h3Label: cellCode, cellId: cell.id, visible: true,
          },
        });
        // binary 열
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
        // other-text 열
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

  const h1 = ['response_id', ...expandedList.map((ec) => ec.h1Label)];
  const h2 = ['response_id', ...expandedList.map((ec) => ec.h2Label)];
  const h3 = ['response_id', ...expandedList.map((ec) => ec.h3Label)];
  addRow(ws, h1);
  addRow(ws, h2);
  addRow(ws, h3);
  applyHeaderStyle(ws, h1.length);
  mergeHeaderCells(ws, 1);

  const hiddenStartCol = h1.length + 1;
  setupHiddenColumns(ws, hiddenStartCol, 3);

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
  }

  // 체크박스 수식/숨김/드롭다운 적용 — label 셀 값이 [미노출]이면 수식 건너뜀
  const measureStartCol = 2; // response_id 다음부터
  const dummyRows: SemiLongRow[] = responses.map(() => ({
    responseId: '', seqNum: 0, rowLabel: '', identifierValues: [], measurementValues: [],
    depth1Value: '', questionId: '', rowIndex: -1, cellIds: [],
    isUnexposed: false, unexposedColumns: new Set<number>(),
  }));
  applyCheckboxFormulas(ws, expandedList, measureStartCol, dummyRows);
  applyHiddenAndValidation(ws, expandedList, measureStartCol, responses.length);
  mergeExpandedH1Headers(ws, expandedList, measureStartCol);

  applyAutoFilterAndFreeze(ws, h1.length, 1);
  autoFitColumnWidths(ws);
}

/**
 * Semi-Long 시트 생성 (단일 또는 통합).
 * sheetNameOverride가 있으면 해당 이름 사용, 없으면 question에서 추출.
 */
function buildSemiLongSheet(
  workbook: ExcelJS.Workbook,
  question: Question,
  classified: ClassifiedCells,
  expandedColumns: ExpandedColumn[],
  dataRows: SemiLongRow[],
  sheetNames: Set<string>,
  sheetNameOverride?: string,
) {
  const sheetLabel = sheetNameOverride
    ?? (question.questionCode ?? question.title.slice(0, 30));
  const name = sanitizeSheetName(sheetLabel, sheetNames);
  const ws = workbook.addWorksheet(name, { properties: { tabColor: TAB_COLOR_SEMI_LONG } });

  const { h1, h2, h3 } = buildSemiLongHeaders(classified, expandedColumns);
  addRow(ws, h1);
  addRow(ws, h2);
  addRow(ws, h3);
  applyHeaderStyle(ws, h1.length);
  mergeHeaderCells(ws, 1); // response_id
  mergeHeaderCells(ws, 2); // #

  const hiddenStartCol = h1.length + 1;
  setupHiddenColumns(ws, hiddenStartCol, 4);

  const metaColCount = 2; // response_id, #
  const idColCount = classified.identifiers.length;
  const measureStartCol = metaColCount + idColCount + 1;

  writeSemiLongDataRows(ws, dataRows, h1.length, metaColCount, idColCount, hiddenStartCol);

  // 체크박스 수식/숨김/드롭다운 적용
  applyCheckboxFormulas(ws, expandedColumns, measureStartCol, dataRows);
  applyHiddenAndValidation(ws, expandedColumns, measureStartCol, dataRows.length);
  mergeExpandedH1Headers(ws, expandedColumns, measureStartCol);

  applyAutoFilterAndFreeze(ws, h1.length, 2);
  autoFitColumnWidths(ws);
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
      : qs[0].questionCode ?? key;
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
        const expanded = expandMeasurements(classified.measurements, firstQ.tableColumns ?? []);
        const perQuestionRows = group.questions.map((q) => {
          const qClassified = classifyTableCells(q.tableRowsData ?? [], q.tableColumns ?? []);
          const qExpanded = expandMeasurements(qClassified.measurements, q.tableColumns ?? []);
          return buildSemiLongRows(q, responses, qClassified, qExpanded, survey.questions, allGroups);
        });
        const mergedRows = interleaveByResponse(perQuestionRows, responses);
        buildSemiLongSheet(workbook, firstQ, classified, expanded, mergedRows, sheetNames, group.label);
      }
    } else {
      const q = group.questions[0];
      const classified = classifyTableCells(q.tableRowsData ?? [], q.tableColumns ?? []);

      if (shouldUseSemiLong(q.tableRowsData ?? [], classified.measurements, classified.identifiers)) {
        const expanded = expandMeasurements(classified.measurements, q.tableColumns ?? []);
        const dataRows = buildSemiLongRows(q, responses, classified, expanded, survey.questions, allGroups);
        const firstDepth1 = dataRows.find(
          (r) => r.depth1Value && !isNonDataDepth1(r.depth1Value),
        )?.depth1Value;
        const depthSuffix = firstDepth1 ? `-${firstDepth1}` : '';
        const sheetLabel = (q.questionCode ?? q.title.slice(0, 20)) + depthSuffix;
        buildSemiLongSheet(workbook, q, classified, expanded, dataRows, sheetNames, sheetLabel);
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
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
