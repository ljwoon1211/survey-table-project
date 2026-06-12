import {
  CHOICE_GROUP_TYPES,
  EMBEDDED_TABLE_TYPES,
  OPTION_LIST_TYPES,
  type ChoiceGroupType,
  type EmbeddedTableType,
  type OptionListType,
} from '@/types/question-types';
import type { QuestionType } from '@/types/survey';

/**
 * Question 유형 narrowing 가드.
 *
 * 제네릭 교차 형태(q is Q & { type: ... })라 flat Question 과 QuestionVariant
 * 양쪽 입력에서 동작한다 — 전환기에 소비처가 어느 세계에 있든 같은 가드를 쓴다.
 *
 * 주의: "분류 가드(is*)"와 "capability 술어(has*)"는 다른 종류다.
 * isChoiceTableSource(choice-source.ts — choice_opt 셀 실재 검사) 같은 술어를
 * 타입가드로 승격하면 manual-source radio 가 else 분기에서 타입상 배제되는
 * unsound narrowing 이 생긴다. 셀 실재 검사는 boolean 술어로 남긴다.
 */

type Typed = { type: QuestionType };

export function isTextQuestion<Q extends Typed>(q: Q): q is Q & { type: 'text' } {
  return q.type === 'text';
}

export function isTextareaQuestion<Q extends Typed>(q: Q): q is Q & { type: 'textarea' } {
  return q.type === 'textarea';
}

export function isRadioQuestion<Q extends Typed>(q: Q): q is Q & { type: 'radio' } {
  return q.type === 'radio';
}

export function isCheckboxQuestion<Q extends Typed>(q: Q): q is Q & { type: 'checkbox' } {
  return q.type === 'checkbox';
}

export function isSelectQuestion<Q extends Typed>(q: Q): q is Q & { type: 'select' } {
  return q.type === 'select';
}

export function isMultiselectQuestion<Q extends Typed>(q: Q): q is Q & { type: 'multiselect' } {
  return q.type === 'multiselect';
}

export function isRankingQuestion<Q extends Typed>(q: Q): q is Q & { type: 'ranking' } {
  return q.type === 'ranking';
}

export function isTableQuestion<Q extends Typed>(q: Q): q is Q & { type: 'table' } {
  return q.type === 'table';
}

export function isNoticeQuestion<Q extends Typed>(q: Q): q is Q & { type: 'notice' } {
  return q.type === 'notice';
}

/** 내장 테이블 capability 보유 유형(radio/checkbox/ranking/table)인지. */
export function isEmbeddedTableQuestion<Q extends Typed>(
  q: Q,
): q is Q & { type: EmbeddedTableType } {
  return (EMBEDDED_TABLE_TYPES as readonly QuestionType[]).includes(q.type);
}

/** question.options 를 옵션 소스로 쓰는 유형(radio/checkbox/select/ranking)인지. */
export function isOptionListQuestion<Q extends Typed>(q: Q): q is Q & { type: OptionListType } {
  return (OPTION_LIST_TYPES as readonly QuestionType[]).includes(q.type);
}

/** choiceGroups 소비 유형(radio/checkbox/ranking)인지. */
export function isChoiceGroupQuestion<Q extends Typed>(q: Q): q is Q & { type: ChoiceGroupType } {
  return (CHOICE_GROUP_TYPES as readonly QuestionType[]).includes(q.type);
}

/**
 * switch(question.type) exhaustiveness 강제 — default 절에서 호출한다.
 * 신규 유형 추가 시 누락된 case 가 컴파일 에러로 드러난다.
 */
export function assertNeverQuestionType(type: never): never {
  throw new Error(`처리되지 않은 질문 유형: ${String(type)}`);
}
