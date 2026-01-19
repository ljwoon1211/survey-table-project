/**
 * Compact Excel Export Utilities
 * 
 * 간결 스타일의 데이터 내보내기 기능
 * - 각 질문/셀당 하나의 열
 * - 다중 선택(Checkbox)은 선택된 값들을 콤마로 합침
 * - 열 개수 최소화 (데이터 확인용)
 */

import * as XLSX from 'xlsx';
import {
  Survey,
  Question,
  TableCell,
} from '@/types/survey';
import type { ResponseData } from './flat-excel-export';

/** 간결 열 정의 */
interface CompactColumn {
  code: string;
  header: string;
  questionId: string;
  type: 'meta' | 'question' | 'table-cell';
  tableInfo?: {
    rowId: string;
    rowLabel: string;
    cellId: string;
    cellType: string;
  };
}

type CompactRow = Record<string, string | number>;

// ============================================================
// Column Generation (Compact)
// ============================================================

/**
 * 설문 질문들을 간결 열 목록으로 변환 (옵션 확장 없음)
 */
function flattenQuestionsToCompactColumns(survey: Survey): CompactColumn[] {
  const columns: CompactColumn[] = [];

  // 메타데이터 열
  columns.push(
    { code: 'response_id', header: 'Response ID', questionId: '', type: 'meta' },
    { code: 'started_at', header: '시작 시간', questionId: '', type: 'meta' },
    { code: 'completed_at', header: '완료 시간', questionId: '', type: 'meta' },
    { code: 'duration_sec', header: '소요 시간(초)', questionId: '', type: 'meta' },
    { code: 'status', header: '상태', questionId: '', type: 'meta' },
  );

  // 질문별 열 생성
  const sortedQuestions = [...survey.questions].sort((a, b) => a.order - b.order);

  sortedQuestions.forEach(question => {
    if (question.type === 'table') {
      columns.push(...expandTableToCompactColumns(question));
    } else if (question.type === 'notice') {
      // notice 타입은 내보내기에서 제외
    } else {
      // 단일 열 (checkbox도 하나의 열)
      const code = question.questionCode || question.id.slice(0, 8);
      const header = question.exportLabel || question.title;

      columns.push({
        code,
        header: sanitizeHeader(header),
        questionId: question.id,
        type: 'question',
      });
    }
  });

  return columns;
}

/**
 * 테이블 질문을 간결 열로 확장 (셀당 하나의 열)
 */
function expandTableToCompactColumns(question: Question): CompactColumn[] {
  const columns: CompactColumn[] = [];
  const qCode = question.questionCode || question.id.slice(0, 8);

  if (!question.tableRowsData) return columns;

  question.tableRowsData.forEach(row => {
    const rowCode = row.rowCode || row.id.slice(0, 4);
    const rowLabel = row.label;

    row.cells.forEach((cell, cellIndex) => {
      // 숨겨진 셀은 건너뛰기
      if (cell.isHidden) return;

      // 입력 가능한 셀 타입만 처리
      if (!isCellInputable(cell)) return;

      const cellCode = cell.cellCode || `c${cellIndex}`;
      const cellLabel = cell.exportLabel || cell.content || cellCode;

      // 하나의 셀 = 하나의 열 (옵션 확장 없음)
      const code = `${qCode}_${rowCode}_${cellCode}`;
      const header = `${qCode}_${rowLabel}_${cellLabel}`;

      columns.push({
        code,
        header: sanitizeHeader(header),
        questionId: question.id,
        type: 'table-cell',
        tableInfo: {
          rowId: row.id,
          rowLabel,
          cellId: cell.id,
          cellType: cell.type,
        },
      });
    });
  });

  return columns;
}

// ============================================================
// Response Flattening (Compact)
// ============================================================

/**
 * 응답 데이터를 간결 행으로 변환
 */
function flattenResponsesToCompactRows(
  responses: ResponseData[],
  columns: CompactColumn[],
  survey: Survey
): CompactRow[] {
  return responses.map(response => {
    const row: CompactRow = {};

    columns.forEach(col => {
      row[col.header] = getCompactValueForColumn(col, response, survey);
    });

    return row;
  });
}

/**
 * 특정 열에 대한 간결 응답 값 추출
 */
function getCompactValueForColumn(
  column: CompactColumn,
  response: ResponseData,
  survey: Survey
): string | number {
  const { questionResponses } = response;

  // 메타데이터 열
  if (column.type === 'meta') {
    return getMetaValue(column.code, response);
  }

  const answer = questionResponses[column.questionId];
  if (answer === undefined || answer === null) return '';

  // 일반 질문
  if (column.type === 'question') {
    return formatCompactValue(answer, column.questionId, survey);
  }

  // 테이블 셀
  if (column.type === 'table-cell' && column.tableInfo) {
    const cellValue = getTableCellValue(answer, column.tableInfo);
    return formatCompactCellValue(cellValue, column.tableInfo, column.questionId, survey);
  }

  return '';
}

/**
 * 메타데이터 값 추출
 */
