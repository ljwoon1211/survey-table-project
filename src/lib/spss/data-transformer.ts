import type { Question } from '@/types/survey';

export interface SPSSColumn {
  spssVarName: string;
  questionText: string;
  optionLabel: string;
  questionId: string;
  type: 'single' | 'checkbox-item' | 'text' | 'multiselect' | 'table-cell' | 'other-text';
  optionIndex?: number;
  optionValue?: string;
  tableInfo?: { rowId: string; cellId: string; cellType: string };
}

interface CheckboxResult {
  varName: string;
  value: number | null;
}

/**
 * 옵션의 SPSS 숫자코드를 반환한다.
 * spssNumericCode가 있으면 사용, 없으면 1-based 인덱스 사용.
 */
function getNumericCode(options: Question['options'], optionId: string): number | null {
  if (!options) return null;
  const idx = options.findIndex((o) => o.id === optionId || o.value === optionId);
  if (idx === -1) return null;
  return options[idx].spssNumericCode ?? idx + 1;
}

/**
 * 단일선택(radio, select) 응답을 숫자코드로 변환한다.
 * hasOther 객체인 경우 selectedValue에서 숫자코드를 추출한다.
 */
export function transformSingleChoice(
  question: Question,
  value: string | { selectedValue: string; otherValue?: string; hasOther: true } | null | undefined,
): number | null {
  if (value == null) return null;
  if (typeof value === 'object' && 'hasOther' in value && value.hasOther) {
    return getNumericCode(question.options, value.selectedValue);
  }
  return getNumericCode(question.options, value as string);
}

/**
 * 복수선택(checkbox) 응답을 옵션별 독립 변수로 분리한다.
 * 선택된 옵션은 해당 숫자코드, 미선택은 null.
 */
export function transformCheckbox(
  question: Question,
  values: string[] | null | undefined,
): CheckboxResult[] {
  const options = question.options ?? [];
  const selectedSet = new Set(values ?? []);

  return options.map((opt, idx) => {
    const code = opt.spssNumericCode ?? idx + 1;
    const isSelected = selectedSet.has(opt.id) || selectedSet.has(opt.value);
    return {
      varName: `${question.questionCode}M${idx + 1}`,
      value: isSelected ? code : null,
    };
  });
}

/**
 * 텍스트(text, textarea) 응답을 그대로 반환한다.
 */
export function transformText(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  return value;
}

/**
 * 다단계 선택(multiselect) 응답을 밑줄로 합산한 텍스트로 반환한다.
 */
export function transformMultiselect(values: string[] | null | undefined): string | null {
  if (!values || values.length === 0) return null;
  return values.join('_');
}

/**
 * 기타(Other) 옵션의 텍스트를 추출한다.
 */
export function transformOtherOption(
  otherData: { hasOther?: boolean; otherValue?: string } | null | undefined,
): string | null {
  if (!otherData || !otherData.hasOther) return null;
  return otherData.otherValue ?? '';
}

/**
 * 테이블 셀 값을 변환한다.
 */
export function transformTableCell(
  cellType: string,
  value: unknown,
): string | number | null {
  if (value == null) return null;

  switch (cellType) {
    case 'input':
      return typeof value === 'string' && value !== '' ? value : null;
    case 'checkbox':
    case 'radio':
    case 'select':
      return typeof value === 'number' ? value : typeof value === 'string' ? value : null;
    default:
      return null;
  }
}
