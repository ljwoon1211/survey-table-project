/**
 * 응답 어댑터
 *
 * response_answers 정규화 데이터 → 기존 questionResponses 형식 변환
 * 기존 분석 코드(analyzer, cross-tab, filter, excel-transformer)를 변경 없이 사용 가능
 */

interface AnswerRow {
  questionId: string;
  textValue: string | null;
  arrayValue: string[] | null;
  objectValue: Record<string, unknown> | null;
  questionType: string;
}

/**
 * response_answers 행 배열 → Record<string, unknown> 변환
 *
 * - textValue → string
 * - arrayValue → string[]
 * - objectValue → Record<string, unknown>
 * - 모두 null인 행은 건너뜀
 */
export function answersToQuestionResponses(
  answers: AnswerRow[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const answer of answers) {
    if (answer.textValue !== null) {
      result[answer.questionId] = answer.textValue;
    } else if (answer.arrayValue !== null) {
      result[answer.questionId] = answer.arrayValue;
    } else if (answer.objectValue !== null) {
      // normalizer 가 객체 원소 포함 배열을 { __array: [...] } 로 래핑했으면 언래핑
      const obj = answer.objectValue;
      if (
        Object.prototype.hasOwnProperty.call(obj, '__array') &&
        Array.isArray((obj as { __array?: unknown }).__array)
      ) {
        result[answer.questionId] = (obj as { __array: unknown[] }).__array;
      } else {
        result[answer.questionId] = obj;
      }
    }
  }

  return result;
}
