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

import type { ResponseData } from './flat-excel-export';

import type { ProgressCallback, SemiLongRow } from './cleaning-export-types';
export type { ProgressCallback } from './cleaning-export-types';

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

// ============================================================
// Workbook Generation
// ============================================================

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
      const firstQ = group.questions[0];
      const classified = classifyTableCells(firstQ.tableRowsData ?? [], firstQ.tableColumns ?? []);

      if (shouldUseSemiLong(firstQ.tableRowsData ?? [], classified.measurements, classified.identifiers)) {
        const expanded = expandMeasurements(classified.measurements, firstQ.tableColumns ?? [], firstQ.tableRowsData ?? undefined);
        const perQuestionRows = group.questions.map((q) => {
          const qClassified = classifyTableCells(q.tableRowsData ?? [], q.tableColumns ?? []);
          const qExpanded = expandMeasurements(qClassified.measurements, q.tableColumns ?? [], q.tableRowsData ?? undefined);
          return buildSemiLongRows(q, responses, qClassified, qExpanded, survey.questions, allGroups);
        });
        const mergedRows = interleaveByResponse(perQuestionRows, responses);
        buildSemiLongSheet(workbook, firstQ, classified, expanded, mergedRows, sheetNames, group.label);
      } else {
        for (const q of group.questions) {
          buildWideTableSheet(workbook, q, responses, survey.questions, sheetNames, allGroups);
        }
      }
    } else {
      const q = group.questions[0];
      const classified = classifyTableCells(q.tableRowsData ?? [], q.tableColumns ?? []);

      if (shouldUseSemiLong(q.tableRowsData ?? [], classified.measurements, classified.identifiers)) {
        const expanded = expandMeasurements(classified.measurements, q.tableColumns ?? [], q.tableRowsData ?? undefined);
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
