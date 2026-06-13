import {
  isChoiceGroupType,
  isEmbeddedTableType,
  isOptionListType,
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
 * 주의 1: "분류 가드(is*)"와 "capability 술어(has*)"는 다른 종류다.
 * isChoiceTableSource(choice-source.ts — choice_opt 셀 실재 검사) 같은 술어를
 * 타입가드로 승격하면 manual-source radio 가 else 분기에서 타입상 배제되는
 * unsound narrowing 이 생긴다. 셀 실재 검사는 boolean 술어로 남긴다.
 *
 * 주의 2: 근사 동명 함정 — 이 파일의 가드는 전부 "유형 멤버십"이다.
 * 데이터 실재 검사(isGroupedChoiceQuestion = choiceGroups 정의 존재,
 * utils/choice-group-helpers.ts)와 이름이 비슷하지만 의미가 다르다.
 * 응답 검증·grouped shape 분기에 멤버십 가드를 꽂으면 required 영구
 * 미충족/무력화 양방향 사고가 난다 — 자동 import 시 모듈 경로를 확인할 것.
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

/** 내장 테이블 capability 보유 유형(radio/checkbox/ranking/table)인지 — 멤버십이며 테이블 데이터 실재 검사가 아니다. */
export function isEmbeddedTableQuestion<Q extends Typed>(
  q: Q,
): q is Q & { type: EmbeddedTableType } {
  return isEmbeddedTableType(q.type);
}

/** question.options 를 옵션 소스로 쓰는 유형(radio/checkbox/select/ranking)인지. */
export function isOptionListQuestion<Q extends Typed>(q: Q): q is Q & { type: OptionListType } {
  return isOptionListType(q.type);
}

/**
 * choiceGroups 를 소비할 수 있는 유형(radio/checkbox/ranking)인지 — capability 멤버십.
 * choiceGroups 정의가 실재하는지(grouped 응답 shape 분기점)는 별개 술어인
 * isGroupedChoiceQuestion(utils/choice-group-helpers.ts)이다 — 혼용 금지(헤더 주의 2).
 */
export function isChoiceGroupCapableQuestion<Q extends Typed>(
  q: Q,
): q is Q & { type: ChoiceGroupType } {
  return isChoiceGroupType(q.type);
}

/**
 * switch(question.type) exhaustiveness 강제 — default 절에서 호출한다.
 * 신규 유형 추가 시 누락된 case 가 컴파일 에러로 드러난다.
 */
export function assertNeverQuestionType(type: never): never {
  throw new Error(`처리되지 않은 질문 유형: ${String(type)}`);
}
