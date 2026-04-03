import * as XLSX from 'xlsx';

import type { Question, SurveySubmission } from '@/types/survey';

import { transformCheckbox, transformSingleChoice, transformTableCell, transformText } from '@/lib/spss/data-transformer';
import { generateFullSyntax } from '@/lib/spss/spss-syntax-generator';
import { getOtherOptionCode } from '@/utils/option-code-generator';

export interface SPSSExportColumn {
  spssVarName: string;
  questionText: string;
  optionLabel: string;
  questionId: string;
  type: 'single' | 'checkbox-item' | 'text' | 'multiselect' | 'table-cell' | 'other-text' | 'notice-agree' | 'notice-date';
  optionIndex?: number;
  optionValue?: string;
  tableCellId?: string;
  tableCellType?: string;
  // 셀 단위 SPSS 오버라이드
  cellSpssVarType?: 'Numeric' | 'String' | 'Date' | 'DateTime';
  cellSpssMeasure?: 'Nominal' | 'Ordinal' | 'Continuous';
}

export interface CodingBookEntry {
  spssVarName: string;
  questionId: string;
  questionTitle: string;
  type: string;
  valueLabels: string;
}

/**
 * 질문 목록에서 SPSS 열 정의를 생성한다.
 * - notice 제외
 * - checkbox는 옵션별 분리 (Q2M1, Q2M2...)
 * - 나머지는 열 1개
 */
export function generateSPSSColumns(questions: Question[]): SPSSExportColumn[] {
  const columns: SPSSExportColumn[] = [];

  for (const q of questions) {
    // notice 중 requiresAcknowledgment가 있는 경우 동의 + 날짜 열 생성
    if (q.type === 'notice') {
      if (q.requiresAcknowledgment && q.questionCode) {
        columns.push({
          spssVarName: q.questionCode,
          questionText: q.title,
          optionLabel: '동의 여부',
          questionId: q.id,
          type: 'notice-agree',
        });
        columns.push({
          spssVarName: `${q.questionCode}_DATE`,
          questionText: q.title,
          optionLabel: '동의 일시 (MM DD YYYY)',
          questionId: q.id,
          type: 'notice-date',
        });
      }
      continue;
    }
    if (!q.questionCode) continue;

    if (q.type === 'checkbox' && q.options) {
      for (let i = 0; i < q.options.length; i++) {
        const opt = q.options[i];
        columns.push({
          spssVarName: `${q.questionCode}_${opt.optionCode ?? String(i + 1)}`,
          questionText: q.title,
          optionLabel: opt.label,
          questionId: q.id,
          type: 'checkbox-item',
          optionIndex: i,
          optionValue: opt.value,
        });
      }
      // 기타 옵션이 있으면 기타 텍스트 컬럼 추가
      if (q.allowOtherOption) {
        const otherCode = getOtherOptionCode(q.options);
        columns.push({
          spssVarName: `${q.questionCode}_${otherCode}_etc`,
          questionText: q.title,
          optionLabel: '기타 입력',
          questionId: q.id,
          type: 'other-text',
        });
      }
    } else if (q.type === 'radio' || q.type === 'select') {
      const optionLabel = q.options
        ? q.options.map((o) => o.label).join(' / ')
        : '';
      columns.push({
        spssVarName: q.questionCode,
        questionText: q.title,
        optionLabel,
        questionId: q.id,
        type: 'single',
      });
      // 기타 옵션이 있으면 기타 텍스트 컬럼 추가
      if (q.allowOtherOption) {
        const otherCode = getOtherOptionCode(q.options);
        columns.push({
          spssVarName: `${q.questionCode}_${otherCode}_etc`,
          questionText: q.title,
          optionLabel: '기타 입력',
          questionId: q.id,
          type: 'other-text',
        });
      }
    } else if (q.type === 'table' && q.tableRowsData && q.tableColumns) {
      // 테이블 질문: 입력 가능한 셀마다 개별 열 생성
      for (const tRow of q.tableRowsData) {
        for (let colIdx = 0; colIdx < q.tableColumns.length; colIdx++) {
          const cell = tRow.cells[colIdx];
          if (!cell) continue;
          // 입력 불가능한 셀(text, image, video)은 건너뛰기
          if (!['checkbox', 'radio', 'select', 'input'].includes(cell.type)) continue;
          // 셀코드가 의도적으로 비어있으면 내보내기에서 제외 (표시용 셀)
          if (cell.isCustomCellCode === true && !cell.cellCode) continue;

          // 변수명: cellCode > questionCode_rowCode_colCode (폴백)
          // exportLabel은 한국어가 포함될 수 있어 SPSS 변수명으로 부적합
          const varName = cell.cellCode
            || `${q.questionCode || q.id.slice(0, 8)}_${tRow.rowCode || `r${tRow.id.slice(0, 4)}`}_${q.tableColumns[colIdx].columnCode || `c${colIdx + 1}`}`;

          // checkbox 셀: checkboxOptions가 있으면 옵션별 분리 변수 생성
          if (cell.type === 'checkbox' && cell.checkboxOptions && cell.checkboxOptions.length > 0) {
            for (let optIdx = 0; optIdx < cell.checkboxOptions.length; optIdx++) {
              const opt = cell.checkboxOptions[optIdx];
              columns.push({
                spssVarName: `${varName}_${opt.optionCode ?? String(optIdx + 1)}`,
                questionText: q.title,
                optionLabel: opt.label,
                questionId: q.id,
                type: 'table-cell',
                tableCellId: cell.id,
                tableCellType: 'checkbox',
                optionIndex: optIdx,
                optionValue: opt.value,
                cellSpssVarType: cell.spssVarType,
                cellSpssMeasure: cell.spssMeasure,
              });
            }
          } else {
            // radio/select/input: 기존 로직
            let optionLabel = '';
            const opts = cell.radioOptions || cell.selectOptions;
            if (opts && opts.length > 0) {
              optionLabel = opts.map((o) => o.label).join(' / ');
            }

            columns.push({
              spssVarName: varName,
              questionText: q.title,
              optionLabel: optionLabel || `${tRow.label} - ${q.tableColumns[colIdx].label}`,
              questionId: q.id,
              type: 'table-cell',
              tableCellId: cell.id,
              tableCellType: cell.type,
              cellSpssVarType: cell.spssVarType,
              cellSpssMeasure: cell.spssMeasure,
            });
          }
        }
      }
    } else {
      columns.push({
        spssVarName: q.questionCode,
        questionText: q.title,
        optionLabel: '',
        questionId: q.id,
        type: q.type === 'text' || q.type === 'textarea' ? 'text' : 'multiselect',
      });
    }
  }

  return columns;
}

