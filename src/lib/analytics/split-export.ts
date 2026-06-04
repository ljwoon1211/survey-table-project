import type { Question, QuestionConditionGroup } from '@/types/survey';

export const SPLIT_SOFT_LIMIT = 10000;
export const SPLIT_EXCEL_LIMIT = 16384;

/** displayCondition 중 basisId를 value-match 하는 조건의 requiredValues 합집합. 없으면 null. */
export function valueMatchSet(
  dc: QuestionConditionGroup | undefined,
  basisId: string,
): Set<string> | null {
  if (!dc || !Array.isArray(dc.conditions)) return null;
  let s: Set<string> | null = null;
  for (const c of dc.conditions) {
    if (
      c.conditionType === 'value-match' &&
      c.sourceQuestionId === basisId &&
      Array.isArray(c.requiredValues) &&
      c.requiredValues.length > 0
    ) {
      s = s ?? new Set<string>();
      for (const v of c.requiredValues) s.add(v);
    }
  }
  return s;
}
