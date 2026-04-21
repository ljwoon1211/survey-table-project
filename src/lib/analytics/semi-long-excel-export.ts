/**
 * Semi-Long Excel Export — 데이터 클리닝용 엑셀 내보내기
 *
 * 테이블 문항의 식별자 셀(text)은 행으로, 측정 셀(input 등)은 열로 유지하는
 * Semi-Long 형식으로 변환한다. 사람이 이상치 탐지 및 데이터 클리닝하기 위한 용도.
 *
 * 이 파일은 워크북 생성 오케스트레이터로,
 * 개별 시트 생성/데이터 변환은 cleaning-export-*.ts 모듈에 위임한다.
 */
import ExcelJS from 'exceljs';

import type { Question, Survey } from '@/types/survey';

import type { ResponseData } from './response-data';

import type { CleaningExportOptions, ProgressCallback, SemiLongRow } from './cleaning-export-types';
import {
  DEPTH_SPLIT_ROW_THRESHOLD,
  TAB_COLOR_SEMI_LONG_DEPTH,
  XLSM_MIME,
  XLSX_MIME,
} from './cleaning-export-types';

import {
  buildSemiLongRows,
  classifyTableCells,
  expandMeasurements,
  isNonDataDepth1,
  shouldUseSemiLong,
} from './cleaning-export-format';

import {
  buildGeneralQuestionsSheet,
  buildIndexSheet,
  buildSemiLongSheet,
  buildWideTableSheet,
} from './cleaning-export-sheet';

import { fetchMacroTemplate, injectVbaProject } from './macro-injection';

// ============================================================
// Helpers
// ============================================================

function extractQuestionNumber(title: string): string | null {
  const match = title.match(/^(Q[\d]+[-_ ][\d]+(?:[-_ ][\d]+)*|Q[\d]+)/i);
  return match ? match[1].toUpperCase().replace(/[-\s]/g, '_') : null;
}

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

/**
 * SemiLongRow[]를 depth1Value별로 분리한다.
 * - 출현 순서 보존, 동일 depth1이 비연속 출현하면 하나의 그룹으로 합침
 * - non-data depth1 행([전체 미응답], [미노출] 등)은 모든 그룹에 복제
 */
function splitByDepth1(
  dataRows: SemiLongRow[],
): { depth1Value: string; rows: SemiLongRow[] }[] {
  const isReplicateTarget = (d: string) => isNonDataDepth1(d) || d === '';

  // 1) 고유 depth1 값 수집 (출현 순서, non-data 제외)
  const depth1Order: string[] = [];
  const depth1Set = new Set<string>();
  for (const row of dataRows) {
    if (!isReplicateTarget(row.depth1Value) && !depth1Set.has(row.depth1Value)) {
      depth1Set.add(row.depth1Value);
      depth1Order.push(row.depth1Value);
    }
  }

  // 2) 그룹별 버킷 초기화
  const buckets = new Map<string, SemiLongRow[]>();
  for (const d of depth1Order) buckets.set(d, []);

  // 3) 행 분배 — non-data 행은 모든 버킷에 복제
  for (const row of dataRows) {
    if (isReplicateTarget(row.depth1Value)) {
      for (const bucket of buckets.values()) {
        bucket.push(row);
      }
    } else {
      buckets.get(row.depth1Value)?.push(row);
    }
  }

  return depth1Order.map((d) => ({ depth1Value: d, rows: buckets.get(d)! }));
}

/**
 * 대형 테이블의 depth-1 고유 값 수를 미리 계산한다 (progress 보정용).
 */
function countDepth1SplitSheets(question: Question): number {
  const rows = question.tableRowsData ?? [];
  if (rows.length <= DEPTH_SPLIT_ROW_THRESHOLD) return 1;

  const cols = question.tableColumns ?? [];
  const classified = classifyTableCells(rows, cols);

  // shouldUseSemiLong이 false면 wide 시트 1개
  if (!shouldUseSemiLong(rows, classified.measurements, classified.identifiers)) return 1;
  if (classified.identifiers.length === 0) return 1;

  const firstIdColIdx = classified.identifiers[0].colIndex;
  const uniqueDepth1 = new Set<string>();
  for (const row of rows) {
    const cell = row.cells[firstIdColIdx];
    if (cell) {
      const val = cell.content ?? '';
      if (val) uniqueDepth1.add(val);
    }
  }
  return uniqueDepth1.size > 1 ? uniqueDepth1.size : 1;
}

// ============================================================
// Workbook Generation
// ============================================================

/**
 * semi-long 시트를 생성한다.
 * 행이 100개 초과 + depth-1이 2개 이상이면 depth-1별 시트 분리 (주황 탭),
 * 그렇지 않으면 단일 시트 (파랑 탭).
 */
