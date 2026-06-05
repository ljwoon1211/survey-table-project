import ExcelJS from 'exceljs';

import { buildCodebookValueLabel, formatExcelDateTime } from '@/lib/analytics/raw-export-helpers';
import { bucketQuestions, planSplit } from '@/lib/analytics/split-export';
import { buildDataRow, generateSPSSColumns } from '@/lib/analytics/spss-excel-export';
import { type Platform, formatPlatformKo } from '@/lib/operations/parse-ua';
import { formatTotalTime, mapStatusPill } from '@/lib/operations/profiles';
import { Question, SurveySubmission } from '@/types/survey';

import {
  type RawExportResponseRow,
  type RawIdentifierMode,
  autoFitRawColumns,
  clampRawWidth,
  estimateTextWidth,
  row2Label,
  styleHeaderRows,
} from './raw-workbook';

/** 분할 내보내기 워크북: 응답내역 + 공통 + 옵션별 + 코딩북 (열만 분할, 행 전체 공통) */
export function buildSplitWorkbook(
  questions: Question[],
  rows: RawExportResponseRow[],
  basisQuestionId: string,
  identifierMode: RawIdentifierMode,
): ExcelJS.Workbook {
  const idHeader = identifierMode === 'systemId' ? 'systemID' : '순번';
  const idValue = (row: RawExportResponseRow, idx: number): string | number =>
    identifierMode === 'systemId' ? (row.resid ?? '') : idx + 1;

  const sortedQuestions = [...questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const questionMap = new Map(sortedQuestions.map((q) => [q.id, q]));

  // planSplit이 assignSplitSheetNames 적용 후 최종 시트명을 s.name에 보관한다.
  // buildSplitWorkbook은 plan.sheets를 그대로 따라 옵션 시트를 생성해 이름 일관성을 보장한다.
  const plan = planSplit(sortedQuestions, basisQuestionId);

  const workbook = new ExcelJS.Workbook();

  // 변수 시트(공통/옵션) — bucketQuestions 결과로 헤더 3행 + 전체 응답자 데이터
  // 옵션 시트명 유일성은 assignSplitSheetNames(reserved 시드 포함)가 보장하므로 중복 방어 불필요.
  const addVariableSheet = (name: string, bucketQs: Question[]) => {
    const columns = generateSPSSColumns(bucketQs);
    const ws = workbook.addWorksheet(name);
    const colCount = columns.length + 1;
    ws.addRow([idHeader, ...columns.map((c) => c.questionText)]);
    ws.addRow(['', ...columns.map((c) => row2Label(c))]);
    ws.addRow(['', ...columns.map((c) => c.spssVarName)]);
    // 데이터는 전체 응답자 + 이 버킷 컬럼만 (열만 분할)
    rows.forEach((row, i) => {
      ws.addRow([
        idValue(row, i),
        ...buildDataRow(columns, questionMap, row as unknown as SurveySubmission),
      ]);
    });

    styleHeaderRows(ws, [1, 2, 3], colCount);
    ws.mergeCells(1, 1, 3, 1);
    let start = 0;
    while (start < columns.length) {
      let end = start;
      while (end + 1 < columns.length && columns[end + 1]?.questionId === columns[start]?.questionId)
        end++;
      if (end > start) ws.mergeCells(1, start + 2, 1, end + 2);
      start = end + 1;
    }
    ws.getColumn(1).width = clampRawWidth(estimateTextWidth(idHeader));
    columns.forEach((c, i) => {
      ws.getColumn(i + 2).width = clampRawWidth(estimateTextWidth(row2Label(c)));
    });
  };

  // 시트 1: 응답 내역 (전체 응답자) — 고정 이름
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
      formatExcelDateTime(row.completedAt),
      formatTotalTime(row.totalSeconds, row.status),
    ]);
  });
  styleHeaderRows(ws1, [1], 8);
  autoFitRawColumns(ws1, 8);

  // 시트 2: 공통 — 고정 이름
  addVariableSheet('공통', bucketQuestions(sortedQuestions, basisQuestionId, 'common'));

  // 시트 3..N: 옵션별 — plan.sheets 순서와 이름을 그대로 사용 (BY CONSTRUCTION 일치)
  for (const s of plan.sheets) {
    addVariableSheet(s.name, bucketQuestions(sortedQuestions, basisQuestionId, s.token));
  }

  // 마지막 시트: 코딩북 (전체 변수) — 고정 이름
  const allColumns = generateSPSSColumns(sortedQuestions);
  const wsCb = workbook.addWorksheet('코딩북');
  wsCb.addRow(['변수번호', 'SPSS 변수명', '질문 제목', '셀라벨', '값 라벨']);
  allColumns.forEach((c, i) => {
    wsCb.addRow([
      i + 1,
      c.spssVarName,
      c.questionText,
      c.cellExportLabel ?? '',
      buildCodebookValueLabel(c, questionMap),
    ]);
  });
  styleHeaderRows(wsCb, [1], 5);
  autoFitRawColumns(wsCb, 5);

  return workbook;
}
