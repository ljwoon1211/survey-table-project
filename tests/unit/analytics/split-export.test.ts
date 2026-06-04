import { describe, it, expect } from 'vitest';

import { valueMatchSet } from '@/lib/analytics/split-export';
import type { QuestionConditionGroup } from '@/types/survey';

const vm = (sourceQuestionId: string, requiredValues: string[]): QuestionConditionGroup => ({
  logicType: 'AND',
  conditions: [
    { id: 'c1', sourceQuestionId, conditionType: 'value-match', requiredValues, logicType: 'AND' },
  ],
});

describe('valueMatchSet', () => {
  it('value-match 조건의 requiredValues를 Set으로 모은다', () => {
    const set = valueMatchSet(vm('Q2', ['opt1', 'opt3']), 'Q2');
    expect(set).not.toBeNull();
    expect([...set!].sort()).toEqual(['opt1', 'opt3']);
  });

  it('다른 sourceQuestionId는 무시한다', () => {
    expect(valueMatchSet(vm('Q9', ['opt1']), 'Q2')).toBeNull();
  });

  it('value-match가 아닌 conditionType은 무시한다', () => {
    const dc: QuestionConditionGroup = {
      logicType: 'AND',
      conditions: [
        { id: 'c1', sourceQuestionId: 'Q2', conditionType: 'table-cell-check', logicType: 'AND' },
      ],
    };
    expect(valueMatchSet(dc, 'Q2')).toBeNull();
  });

  it('조건이 없으면 null', () => {
    expect(valueMatchSet(undefined, 'Q2')).toBeNull();
  });
});