/**
 * 테이블 질문에서 특정 셀의 checkboxOptions를 찾는다.
 */
function findTableCellCheckboxOptions(question: Question, cellId: string) {
  if (!question.tableRowsData) return undefined;
  for (const row of question.tableRowsData) {
    for (const cell of row.cells) {
      if (cell.id === cellId) {
        return cell.checkboxOptions;
      }
    }
  }
  return undefined;
}

/**
 * 응답 데이터를 SPSS 열 정의에 맞춰 2차원 배열로 변환한다.
 */
export function buildDataRows(
  columns: SPSSExportColumn[],
  questions: Question[],
  submissions: SurveySubmission[],
): (string | number | null)[][] {
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  return submissions.map((sub) => {
    return columns.map((col) => {
      const question = questionMap.get(col.questionId);
      if (!question) return null;

      const rawValue = sub.questionResponses[col.questionId];

      switch (col.type) {
        case 'notice-agree': {
          // { agreed: true, agreedAt: "..." } 또는 boolean(하위 호환)
          if (rawValue && typeof rawValue === 'object' && 'agreed' in rawValue) {
            return (rawValue as { agreed: boolean }).agreed ? '동의' : null;
          }
          return rawValue === true ? '동의' : null;
        }

        case 'notice-date': {
          // agreedAt ISO 문자열 → 한국시 MM DD YYYY 형식
          if (rawValue && typeof rawValue === 'object' && 'agreedAt' in rawValue) {
            const agreedAt = (rawValue as { agreedAt?: string }).agreedAt;
            if (agreedAt) {
              const d = new Date(agreedAt);
              const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
              const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
              const dd = String(kst.getUTCDate()).padStart(2, '0');
              const yyyy = String(kst.getUTCFullYear());
              return `${mm} ${dd} ${yyyy}`;
            }
          }
          return null;
        }

        case 'single':
          return transformSingleChoice(question, rawValue as string | { selectedValue: string; otherValue?: string; hasOther: true } | null);

        case 'checkbox-item': {
          const values = rawValue as Array<string | { selectedValue: string; otherValue?: string; hasOther: true }> | null;
          if (!question.options || col.optionIndex == null) return null;
          const opt = question.options[col.optionIndex];
          const isSelected =
            values != null &&
            values.some((v) => {
              if (typeof v === 'object' && v !== null && 'hasOther' in v) {
                return v.selectedValue === opt.id || v.selectedValue === opt.value;
              }
              return v === opt.id || v === opt.value;
            });
          return isSelected ? (opt.spssNumericCode ?? col.optionIndex + 1) : null;
        }

        case 'other-text': {
          // radio/select: { hasOther: true, otherValue: "..." }
          if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) && 'hasOther' in rawValue) {
            return (rawValue as { otherValue?: string }).otherValue || null;
          }
          // checkbox: 배열 내 hasOther 객체에서 otherValue 추출
          if (Array.isArray(rawValue)) {
            const otherItem = rawValue.find(
              (v) => typeof v === 'object' && v !== null && 'hasOther' in v && (v as { hasOther: boolean }).hasOther,
            ) as { otherValue?: string } | undefined;
            return otherItem?.otherValue || null;
          }
          return null;
        }

        case 'table-cell': {
          // rawValue는 테이블 응답 객체: { cellId: value, ... }
          if (!rawValue || typeof rawValue !== 'object') return null;
          const tableAnswer = rawValue as Record<string, unknown>;
          const cellId = col.tableCellId;
          if (!cellId) return null;
          const cellVal = tableAnswer[cellId];
          if (cellVal == null) return null;

          // checkbox 옵션별 분리 변수: 해당 옵션 선택 여부만 반환
          if (col.tableCellType === 'checkbox' && col.optionIndex != null && col.optionValue != null) {
            const selectedValues = Array.isArray(cellVal) ? cellVal : [cellVal];
            const isSelected = selectedValues.some((v: unknown) => v === col.optionValue);
            // 셀의 checkboxOptions에서 spssNumericCode 조회
            const cellOptions = findTableCellCheckboxOptions(question, cellId);
            const code = cellOptions?.[col.optionIndex]?.spssNumericCode ?? col.optionIndex + 1;
            return isSelected ? code : null;
          }

          return transformTableCell(col.tableCellType || 'input', cellVal);
        }

        case 'text':
          return transformText(rawValue as string | null);

        default:
          return rawValue != null ? String(rawValue) : null;
      }
    });
  });
}

