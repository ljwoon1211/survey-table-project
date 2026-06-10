import type { ChoiceGroup, Question, TableCell } from '@/types/survey';
import { collectChoiceOptCells } from '@/utils/choice-source';

/** 그룹 미소속 choice_opt 셀의 예약 응답 키. export 변수명은 질문코드 그대로(하위호환). */
export const DEFAULT_GROUP_KEY = 'default';

/** 그룹별 응답 맵 shape: { groupKey: 선택 cellId } */
export type GroupedChoiceAnswer = Record<string, string>;

/**
 * 이 질문의 응답이 그룹별 맵 shape인지 — 모든 경로(렌더/검증/분기/export)의
 * 하위호환 분기점. radio 그룹이 1개 이상 정의된 경우에만 true.
 */
export function isGroupedChoiceQuestion(question: Question): boolean {
  return (question.choiceGroups ?? []).some((g) => g.type === 'radio');
}

/** 셀이 속한 그룹의 groupKey. 미소속/깨진 참조는 default로 폴백. */
export function getGroupKeyOfCell(question: Question, cellId: string): string {
  const cell = collectChoiceOptCells(question.tableRowsData).find((c) => c.id === cellId);
  if (!cell?.choiceGroupId) return DEFAULT_GROUP_KEY;
  const group = (question.choiceGroups ?? []).find((g) => g.id === cell.choiceGroupId);
  return group?.groupKey ?? DEFAULT_GROUP_KEY;
}

export interface RadioGroupWithCells {
  groupKey: string;
  label: string;
  cells: TableCell[];
}

/**
 * 질문의 radio 그룹들을 멤버 셀과 함께 반환한다 (정의 순).
 * 미소속 choice_opt 셀이 있으면 default 그룹을 마지막에 추가한다.
 */
export function collectRadioGroups(question: Question): RadioGroupWithCells[] {
  const allCells = collectChoiceOptCells(question.tableRowsData);
  const groups: RadioGroupWithCells[] = [];
  const claimed = new Set<string>();

  for (const group of question.choiceGroups ?? []) {
    if (group.type !== 'radio') continue;
    const cells = allCells.filter((c) => c.choiceGroupId === group.id);
    for (const c of cells) claimed.add(c.id);
    groups.push({ groupKey: group.groupKey, label: group.label, cells });
  }

  const orphans = allCells.filter((c) => !claimed.has(c.id));
  if (orphans.length > 0) {
    groups.push({ groupKey: DEFAULT_GROUP_KEY, label: '', cells: orphans });
  }
  return groups;
}

const KEY_PREFIX: Record<ChoiceGroup['type'], string> = {
  radio: 'rad',
  checkbox: 'cb',
  ranking: 'rnk',
};

/** 그룹 키 자동 발번: 같은 종류의 최대 순번 + 1 (rad1, rad2 ...) */
export function nextGroupKey(groups: ChoiceGroup[], type: ChoiceGroup['type']): string {
  const prefix = KEY_PREFIX[type];
  let max = 0;
  for (const g of groups) {
    const m = g.groupKey.match(new RegExp(`^${prefix}(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${max + 1}`;
}

/**
 * 멤버 0 그룹을 제거한 choiceGroups를 반환한다 (저장 시 자동 정리 — 삭제 UI 없음).
 * 변경 없으면 원본 참조 유지, choiceGroups 자체가 없으면 undefined.
 */
export function pruneChoiceGroups(question: Question): ChoiceGroup[] | undefined {
  const groups = question.choiceGroups;
  if (!groups) return undefined;
  const memberIds = new Set(
    collectChoiceOptCells(question.tableRowsData)
      .map((c) => c.choiceGroupId)
      .filter((id): id is string => !!id),
  );
  const pruned = groups.filter((g) => memberIds.has(g.id));
  return pruned.length === groups.length ? groups : pruned;
}
