import * as XLSX from 'xlsx';

import { buildDataRows, generateSPSSColumns } from '@/lib/analytics/spss-excel-export';
import { Survey, SurveySubmission } from '@/types/survey';
import { getOtherOptionCode } from '@/utils/option-code-generator';

interface ExportOptions {
  includeRawData: boolean;
  includeSummary: boolean;
  includeVariableMap: boolean;
  includeVerbatim: boolean;
}

/**
 * 엑셀 워크북 생성 메인 함수 (Legacy - 호환성 유지용)
 */
export function generateExcelWorkbook(
  survey: Survey,
  responses: SurveySubmission[],
  options: ExportOptions,
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  // 1. Raw Data Sheet
  if (options.includeRawData) {
    const rawData = generateRawDataCombinedData(survey, responses);
    const ws = XLSX.utils.json_to_sheet(rawData);
    XLSX.utils.book_append_sheet(workbook, ws, 'Raw Data');
  }

  // 2. Summary Sheet
  if (options.includeSummary) {
    const summaryData = generateSummaryData(survey, responses);
    const ws = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, ws, 'Summary');
  }

  // 3. Variable Map Sheet
  if (options.includeVariableMap) {
    const mapData = generateVariableMap(survey);
    const ws = XLSX.utils.json_to_sheet(mapData);
    XLSX.utils.book_append_sheet(workbook, ws, 'Variable Map');
  }

  // 4. Verbatim Sheet
  if (options.includeVerbatim) {
    const verbatimData = generateVerbatimData(survey, responses);
    const ws = XLSX.utils.json_to_sheet(verbatimData);
    XLSX.utils.book_append_sheet(workbook, ws, 'Verbatim');
  }

  return workbook;
}

/**
 * 1. Raw Data (통합) 워크북 생성
 * 1행: 질문 label, 2행: SPSS 변수명, 3행~: 응답 데이터
 */
export function generateRawDataCombinedWorkbook(
  survey: Survey,
  responses: SurveySubmission[],
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  const questions = [...survey.questions].sort((a, b) => a.order - b.order);
  const columns = generateSPSSColumns(questions);
  const dataRows = buildDataRows(columns, questions, responses);

  // 메타데이터 컬럼 정의
  const metaLabels = ['Response ID', 'Started At', 'Completed At', 'Duration (sec)', 'Status', 'Device'];
  const metaVarNames = ['RES_ID', 'STARTED', 'COMPLETED', 'DURATION', 'STATUS', 'DEVICE'];

  // 1행: 메타 label + 질문 label
  const headerRow1 = [...metaLabels, ...columns.map((col) => col.questionText)];
  // 2행: 메타 빈칸 + 응답 라벨
  const headerRow2 = [...metaLabels.map(() => ''), ...columns.map((col) => col.optionLabel)];
  // 3행: 메타 변수명 + SPSS 변수명
  const headerRow3 = [...metaVarNames, ...columns.map((col) => col.spssVarName)];

  // 데이터 행: 메타데이터 + 응답 데이터
  const metaColCount = metaLabels.length;
  const fullDataRows = responses.map((res, idx) => {
    const startedAt = new Date(res.startedAt);
    const completedAt = res.completedAt ? new Date(res.completedAt) : null;
    const durationSeconds = completedAt
      ? Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)
      : null;

    const metaCols: (string | number | null)[] = [
      res.id,
      startedAt.toLocaleString('ko-KR'),
      completedAt ? completedAt.toLocaleString('ko-KR') : '미완료',
      durationSeconds,
      res.isCompleted ? 'Completed' : 'Partial',
      res.userAgent ? parseUserAgent(res.userAgent) : 'Unknown',
    ];

    return [...metaCols, ...dataRows[idx]];
  });

  const aoa: (string | number | null)[][] = [headerRow1, headerRow2, headerRow3, ...fullDataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // 동일 질문 텍스트 셀 병합 (메타 컬럼 오프셋 반영)
  const merges: XLSX.Range[] = [];
  let mergeStart = 0;
  for (let i = 1; i <= columns.length; i++) {
    if (
      i < columns.length &&
      columns[i].questionText === columns[mergeStart].questionText &&
      columns[i].questionId === columns[mergeStart].questionId
    ) {
      continue;
    }
    if (i - mergeStart > 1) {
      merges.push({
        s: { r: 0, c: mergeStart + metaColCount },
        e: { r: 0, c: i - 1 + metaColCount },
      });
    }
    mergeStart = i;
  }
  if (merges.length > 0) ws['!merges'] = merges;

  // 열 너비
  const metaWidths = metaLabels.map((l) => ({ wch: Math.max(l.length, 14) }));
  const questionWidths = columns.map((col) => ({
    wch: Math.max(col.spssVarName.length, 12),
  }));
  ws['!cols'] = [...metaWidths, ...questionWidths];

  XLSX.utils.book_append_sheet(workbook, ws, 'Raw Data');
  return workbook;
}