function emitSemiLongSheets(
  ctx: {
    workbook: ExcelJS.Workbook;
    sheetNames: Set<string>;
    onProgress?: ProgressCallback;
    currentSheet: number;
    totalSheets: number;
  },
  question: Question,
  classified: ReturnType<typeof classifyTableCells>,
  expanded: ReturnType<typeof expandMeasurements>,
  dataRows: SemiLongRow[],
  baseLabel: string,
  tableRowCount: number,
): number {
  const depth1Groups = splitByDepth1(dataRows);

  if (tableRowCount > DEPTH_SPLIT_ROW_THRESHOLD && depth1Groups.length > 1) {
    for (let i = 0; i < depth1Groups.length; i++) {
      const { depth1Value, rows } = depth1Groups[i];
      const label = `${baseLabel}-${depth1Value}`;
      ctx.onProgress?.(++ctx.currentSheet, ctx.totalSheets, label);
      buildSemiLongSheet(
        ctx.workbook, question, classified, expanded, rows, ctx.sheetNames, label,
        { tabColor: TAB_COLOR_SEMI_LONG_DEPTH, titleSuffix: depth1Value },
      );
    }
  } else {
    ctx.onProgress?.(++ctx.currentSheet, ctx.totalSheets, baseLabel);
    buildSemiLongSheet(
      ctx.workbook, question, classified, expanded, dataRows, ctx.sheetNames, baseLabel,
    );
  }

  return ctx.currentSheet;
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

  // progress 보정: depth-1 분리 대상은 시트 수가 늘어남
  let totalSheets = 2; // 응답자목록 + 일반문항
  for (const group of tableGroups) {
    totalSheets += countDepth1SplitSheets(group.questions[0]);
  }

  const ctx = {
    workbook,
    sheetNames,
    onProgress,
    currentSheet: 0,
    totalSheets,
  };

  // 1. 응답자목록
  onProgress?.(++ctx.currentSheet, totalSheets, '응답자목록');
  buildIndexSheet(workbook, responses, sheetNames);

  // 2. 일반문항
  onProgress?.(++ctx.currentSheet, totalSheets, '일반문항');
  buildGeneralQuestionsSheet(workbook, survey, responses, sheetNames);

  // 3. 테이블 문항
  for (const group of tableGroups) {
    const firstQ = group.questions[0];
    const rows = firstQ.tableRowsData ?? [];
    const cols = firstQ.tableColumns ?? [];
    const classified = classifyTableCells(rows, cols);

    if (!shouldUseSemiLong(rows, classified.measurements, classified.identifiers)) {
      onProgress?.(++ctx.currentSheet, totalSheets, group.label);
      for (const q of group.questions) {
        buildWideTableSheet(workbook, q, responses, survey.questions, sheetNames, allGroups);
      }
      continue;
    }

    const expanded = expandMeasurements(classified.measurements, cols, rows.length > 0 ? rows : undefined);

    if (group.questions.length > 1) {
      const perQuestionRows = group.questions.map((q) => {
        const qClassified = classifyTableCells(q.tableRowsData ?? [], q.tableColumns ?? []);
        const qExpanded = expandMeasurements(qClassified.measurements, q.tableColumns ?? [], q.tableRowsData ?? undefined);
        return buildSemiLongRows(q, responses, qClassified, qExpanded, survey.questions, allGroups);
      });
      const mergedRows = interleaveByResponse(perQuestionRows, responses);
      emitSemiLongSheets(ctx, firstQ, classified, expanded, mergedRows, group.label, rows.length);
    } else {
      const dataRows = buildSemiLongRows(firstQ, responses, classified, expanded, survey.questions, allGroups);
      const baseLabel = firstQ.questionCode ?? extractQuestionNumber(firstQ.title) ?? firstQ.title.slice(0, 20);
      emitSemiLongSheets(ctx, firstQ, classified, expanded, dataRows, baseLabel, rows.length);
    }
  }

  return workbook;
}

export async function generateCleaningExcelBlob(
  survey: Survey,
  responses: ResponseData[],
  onProgress?: ProgressCallback,
  options?: CleaningExportOptions,
): Promise<Blob> {
  const wantsMacro = options?.includeMacroSync !== false;
  const templateBuffer = wantsMacro ? await fetchMacroTemplate() : undefined;

  const workbook = await generateCleaningWorkbook(survey, responses, onProgress);
  const xlsxBuffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

  if (!templateBuffer) {
    return new Blob([new Uint8Array(xlsxBuffer)], { type: XLSX_MIME });
  }

  try {
    const xlsmBuffer = await injectVbaProject(xlsxBuffer, templateBuffer);
    return new Blob([new Uint8Array(xlsmBuffer)], { type: XLSM_MIME });
  } catch (e) {
    console.warn('[macro] VBA 주입 실패 — xlsx로 폴백합니다:', e);
    return new Blob([new Uint8Array(xlsxBuffer)], { type: XLSX_MIME });
  }
}
