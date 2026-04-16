/**
 * Cleaning Export 타입 및 상수
 *
 * Semi-Long / Wide 테이블 클리닝 엑셀에서 사용하는
 * 인터페이스, 스타일 상수, 임계값, 마커를 정의한다.
 */
import type ExcelJS from 'exceljs';

import type { TableCell } from '@/types/survey';

// ============================================================
// Types
// ============================================================

export interface ClassifiedCells {
  identifiers: { colIndex: number; cell: TableCell; label: string }[];
  measurements: { colIndex: number; cell: TableCell; label: string }[];
}

export interface ExpandedColumn {
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
  isVaryingOptions?: boolean;
}

export interface SemiLongRow {
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
  computedLabels?: Map<number, string>;
}

/** applyCheckboxFormulas 등에서 행 단위 메타 정보만 필요할 때 사용 */
export interface DataRowMeta {
  isUnexposed: 'question' | 'row' | false;
  depth1Value: string;
}

export type OptionLike = { id: string; value: string; label: string };

export type ProgressCallback = (current: number, total: number, sheetName: string) => void;

// ============================================================
// Style Constants
// ============================================================

export const LIGHT_BLUE_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFDCE6F1' },
};

export const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF4472C4' },
};

export const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 10,
};

export const UNEXPOSED_FONT: Partial<ExcelJS.Font> = {
  color: { argb: 'FF999999' },
  size: 10,
};

export const THICK_BOTTOM_BORDER: Partial<ExcelJS.Borders> = {
  bottom: { style: 'thin', color: { argb: 'FF333333' } },
};

export const HEADER_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF2F5496' } },
  bottom: { style: 'thin', color: { argb: 'FF2F5496' } },
  left: { style: 'thin', color: { argb: 'FF2F5496' } },
  right: { style: 'thin', color: { argb: 'FF2F5496' } },
};

// ============================================================
// Threshold & Behavior Constants
// ============================================================

export const SEMI_LONG_THRESHOLD_ROWS = 50;
export const SEMI_LONG_THRESHOLD_MEASUREMENT_COLS = 20;
export const LARGE_TABLE_ROW_THRESHOLD = 100;
export const DEPTH_SPLIT_ROW_THRESHOLD = 300;
export const HEADER_ROW_COUNT = 3;
export const TITLE_ROW_OFFSET = 1;

// ============================================================
// Marker & Color Constants
// ============================================================

export const UNEXPOSED_MARKER = '[미노출]';
export const NO_ANSWER_MARKER = '[전체 미응답]';

export const TAB_COLOR_WIDE = { argb: 'FF70AD47' };
export const TAB_COLOR_SEMI_LONG = { argb: 'FF4472C4' };
export const TAB_COLOR_SEMI_LONG_DEPTH = { argb: 'FFED7D31' };
