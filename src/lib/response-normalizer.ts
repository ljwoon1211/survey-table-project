/**
 * 응답 정규화 유틸리티
 *
 * JSONB questionResponses → response_answers 행으로 변환
 */

interface QuestionMeta {
  id: string;
  type: string;
}

interface NormalizedAnswer {
  responseId: string;
  questionId: string;
  textValue: string | null;
  arrayValue: string[] | null;
  objectValue: Record<string, unknown> | null;
  questionType: string;
}

/**
 * JSONB 응답 데이터를 정규화된 행 배열로 변환
 *
 * - string → textValue
 * - string[] → arrayValue
 * - object → objectValue (table, multiselect, other 응답)
 * - null/undefined → 건너뜀
 * - 질문 목록에 없는 ID → 건너뜀
 */
export function normalizeToAnswers(
  responseId: string,
  questionResponses: Record<string, unknown>,
  questions: QuestionMeta[],
): NormalizedAnswer[] {
  const questionMap = new Map(questions.map((q) => [q.id, q.type]));
  const answers: NormalizedAnswer[] = [];

  for (const [questionId, value] of Object.entries(questionResponses)) {
    if (value === null || value === undefined) continue;

    const questionType = questionMap.get(questionId);
    if (!questionType) continue;

    const answer: NormalizedAnswer = {
      responseId,
      questionId,
      textValue: null,
      arrayValue: null,
      objectValue: null,
      questionType,
    };

    if (typeof value === 'string') {
      answer.textValue = value;
    } else if (Array.isArray(value)) {
      answer.arrayValue = value.map(String);
    } else if (typeof value === 'object') {
      answer.objectValue = value as Record<string, unknown>;
    }

    answers.push(answer);
  }

  return answers;
}
