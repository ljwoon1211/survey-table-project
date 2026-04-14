import type { Question, QuestionGroup } from '@/types/survey';

// ── 타입 ──

export type GroupChildItem =
  | { kind: 'question'; data: Question }
  | { kind: 'subgroup'; data: QuestionGroup };

// ── DnD ID 유틸리티 ──

const GROUP_DND_PREFIX = 'group::';

export function toGroupDndId(groupId: string): string {
  return `${GROUP_DND_PREFIX}${groupId}`;
}

export function isGroupDndId(id: string): boolean {
  return id.startsWith(GROUP_DND_PREFIX);
}

export function extractGroupId(dndId: string): string {
  return dndId.slice(GROUP_DND_PREFIX.length);
}

// ── 인터리브 정렬 ──

/**
 * 특정 그룹 내의 직접 자식(질문 + 하위그룹)을 인터리브된 순서로 반환.
 *
 * 알고리즘:
 * 1. 하위그룹을 order 값으로 위치 슬롯에 배치
 * 2. 질문을 전역 order 순으로 정렬한 뒤 남은 슬롯을 순서대로 채움
 *
 * @param groupId 부모 그룹 ID (null이면 최상위 레벨의 그룹 없는 질문)
 */
export function getInterleavedChildren(
  groupId: string | null,
  questions: Question[],
  groups: QuestionGroup[],
): GroupChildItem[] {
  // 직접 질문: 전역 order 순 정렬
  const directQuestions = questions
    .filter((q) => (groupId ? q.groupId === groupId : !q.groupId))
    .sort((a, b) => a.order - b.order);

  // 직접 하위그룹: order 순 정렬
  const directSubGroups = groupId
    ? groups.filter((g) => g.parentGroupId === groupId).sort((a, b) => a.order - b.order)
    : [];

  if (directSubGroups.length === 0) {
    return directQuestions.map((q) => ({ kind: 'question' as const, data: q }));
  }

  const totalSize = directQuestions.length + directSubGroups.length;
  const result: GroupChildItem[] = new Array(totalSize);

  // 1. 하위그룹을 order 위치에 배치 (범위 초과 시 clamp)
  const usedSlots = new Set<number>();
  for (const sg of directSubGroups) {
    const pos = Math.max(0, Math.min(sg.order, totalSize - 1));
    let slot = pos;
    while (usedSlots.has(slot) && slot < totalSize) slot++;
    if (slot >= totalSize) {
      slot = 0;
      while (usedSlots.has(slot) && slot < totalSize) slot++;
    }
    if (slot < totalSize) {
      usedSlots.add(slot);
      result[slot] = { kind: 'subgroup', data: sg };
    }
  }

  // 2. 질문을 남은 슬롯에 순서대로 채움
  let qIdx = 0;
  for (let i = 0; i < totalSize; i++) {
    if (!result[i] && qIdx < directQuestions.length) {
      result[i] = { kind: 'question', data: directQuestions[qIdx] };
      qIdx++;
    }
  }

  return result;
}

/**
 * 전체 설문의 질문을 그룹 계층 + 인터리브 순서로 평탄화.
 * 결과 배열 순서 = 올바른 전역 순서.
 *
 * 순회 순서:
 * 1. 최상위 그룹을 order 순으로 → 각 그룹의 인터리브 자식 재귀
 * 2. 그룹 없는 질문 (ungrouped)
 */
export function buildFlatOrderedQuestions(
  questions: Question[],
  groups: QuestionGroup[],
): Question[] {
  const result: Question[] = [];

  const topLevelGroups = groups
    .filter((g) => !g.parentGroupId)
    .sort((a, b) => a.order - b.order);

  // 재귀적으로 그룹의 자식을 평탄화
  const flattenGroup = (groupId: string) => {
    const children = getInterleavedChildren(groupId, questions, groups);
    for (const child of children) {
      if (child.kind === 'question') {
        result.push(child.data);
      } else {
        // 하위그룹: 하위그룹 내부의 질문을 재귀적으로 추가
        flattenGroup(child.data.id);
      }
    }
  };

  for (const group of topLevelGroups) {
    flattenGroup(group.id);
  }

  // 그룹 없는 질문
  const ungrouped = questions
    .filter((q) => !q.groupId)
    .sort((a, b) => a.order - b.order);
  result.push(...ungrouped);

  return result;
}

/**
 * 특정 DnD ID(질문 ID 또는 group::그룹ID)의 부모 그룹 ID를 찾는다.
 */
export function findParentGroupId(
  dndId: string,
  questions: Question[],
  groups: QuestionGroup[],
): string | null {
  if (isGroupDndId(dndId)) {
    const groupId = extractGroupId(dndId);
    const group = groups.find((g) => g.id === groupId);
    return group?.parentGroupId ?? null;
  }
  // 질문인 경우
  const question = questions.find((q) => q.id === dndId);
  return question?.groupId ?? null;
}
