import { describe, it, expect } from 'vitest';
import type { Question, QuestionCondition } from '@/types/survey';
import { shouldDisplayQuestion } from '@/utils/branch-logic';

// 숫자 입력 셀이 있는 테이블 소스 질문 생성
function makeSourceQuestion(rowId: string, cellId: string): Question {
  return {
    id: 'q-source',
    surveyId: 's1',
    type: 'table',
    title: '비용 표',
    required: false,
    order: 0,
    tableColumns: [
      { id: 'col-label', label: '항목' },
      { id: 'col-amount', label: '금액' },
    ],
    tableRowsData: [
      {
        id: rowId,
        label: '출장비',
        cells: [
          { id: 'lbl', content: '출장비', type: 'text' as const },
          {
            id: cellId,
            content: '',
            type: 'input' as const,
            inputType: 'number' as const,
          },
        ],
      },
    ],
  } as unknown as Question;
}

// 숫자 비교 조건을 가진 더미 타겟 질문 생성
// shouldDisplayQuestion(targetQ, responses, allQuestions) 호출 시
// targetQ.displayCondition 을 통해 조건을 평가함
function makeTargetQuestion(
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=',
  comparandValue: number,
  rowId: string,
): Question {
  const condition: QuestionCondition = {
    id: 'cond-1',
    sourceQuestionId: 'q-source',
    conditionType: 'table-cell-check',
    logicType: 'AND',
    tableConditions: {
      rowIds: [rowId],
      cellColumnIndex: 1,
      checkType: 'any',
      numericComparison: {
        operator,
        comparand: { kind: 'literal', value: comparandValue },
      },
    },
  };

  return {
    id: 'q-target',
    surveyId: 's1',
    type: 'text',
    title: '대상 질문',
    required: false,
    order: 1,
    displayCondition: {
      conditions: [condition],
      logicType: 'AND',
    },
  } as unknown as Question;
}

describe('branch-logic — numericComparison on input(number) cell', () => {
  const rowId = 'row-1';
  const cellId = 'cell-amount';

  function evalWith(
    cellValue: string,
    operator: '==' | '!=' | '>' | '<' | '>=' | '<=',
    comparandValue: number,
  ): boolean {
    const sourceQuestion = makeSourceQuestion(rowId, cellId);
    const targetQuestion = makeTargetQuestion(operator, comparandValue, rowId);
    const responses: Record<string, unknown> = {
      'q-source': { [cellId]: cellValue },
    };
    const allQuestions = [sourceQuestion, targetQuestion];
    return shouldDisplayQuestion(targetQuestion, responses, allQuestions);
  }

  it('== 0 matches "0"', () => { expect(evalWith('0', '==', 0)).toBe(true); });
  it('== 0 does not match "1"', () => { expect(evalWith('1', '==', 0)).toBe(false); });
  it('!= 0 matches "1"', () => { expect(evalWith('1', '!=', 0)).toBe(true); });
  it('!= 0 does not match "0"', () => { expect(evalWith('0', '!=', 0)).toBe(false); });
  it('>= 1 matches "1"', () => { expect(evalWith('1', '>=', 1)).toBe(true); });
  it('>= 1 matches "10"', () => { expect(evalWith('10', '>=', 1)).toBe(true); });
  it('>= 1 does not match "0"', () => { expect(evalWith('0', '>=', 1)).toBe(false); });
  it('> 0 does not match "0"', () => { expect(evalWith('0', '>', 0)).toBe(false); });
  it('< 1000 matches "999"', () => { expect(evalWith('999', '<', 1000)).toBe(true); });
  it('<= 1000 matches "1000"', () => { expect(evalWith('1000', '<=', 1000)).toBe(true); });
  it('supports negative values (== -5)', () => { expect(evalWith('-5', '==', -5)).toBe(true); });
  it('supports decimals (>= 1.5)', () => {
    expect(evalWith('1.5', '>=', 1.5)).toBe(true);
    expect(evalWith('1.4', '>=', 1.5)).toBe(false);
  });
  it('non-numeric value → false', () => {
    expect(evalWith('abc', '==', 0)).toBe(false);
    expect(evalWith('abc', '!=', 0)).toBe(false);
    expect(evalWith('abc', '>=', 0)).toBe(false);
  });
  it('empty cell → false', () => { expect(evalWith('', '==', 0)).toBe(false); });
});
