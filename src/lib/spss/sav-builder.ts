import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

import {
  createStream,
  SavVariable,
  VariableAlignment,
  VariableMeasure,
  VariableType,
} from 'sav-writer';

import type { Question, SurveySubmission } from '@/types/survey';

import { buildDataRows, generateSPSSColumns, SPSSExportColumn } from '@/lib/analytics/spss-excel-export';

// ── 상수 ──

const BATCH_SIZE = 500;
const DEFAULT_STRING_WIDTH = 256;
const MIN_STRING_WIDTH = 8;

// ── 타입 결정 함수 ──

/**
 * 변수 타입 결정 (오버라이드 우선 → 자동 판단)
 */
function resolveVarType(col: SPSSExportColumn, question: Question | undefined): VariableType {
  const varTypeMap: Record<string, VariableType> = {
    Numeric: VariableType.Numeric,
    String: VariableType.String,
    Date: VariableType.Date,
    DateTime: VariableType.DateTime,
  };

  // 셀 단위 오버라이드 (테이블 셀)
  if (col.cellSpssVarType) {
    return varTypeMap[col.cellSpssVarType] ?? VariableType.Numeric;
  }

  // 질문 단위 오버라이드
  if (question?.spssVarType) {
    return varTypeMap[question.spssVarType] ?? VariableType.Numeric;
  }

  // 자동 판단
  switch (col.type) {
    case 'single':
    case 'checkbox-item':
    case 'notice-agree':
    case 'ranking-rank':
    case 'radio-group':
      return VariableType.Numeric;

    case 'text':
    case 'other-text':
    case 'ranking-other':
    case 'multiselect':
    case 'notice-date':
      return VariableType.String;

    case 'table-cell':
      return col.tableCellType === 'input' ? VariableType.String : VariableType.Numeric;

    default:
      return VariableType.String;
  }
}

/**
 * 측정 수준 결정 (셀 단위 오버라이드 → 질문 단위 오버라이드 → 기본 Nominal)
 */
function resolveMeasure(col: SPSSExportColumn, question: Question | undefined): VariableMeasure {
  const measureMap: Record<string, VariableMeasure> = {
    Nominal: VariableMeasure.Nominal,
    Ordinal: VariableMeasure.Ordinal,
    Continuous: VariableMeasure.Continuous,
  };

  // 셀 단위 오버라이드
  if (col.cellSpssMeasure) {
    return measureMap[col.cellSpssMeasure] ?? VariableMeasure.Nominal;
  }

  // 질문 단위 오버라이드
  if (question?.spssMeasure) {
    return measureMap[question.spssMeasure] ?? VariableMeasure.Nominal;
  }

  // ranking 순위 변수는 Ordinal (Kendall's W 등 순위통계 지원)
  if (col.type === 'ranking-rank') {
    return VariableMeasure.Ordinal;
  }

  // radio-group (Likert 등 매트릭스 단일선택) 디폴트 Ordinal — Continuous로 보고 싶으면 셀에서 명시
  if (col.type === 'radio-group') {
    return VariableMeasure.Ordinal;
  }

  return VariableMeasure.Nominal;
}

// ── 라벨 생성 ──

/**
 * 변수 라벨 생성
 */
function buildLabel(col: SPSSExportColumn): string {
  switch (col.type) {
    case 'checkbox-item':
      return `${col.questionText} - ${col.optionLabel}`;
    case 'other-text':
      return `${col.questionText} - 기타 입력`;
    case 'notice-agree':
      return `${col.questionText} - 동의 여부`;
    case 'notice-date':
      return `${col.questionText} - 동의 일시`;
    case 'ranking-rank':
      return `${col.questionText} (${col.rankIndex}순위)`;
    case 'ranking-other':
      return `${col.questionText} - ${col.rankIndex}순위 기타 입력`;
    case 'table-cell':
      return col.optionLabel
        ? `${col.questionText} - ${col.optionLabel}`
        : col.questionText;
    case 'radio-group':
      return col.optionLabel
        ? `${col.questionText} - ${col.optionLabel}`
        : col.questionText;
    default:
      return col.questionText;
  }
}