/**
 * 2. Raw Data (개별 시트) 워크북 생성
 */
export function generateRawDataIndividualWorkbook(
  survey: Survey,
  responses: SurveySubmission[],
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const sortedQuestions = [...survey.questions].sort((a, b) => a.order - b.order);

  responses.forEach((res, index) => {
    // 시트 이름 생성 (최대 31자 제한, 특수문자 제거)
    const sheetName = `Response_${index + 1}`.substring(0, 31);

    const rows: any[][] = [];

    // 2-1. 메타데이터
    const startedAt = new Date(res.startedAt);
    const completedAt = res.completedAt ? new Date(res.completedAt) : null;
    const durationSeconds = completedAt
      ? Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)
      : null;

    rows.push(['[응답자 정보]']);
    rows.push(['Response ID', res.id]);
    rows.push(['Status', res.isCompleted ? 'Completed' : 'Partial']);
    rows.push(['Started At', startedAt.toLocaleString('ko-KR')]);
    rows.push([
      'Completed At',
      completedAt ? completedAt.toLocaleString('ko-KR') : '미완료',
    ]);
    rows.push(['Duration', durationSeconds !== null ? `${durationSeconds}초` : '미완료']);
    rows.push(['Device', res.userAgent ? parseUserAgent(res.userAgent) : 'Unknown']);
    rows.push([]); // Spacer
    rows.push(['[응답 내용]']);
    rows.push([]); // Spacer

    // 2-2. 질문 답변 매핑
    sortedQuestions.forEach((q) => {
      // [수정] Notice 타입 제외
      if (q.type === 'notice') return;

      const answer = (res.questionResponses as any)?.[q.id];

      if (q.type === 'table' && q.tableRowsData && q.tableColumns) {
        // 테이블 질문: 2D 매트릭스 렌더링
        rows.push([`Q. ${q.title}`]);

        // 열 헤더 (빈칸 + 열 라벨들)
        const headerRow = [''].concat(q.tableColumns.map((c) => c.label));
        rows.push(headerRow);

        // 행 데이터
        q.tableRowsData.forEach((row) => {
          const cells = [row.label];
          q.tableColumns!.forEach((_col, colIndex) => {
            let val = '';
            const cell = row.cells[colIndex];

            if (cell && answer) {
              const rawVal = answer[cell.id];

              if (rawVal) {
                val = formatExcelCellValue(rawVal, cell);
              }
            }
            cells.push(val);
          });
          rows.push(cells);
        });

        rows.push([]); // Spacer
      } else if (q.type === 'multiselect' && q.selectLevels) {
        // [NEW] 다단계 선택
        rows.push([`Q. ${q.title}`]);
        q.selectLevels.forEach((level) => {
          const answerObj = answer as Record<string, string>;
          const rawVal = answerObj?.[level.id];
          let val = '';
          if (rawVal) {
            const opt = level.options.find((o) => o.value === rawVal);
            val = opt ? opt.label : rawVal;
          }
          rows.push([`  - ${level.label}`, val || '']);
        });
        rows.push([]); // Spacer
      } else {
        // 일반 질문
        const displayValue = formatExcelCellValue(answer, q);
        rows.push([`Q. ${q.title}`, displayValue]);
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // 컬럼 너비 설정 (대략적으로)
    const wscols = [
      { wch: 30 }, // A열 (질문/행라벨)
      { wch: 50 }, // B열 (답변/열라벨)
      { wch: 20 }, // C열...
      { wch: 20 },
    ];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  });

  return workbook;
}

/**
 * 3. Summary 워크북 생성
 */
export function generateSummaryWorkbook(
  survey: Survey,
  responses: SurveySubmission[],
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const summaryData = generateSummaryData(survey, responses);
  const ws = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, ws, 'Summary');
  return workbook;
}

/**
 * 4. Variable Map 워크북 생성
 */
export function generateVariableMapWorkbook(survey: Survey): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const mapData = generateVariableMap(survey);
  const ws = XLSX.utils.json_to_sheet(mapData);
  ws['!cols'] = [{ wch: 38 }, { wch: 14 }, { wch: 22 }, { wch: 40 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(workbook, ws, 'Variable Map');
  return workbook;
}

/**
 * Raw Data 생성 로직 (Internal)
 */
function generateRawDataCombinedData(survey: Survey, responses: SurveySubmission[]) {
  // 질문 목록 (순서대로)
  const sortedQuestions = [...survey.questions].sort((a, b) => a.order - b.order);

  return responses.map((res) => {
    // 1-1. 메타데이터
    const startedAt = new Date(res.startedAt);
    const completedAt = res.completedAt ? new Date(res.completedAt) : null;
    const durationSeconds = completedAt
      ? Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)
      : null;

    const row: Record<string, any> = {
      'Response ID': res.id,
      'Started At': startedAt.toLocaleString('ko-KR'),
      'Completed At': completedAt ? completedAt.toLocaleString('ko-KR') : '미완료',
      'Duration (sec)': durationSeconds ?? '',
      Status: res.isCompleted ? 'Completed' : 'Partial',
      Device: res.userAgent ? parseUserAgent(res.userAgent) : 'Unknown',
    };

    // 1-2. 질문 데이터 매핑
    sortedQuestions.forEach((q) => {
      // [수정] Notice 타입 제외
      if (q.type === 'notice') return;

      const answer = (res.questionResponses as any)?.[q.id];

      // 질문 데이터 매핑
      if (q.type === 'table') {
        // 테이블 질문 Flattening: [질문]_[행]_[열]
        if (q.tableRowsData && q.tableColumns) {
          q.tableRowsData.forEach((tRow) => {
            q.tableColumns!.forEach((tCol, colIndex) => {
              // 헤더 생성: 엑셀 라벨 > 셀 코드 > 기존 조합 순
              // [수정] 입력 불가능한 셀(text, image 등)은 건너뛰기
              const cell = tRow.cells[colIndex];
              if (!cell || !isCellInputable(cell)) return;

              let headerString = '';

              if (cell && cell.exportLabel) {
                headerString = cell.exportLabel;
              } else if (cell && cell.cellCode) {
                headerString = cell.cellCode;
              } else {
                headerString = `${q.title}_${tRow.label}_${tCol.label}`;
              }

              const header = sanitize(headerString);

              // 해당 위치의 셀 찾기 (columns 순서와 cells 순서가 일치한다고 가정)
              // (cell은 위에서 이미 정의됨)

              let value = '';

              if (cell && answer) {
                const rawVal = answer[cell.id];

                if (rawVal) {
                  value = formatExcelCellValue(rawVal, cell);
                }
              }

              row[header] = value;
            });
          });
        }
      } else if (q.type === 'multiselect' && q.selectLevels) {
        // [NEW] 다단계 선택 (MultiSelect) Flattening: [질문] - [단계]
        q.selectLevels.forEach((level) => {
          const header = sanitize(`${q.title} - ${level.label}`);
          const answerObj = answer as Record<string, string>;
          const rawVal = answerObj?.[level.id];

          let val = '';
          if (rawVal) {
            const opt = level.options.find((o) => o.value === rawVal);
            val = opt ? opt.label : rawVal;
          }
          row[header] = val;
        });
      } else {
        // 일반 질문
        const header = sanitize(q.title);
        // 포맷팅 헬퍼 사용
        row[header] = formatExcelCellValue(answer, q);
      }
    });

    return row;
  });
}

/**
 * 2. Summary 데이터 생성
 */
function generateSummaryData(survey: Survey, responses: SurveySubmission[]) {
  const summary: any[] = [];
  const totalResponses = responses.length;

  [...survey.questions]
    .sort((a, b) => a.order - b.order)
    .forEach((q) => {
      // [수정] Notice 타입 제외
      if (q.type === 'notice') return;

      // 질문 헤더
      summary.push({
        구분: `[${q.type}] ${q.title}`,
        '응답 수': '',
        '비율(%)': '',
      });

      if (q.type === 'table' && q.tableRowsData && q.tableColumns) {
        // 테이블형 통계
        q.tableRowsData.forEach((row) => {
          q.tableColumns!.forEach((col, colIndex) => {
            const cell = row.cells[colIndex];

            // [수정] 입력 불가능한 셀 제외
            if (!cell || !isCellInputable(cell)) return;

            // 해당 셀에 데이터가 있는 응답 수 계산
            const count = responses.filter((r) => {
              const ans = (r.questionResponses as any)?.[q.id];
              const val = ans && ans[cell.id];

              if (!val) return false;
              if (Array.isArray(val)) return val.length > 0; // Checkbox empty array check
              if (typeof val === 'string') return val.trim().length > 0; // Empty string check
              return true; // Numbers, booleans
            }).length;

            summary.push({
              구분: `  - ${row.label} > ${col.label}`,
              '응답 수': count,
              '비율(%)': (totalResponses > 0 ? (count / totalResponses) * 100 : 0).toFixed(1) + '%',
            });
          });
        });
      } else if (q.type === 'multiselect' && q.selectLevels) {
        // [NEW] 다단계 선택 통계
        q.selectLevels.forEach((level) => {
          summary.push({
            구분: `  [${level.label}]`,
            '응답 수': '',
            '비율(%)': '',
          });

          level.options.forEach((opt) => {
            const count = responses.filter((r) => {
              const ans = (r.questionResponses as any)?.[q.id];
              // ans는 { levelId: value } 형태
              return ans && ans[level.id] === opt.value;
            }).length;

            summary.push({
              구분: `    - ${opt.label}`,
              '응답 수': count,
              '비율(%)': (totalResponses > 0 ? (count / totalResponses) * 100 : 0).toFixed(1) + '%',
            });
          });
        });
      } else if (q.options) {
        // 객관식 통계
        q.options.forEach((opt) => {
          const count = responses.filter((r) => {
            const ans = (r.questionResponses as any)?.[q.id];
            if (Array.isArray(ans)) return ans.includes(opt.value); // Checkbox
            return ans === opt.value; // Radio/Select
          }).length;

          summary.push({
            구분: `  - ${opt.label}`,
            '응답 수': count,
            '비율(%)': (totalResponses > 0 ? (count / totalResponses) * 100 : 0).toFixed(1) + '%',
          });
        });
      }

      // 빈 줄 추가
      summary.push({});
    });

  return summary;
}

/**
 * 3. Variable Map 생성
 */
function generateVariableMap(survey: Survey) {
  const mapData: Record<string, string>[] = [];

  survey.questions
    .sort((a, b) => a.order - b.order)
    .forEach((q) => {
      // Notice 타입 제외 (requiresAcknowledgment 없는 경우)
      if (q.type === 'notice' && !q.requiresAcknowledgment) return;

      // 값 라벨 생성
      let valueLabels = '';
      if (q.type === 'notice' && q.requiresAcknowledgment) {
        valueLabels = '동의=확인함, 빈값=미확인';
      } else if ((q.type === 'radio' || q.type === 'select' || q.type === 'checkbox') && q.options) {
        valueLabels = q.options
          .map((o, i) => `${o.spssNumericCode ?? i + 1}=${o.label}`)
          .join(', ');
      }

      mapData.push({
        '질문 ID': q.id,
        '타입': q.type,
        'SPSS 변수명': q.questionCode || '',
        '질문 제목': q.title,
        '값 라벨': valueLabels,
      });

      // 옵션 행 (radio, select, checkbox)
      if (q.options && ['radio', 'select', 'checkbox'].includes(q.type)) {
        q.options.forEach((opt, i) => {
          mapData.push({
            '질문 ID': '',
            '타입': 'Option',
            'SPSS 변수명': q.type === 'checkbox' ? `${q.questionCode}_${opt.optionCode ?? String(i + 1)}` : '',
            '질문 제목': `  ${opt.spssNumericCode ?? i + 1}. ${opt.label}`,
            '값 라벨': `Value: ${opt.value}`,
          });
        });
        // 기타 옵션
        if (q.allowOtherOption) {
          mapData.push({
            '질문 ID': '',
            '타입': 'Other',
            'SPSS 변수명': `${q.questionCode}_${getOtherOptionCode(q.options)}_etc`,
            '질문 제목': '  기타 입력',
            '값 라벨': '(기타 텍스트)',
          });
        }
      }

      // 테이블 질문
      if (q.type === 'table' && q.tableRowsData && q.tableColumns) {
        q.tableRowsData.forEach((row) => {
          q.tableColumns!.forEach((col, colIndex) => {
            const cell = row.cells[colIndex];
            if (!cell || !isCellInputable(cell)) return;
            // 셀코드가 의도적으로 비어있으면 내보내기에서 제외 (표시용 셀)
            if (cell.isCustomCellCode === true && !cell.cellCode) return;

            const varName = cell.cellCode || cell.exportLabel
              || `${q.questionCode}_${row.rowCode || row.label}_${col.columnCode || col.label}`;

            let cellValueLabels = '';
            if (cell.type === 'checkbox') {
              cellValueLabels = '1=선택, 빈값=미선택';
            } else {
              const opts = cell.radioOptions || cell.selectOptions;
              if (opts && opts.length > 0) {
                cellValueLabels = opts.map((o, i) => `${o.spssNumericCode ?? i + 1}=${o.label}`).join(', ');
              }
            }

            mapData.push({
              '질문 ID': '',
              '타입': `Table (${cell.type})`,
              'SPSS 변수명': varName,
              '질문 제목': `  ${row.label} - ${col.label}`,
              '값 라벨': cellValueLabels || `(${cell.type})`,
            });
          });
        });
      }

      // 다단계 선택
      if (q.type === 'multiselect' && q.selectLevels) {
        q.selectLevels.forEach((level) => {
          mapData.push({
            '질문 ID': '',
            '타입': 'Select Level',
            'SPSS 변수명': '',
            '질문 제목': `  [Level] ${level.label}`,
            '값 라벨': level.options.map((o) => o.label).join(', '),
          });
        });
      }
    });

  return mapData;
}

/**
 * 4. Verbatim (주관식) 생성
 */
function generateVerbatimData(survey: Survey, responses: SurveySubmission[]) {
  const verbatim: any[] = [];

  // 주관식 질문만 필터링 (text, textarea)
  const textQuestions = survey.questions.filter(
    (q) => q.type === 'text' || q.type === 'textarea' || q.type === 'table', // 테이블 내 input도 포함 가능
  );

  responses.forEach((res) => {
    textQuestions.forEach((q) => {
      // [수정] notice 제외 (위 필터에서 이미 제외됨)

      if (q.type === 'table') {
        // 테이블 내 텍스트/입력 셀 찾기
        q.tableRowsData?.forEach((row) => {
          q.tableColumns?.forEach((col, colIndex) => {
            const cell = row.cells[colIndex];
            // [수정] 테이블 내에서는 input(텍스트) 타입만 주관식으로 처리
            if (!cell || cell.type !== 'input') return;

            const ans = (res.questionResponses as any)?.[q.id];
            const val = ans?.[cell.id];

            if (val) {
              verbatim.push({
                'Response ID': res.id,
                Question: `${q.title} [${row.label}-${col.label}]`,
                Answer: val,
              });
            }
          });
        });
      } else {
        const val = (res.questionResponses as any)?.[q.id];
        if (val) {
          verbatim.push({
            'Response ID': res.id,
            Question: q.title,
            Answer: val,
          });
        }
      }
    });
  });

  return verbatim;
}

// --- Helpers ---

// [NEW] 입력 가능한 셀인지 확인하는 헬퍼 함수
function isCellInputable(cell: any): boolean {
  return ['checkbox', 'radio', 'select', 'input'].includes(cell.type);
}

function sanitize(str: string) {
  // 엑셀 헤더로 쓸 수 없는 문자나 너무 긴 공백 제거
  return str
    .replace(/[\r\n]+/g, ' ')
}

function parseUserAgent(ua: string) {
  if (ua.includes('Mobile')) return 'Mobile';
  if (ua.includes('Windows')) return 'PC (Windows)';
  if (ua.includes('Macintosh')) return 'PC (Mac)';
  if (ua.includes('Linux')) return 'PC (Linux)';
  return 'PC (Other)';
}

// [NEW] 엑셀 값 포맷팅 헬퍼 (기타 응답 및 옵션 라벨 처리)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatExcelCellValue(value: any, context?: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  // 배열 (Checkbox 등)
  if (Array.isArray(value)) {
    return value.map((v) => formatExcelCellValue(v, context)).join(', ');
  }

  // 객체 (기타 응답 등)
  if (typeof value === 'object') {
    // 1. 기타(Other) 응답 처리: { hasOther: true, selectedValue: ..., otherValue: ... }
    if (value.hasOther === true) {
      const selected = String(value.selectedValue || '');
      const input = String(value.otherValue || '').trim();

      // 라벨 매핑 시도
      let label = selected;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options = context?.options || context?.radioOptions || context?.selectOptions || context?.checkboxOptions;
      if (options) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const opt = options.find((o: any) => o.value === selected);
        if (opt) label = opt.label;
      }

      return input ? `${label} (${input})` : label;
    }

    // 2. 일반 값 매핑 시도 (혹시 객체로 들어온 경우)
    if (value.value !== undefined) return String(value.value);

    return JSON.stringify(value);
  }

  // 기본 라벨 매핑 (값 -> 라벨)
  if (context) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = context.options || context.radioOptions || context.selectOptions || context.checkboxOptions;
    if (options && typeof value === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opt = options.find((o: any) => o.value === value);
      if (opt) return opt.label;
    }
  }

  return String(value);
}
