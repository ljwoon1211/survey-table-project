import { describe, it, expect } from 'vitest';

import { isQuestionAnswered } from '@/lib/survey/answer-validation';
import type { Question, QuestionType } from '@/types/survey';

// ── 최소 Question 빌더 ──
// isQuestionAnswered 가 참조하는 필드는 type / minSelections / requiresAcknowledgment 뿐.
// 나머지 필수 필드(id/title/required/order)는 형식만 채운다.
function q(type: QuestionType, overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    type,
    title: '질문',
    required: false,
    order: 0,
    ...overrides,
  };
}

/**
 * 그룹별 선택 radio 질문 빌더.
 * rad1(cellA, cellB), rad2(cellC), 미소속 default(cellD)
 */
function groupedRadioQ(): Question {
  return {
    id: 'qg',
    type: 'radio',
    title: '그룹 라디오',
    required: true,
    order: 0,
    tableColumns: [{ id: 'c1', label: '열' }],
    tableRowsData: [
      {
        id: 'r1',
        label: '',
        cells: [
          { id: 'cellA', type: 'choice_opt', content: '', choiceGroupId: 'grp1' },
          { id: 'cellB', type: 'choice_opt', content: '', choiceGroupId: 'grp1' },
          { id: 'cellC', type: 'choice_opt', content: '', choiceGroupId: 'grp2' },
          { id: 'cellD', type: 'choice_opt', content: '' },
        ],
      },
    ],
    choiceGroups: [
      { id: 'grp1', type: 'radio', groupKey: 'rad1', label: '그룹1' },
      { id: 'grp2', type: 'radio', groupKey: 'rad2', label: '그룹2' },
    ],
  } as unknown as Question;
}

describe('isQuestionAnswered (survey-response-flow 추출 characterization)', () => {
  // 모든 타입 공통: null/undefined 응답은 미응답.
  it('응답값이 undefined/null 이면 모든 타입에서 미응답', () => {
    const types: QuestionType[] = [
      'text',
      'textarea',
      'radio',
      'checkbox',
      'select',
      'multiselect',
      'ranking',
      'table',
      'notice',
    ];
    for (const t of types) {
      expect(isQuestionAnswered(q(t), undefined)).toBe(false);
      expect(isQuestionAnswered(q(t), null)).toBe(false);
    }
  });

  describe('text', () => {
    it('공백 아닌 문자열은 응답', () => {
      expect(isQuestionAnswered(q('text'), 'hello')).toBe(true);
    });
    it('빈 문자열/공백만은 미응답', () => {
      expect(isQuestionAnswered(q('text'), '')).toBe(false);
      expect(isQuestionAnswered(q('text'), '   ')).toBe(false);
    });
    it('문자열이 아니면 미응답', () => {
      expect(isQuestionAnswered(q('text'), 123)).toBe(false);
    });
  });

  describe('textarea', () => {
    it('공백 아닌 문자열은 응답', () => {
      expect(isQuestionAnswered(q('textarea'), '내용')).toBe(true);
    });
    it('공백만은 미응답', () => {
      expect(isQuestionAnswered(q('textarea'), ' \n\t ')).toBe(false);
    });
  });

  describe('radio', () => {
    it('빈 문자열이 아닌 값은 응답', () => {
      expect(isQuestionAnswered(q('radio'), 'opt1')).toBe(true);
      expect(isQuestionAnswered(q('radio'), '0')).toBe(true);
    });
    it('빈 문자열은 미응답', () => {
      expect(isQuestionAnswered(q('radio'), '')).toBe(false);
    });
  });

  describe('select', () => {
    it('빈 문자열이 아닌 값은 응답', () => {
      expect(isQuestionAnswered(q('select'), 'a')).toBe(true);
    });
    it('빈 문자열은 미응답', () => {
      expect(isQuestionAnswered(q('select'), '')).toBe(false);
    });
  });

  describe('checkbox', () => {
    it('비어있지 않은 배열은 응답 (minSelections 미설정)', () => {
      expect(isQuestionAnswered(q('checkbox'), ['a'])).toBe(true);
    });
    it('빈 배열/배열 아님은 미응답', () => {
      expect(isQuestionAnswered(q('checkbox'), [])).toBe(false);
      expect(isQuestionAnswered(q('checkbox'), 'a')).toBe(false);
    });
    it('minSelections 양수면 길이가 그 이상이어야 응답', () => {
      const cb = q('checkbox', { minSelections: 2 });
      expect(isQuestionAnswered(cb, ['a'])).toBe(false);
      expect(isQuestionAnswered(cb, ['a', 'b'])).toBe(true);
      expect(isQuestionAnswered(cb, ['a', 'b', 'c'])).toBe(true);
    });
    it('minSelections=0 이면 비어있지 않은 배열로 충족', () => {
      const cb = q('checkbox', { minSelections: 0 });
      expect(isQuestionAnswered(cb, ['a'])).toBe(true);
    });
  });

  describe('multiselect', () => {
    it('비어있지 않은 배열은 응답', () => {
      expect(isQuestionAnswered(q('multiselect'), ['x', 'y'])).toBe(true);
    });
    it('빈 배열/배열 아님은 미응답', () => {
      expect(isQuestionAnswered(q('multiselect'), [])).toBe(false);
      expect(isQuestionAnswered(q('multiselect'), 'x')).toBe(false);
    });
  });

  describe('ranking (default 분기)', () => {
    it('null/undefined 가 아닌 어떤 값이든 응답으로 취급', () => {
      expect(isQuestionAnswered(q('ranking'), [{ rank: 1, optionValue: 'a' }])).toBe(true);
      expect(isQuestionAnswered(q('ranking'), [])).toBe(true);
      expect(isQuestionAnswered(q('ranking'), {})).toBe(true);
    });
  });

  describe('table', () => {
    it('키가 하나 이상인 object 는 응답', () => {
      expect(isQuestionAnswered(q('table'), { cell1: 'v' })).toBe(true);
    });
    it('빈 object/배열은 미응답', () => {
      expect(isQuestionAnswered(q('table'), {})).toBe(false);
    });
    it('빈 배열은 키 0개라 미응답', () => {
      expect(isQuestionAnswered(q('table'), [])).toBe(false);
    });
    it('비어있지 않은 배열은 인덱스 키가 있어 응답으로 취급', () => {
      // 원본 로직: Object.keys(['v']).length === 1 > 0 → true
      expect(isQuestionAnswered(q('table'), ['v'])).toBe(true);
    });
  });

  describe('notice', () => {
    it('requiresAcknowledgment=false 면 null 이 아닌 값으로 항상 응답', () => {
      const n = q('notice', { requiresAcknowledgment: false });
      expect(isQuestionAnswered(n, true)).toBe(true);
      expect(isQuestionAnswered(n, false)).toBe(true);
      expect(isQuestionAnswered(n, {})).toBe(true);
    });
    it('requiresAcknowledgment 미설정도 false 취급이라 응답', () => {
      const n = q('notice');
      expect(isQuestionAnswered(n, false)).toBe(true);
    });
    it('requiresAcknowledgment=true + agreed 플래그 object 는 agreed 값을 따른다', () => {
      const n = q('notice', { requiresAcknowledgment: true });
      expect(isQuestionAnswered(n, { agreed: true })).toBe(true);
      expect(isQuestionAnswered(n, { agreed: false })).toBe(false);
    });
    it('requiresAcknowledgment=true + response===true 면 응답', () => {
      const n = q('notice', { requiresAcknowledgment: true });
      expect(isQuestionAnswered(n, true)).toBe(true);
    });
    it('requiresAcknowledgment=true + agreed 없는 object/false 면 미응답', () => {
      const n = q('notice', { requiresAcknowledgment: true });
      expect(isQuestionAnswered(n, {})).toBe(false);
      expect(isQuestionAnswered(n, false)).toBe(false);
    });
  });
});

