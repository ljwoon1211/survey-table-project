/**
 * Flat Excel Export Utilities
 *
 * 퀄트릭스 스타일의 Flat/Linear 데이터 내보내기 기능
 * - 각 질문/셀/옵션을 개별 열로 확장
 * - 다중 선택(Checkbox)은 각 옵션별 별도 열 (Y/N)
 * - Loop/Matrix 테이블 패턴 지원
 */
import * as XLSX from 'xlsx';

import {
  CheckboxOption,
  Question,
  QuestionOption,
  RadioOption,
  Survey,
  TableCell,
  TableRow,
} from '@/types/survey';

// ============================================================
// Types
// ============================================================

/** 엑셀 내보내기용 열 정의 */
export interface ExportColumn {
  /** 열 고유 코드 (데이터 매핑용) */
  code: string;
  /** 엑셀 헤더 라벨 */
  header: string;
  /** 원본 질문 ID */
  questionId: string;
  /** 열 타입 */
  type: 'meta' | 'single' | 'checkbox-option' | 'table-cell' | 'table-checkbox-option';
  /** 체크박스 옵션 정보 (type이 checkbox-option일 때) */
  optionInfo?: {
    optionValue: string;
    optionLabel: string;
  };
  /** 테이블 셀 정보 (type이 table-*일 때) */
  tableInfo?: {
    rowId: string;
    rowCode: string;
    rowLabel: string;
    cellId: string;
    cellCode: string;
    cellType: string;
  };
}

/** Flat 행 데이터 */
export type FlatRow = Record<string, string | number | boolean>;

/** 응답 데이터 (DB에서 가져온 형태) */
export interface ResponseData {
  id: string;
  surveyId: string;
  questionResponses: Record<string, unknown>;
  isCompleted: boolean;
  startedAt: Date;
  completedAt?: Date;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
}

// ============================================================
// Column Generation
// ============================================================

/**
 * 설문 질문들을 Flat 열 목록으로 변환
 */
export function flattenQuestionsToColumns(survey: Survey): ExportColumn[] {
  const columns: ExportColumn[] = [];

  // 메타데이터 열
  columns.push(
    { code: 'response_id', header: 'Response ID', questionId: '', type: 'meta' },
    { code: 'started_at', header: '시작 시간', questionId: '', type: 'meta' },
    { code: 'completed_at', header: '완료 시간', questionId: '', type: 'meta' },
    { code: 'duration_sec', header: '소요 시간(초)', questionId: '', type: 'meta' },
    { code: 'status', header: '상태', questionId: '', type: 'meta' },
    { code: 'device', header: '디바이스', questionId: '', type: 'meta' },
  );

  // 질문별 열 생성
  const sortedQuestions = [...survey.questions].sort((a, b) => a.order - b.order);

  sortedQuestions.forEach((question) => {
    if (question.type === 'table') {
      columns.push(...expandTableToColumns(question));
    } else if (question.type === 'checkbox') {
      columns.push(...expandCheckboxToColumns(question));
    } else if (question.type === 'notice') {
      // notice 타입은 내보내기에서 제외
    } else {
      columns.push(createSingleColumn(question));
    }
  });

  return columns;
}

/**
 * 단일 응답 질문을 열로 변환
 */
function createSingleColumn(question: Question): ExportColumn {
  const code = question.questionCode || question.id.slice(0, 8);
  const header = question.exportLabel || question.title;

  return {
    code,
    header: sanitizeHeader(header),
    questionId: question.id,
    type: 'single',
  };
}

/**
 * 체크박스 질문을 옵션별 열로 확장
 */
function expandCheckboxToColumns(question: Question): ExportColumn[] {
  const columns: ExportColumn[] = [];
  const qCode = question.questionCode || question.id.slice(0, 8);
  const qLabel = question.exportLabel || question.title;

  if (question.options) {
    question.options.forEach((option) => {
      const optCode = option.optionCode || option.value;
      const code = `${qCode}_${optCode}`;
      const header = `${qLabel}_${option.label}`;

      columns.push({
        code,
        header: sanitizeHeader(header),
        questionId: question.id,
        type: 'checkbox-option',
        optionInfo: {
          optionValue: option.value,
          optionLabel: option.label,
        },
      });
    });
  }

  // 기타 옵션이 있는 경우 별도 열 추가
  if (question.allowOtherOption) {
    columns.push({
      code: `${qCode}_other`,
      header: sanitizeHeader(`${qLabel}_기타`),
      questionId: question.id,
      type: 'checkbox-option',
      optionInfo: {
        optionValue: 'other',
        optionLabel: '기타',
      },
    });

    // 기타 입력값 열
    columns.push({
      code: `${qCode}_other_text`,
      header: sanitizeHeader(`${qLabel}_기타_입력값`),
      questionId: question.id,
      type: 'single',
    });
  }

  return columns;
}

