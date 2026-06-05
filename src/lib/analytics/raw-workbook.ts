import ExcelJS from 'exceljs';

import { HEADER_BORDER, HEADER_FILL, HEADER_FONT } from '@/lib/analytics/export-styles';
import { buildCodebookValueLabel, formatExcelDateTime } from '@/lib/analytics/raw-export-helpers';
import {
  type SPSSExportColumn,
  buildDataRow,
  generateSPSSColumns,
} from '@/lib/analytics/spss-excel-export';
import { type Platform, formatPlatformKo } from '@/lib/operations/parse-ua';
import { formatTotalTime, mapStatusPill } from '@/lib/operations/profiles';
import { Question, SurveySubmission } from '@/types/survey';

// ============================================================
// Raw Data 워크북
// ============================================================

export interface RawExportResponseRow {
  id: string;
  questionResponses: Record<string, unknown>;
  groupValue: string | null;
  resid: number | null;
  platform: string | null;
  browser: string | null;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  totalSeconds: number | null;
}

export type RawIdentifierMode = 'sequence' | 'systemId';

/**
 * 시트 분리 없는 3시트 Raw Data 워크북.
 * - 응답 내역: 응답자 메타 (응답 내역 페이지 재현)
 * - Raw Data: 응답 × 변수 wide table (SPSS 코드값), 헤더 3행
 * - 코딩북: 변수 정의 + 값 라벨
 * rows 는 started_at ASC 정렬된 동일 모수.
 */
export function generateRawDataWorkbook(
  questions: Question[],
  rows: RawExportResponseRow[],
  identifierMode: RawIdentifierMode,
): ExcelJS.Workbook {
  const idHeader = identifierMode === 'systemId' ? 'systemID' : '순번';
  // systemId 모드에서 컨택 미매칭(익명) 응답은 resid가 없어 식별자 칸을 공백으로 둔다.
  const idValue = (row: RawExportResponseRow, idx: number): string | number =>
    identifierMode === 'systemId' ? (row.resid ?? '') : idx + 1;

  // 질문은 order 순으로 정렬해 컬럼/코딩북 순서를 설문 표시 순서와 일치시킨다.
  const sortedQuestions = [...questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const columns = generateSPSSColumns(sortedQuestions);
  const questionMap = new Map(sortedQuestions.map((q) => [q.id, q]));

  const workbook = new ExcelJS.Workbook();

  // 시트 1: 응답 내역
  const ws1 = workbook.addWorksheet('응답 내역');
  ws1.addRow([
    idHeader,
    '조사 대상 그룹',
    '접속 단말',
    '브라우저',
    '상태',
    '시작일시',
    '종료일시',
    '소요시간',
  ]);
  rows.forEach((row, i) => {
    ws1.addRow([
      idValue(row, i),
      row.groupValue ?? '공개링크',
      formatPlatformKo(row.platform as Platform | null),
      row.browser ?? 'Other',
      mapStatusPill({ status: row.status }).label,
      formatExcelDateTime(row.startedAt),
      // 상태는 별도 컬럼이 표시하므로 종료일시는 순수 시각만(미완료/이탈은 null → 공백).
      formatExcelDateTime(row.completedAt),
      formatTotalTime(row.totalSeconds, row.status),
    ]);
  });
  styleHeaderRows(ws1, [1], 8);
  autoFitRawColumns(ws1, 8);

  // 시트 2: Raw Data (헤더 3행 = 질문제목 / 셀라벨 / SPSS 변수명)
  const ws2 = workbook.addWorksheet('Raw Data');
  const colCount = columns.length + 1; // 식별자 1열 + 변수 열
  ws2.addRow([idHeader, ...columns.map((c) => c.questionText)]);
  ws2.addRow(['', ...columns.map((c) => row2Label(c))]);
  ws2.addRow(['', ...columns.map((c) => c.spssVarName)]);
  rows.forEach((row, i) => {
    ws2.addRow([
      idValue(row, i),
      ...buildDataRow(columns, questionMap, row as unknown as SurveySubmission),
    ]);
  });

  // 1~3행 헤더 스타일
  styleHeaderRows(ws2, [1, 2, 3], colCount);
  // 식별자 열은 1~3행 세로 병합
  ws2.mergeCells(1, 1, 3, 1);
  // 1행: 같은 질문(questionId)에 속한 연속 변수 열을 가로 병합
  let start = 0;
  while (start < columns.length) {
    let end = start;
    while (end + 1 < columns.length && columns[end + 1]?.questionId === columns[start]?.questionId) {
      end++;
    }
    if (end > start) ws2.mergeCells(1, start + 2, 1, end + 2);
    start = end + 1;
  }
  // 열 너비: 변수 열은 2행(셀라벨) 컨텐츠 기준
  ws2.getColumn(1).width = clampRawWidth(estimateTextWidth(idHeader));
  columns.forEach((c, i) => {
    ws2.getColumn(i + 2).width = clampRawWidth(estimateTextWidth(row2Label(c)));
  });

  // 시트 3: 코딩북
  const ws3 = workbook.addWorksheet('코딩북');
  ws3.addRow(['변수번호', 'SPSS 변수명', '질문 제목', '셀라벨', '값 라벨']);
  columns.forEach((c, i) => {
    ws3.addRow([
      i + 1,
      c.spssVarName,
      c.questionText,
      c.cellExportLabel ?? '',
      buildCodebookValueLabel(c, questionMap),
    ]);
  });
  styleHeaderRows(ws3, [1], 5);
  autoFitRawColumns(ws3, 5);

  return workbook;
}

// ── Raw/Split 워크북 공통 스타일·레이아웃 헬퍼 ──

const RAW_MIN_WIDTH = 8;
const RAW_MAX_WIDTH = 60;
const RAW_WIDTH_PADDING = 2;

/** 텍스트 표시 너비 추정 (CJK 문자 1.8배). */
export function estimateTextWidth(value: unknown): number {
  if (value === null || value === undefined) return 0;
  let width = 0;
  for (const ch of String(value)) {
    const code = ch.codePointAt(0) ?? 0;
    const isCjk =
      (code >= 0x1100 && code <= 0x11ff) ||
      (code >= 0x3000 && code <= 0x9fff) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xff00 && code <= 0xffef);
    width += isCjk ? 1.8 : 1;
  }
  return width;
}

