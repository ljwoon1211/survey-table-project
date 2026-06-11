import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GROUP_KEY,
  collectRadioGroups,
  getGroupKeyOfCell,
  isGroupedChoiceQuestion,
  nextGroupKey,
  pruneChoiceGroups,
} from '@/utils/choice-group-helpers';
import type { ChoiceGroup, Question } from '@/types/survey';

const rad1: ChoiceGroup = { id: 'g1', groupKey: 'rad1', type: 'radio', label: 'TV보유' };
const rad2: ChoiceGroup = { id: 'g2', groupKey: 'rad2', type: 'radio', label: '구매의향' };

function makeQuestion(overrides: Record<string, unknown>): Question {
  return {
    id: 'q1', type: 'radio', title: '질문', required: false, order: 1,
    ...overrides,
  } as unknown as Question;
}

const grouped = makeQuestion({
  choiceGroups: [rad1, rad2],
  tableRowsData: [
    {
      id: 'r1', label: '행1',
      cells: [
        { id: 'cellA', content: 'UHD', type: 'choice_opt', choiceGroupId: 'g1' },
        { id: 'cellB', content: 'FHD', type: 'choice_opt', choiceGroupId: 'g1' },
        { id: 'cellC', content: '있음', type: 'choice_opt', choiceGroupId: 'g2' },
        { id: 'cellD', content: '미소속', type: 'choice_opt' },
        { id: 'cellX', content: '텍스트', type: 'text' },
      ],
    },
  ],
});

describe('isGroupedChoiceQuestion', () => {
  it('radio 그룹이 있으면 true', () => {
    expect(isGroupedChoiceQuestion(grouped)).toBe(true);
  });

  it('choiceGroups가 없거나 비면 false - 하위호환 분기점', () => {
    expect(isGroupedChoiceQuestion(makeQuestion({}))).toBe(false);
    expect(isGroupedChoiceQuestion(makeQuestion({ choiceGroups: [] }))).toBe(false);
  });
});

describe('getGroupKeyOfCell', () => {
  it('셀의 choiceGroupId를 groupKey로 해석한다', () => {
    expect(getGroupKeyOfCell(grouped, 'cellA')).toBe('rad1');
    expect(getGroupKeyOfCell(grouped, 'cellC')).toBe('rad2');
  });

  it('미소속 셀은 default 키', () => {
    expect(getGroupKeyOfCell(grouped, 'cellD')).toBe(DEFAULT_GROUP_KEY);
  });

  it('존재하지 않는 그룹 id를 참조하는 셀도 default로 폴백한다', () => {
    const broken = makeQuestion({
      choiceGroups: [rad1],
      tableRowsData: [{ id: 'r1', label: '행1', cells: [
        { id: 'cellZ', content: '', type: 'choice_opt', choiceGroupId: 'ghost' },
      ] }],
    });
    expect(getGroupKeyOfCell(broken, 'cellZ')).toBe(DEFAULT_GROUP_KEY);
  });
});

describe('collectRadioGroups', () => {
  it('명시 그룹 + 미소속 셀 존재 시 default를 멤버 셀과 함께 반환한다', () => {
    const groups = collectRadioGroups(grouped);
    expect(groups.map((g) => g.groupKey)).toEqual(['rad1', 'rad2', DEFAULT_GROUP_KEY]);
    expect(groups[0]!.cells.map((c) => c.id)).toEqual(['cellA', 'cellB']);
    expect(groups[2]!.cells.map((c) => c.id)).toEqual(['cellD']);
  });

  it('미소속 셀이 없으면 default 그룹을 만들지 않는다', () => {
    const noDefault = makeQuestion({
      choiceGroups: [rad1],
      tableRowsData: [{ id: 'r1', label: '행1', cells: [
        { id: 'cellA', content: 'UHD', type: 'choice_opt', choiceGroupId: 'g1' },
      ] }],
    });
    expect(collectRadioGroups(noDefault).map((g) => g.groupKey)).toEqual(['rad1']);
  });

  it('멤버 0인 명시 그룹은 collectRadioGroups 에서 제외된다', () => {
    // rad1 은 멤버 있음, rad2 는 멤버 없음(phantom)
    const withPhantom = makeQuestion({
      choiceGroups: [rad1, rad2],
      tableRowsData: [{ id: 'r1', label: '행1', cells: [
        { id: 'cellA', content: 'UHD', type: 'choice_opt', choiceGroupId: 'g1' },
        { id: 'cellD', content: '미소속', type: 'choice_opt' },
      ] }],
    });
    const groups = collectRadioGroups(withPhantom);
    // rad2(g2)는 멤버 0이므로 제외. rad1 + default(미소속 셀) 만 반환.
    expect(groups.map((g) => g.groupKey)).toEqual(['rad1', DEFAULT_GROUP_KEY]);
  });

  it('멤버 0인 명시 그룹만 있을 때 미소속 셀이 없으면 빈 배열', () => {
    // 모든 그룹이 phantom 이고 미소속 셀도 없는 극단 케이스
    const allPhantom = makeQuestion({
      choiceGroups: [rad1, rad2],
      tableRowsData: [{ id: 'r1', label: '행1', cells: [] }],
    });
    expect(collectRadioGroups(allPhantom)).toEqual([]);
  });
});

describe('nextGroupKey', () => {
  it('기존 rad 순번 다음 번호를 발번한다', () => {
    expect(nextGroupKey([rad1, rad2], 'radio')).toBe('rad3');
  });

  it('그룹이 없으면 rad1', () => {
    expect(nextGroupKey([], 'radio')).toBe('rad1');
  });

  it('수동 오버라이드로 구멍이 나도 최대+1', () => {
    const custom: ChoiceGroup = { id: 'g9', groupKey: 'rad9', type: 'radio', label: 'x' };
    expect(nextGroupKey([custom], 'radio')).toBe('rad10');
  });
});

describe('pruneChoiceGroups', () => {
  it('멤버 0 그룹을 제거한다', () => {
    const q = makeQuestion({
      choiceGroups: [rad1, rad2],
      tableRowsData: [{ id: 'r1', label: '행1', cells: [
        { id: 'cellA', content: '', type: 'choice_opt', choiceGroupId: 'g1' },
      ] }],
    });
    expect(pruneChoiceGroups(q)?.map((g) => g.groupKey)).toEqual(['rad1']);
  });

  it('전부 멤버가 있으면 동일 참조 반환', () => {
    expect(pruneChoiceGroups(grouped)).toBe(grouped.choiceGroups);
  });

  it('choiceGroups가 없으면 undefined', () => {
    expect(pruneChoiceGroups(makeQuestion({}))).toBeUndefined();
  });
});
