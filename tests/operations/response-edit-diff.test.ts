import { describe, expect, it } from 'vitest';

import {
  buildChangedQuestions,
  diffQuestionResponses,
} from '@/lib/operations/response-edit-diff';
import type { SurveyVersionSnapshot } from '@/db/schema/schema-types';

describe('diffQuestionResponses', () => {
  it('값이 바뀐 questionId 를 찾는다', () => {
    expect(diffQuestionResponses({ q1: 'a', q2: 'x' }, { q1: 'b', q2: 'x' })).toEqual(['q1']);
  });

  it('추가/삭제된 questionId 를 찾는다', () => {
    expect(
      diffQuestionResponses({ q1: 'a' }, { q1: 'a', q2: 'new' }).sort(),
    ).toEqual(['q2']);
    expect(diffQuestionResponses({ q1: 'a', q2: 'old' }, { q1: 'a' })).toEqual(['q2']);
  });

  it('키 순서만 다른 객체 값은 변경으로 보지 않는다', () => {
    expect(
      diffQuestionResponses({ q1: { a: 1, b: 2 } }, { q1: { b: 2, a: 1 } }),
    ).toEqual([]);
  });

  it('중첩 배열/객체의 실제 변경을 감지한다', () => {
    expect(
      diffQuestionResponses({ q1: { rows: [1, 2] } }, { q1: { rows: [1, 3] } }),
    ).toEqual(['q1']);
  });
});

describe('buildChangedQuestions', () => {
  const snapshot = {
    questions: [
      { id: 'q1', title: '성별', questionCode: 'Q1' },
      { id: 'q2', title: '나이' },
    ],
  } as unknown as SurveyVersionSnapshot;

  it('스냅샷에서 code/title 을 매핑한다', () => {
    expect(buildChangedQuestions(['q1'], snapshot)).toEqual([
      { questionId: 'q1', code: 'Q1', title: '성별' },
    ]);
  });

  it('questionCode 없으면 code=null', () => {
    expect(buildChangedQuestions(['q2'], snapshot)).toEqual([
      { questionId: 'q2', code: null, title: '나이' },
    ]);
  });

  it('스냅샷에 없는 id 는 title 을 questionId 로 폴백', () => {
    expect(buildChangedQuestions(['zzz'], snapshot)).toEqual([
      { questionId: 'zzz', code: null, title: 'zzz' },
    ]);
    expect(buildChangedQuestions(['q1'], null)).toEqual([
      { questionId: 'q1', code: null, title: 'q1' },
    ]);
  });
});