export function clampRawWidth(width: number): number {
  return Math.min(RAW_MAX_WIDTH, Math.max(RAW_MIN_WIDTH, width + RAW_WIDTH_PADDING));
}

/** 지정한 행들을 헤더 스타일(파란 배경 + 흰 굵은 글씨 + 테두리 + 가운데 정렬)로 칠한다. */
export function styleHeaderRows(
  ws: ExcelJS.Worksheet,
  rowNums: number[],
  colCount: number,
): void {
  for (const rowNum of rowNums) {
    const row = ws.getRow(rowNum);
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.border = HEADER_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    }
    row.height = 22;
  }
}

/** 헤더 + 데이터 일부를 표본으로 열 너비를 자동 맞춤 (시트1/코딩북용). */
export function autoFitRawColumns(ws: ExcelJS.Worksheet, colCount: number): void {
  const sampleEnd = Math.min(ws.rowCount, 200);
  for (let c = 1; c <= colCount; c++) {
    let max = 0;
    for (let r = 1; r <= sampleEnd; r++) {
      max = Math.max(max, estimateTextWidth(ws.getRow(r).getCell(c).value));
    }
    ws.getColumn(c).width = clampRawWidth(max);
  }
}

/** Raw Data 헤더 행2: 테이블 셀라벨 > 옵션 분리 열 라벨 > 공백 */
export function row2Label(c: SPSSExportColumn): string {
  if (c.cellExportLabel) return c.cellExportLabel;
  if (
    c.type === 'checkbox-item' ||
    c.type === 'ranking-rank' ||
    c.type === 'ranking-other' ||
    c.type === 'option-text' ||
    c.type === 'other-text' ||
    c.type === 'table-cell-option-text' ||
    c.type === 'table-cell-ranking-other'
  ) {
    return c.optionLabel ?? '';
  }
  return '';
}