/**
 * 값 라벨 생성
 */
function buildValueLabels(
  col: SPSSExportColumn,
  question: Question | undefined,
): Array<{ label: string; value: string | number }> | undefined {
  switch (col.type) {
    case 'single':
    case 'ranking-rank': {
      if (!question?.options) return undefined;
      return question.options.map((opt, i) => ({
        value: opt.spssNumericCode ?? i + 1,
        label: opt.label,
      }));
    }

    case 'checkbox-item': {
      const code = question?.options?.[col.optionIndex ?? 0]?.spssNumericCode
        ?? (col.optionIndex ?? 0) + 1;
      return [{ value: code, label: '선택' }];
    }

    case 'notice-agree':
      return [{ value: 1, label: '동의' }];

    case 'radio-group': {
      // radio-group: generateSPSSColumns가 미리 계산한 valueLabels를 그대로 사용
      if (!col.radioGroupValueLabels) return undefined;
      return Object.entries(col.radioGroupValueLabels).map(([value, label]) => ({
        value: Number(value),
        label,
      }));
    }

    case 'table-cell': {
      if (col.tableCellType === 'input') return undefined;

      // checkbox 옵션별 분리: 해당 옵션의 코드만
      if (col.tableCellType === 'checkbox' && col.optionIndex != null) {
        const cellOpts = findTableCellOptions(question, col.tableCellId, 'checkbox');
        const code = cellOpts?.[col.optionIndex]?.spssNumericCode ?? col.optionIndex + 1;
        return [{ value: code, label: '선택' }];
      }

      // radio/select: 셀의 옵션들
      const cellOpts = findTableCellOptions(question, col.tableCellId, col.tableCellType || '');
      if (!cellOpts || cellOpts.length === 0) return undefined;
      return cellOpts.map((opt, i) => ({
        value: opt.spssNumericCode ?? i + 1,
        label: opt.label,
      }));
    }

    default:
      return undefined;
  }
}

/**
 * 테이블 셀의 옵션을 역참조
 */
function findTableCellOptions(
  question: Question | undefined,
  cellId: string | undefined,
  cellType: string,
) {
  if (!question?.tableRowsData || !cellId) return undefined;
  for (const row of question.tableRowsData) {
    for (const cell of row.cells) {
      if (cell.id === cellId) {
        if (cellType === 'radio') return cell.radioOptions;
        if (cellType === 'select') return cell.selectOptions;
        if (cellType === 'checkbox') return cell.checkboxOptions;
      }
    }
  }
  return undefined;
}

// ── SPSS 변수명 sanitize ──

/**
 * SPSS 변수명 규격에 맞게 정리
 * - 영문/숫자/언더스코어만 허용
 * - 영문자 또는 @로 시작해야 함
 * - 최대 64자
 */
