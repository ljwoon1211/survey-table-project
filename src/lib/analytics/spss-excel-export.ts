/**
 * SPSS 공용 열/데이터 정의 빌더
 *
 * 현재 소비자:
 *  - `@/lib/spss/sav-builder` — .sav 네이티브 내보내기
 *  - `@/lib/excel-transformer` — 서버 엑셀 워크북 (Summary/Map 등)
 *
 * 과거 엑셀 Blob/워크북/코딩북 헬퍼는 UI에서 제거됨에 따라 함께 삭제되었다.
 */
import type { Question, SurveySubmission } from '@/types/survey';

import { transformSingleChoice, transformTableCell, transformText } from '@/lib/spss/data-transformer';
import { getOtherOptionCode } from '@/utils/option-code-generator';
import { buildTableCellVarName } from '@/utils/table-cell-code-generator';

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
            || buildTableCellVarName(q, tRow, colIdx, q.tableColumns, q.tableRowsData!);

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
