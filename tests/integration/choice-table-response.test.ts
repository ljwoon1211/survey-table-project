import { describe, expect, it } from 'vitest';

import type { SurveyResponse } from '@/db/schema';
import { analyzeQuestion } from '@/lib/analytics/analyzer';
import type { Question } from '@/types/survey';
// dispatcher: branch-logic.ts 에서 callers 가 쓰는 공개 함수
import { getBranchRuleForResponse } from '@/utils/branch-logic';
import { transformSingleChoice } from '@/lib/spss/data-transformer';

function choiceTableQ(): Question {
  return {
    id: 'q1',
    type: 'radio',
    title: 'Q',
    required: false,
    order: 0,
    tableColumns: [{ id: 'c1', label: '선택' }],
    tableRowsData: [
      {
        id: 'r1',
        label: '',
        cells: [
          {
            id: 'cellA',
            type: 'choice_opt',
            content: '',
            choiceLabel: 'A',
            branchRule: { id: 'b1', value: 'cellA', action: 'end' },
          },
        ],
      },
    ],
  } as Question;
}

describe('choice table-source 분기', () => {
  it('선택된 choice_opt 셀의 branchRule 을 평가한다', () => {
    const q = choiceTableQ();
    const rule = getBranchRuleForResponse(q, 'cellA'); // 응답값 = 선택된 셀 id
    expect(rule?.action).toBe('end');
  });
});

// 테이블 소스 checkbox: 응답값은 일반 checkbox 와 동일한 cell.id 문자열 배열.
// 집계는 resolveChoiceOptions(question) 로 옵션을 풀어 cell.id 별 분포를 만든다.
function choiceTableCheckboxQ(): Question {
  return {
    id: 'q1',
    type: 'checkbox',
    title: 'Q',
    required: false,
    order: 0,
    tableColumns: [{ id: 'c1', label: '선택' }],
    tableRowsData: [
      {
        id: 'r1',
        label: '',
        cells: [
          { id: 'cellA', type: 'choice_opt', content: '', choiceLabel: 'A' },
        ],
      },
      {
        id: 'r2',
        label: '',
        cells: [
          { id: 'cellB', type: 'choice_opt', content: '', choiceLabel: 'B' },
        ],
      },
    ],
  } as Question;
}

// analyzeQuestion 은 SurveyResponse[] 를 받아 r.questionResponses[question.id] 를 읽는다.
// 테스트에 필요한 필드만 채우고 나머지는 캐스팅으로 생략한다.
function responseFixture(id: string, value: string[]): SurveyResponse {
  return {
    id,
    questionResponses: { q1: value },
    completedAt: new Date(),
  } as unknown as SurveyResponse;
}

describe('choice table-source checkbox 집계', () => {
  it('cell.id 별 분포를 정확히 카운트한다', () => {
    const q = choiceTableCheckboxQ();
    const responses: SurveyResponse[] = [
      responseFixture('resp1', ['cellA', 'cellB']), // 응답자 1
      responseFixture('resp2', ['cellA']), // 응답자 2
    ];

    const result = analyzeQuestion(q, responses);
    expect(result.type).toBe('multiple');
    if (result.type !== 'multiple') throw new Error('checkbox 는 multiple 분석이어야 한다');

    const a = result.distribution.find((d) => d.value === 'cellA');
    const b = result.distribution.find((d) => d.value === 'cellB');

    expect(a?.count).toBe(2);
    expect(b?.count).toBe(1);
  });
});

/**
 * 그룹별 선택 radio: getBranchRuleForResponse 가 grouped 응답 맵을 처리한다.
 * 맵의 값들(선택 cell.id 목록) 중 branchRule 이 있는 첫 번째 옵션을 반환.
 */
function groupedBranchQ(): Question {
  return {
    id: 'qg',
    type: 'radio',
    title: '그룹 분기 라디오',
    required: false,
    order: 0,
    tableColumns: [{ id: 'c1', label: '열' }],
    tableRowsData: [
      {
        id: 'row1',
        label: '',
        cells: [
          {
            id: 'cellA',
            type: 'choice_opt',
            content: '',
            choiceGroupId: 'grp1',
            branchRule: { id: 'b1', value: 'cellA', action: 'end' },
          },
          {
            id: 'cellB',
            type: 'choice_opt',
            content: '',
            choiceGroupId: 'grp1',
          },
          {
            id: 'cellC',
            type: 'choice_opt',
            content: '',
            choiceGroupId: 'grp2',
          },
        ],
      },
    ],
    choiceGroups: [
      { id: 'grp1', type: 'radio', groupKey: 'rad1', label: '그룹1' },
      { id: 'grp2', type: 'radio', groupKey: 'rad2', label: '그룹2' },
    ],
  } as unknown as Question;
}

