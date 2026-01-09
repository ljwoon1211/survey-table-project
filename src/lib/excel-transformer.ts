import * as XLSX from 'xlsx';
import {
  Survey,
  Question,
  SurveyResponse,
  TableColumn,
  TableRow
} from '@/types/survey';

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
  responses: SurveyResponse[],
  options: ExportOptions
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
 */
export function generateRawDataCombinedWorkbook(survey: Survey, responses: SurveyResponse[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const rawData = generateRawDataCombinedData(survey, responses);
  const ws = XLSX.utils.json_to_sheet(rawData);
  XLSX.utils.book_append_sheet(workbook, ws, 'Raw Data');
  return workbook;
}

/**
 * 2. Raw Data (개별 시트) 워크북 생성
 */
export function generateRawDataIndividualWorkbook(survey: Survey, responses: SurveyResponse[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const sortedQuestions = survey.questions.sort((a, b) => a.order - b.order);

  responses.forEach((res, index) => {
    // 시트 이름 생성 (최대 31자 제한, 특수문자 제거)
    const sheetName = `Response_${index + 1}`.substring(0, 31);
    
    const rows: any[][] = [];
    
    // 2-1. 메타데이터
    const startedAt = new Date(res.startedAt);
    const completedAt = res.completedAt ? new Date(res.completedAt) : new Date();
    const durationSeconds = Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000);

    rows.push(['[응답자 정보]']);
    rows.push(['Response ID', res.id]);
    rows.push(['Status', res.isCompleted ? 'Completed' : 'Partial']);
    rows.push(['Started At', startedAt.toLocaleString()]);
    rows.push(['Completed At', res.completedAt ? new Date(res.completedAt).toLocaleString() : '미완료']);
    rows.push(['Duration', `${durationSeconds}초`]);
    rows.push(['Device', res.userAgent ? parseUserAgent(res.userAgent) : 'Unknown']);
    rows.push([]); // Spacer
    rows.push(['[응답 내용]']);
    rows.push([]); // Spacer

    // 2-2. 질문 답변 매핑
    sortedQuestions.forEach((q) => {
      const answer = (res.questionResponses as any)?.[q.id];

      if (q.type === 'table' && q.tableRowsData && q.tableColumns) {
        // 테이블 질문: 2D 매트릭스 렌더링
        rows.push([`Q. ${q.title}`]);
        
        // 열 헤더 (빈칸 + 열 라벨들)
        const headerRow = [''].concat(q.tableColumns.map(c => c.label));
        rows.push(headerRow);

        // 행 데이터
        q.tableRowsData.forEach(row => {
          const cells = [row.label];
          q.tableColumns!.forEach((col, colIndex) => {
            let val = '';
            const cell = row.cells[colIndex];
            
            if (cell && answer) {
              // 1. cell.id로 조회
              let rawVal = answer[cell.id];
              
              // 2. Fallback
              if (!rawVal && answer[row.id] && answer[row.id][col.id]) {
                rawVal = answer[row.id][col.id];
              }

              if (rawVal) {
                 // 값 변환 로직
                 if (cell.type === 'radio' && cell.radioOptions) {
                    const opt = cell.radioOptions.find(o => o.value === rawVal);
                    val = opt ? opt.label : rawVal;
                  } else if (cell.type === 'checkbox' && cell.checkboxOptions && Array.isArray(rawVal)) {
                     val = rawVal.map((v: string) => {
                       const opt = cell.checkboxOptions?.find(o => o.value === v);
                       return opt ? opt.label : v;
                     }).join(', ');
                  } else if (cell.type === 'select' && cell.selectOptions) {
                    const opt = cell.selectOptions.find(o => o.value === rawVal);
                    val = opt ? opt.label : rawVal;
                  } else {
                    val = String(rawVal);
                  }
              }
            }
            cells.push(val);
          });
          rows.push(cells);
        });
        
        rows.push([]); // Spacer

      } else {
        // 일반 질문
        let displayValue = '';
        
        if (Array.isArray(answer)) {
          displayValue = answer.join(', ');
        } else if (typeof answer === 'object' && answer !== null) {
          displayValue = JSON.stringify(answer);
        } else {
          displayValue = answer || '';
        }

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
export function generateSummaryWorkbook(survey: Survey, responses: SurveyResponse[]): XLSX.WorkBook {
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
  XLSX.utils.book_append_sheet(workbook, ws, 'Variable Map');
  return workbook;
}

/**
 * Raw Data 생성 로직 (Internal)
 */
function generateRawDataCombinedData(survey: Survey, responses: SurveyResponse[]) {
  // 질문 목록 (순서대로)
  const sortedQuestions = survey.questions.sort((a, b) => a.order - b.order);

  return responses.map((res) => {
    // 1-1. 메타데이터
    const startedAt = new Date(res.startedAt);
    const completedAt = res.completedAt ? new Date(res.completedAt) : new Date();
    const durationSeconds = Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000);

    const row: Record<string, any> = {
      'Response ID': res.id,
      'Started At': startedAt.toLocaleString(),
      'Completed At': res.completedAt ? new Date(res.completedAt).toLocaleString() : '미완료',
      'Duration (sec)': durationSeconds,
      'Status': res.isCompleted ? 'Completed' : 'Partial',
      'Device': res.userAgent ? parseUserAgent(res.userAgent) : 'Unknown',
    };

    // 1-2. 질문 데이터 매핑
    sortedQuestions.forEach((q) => {
      const answer = (res.questionResponses as any)?.[q.id];

      // 디버깅용 로그 (테이블 질문인 경우)
      if (q.type === 'table' && answer) {
        console.log(`[Export Debug] Table Q(${q.id}) Answer Keys:`, Object.keys(answer));
      }

      if (q.type === 'table') {
        // 테이블 질문 Flattening: [질문]_[행]_[열]
        if (q.tableRowsData && q.tableColumns) {
          q.tableRowsData.forEach((tRow) => {
            q.tableColumns!.forEach((tCol, colIndex) => {
              // 헤더 생성: 라벨 사용 + 특수문자 제거
              const header = `${sanitize(q.title)}_${sanitize(tRow.label)}_${sanitize(tCol.label)}`;

              // 해당 위치의 셀 찾기 (columns 순서와 cells 순서가 일치한다고 가정)
              const cell = tRow.cells[colIndex];
              let value = '';

              if (cell && answer) {
                // 1. cell.id로 직접 조회 (가장 정확)
                let rawVal = answer[cell.id];
                
                // 2. Fallback: 혹시 rowId > colId 구조로 저장된 경우 (구버전 데이터 등)
                if (!rawVal && answer[tRow.id] && answer[tRow.id][tCol.id]) {
                  rawVal = answer[tRow.id][tCol.id];
                }

                if (rawVal) {
                  // 값 변환 로직 (옵션 ID -> 라벨)
                  if (cell.type === 'radio' && cell.radioOptions) {
                    const opt = cell.radioOptions.find(o => o.value === rawVal);
                    value = opt ? opt.label : rawVal;
                  } else if (cell.type === 'checkbox' && cell.checkboxOptions && Array.isArray(rawVal)) {
                     value = rawVal.map((v: string) => {
                       const opt = cell.checkboxOptions?.find(o => o.value === v);
                       return opt ? opt.label : v;
                     }).join(', ');
                  } else if (cell.type === 'select' && cell.selectOptions) {
                    const opt = cell.selectOptions.find(o => o.value === rawVal);
                    value = opt ? opt.label : rawVal;
                  } else {
                    value = String(rawVal);
                  }
                }
              }
              
              row[header] = value;
            });
          });
        }
      } else {
        // 일반 질문
        const header = sanitize(q.title);

        if (Array.isArray(answer)) {
          // 복수 선택 (Checkbox) -> 콤마로 연결
          row[header] = answer.join(', ');
        } else if (typeof answer === 'object' && answer !== null) {
          // 기타 객체형일 경우 (안전장치)
          row[header] = JSON.stringify(answer);
        } else {
          // 단일 값 (Text, Radio, Select 등)
          row[header] = answer || '';
        }
      }
    });

    return row;
  });
}

/**
 * 2. Summary 데이터 생성
 */
function generateSummaryData(survey: Survey, responses: SurveyResponse[]) {
  const summary: any[] = [];
  const totalResponses = responses.length;

  survey.questions.sort((a, b) => a.order - b.order).forEach((q) => {
    // 질문 헤더
    summary.push({
      '구분': `[${q.type}] ${q.title}`,
      '응답 수': '',
      '비율(%)': ''
    });

    if (q.type === 'table' && q.tableRowsData && q.tableColumns) {
      // 테이블형 통계
      q.tableRowsData.forEach((row) => {
        q.tableColumns!.forEach((col, colIndex) => {
          const cell = row.cells[colIndex];
          
          if (!cell) return;

          // 해당 셀에 데이터가 있는 응답 수 계산
          const count = responses.filter(r => {
            const ans = (r.questionResponses as any)?.[q.id];
            // cell.id로 조회하거나, fallback 구조로 조회
            return ans && (ans[cell.id] || (ans[row.id] && ans[row.id][col.id]));
          }).length;

          summary.push({
            '구분': `  - ${row.label} > ${col.label}`,
            '응답 수': count,
            '비율(%)': ((count / totalResponses) * 100).toFixed(1) + '%'
          });
        });
      });

    } else if (q.options) {
      // 객관식 통계
      q.options.forEach((opt) => {
        const count = responses.filter(r => {
          const ans = (r.questionResponses as any)?.[q.id];
          if (Array.isArray(ans)) return ans.includes(opt.value); // Checkbox
          return ans === opt.value; // Radio/Select
        }).length;

        summary.push({
          '구분': `  - ${opt.label}`,
          '응답 수': count,
          '비율(%)': ((count / totalResponses) * 100).toFixed(1) + '%'
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
  const mapData: any[] = [];

  survey.questions.sort((a, b) => a.order - b.order).forEach((q) => {
    mapData.push({
      'Question ID': q.id,
      'Type': q.type,
      'Title': q.title,
      'Description': q.description || ''
    });

    if (q.type === 'table') {
      q.tableRowsData?.forEach(row => {
        q.tableColumns?.forEach(col => {
          mapData.push({
            'Question ID': '',
            'Type': 'Table Cell',
            'Title': `  Row: ${row.label} / Col: ${col.label}`,
            'Description': `RowID: ${row.id}, ColID: ${col.id}`
          });
        });
      });
    } else if (q.options) {
      q.options.forEach(opt => {
        mapData.push({
          'Question ID': '',
          'Type': 'Option',
          'Title': `  ${opt.label}`,
          'Description': `Value: ${opt.value}`
        });
      });
    }
  });

  return mapData;
}

/**
 * 4. Verbatim (주관식) 생성
 */
function generateVerbatimData(survey: Survey, responses: SurveyResponse[]) {
  const verbatim: any[] = [];

  // 주관식 질문만 필터링 (text, textarea)
  const textQuestions = survey.questions.filter(q =>
    q.type === 'text' || q.type === 'textarea' || (q.type === 'table') // 테이블 내 input도 포함 가능
  );

  responses.forEach(res => {
    textQuestions.forEach(q => {
      if (q.type === 'table') {
        // 테이블 내 텍스트/입력 셀 찾기
        q.tableRowsData?.forEach(row => {
          q.tableColumns?.forEach((col, colIndex) => {
            const cell = row.cells[colIndex];
            if (!cell) return;

            const ans = (res.questionResponses as any)?.[q.id];
            let val = ans?.[cell.id];
            
            // Fallback
            if (!val && ans?.[row.id]?.[col.id]) {
              val = ans[row.id][col.id];
            }

            if (val) {
              verbatim.push({
                'Response ID': res.id,
                'Question': `${q.title} [${row.label}-${col.label}]`,
                'Answer': val
              });
            }
          });
        });
      } else {
        const val = (res.questionResponses as any)?.[q.id];
        if (val) {
          verbatim.push({
            'Response ID': res.id,
            'Question': q.title,
            'Answer': val
          });
        }
      }
    });
  });

  return verbatim;
}

// --- Helpers ---

function sanitize(str: string) {
  // 엑셀 헤더로 쓸 수 없는 문자나 너무 긴 공백 제거
  return str.replace(/[\r\n]+/g, ' ').trim().substring(0, 100);
}

function parseUserAgent(ua: string) {
  if (ua.includes('Mobile')) return 'Mobile';
  if (ua.includes('Windows')) return 'PC (Windows)';
  if (ua.includes('Macintosh')) return 'PC (Mac)';
  if (ua.includes('Linux')) return 'PC (Linux)';
  return 'PC (Other)';
}