/**
 * 테이블 질문을 Flat 열로 확장
 */
function expandTableToColumns(question: Question): ExportColumn[] {
  const columns: ExportColumn[] = [];
  const qCode = question.questionCode || question.id.slice(0, 8);

  if (!question.tableRowsData) return columns;

  question.tableRowsData.forEach((row) => {
    const rowCode = row.rowCode || row.id.slice(0, 4);
    const rowLabel = row.label;

    row.cells.forEach((cell, cellIndex) => {
      // 숨겨진 셀은 건너뛰기
      if (cell.isHidden) return;

      // 입력 가능한 셀 타입만 처리
      if (!isCellInputable(cell)) return;

      const cellCode = cell.cellCode || `c${cellIndex}`;
      const cellLabel = cell.exportLabel || cell.content || cellCode;

      if (cell.type === 'checkbox' && cell.checkboxOptions) {
        // 체크박스 셀: 각 옵션별 열 생성
        cell.checkboxOptions.forEach((option) => {
          const optCode = option.optionCode || option.value;
          const code = `${qCode}_${rowCode}_${cellCode}_${optCode}`;
          const header = `${qCode}_${rowLabel}_${cellLabel}_${option.label}`;

          columns.push({
            code,
            header: sanitizeHeader(header),
            questionId: question.id,
            type: 'table-checkbox-option',
            optionInfo: {
              optionValue: option.value,
              optionLabel: option.label,
            },
            tableInfo: {
              rowId: row.id,
              rowCode,
              rowLabel,
              cellId: cell.id,
              cellCode,
              cellType: cell.type,
            },
          });
        });
      } else {
        // 단일 값 셀 (radio, select, input)
        const code = `${qCode}_${rowCode}_${cellCode}`;
        const header = `${qCode}_${rowLabel}_${cellLabel}`;

        columns.push({
          code,
          header: sanitizeHeader(header),
          questionId: question.id,
          type: 'table-cell',
          tableInfo: {
            rowId: row.id,
            rowCode,
            rowLabel,
            cellId: cell.id,
            cellCode,
            cellType: cell.type,
          },
        });
      }
    });
  });

  return columns;
}

// ============================================================
// Response Flattening
// ============================================================

/**
 * 응답 데이터를 Flat 행으로 변환
 */
export function flattenResponsesToRows(
  responses: ResponseData[],
  columns: ExportColumn[],
  survey: Survey,
): FlatRow[] {
  return responses.map((response) => {
    const row: FlatRow = {};

    columns.forEach((col) => {
      row[col.header] = getValueForColumn(col, response, survey);
    });

    return row;
  });
}

/**
 * 특정 열에 대한 응답 값 추출
 */
function getValueForColumn(
  column: ExportColumn,
  response: ResponseData,
  survey: Survey,
): string | number | boolean {
  const { questionResponses } = response;

  // 메타데이터 열
  if (column.type === 'meta') {
    return getMetaValue(column.code, response);
  }

  const answer = questionResponses[column.questionId];
  if (answer === undefined || answer === null) return '';

  // 단일 값 열
  if (column.type === 'single') {
    if (typeof answer === 'string' || typeof answer === 'number') {
      return formatValue(answer, column.questionId, survey);
    }
    return '';
  }

  // 체크박스 옵션 열 (Y/N)
  if (column.type === 'checkbox-option' && column.optionInfo) {
    if (Array.isArray(answer)) {
      return answer.includes(column.optionInfo.optionValue) ? 'Y' : 'N';
    }
    return 'N';
  }

  // 테이블 셀 열
  if (column.type === 'table-cell' && column.tableInfo) {
    const cellValue = getTableCellValue(answer, column.tableInfo);
    return formatTableCellValue(cellValue, column.tableInfo, column.questionId, survey);
  }

  // 테이블 체크박스 옵션 열 (Y/N)
  if (column.type === 'table-checkbox-option' && column.tableInfo && column.optionInfo) {
    const cellValue = getTableCellValue(answer, column.tableInfo);
    if (Array.isArray(cellValue)) {
      return cellValue.includes(column.optionInfo.optionValue) ? 'Y' : 'N';
    }
    return 'N';
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
    case 'device':
      return parseUserAgent(response.userAgent || '');
    default:
      return '';
  }
}