describe('그룹별 선택 radio 분기 로직', () => {
  it('grouped 응답 맵에서 branchRule 있는 선택 셀의 규칙을 반환한다', () => {
    const q = groupedBranchQ();
    const rule = getBranchRuleForResponse(q, { rad1: 'cellA', rad2: 'cellC' });
    expect(rule?.action).toBe('end');
  });

  it('branchRule 없는 셀만 선택된 경우 null 반환', () => {
    const q = groupedBranchQ();
    const rule = getBranchRuleForResponse(q, { rad1: 'cellB', rad2: 'cellC' });
    expect(rule).toBeNull();
  });

  it('빈 맵({})이면 null 반환', () => {
    const q = groupedBranchQ();
    const rule = getBranchRuleForResponse(q, {});
    expect(rule).toBeNull();
  });
});

/**
 * checkbox 그룹이 포함된 grouped 응답 맵에서 branchRule 탐색.
 * { cb1: ['cellE'] } 에서 cellE 의 branchRule 반환.
 */
function groupedCheckboxBranchQ(): Question {
  return {
    id: 'qgcb',
    type: 'radio',
    title: '혼합 분기 질문',
    required: false,
    order: 0,
    tableColumns: [{ id: 'c1', label: '열' }],
    tableRowsData: [
      {
        id: 'row1',
        label: '',
        cells: [
          {
            id: 'cellA',
            type: 'choice_opt',
            content: '',
            choiceGroupId: 'grp1',
          },
          {
            id: 'cellE',
            type: 'choice_opt',
            content: '',
            choiceGroupId: 'grpCb',
            branchRule: { id: 'bE', value: 'cellE', action: 'end' },
          },
          {
            id: 'cellF',
            type: 'choice_opt',
            content: '',
            choiceGroupId: 'grpCb',
          },
        ],
      },
    ],
    choiceGroups: [
      { id: 'grp1', type: 'radio', groupKey: 'rad1', label: 'Radio그룹' },
      { id: 'grpCb', type: 'checkbox', groupKey: 'cb1', label: 'CB그룹' },
    ],
  } as unknown as Question;
}

describe('checkbox 그룹 분기 로직', () => {
  it('{ cb1: [cellE] } 에서 cellE branchRule 반환', () => {
    const q = groupedCheckboxBranchQ();
    const rule = getBranchRuleForResponse(q, { rad1: 'cellA', cb1: ['cellE'] });
    expect(rule?.action).toBe('end');
  });

  it('branchRule 없는 셀만 선택된 경우 null', () => {
    const q = groupedCheckboxBranchQ();
    const rule = getBranchRuleForResponse(q, { rad1: 'cellA', cb1: ['cellF'] });
    expect(rule).toBeNull();
  });

  it('{ cb1: [cellE, cellF] } — cellE branchRule 반환(첫 번째 매칭)', () => {
    const q = groupedCheckboxBranchQ();
    const rule = getBranchRuleForResponse(q, { cb1: ['cellE', 'cellF'] });
    expect(rule?.action).toBe('end');
  });

  it('빈 맵({})이면 null', () => {
    const q = groupedCheckboxBranchQ();
    const rule = getBranchRuleForResponse(q, {});
    expect(rule).toBeNull();
  });
});

describe('choice table-source SPSS 단일/복수 변수 계약', () => {
  function radioTableQ(): Question {
    return {
      id: 'q1',
      type: 'radio',
      title: 'Q',
      required: false,
      order: 0,
      questionCode: 'Q2',
      options: [],
      tableColumns: [{ id: 'c1', label: '선택' }],
      tableRowsData: [
        { id: 'r1', label: '', cells: [{ id: 'cellA', type: 'choice_opt', content: '', choiceLabel: 'A' }] },
        { id: 'r2', label: '', cells: [{ id: 'cellB', type: 'choice_opt', content: '', choiceLabel: 'B' }] },
        { id: 'r3', label: '', cells: [{ id: 'cellC', type: 'choice_opt', content: '', choiceLabel: 'C' }] },
      ],
    } as Question;
  }

  it('라디오는 단일 변수 Q2 에 선택한 보기 코드 하나, 미선택은 null', () => {
    const q = radioTableQ();
    // 선택값 = cell.id. 기본 코드 = 수집 순서 1-based.
    expect(transformSingleChoice(q, 'cellA')).toBe(1);
    expect(transformSingleChoice(q, 'cellC')).toBe(3);
    expect(transformSingleChoice(q, null)).toBeNull();
  });
});
