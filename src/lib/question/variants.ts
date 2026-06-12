import type { Question } from '@/types/survey';

/**
 * Question 판별 유니언 variant 정의.
 *
 * 필드 타입의 단일 출처는 기존 flat Question(types/survey.ts) — 모든 variant 필드를
 * Pick 으로 합성해 optional 정밀도(exactOptionalPropertyTypes)와 필드 타입이 flat 과
 * 구조적으로 동일함을 보장한다. variant 가 결정하는 것은 "유형별 필드 집합"뿐이다.
 *
 * 필드 집합은 2026-06-12 실측 매트릭스(8방향 탐색 + 적대 검증)를 따른다:
 * - 내장 테이블 capability 는 table 전용이 아니라 radio/checkbox(choice_opt 옵션 소스)·
 *   ranking(optionsSource='table' 의 ranking_opt)·table 4유형이 공유한다.
 * - choiceGroups 는 radio/checkbox/ranking 전용 (table 은 소비 경로 없음).
 * - textarea 는 전용 필드 0 — base 만으로 구성되는 가장 얇은 variant.
 *
 * 런타임 검증은 schema.ts 의 zod discriminatedUnion 이 담당하며, 두 기술의 키셋
 * 드리프트는 schema.ts 의 keyof 동치 게이트가 컴파일로 차단한다.
 */

/** 전 유형 공통 필드 — 실측에서 무가드 공통 접근으로 검증된 집합. */
type QuestionBase = Pick<
  Question,
  | 'id'
  | 'title'
  | 'description'
  | 'required'
  | 'groupId'
  | 'order'
  | 'displayCondition'
  | 'questionCode'
  | 'isCustomSpssVarName'
  | 'exportLabel'
  | 'spssVarType'
  | 'spssMeasure'
>;

/** 내장 테이블 capability — radio/checkbox/ranking/table 4유형 공유. */
type EmbeddedTableFields = Pick<
  Question,
  'tableTitle' | 'tableColumns' | 'tableRowsData' | 'tableHeaderGrid' | 'hideColumnLabels'
>;

/** 테이블 레벨 옵션 그룹 — radio/checkbox/ranking 전용. */
type ChoiceGroupFields = Pick<Question, 'choiceGroups'>;

/** question.options 옵션 리스트 — radio/checkbox/select/ranking(manual). */
type OptionListFields = Pick<Question, 'options' | 'optionsColumns' | 'allowOtherOption'>;

export interface TextQuestion
  extends QuestionBase,
    Pick<Question, 'placeholder' | 'defaultValueTemplate' | 'inputType' | 'emptyDefault'> {
  type: 'text';
}

export interface TextareaQuestion extends QuestionBase {
  type: 'textarea';
}

export interface RadioQuestion
  extends QuestionBase,
    OptionListFields,
    EmbeddedTableFields,
    ChoiceGroupFields {
  type: 'radio';
}

export interface CheckboxQuestion
  extends QuestionBase,
    OptionListFields,
    EmbeddedTableFields,
    ChoiceGroupFields,
    Pick<Question, 'minSelections' | 'maxSelections'> {
  type: 'checkbox';
}

export interface SelectQuestion
  extends QuestionBase,
    Pick<Question, 'options' | 'allowOtherOption'> {
  type: 'select';
}

export interface MultiselectQuestion extends QuestionBase, Pick<Question, 'selectLevels'> {
  type: 'multiselect';
}

export interface RankingQuestion
  extends QuestionBase,
    OptionListFields,
    EmbeddedTableFields,
    ChoiceGroupFields,
    Pick<Question, 'rankingConfig'> {
  type: 'ranking';
}

export interface TableQuestion
  extends QuestionBase,
    EmbeddedTableFields,
    Pick<Question, 'tableValidationRules' | 'dynamicRowConfigs'> {
  type: 'table';
}

export interface NoticeQuestion
  extends QuestionBase,
    Pick<Question, 'noticeContent' | 'requiresAcknowledgment'> {
  type: 'notice';
}

export type QuestionVariant =
  | TextQuestion
  | TextareaQuestion
  | RadioQuestion
  | CheckboxQuestion
  | SelectQuestion
  | MultiselectQuestion
  | RankingQuestion
  | TableQuestion
  | NoticeQuestion;

/** question.options 를 옵션 소스로 쓰는 유형 (OPTION_LIST_TYPES 와 정렬). */
export type OptionListQuestion = RadioQuestion | CheckboxQuestion | SelectQuestion | RankingQuestion;

/** 내장 테이블 capability 보유 유형 (EMBEDDED_TABLE_TYPES 와 정렬). */
export type EmbeddedTableQuestion = RadioQuestion | CheckboxQuestion | RankingQuestion | TableQuestion;

/** choiceGroups 소비 유형 (CHOICE_GROUP_TYPES 와 정렬). */
export type ChoiceGroupQuestion = RadioQuestion | CheckboxQuestion | RankingQuestion;

// 전환기 호환성 축 — 모든 variant 는 기존 flat Question 에 캐스트 없이 단방향 할당
// 가능해야 한다. 이 보장이 깨지면(필드 타입/optional 정밀도 드리프트) 아래가 컴파일 에러.
export function toFlatQuestion(question: QuestionVariant): Question {
  return question;
}