describe('isQuestionAnswered — 그룹별 선택 radio (choiceGroups)', () => {
  it('모든 그룹(rad1, rad2, default)에 선택이 있어야 응답 충족', () => {
    const gq = groupedRadioQ();
    expect(
      isQuestionAnswered(gq, { rad1: 'cellA', rad2: 'cellC', default: 'cellD' }),
    ).toBe(true);
  });

  it('일부 그룹만 선택된 경우 미응답', () => {
    const gq = groupedRadioQ();
    // rad1만 선택, rad2/default 누락
    expect(isQuestionAnswered(gq, { rad1: 'cellA' })).toBe(false);
  });

  it('빈 맵({})은 미응답', () => {
    const gq = groupedRadioQ();
    expect(isQuestionAnswered(gq, {})).toBe(false);
  });

  it('undefined/null 은 미응답', () => {
    const gq = groupedRadioQ();
    expect(isQuestionAnswered(gq, undefined)).toBe(false);
    expect(isQuestionAnswered(gq, null)).toBe(false);
  });

  it('비그룹 radio 기존 동작 유지: 문자열이면 응답', () => {
    expect(isQuestionAnswered(q('radio'), 'opt1')).toBe(true);
    expect(isQuestionAnswered(q('radio'), '')).toBe(false);
  });

  it('phantom 그룹(멤버 0) 이 있어도 살아있는 그룹만 채우면 isQuestionAnswered=true', () => {
    // rad2 는 멤버가 없는 phantom — collectRadioGroups 가 제외하므로 요구 그룹이 줄어든다.
    const withPhantom: Question = {
      id: 'qp',
      type: 'radio',
      title: '팬텀 그룹 테스트',
      required: true,
      order: 0,
      tableColumns: [{ id: 'c1', label: '열' }],
      tableRowsData: [
        {
          id: 'r1',
          label: '',
          cells: [
            { id: 'cellA', type: 'choice_opt', content: '', choiceGroupId: 'grp1' },
            // grp2 에 소속된 셀 없음 — phantom
          ],
        },
      ],
      choiceGroups: [
        { id: 'grp1', type: 'radio', groupKey: 'rad1', label: '그룹1' },
        { id: 'grp2', type: 'radio', groupKey: 'rad2', label: '팬텀' },
      ],
    } as unknown as Question;
    // rad1 만 선택해도 살아있는 그룹은 rad1 뿐이므로 응답 충족
    expect(isQuestionAnswered(withPhantom, { rad1: 'cellA' })).toBe(true);
    // 아무것도 선택 안 하면 미응답
    expect(isQuestionAnswered(withPhantom, {})).toBe(false);
  });
});
