/**
 * 질문 판별 유니언 모듈 — Question discriminated union 전환의 기반층.
 *
 * - variants.ts: 유형별 TS variant (필드 타입 출처는 flat Question 의 Pick 합성)
 * - schema.ts: zod discriminatedUnion + TS↔zod 키셋 드리프트 게이트
 * - guards.ts: 분류 가드(is*) — capability 술어(has*, choice-source 등)와 구분
 * - normalize.ts: 읽기 경계 정규화 (preserve/strict 2모드, 비파괴 전환 규율)
 */

export type {
  CheckboxQuestion,
  ChoiceGroupCapableQuestion,
  EmbeddedTableQuestion,
  MultiselectQuestion,
  NoticeQuestion,
  OptionListQuestion,
  QuestionGroupAlignmentGates,
  QuestionVariant,
  RadioQuestion,
  RankingQuestion,
  SelectQuestion,
  TableQuestion,
  TextQuestion,
  TextareaQuestion,
} from './variants';
export { toFlatQuestion } from './variants';

export {
  CheckboxQuestionSchema,
  MultiselectQuestionSchema,
  NoticeQuestionSchema,
  QuestionVariantSchema,
  RadioQuestionSchema,
  RankingQuestionSchema,
  SelectQuestionSchema,
  TableQuestionSchema,
  TextQuestionSchema,
  TextareaQuestionSchema,
} from './schema';
export type { QuestionEnumLeafGates, QuestionSchemaDriftGates } from './schema';

export {
  assertNeverQuestionType,
  isCheckboxQuestion,
  isChoiceGroupCapableQuestion,
  isEmbeddedTableQuestion,
  isMultiselectQuestion,
  isNoticeQuestion,
  isOptionListQuestion,
  isRadioQuestion,
  isRankingQuestion,
  isSelectQuestion,
  isTableQuestion,
  isTextQuestion,
  isTextareaQuestion,
} from './guards';

export { normalizeQuestion, normalizeQuestions } from './normalize';
export type { NormalizeMode } from './normalize';