/**
 * 코딩북(변수 매핑) 데이터를 생성한다.
 */
export function buildCodingBook(
  columns: SPSSExportColumn[],
  questions: Question[],
): CodingBookEntry[] {
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  return columns.map((col) => {
    const question = questionMap.get(col.questionId);

    if (col.type === 'notice-agree') {
      return {
        spssVarName: col.spssVarName,
        questionId: col.questionId,
        questionTitle: `${col.questionText} - 동의 여부`,
        type: 'notice',
        valueLabels: '동의=확인함, 빈값=미확인',
      };
    }

    if (col.type === 'notice-date') {
      return {
        spssVarName: col.spssVarName,
        questionId: col.questionId,
        questionTitle: `${col.questionText} - 동의 일시`,
        type: 'notice',
        valueLabels: '(MM DD YYYY 형식)',
      };
    }

    if (col.type === 'single' && question?.options) {
      const valueLabels = question.options
        .map((o, i) => `${o.spssNumericCode ?? i + 1}=${o.label}`)
        .join(', ');
      return {
        spssVarName: col.spssVarName,
        questionId: col.questionId,
        questionTitle: col.questionText,
        type: question.type,
        valueLabels,
      };
    }

    if (col.type === 'checkbox-item') {
      const opt = question?.options?.[col.optionIndex ?? 0];
      const code = opt?.spssNumericCode ?? (col.optionIndex ?? 0) + 1;
      return {
        spssVarName: col.spssVarName,
        questionId: col.questionId,
        questionTitle: `${col.questionText} - ${col.optionLabel}`,
        type: 'checkbox',
        valueLabels: `${code}=선택, 빈값=미선택`,
      };
    }

    if (col.type === 'other-text') {
      return {
        spssVarName: col.spssVarName,
        questionId: col.questionId,
        questionTitle: `${col.questionText} - 기타 입력`,
        type: '기타 텍스트',
        valueLabels: '(기타 입력 텍스트)',
      };
    }

    if (col.type === 'table-cell') {
      return {
        spssVarName: col.spssVarName,
        questionId: col.questionId,
        questionTitle: `${col.questionText} - ${col.optionLabel}`,
        type: `table (${col.tableCellType || 'input'})`,
        valueLabels: col.tableCellType === 'input' ? '(텍스트)' : col.optionLabel,
      };
    }

    return {
      spssVarName: col.spssVarName,
      questionId: col.questionId,
      questionTitle: col.questionText,
      type: question?.type ?? col.type,
      valueLabels: '(텍스트)',
    };
  });
}

