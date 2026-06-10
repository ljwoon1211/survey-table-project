import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ChoiceGroup } from '@/types/survey';
import { ChoiceOptCellTab } from '@/components/survey-builder/choice-opt-cell-tab';

// 기본 공통 props (단일 radio 그룹 없는 초기 상태)
function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    choiceLabel: '',
    onChoiceLabelChange: vi.fn(),
    spssNumericCode: '' as const,
    onSpssNumericCodeChange: vi.fn(),
    allowTextInput: false,
    onAllowTextInputChange: vi.fn(),
    branchRule: undefined,
    onBranchRuleChange: vi.fn(),
    allQuestions: [],
    currentQuestionId: 'q1',
    choiceGroups: [] as ChoiceGroup[],
    groupMemberCounts: {} as Record<string, number>,
    choiceGroupId: '',
    onChoiceGroupIdChange: vi.fn(),
    onChoiceGroupsChange: vi.fn(),
    ...overrides,
  };
}

const rad1: ChoiceGroup = { id: 'g1', groupKey: 'rad1', type: 'radio', label: 'TV보유' };
const rad2: ChoiceGroup = { id: 'g2', groupKey: 'rad2', type: 'radio', label: '구매의향' };

describe('ChoiceOptCellTab — 옵션 그룹 지정 UI', () => {
  it('그룹 목록에 멤버 수가 포함된 옵션이 표시된다', () => {
    render(
      <ChoiceOptCellTab
        {...makeProps({
          choiceGroups: [rad1, rad2],
          groupMemberCounts: { g1: 2, g2: 3 },
        })}
      />,
    );

    // select 옵션에 그룹 라벨과 셀 수가 있어야 한다
    expect(screen.getByRole('option', { name: /TV보유/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /셀 2/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /구매의향/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /셀 3/ })).toBeInTheDocument();
  });

  it('"+ 새 그룹" 선택 시 onChoiceGroupsChange와 onChoiceGroupIdChange가 새 그룹으로 호출된다', async () => {
    const onChoiceGroupsChange = vi.fn();
    const onChoiceGroupIdChange = vi.fn();

    render(
      <ChoiceOptCellTab
        {...makeProps({
          choiceGroups: [rad1, rad2],
          groupMemberCounts: { g1: 2, g2: 3 },
          onChoiceGroupsChange,
          onChoiceGroupIdChange,
        })}
      />,
    );

    const select = screen.getByRole('combobox', { name: /그룹/ });
    await userEvent.selectOptions(select, '__new__');

    // 새 그룹이 choiceGroups 에 추가되어야 한다
    expect(onChoiceGroupsChange).toHaveBeenCalledOnce();
    const newGroups: ChoiceGroup[] = onChoiceGroupsChange.mock.calls[0]![0] as ChoiceGroup[];
    expect(newGroups).toHaveLength(3);
    const newGroup = newGroups[2]!;
    expect(newGroup.groupKey).toBe('rad3');
    expect(newGroup.type).toBe('radio');

    // onChoiceGroupIdChange 는 새 그룹 id 로 호출되어야 한다
    expect(onChoiceGroupIdChange).toHaveBeenCalledWith(newGroup.id);
  });

  it('소속 그룹의 라벨 수정 시 onChoiceGroupsChange가 해당 그룹 label만 바꾼 배열로 호출된다', async () => {
    const onChoiceGroupsChange = vi.fn();

    render(
      <ChoiceOptCellTab
        {...makeProps({
          choiceGroups: [rad1, rad2],
          groupMemberCounts: { g1: 2, g2: 3 },
          choiceGroupId: 'g1',
          onChoiceGroupsChange,
        })}
      />,
    );

    // 라벨 input 에 문자를 추가로 타이핑하면 onChange 가 호출되어야 한다.
    // 컴포넌트가 controlled(value=currentGroup.label)이므로 type 이벤트 1개로 검증한다.
    const labelInput = screen.getByPlaceholderText(/그룹 라벨/);
    await userEvent.type(labelInput, 'X');

    // 마지막 호출에서 g1 의 label 에 'X' 가 추가되어야 한다
    const lastCall: ChoiceGroup[] =
      onChoiceGroupsChange.mock.calls[onChoiceGroupsChange.mock.calls.length - 1]![0] as ChoiceGroup[];
    const updated = lastCall.find((g) => g.id === 'g1')!;
    expect(updated.label).toContain('X');
    // g2 는 그대로
    expect(lastCall.find((g) => g.id === 'g2')!.label).toBe('구매의향');
  });

  it('"(그룹 없음)" 선택 시 onChoiceGroupIdChange("")가 호출된다', async () => {
    const onChoiceGroupIdChange = vi.fn();

    render(
      <ChoiceOptCellTab
        {...makeProps({
          choiceGroups: [rad1],
          groupMemberCounts: { g1: 1 },
          choiceGroupId: 'g1',
          onChoiceGroupIdChange,
        })}
      />,
    );

    const select = screen.getByRole('combobox', { name: /그룹/ });
    await userEvent.selectOptions(select, '');

    expect(onChoiceGroupIdChange).toHaveBeenCalledWith('');
  });

  it('체크박스·순위 세그먼트 버튼은 disabled 상태다', () => {
    render(<ChoiceOptCellTab {...makeProps()} />);

    // 라디오는 활성, 나머지는 disabled
    const checkboxBtn = screen.getByRole('button', { name: /체크박스/ });
    const rankingBtn = screen.getByRole('button', { name: /순위/ });
    expect(checkboxBtn).toBeDisabled();
    expect(rankingBtn).toBeDisabled();
  });
});