function getMetaValue(code: string, response: ResponseData): string | number {
  switch (code) {
    case 'response_id':
      return response.id;
    case 'started_at':
      return new Date(response.startedAt).toLocaleString('ko-KR');
    case 'completed_at':
      return response.completedAt
        ? new Date(response.completedAt).toLocaleString('ko-KR')
        : '미완료';
    case 'duration_sec': {
      if (!response.completedAt) return 0;
      const start = new Date(response.startedAt).getTime();
      const end = new Date(response.completedAt).getTime();
      return Math.floor((end - start) / 1000);
    }
    case 'status':
      return response.isCompleted ? '완료' : '진행중';
    default:
      return '';
  }
}

/**
 * 테이블 셀 값 추출
 */
function getTableCellValue(
  answer: unknown,
  tableInfo: { rowId: string; cellId: string }
): unknown {
  if (!answer || typeof answer !== 'object') return undefined;

  const answerObj = answer as Record<string, unknown>;

  // 1. cell.id로 직접 조회
  if (answerObj[tableInfo.cellId] !== undefined) {
    return answerObj[tableInfo.cellId];
  }

  // 2. Fallback: rowId > cellId 구조
  const rowAnswer = answerObj[tableInfo.rowId];
  if (rowAnswer && typeof rowAnswer === 'object') {
    return (rowAnswer as Record<string, unknown>)[tableInfo.cellId];
  }

  return undefined;
}

/**
 * 간결 값 포맷팅 (다중 선택은 콤마로 합침)
 */
function formatCompactValue(value: unknown, questionId: string, survey: Survey): string {
  const question = survey.questions.find(q => q.id === questionId);
  if (!question) return String(value ?? '');

  // 배열 (체크박스 다중 선택)
  if (Array.isArray(value)) {
    const labels = value.map(v => {
      if (question.options) {
        const option = question.options.find(o => o.value === v);
        if (option) return option.label;
      }
      return String(v);
    });
    return labels.join(', ');
  }

  // 단일 값 (Radio/Select)
  if (question.options && typeof value === 'string') {
    const option = question.options.find(o => o.value === value);
    if (option) return option.label;
  }

  return String(value ?? '');
}

/**
 * 셀 값 간결 포맷팅
 */
function formatCompactCellValue(
  value: unknown,
  tableInfo: { rowId: string; cellId: string; cellType: string },
  questionId: string,
  survey: Survey
): string {
  if (value === undefined || value === null) return '';

  const question = survey.questions.find(q => q.id === questionId);
  if (!question) return String(value);

  // 셀 찾기
  const row = question.tableRowsData?.find(r => r.id === tableInfo.rowId);
  const cell = row?.cells.find(c => c.id === tableInfo.cellId);
  if (!cell) return String(value);

  // 배열 (체크박스 다중 선택) → 콤마로 합침
  if (Array.isArray(value)) {
    const labels = value.map(v => {
      if (cell.checkboxOptions) {
        const option = cell.checkboxOptions.find(o => o.value === v);
        if (option) return option.label;
      }
      return String(v);
    });
    return labels.join(', ');
  }

  // Radio 옵션 라벨 변환
  if (cell.type === 'radio' && cell.radioOptions && typeof value === 'string') {
    const option = cell.radioOptions.find(o => o.value === value);
    if (option) return option.label;
  }

  // Select 옵션 라벨 변환
  if (cell.type === 'select' && cell.selectOptions && typeof value === 'string') {
    const option = cell.selectOptions.find(o => o.value === value);
    if (option) return option.label;
  }

  return String(value);
}

// ============================================================
// Excel Generation (Compact)
// ============================================================

/**
 * Compact 엑셀 워크북 생성
 */
function generateCompactExcelWorkbook(
  survey: Survey,
  responses: ResponseData[]
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  // 열 정의 생성
  const columns = flattenQuestionsToCompactColumns(survey);

  // 응답 데이터 변환
  const rows = flattenResponsesToCompactRows(responses, columns, survey);

  // 워크시트 생성
  const ws = XLSX.utils.json_to_sheet(rows);

  // 열 너비 자동 조정
  const colWidths = columns.map(col => ({
    wch: Math.min(Math.max(col.header.length * 1.5, 10), 50)
  }));
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(workbook, ws, 'Compact Data');

  return workbook;
}

/**
 * Compact 엑셀 파일 다운로드용 Blob 생성
 */
export function generateCompactExcelBlob(
  survey: Survey,
  responses: ResponseData[]
): Blob {
  const workbook = generateCompactExcelWorkbook(survey, responses);
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

// ============================================================
// Helpers
// ============================================================

/**
 * 입력 가능한 셀 타입인지 확인
 */
function isCellInputable(cell: TableCell): boolean {
  return ['checkbox', 'radio', 'select', 'input'].includes(cell.type);
}

/**
 * 헤더 문자열 정리
 */
function sanitizeHeader(str: string): string {
  return str
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\/\\?*\[\]]/g, '_')
    .trim()
    .substring(0, 100);
}