function sanitizeSpssVarName(name: string): string {
  // 비 ASCII 문자(한국어 등)를 제거하고, 허용되지 않는 문자를 언더스코어로 대체
  let sanitized = name.replace(/[^a-zA-Z0-9_@$.#]/g, '_');
  // 연속 언더스코어 정리
  sanitized = sanitized.replace(/_+/g, '_').replace(/^_|_$/g, '');
  // 숫자로 시작하면 V 접두사 추가
  if (/^[0-9]/.test(sanitized)) {
    sanitized = `V${sanitized}`;
  }
  // 빈 문자열 방지
  if (!sanitized) {
    sanitized = 'VAR';
  }
  return sanitized.slice(0, 64);
}

// ── Short name 생성 ──

/**
 * 8자 이하 short name 생성 (중복 방지)
 */
function generateShortNames(varNames: string[]): string[] {
  const usedShorts = new Set<string>();
  return varNames.map((name) => {
    if (name.length <= 8) {
      usedShorts.add(name);
      return name;
    }
    // 앞 6자 + 숫자 suffix
    const base = name.slice(0, 6);
    let suffix = 1;
    let candidate = `${base}${suffix}`;
    while (usedShorts.has(candidate)) {
      suffix++;
      // suffix가 커지면 base 길이 줄이기
      const maxBase = 8 - String(suffix).length;
      candidate = `${name.slice(0, maxBase)}${suffix}`;
    }
    usedShorts.add(candidate);
    return candidate;
  });
}

// ── String width 계산 ──

/**
 * 각 열의 최대 문자열 바이트 길이를 계산 (8바이트 배수 올림)
 */
function computeMaxStringWidths(
  columns: SPSSExportColumn[],
  dataRows: (string | number | null)[][],
  questionMap: Map<string, Question>,
): number[] {
  return columns.map((col, colIdx) => {
    const varType = resolveVarType(col, questionMap.get(col.questionId));
    if (varType !== VariableType.String) return 0;

    let max = 0;
    for (const row of dataRows) {
      const val = row[colIdx];
      if (typeof val === 'string') {
        max = Math.max(max, Buffer.byteLength(val, 'utf-8'));
      }
    }

    if (max === 0) return DEFAULT_STRING_WIDTH;
    // 8바이트 배수로 올림
    return Math.max(Math.ceil(max / 8) * 8, MIN_STRING_WIDTH);
  });
}

// ── SavVariable 변환 ──

/**
 * SPSSExportColumn → SavVariable 변환
 */
function toSavVariable(
  col: SPSSExportColumn,
  question: Question | undefined,
  maxWidth: number,
  shortName: string,
): SavVariable {
  const varType = resolveVarType(col, question);
  const isNumeric = varType === VariableType.Numeric
    || varType === VariableType.Date
    || varType === VariableType.DateTime;

  return {
    name: sanitizeSpssVarName(col.spssVarName),
    short: sanitizeSpssVarName(shortName),
    label: buildLabel(col),
    type: varType,
    width: isNumeric ? 0 : maxWidth,
    decimal: 0,
    alignment: VariableAlignment.Centre,
    measure: resolveMeasure(col, question),
    columns: isNumeric ? 8 : Math.min(maxWidth, 32),
    valueLabels: buildValueLabels(col, question),
  };
}

// ── Records 변환 ──

/**
 * 2차원 배열 → sav-writer records 변환
 */
function buildSavRecords(
  columns: SPSSExportColumn[],
  dataRows: (string | number | null)[][],
): Array<{ [key: string]: unknown }> {
  return dataRows.map((row) => {
    const record: { [key: string]: unknown } = {};
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      let val = row[i];

      // notice-agree: '동의' → 1 (Numeric 타입)
      if (col.type === 'notice-agree' && val === '동의') {
        val = 1;
      }

      // null → undefined (sav-writer에서 system-missing 처리)
      record[col.spssVarName] = val ?? undefined;
    }
    return record;
  });
}

// ── 메인 함수 ──

/**
 * SPSS .sav 파일을 Buffer로 생성한다.
 * createStream을 사용하여 배치 단위로 쓰기 (메모리 절약)
 */
export async function generateSavBuffer(
  questions: Question[],
  submissions: SurveySubmission[],
): Promise<Buffer> {
  const columns = generateSPSSColumns(questions);
  const dataRows = buildDataRows(columns, questions, submissions);

  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const maxWidths = computeMaxStringWidths(columns, dataRows, questionMap);

  // short name 생성
  const shortNames = generateShortNames(columns.map((c) => c.spssVarName));

  // SavVariable[] 생성
  const variables = columns.map((col, i) =>
    toSavVariable(col, questionMap.get(col.questionId), maxWidths[i], shortNames[i]),
  );

  const tmpPath = join(tmpdir(), `sav_${randomUUID()}.sav`);

  try {
    const stream = createStream({
      variables,
      length: dataRows.length,
      path: tmpPath,
    });

    // 배치 단위로 나눠서 쓰기
    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      const records = buildSavRecords(columns, batch);
      stream.write(records);
    }

    // 데이터가 없어도 stream.end()는 호출해야 파일이 완성됨
    await stream.end();

    return await readFile(tmpPath);
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}
