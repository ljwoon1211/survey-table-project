import type {
  CheckboxQuestion,
  MultiselectQuestion,
  NoticeQuestion,
  QuestionVariant,
  RadioQuestion,
  RankingQuestion,
  SelectQuestion,
  TableQuestion,
  TextQuestion,
  TextareaQuestion,
} from '@/lib/question';
import type { QuestionOption, TableRow } from '@/types/survey';

/**
 * 유형별 질문 테스트 팩토리 — Question union 전환의 테스트 수렴 지점.
 *
 * 기존 테스트의 로컬 makeQuestion(Partial<Question>) 팩토리 13곳+ 과 as Question
 * 캐스트 83건은 만나는 대로 이 팩토리로 흡수한다(일괄 치환 금지 — 점진 수렴).
 * 산출물은 QuestionVariant 이며 flat Question 에도 캐스트 없이 할당 가능하다.
 */

let seq = 0;

function nextBase() {
  seq += 1;
  return { id: `q-${seq}`, title: `질문 ${seq}`, required: false, order: seq };
}

export function makeOption(id: string, label: string, value?: string): QuestionOption {
  return { id, label, value: value ?? id };
}

function defaultOptions(): QuestionOption[] {
  return [makeOption('opt-1', '옵션 1', '1'), makeOption('opt-2', '옵션 2', '2')];
}

function defaultTableRow(): TableRow {
  return {
    id: 'row-1',
    label: '행 1',
    cells: [{ id: 'cell-1', content: '셀 1', type: 'text' }],
  };
}

export const makeQuestion = {
  text: (overrides: Partial<TextQuestion> = {}): TextQuestion => ({
    ...nextBase(),
    type: 'text',
    ...overrides,
  }),

  textarea: (overrides: Partial<TextareaQuestion> = {}): TextareaQuestion => ({
    ...nextBase(),
    type: 'textarea',
    ...overrides,
  }),

  radio: (overrides: Partial<RadioQuestion> = {}): RadioQuestion => ({
    ...nextBase(),
    type: 'radio',
    options: defaultOptions(),
    ...overrides,
  }),

  checkbox: (overrides: Partial<CheckboxQuestion> = {}): CheckboxQuestion => ({
    ...nextBase(),
    type: 'checkbox',
    options: defaultOptions(),
    ...overrides,
  }),

  select: (overrides: Partial<SelectQuestion> = {}): SelectQuestion => ({
    ...nextBase(),
    type: 'select',
    options: defaultOptions(),
    ...overrides,
  }),

  multiselect: (overrides: Partial<MultiselectQuestion> = {}): MultiselectQuestion => ({
    ...nextBase(),
    type: 'multiselect',
    selectLevels: [
      { id: 'lvl-1', label: '1단계', order: 0, options: defaultOptions() },
    ],
    ...overrides,
  }),

  ranking: (overrides: Partial<RankingQuestion> = {}): RankingQuestion => ({
    ...nextBase(),
    type: 'ranking',
    options: defaultOptions(),
    rankingConfig: { positions: 3 },
    ...overrides,
  }),

  table: (overrides: Partial<TableQuestion> = {}): TableQuestion => ({
    ...nextBase(),
    type: 'table',
    tableColumns: [{ id: 'col-1', label: '열 1' }],
    tableRowsData: [defaultTableRow()],
    ...overrides,
  }),

  notice: (overrides: Partial<NoticeQuestion> = {}): NoticeQuestion => ({
    ...nextBase(),
    type: 'notice',
    noticeContent: '<p>안내문</p>',
    ...overrides,
  }),
} as const;

/** 9개 유형 전부의 기본 산출물 — 매트릭스/roundtrip 류 전수 테스트용. */
export function makeAllQuestionVariants(): QuestionVariant[] {
  return [
    makeQuestion.text(),
    makeQuestion.textarea(),
    makeQuestion.radio(),
    makeQuestion.checkbox(),
    makeQuestion.select(),
    makeQuestion.multiselect(),
    makeQuestion.ranking(),
    makeQuestion.table(),
    makeQuestion.notice(),
  ];
}