/**
 * 테이블 셀 값 추출
 */
function getTableCellValue(
  answer: unknown,
  tableInfo: NonNullable<ExportColumn['tableInfo']>,
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
 * 값 포맷팅 (옵션 라벨로 변환)
 */
function formatValue(value: unknown, questionId: string, survey: Survey): string {
  const question = survey.questions.find((q) => q.id === questionId);
  if (!question) return String(value);

  // Radio/Select 옵션 라벨 변환
  if (question.options && typeof value === 'string') {
    const option = question.options.find((o) => o.value === value);
    if (option) return option.label;
  }

  return String(value);
}

/**
 * 테이블 셀 값 포맷팅
 */
function formatTableCellValue(
  value: unknown,
  tableInfo: NonNullable<ExportColumn['tableInfo']>,
  questionId: string,
  survey: Survey,
): string {
  if (value === undefined || value === null) return '';

  const question = survey.questions.find((q) => q.id === questionId);
  if (!question) return String(value);

  // 셀 찾기
  const row = question.tableRowsData?.find((r) => r.id === tableInfo.rowId);
  const cell = row?.cells.find((c) => c.id === tableInfo.cellId);
  if (!cell) return String(value);

  // Radio 옵션 라벨 변환
  if (cell.type === 'radio' && cell.radioOptions && typeof value === 'string') {
    const option = cell.radioOptions.find((o) => o.value === value);
    if (option) return option.label;
  }

  // Select 옵션 라벨 변환
  if (cell.type === 'select' && cell.selectOptions && typeof value === 'string') {
    const option = cell.selectOptions.find((o) => o.value === value);
    if (option) return option.label;
  }

  return String(value);
}

// ============================================================
// Excel Generation
// ============================================================

/**
 * Flat 엑셀 워크북 생성
 */
export function generateFlatExcelWorkbook(
  survey: Survey,
  responses: ResponseData[],
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  // 열 정의 생성
  const columns = flattenQuestionsToColumns(survey);

  // 응답 데이터 Flat 변환
  const rows = flattenResponsesToRows(responses, columns, survey);

  // 워크시트 생성
  const ws = XLSX.utils.json_to_sheet(rows);

  // 열 너비 자동 조정
  const colWidths = columns.map((col) => ({
    wch: Math.min(Math.max(col.header.length * 1.5, 10), 50),
  }));
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(workbook, ws, 'Flat Data');

  // Variable Map 시트 추가
  const mapData = generateFlatVariableMap(columns, survey);
  const mapWs = XLSX.utils.json_to_sheet(mapData);
  XLSX.utils.book_append_sheet(workbook, mapWs, 'Variable Map');

  return workbook;
}

/**
 * Flat Variable Map 생성
 */
function generateFlatVariableMap(columns: ExportColumn[], survey: Survey) {
  return columns.map((col) => {
    const question = survey.questions.find((q) => q.id === col.questionId);

    return {
      'Column Code': col.code,
      'Column Header': col.header,
      Type: col.type,
      'Question ID': col.questionId,
      'Question Title': question?.title || '',
      'Question Code': question?.questionCode || '',
      'Option Value': col.optionInfo?.optionValue || '',
      'Option Label': col.optionInfo?.optionLabel || '',
      'Table Row': col.tableInfo?.rowLabel || '',
      'Table Cell': col.tableInfo?.cellCode || '',
    };
  });
}

/**
 * Flat 엑셀 파일 다운로드용 Blob 생성
 */
export function generateFlatExcelBlob(survey: Survey, responses: ResponseData[]): Blob {
  const workbook = generateFlatExcelWorkbook(survey, responses);
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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

/**
 * User Agent 파싱
 */
function parseUserAgent(ua: string): string {
  if (ua.includes('Mobile')) return 'Mobile';
  if (ua.includes('Windows')) return 'PC (Windows)';
  if (ua.includes('Macintosh')) return 'PC (Mac)';
  if (ua.includes('Linux')) return 'PC (Linux)';
  return 'PC (Other)';
}