/**
 * SPSS 호환 엑셀 워크북을 생성한다.
 *
 * 시트 구성:
 * 1. "데이터" — 3행 헤더(질문텍스트, 옵션라벨, 변수명) + 응답 데이터
 * 2. "코딩북" — 변수명, 질문 제목, 타입, 값 라벨
 * 3. "SPSS Syntax" — .sps 신택스 텍스트
 */
export function buildSpssWorkbook(
  questions: Question[],
  submissions: SurveySubmission[],
): XLSX.WorkBook {
  const columns = generateSPSSColumns(questions);
  const dataRows = buildDataRows(columns, questions, submissions);
  const codingBook = buildCodingBook(columns, questions);

  const wb = XLSX.utils.book_new();

  // ── 시트 1: 데이터 ──
  const headerRow1 = columns.map((col) => col.questionText);
  const headerRow2 = columns.map((col) => col.optionLabel);
  const headerRow3 = columns.map((col) => col.spssVarName);

  const aoa: (string | number | null)[][] = [headerRow1, headerRow2, headerRow3, ...dataRows];
  const dataSheet = XLSX.utils.aoa_to_sheet(aoa);

  // 질문 텍스트 행 병합 (동일 질문 텍스트가 연속되면 병합)
  const merges: XLSX.Range[] = [];
  let mergeStart = 0;
  for (let i = 1; i <= columns.length; i++) {
    if (i < columns.length && columns[i].questionText === columns[mergeStart].questionText && columns[i].questionId === columns[mergeStart].questionId) {
      continue;
    }
    if (i - mergeStart > 1) {
      merges.push({ s: { r: 0, c: mergeStart }, e: { r: 0, c: i - 1 } });
    }
    mergeStart = i;
  }
  if (merges.length > 0) {
    dataSheet['!merges'] = merges;
  }

  // 숫자 타입 셀에 숫자 형식 적용 (SPSS가 숫자로 인식하도록)
  for (let r = 0; r < dataRows.length; r++) {
    for (let c = 0; c < columns.length; c++) {
      const val = dataRows[r][c];
      if (typeof val === 'number') {
        const cellRef = XLSX.utils.encode_cell({ r: r + 3, c });
        if (dataSheet[cellRef]) {
          dataSheet[cellRef].t = 'n';
        }
      }
    }
  }

  // 열 너비 설정
  dataSheet['!cols'] = columns.map((col) => ({
    wch: Math.max(col.spssVarName.length, 12),
  }));

  XLSX.utils.book_append_sheet(wb, dataSheet, '데이터');

  // ── 시트 2: 코딩북 ──
  const codingAoa: (string | number)[][] = [
    ['SPSS 변수명', '질문 ID', '질문 제목', '타입', '값 라벨'],
    ...codingBook.map((entry) => [
      entry.spssVarName,
      entry.questionId,
      entry.questionTitle,
      entry.type,
      entry.valueLabels,
    ]),
  ];
  const codingSheet = XLSX.utils.aoa_to_sheet(codingAoa);
  codingSheet['!cols'] = [{ wch: 20 }, { wch: 38 }, { wch: 40 }, { wch: 12 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, codingSheet, '코딩북');

  // ── 시트 3: SPSS Syntax ──
  const syntaxText = generateFullSyntax(questions);
  const syntaxLines = syntaxText.split('\n').map((line) => [line]);
  const syntaxSheet = XLSX.utils.aoa_to_sheet(syntaxLines);
  syntaxSheet['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, syntaxSheet, 'SPSS Syntax');

  return wb;
}

/**
 * SPSS 호환 엑셀 파일을 Blob으로 변환한다.
 */
export function buildSpssExcelBlob(
  questions: Question[],
  submissions: SurveySubmission[],
): Blob {
  const wb = buildSpssWorkbook(questions, submissions);
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
