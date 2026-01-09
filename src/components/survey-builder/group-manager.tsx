"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useSurveyBuilderStore } from "@/stores/survey-store";
import { QuestionGroup, QuestionConditionGroup } from "@/types/survey";
import { isUUID } from "@/lib/survey-url";
import { FolderPlus } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableGroupItem } from "./group-manager/group-item";
import { GroupCreateModal } from "./group-manager/group-create-modal";
import { GroupEditModal } from "./group-manager/group-edit-modal";
import { canBeParentOf } from "./group-manager/group-helpers";

interface GroupManagerProps {
  className?: string;
}

export function GroupManager({ className }: GroupManagerProps) {
  const { currentSurvey, addGroup, updateGroup, deleteGroup, reorderGroups } =
    useSurveyBuilderStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<QuestionGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [parentGroupIdForNew, setParentGroupIdForNew] = useState<string | undefined>(undefined);
  const [parentGroupIdForEdit, setParentGroupIdForEdit] = useState<string | undefined>(undefined);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const groups = useMemo(() => currentSurvey.groups || [], [currentSurvey.groups]);

  // 모달이 열려있는 동안 currentSurvey.groups가 업데이트되면 editingGroup도 업데이트
  useEffect(() => {
    if (isEditModalOpen && editingGroup?.id) {
      const latestGroup = groups.find((g) => g.id === editingGroup.id);
      if (latestGroup) {
        // displayCondition이 다르거나 다른 필드가 업데이트된 경우
        const hasChanges =
          latestGroup.displayCondition !== editingGroup.displayCondition ||
          latestGroup.name !== editingGroup.name ||
          latestGroup.description !== editingGroup.description ||
          latestGroup.parentGroupId !== editingGroup.parentGroupId;

        if (hasChanges) {
          setEditingGroup(latestGroup);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditModalOpen, editingGroup?.id, groups]);

  // 최상위 그룹만 필터링 (parentGroupId가 없는 것들)
  const topLevelGroups = useMemo(
    () => groups.filter((g) => !g.parentGroupId).sort((a, b) => a.order - b.order),
    [groups],
  );

  // 특정 그룹의 하위 그룹들 가져오기
  const getSubGroups = useCallback(
    (parentId: string) => {
      return groups.filter((g) => g.parentGroupId === parentId).sort((a, b) => a.order - b.order);
    },
    [groups],
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // 각 그룹에 직접 속한 질문 개수 계산 (메모이제이션)
  const questionCountMap = useMemo(() => {
    const map = new Map<string, number>();
    groups.forEach((group) => {
      const count = currentSurvey.questions.filter((q) => q.groupId === group.id).length;
      map.set(group.id, count);
    });
    return map;
  }, [groups, currentSurvey.questions]);

  // 재귀적으로 그룹과 모든 하위 그룹의 질문 개수 합계 계산 (메모이제이션)
  const getTotalQuestionCount = useCallback(
    (groupId: string): number => {
      const directCount = questionCountMap.get(groupId) || 0;
      const subGroups = getSubGroups(groupId);
      const subGroupsCount = subGroups.reduce((sum, subGroup) => {
        return sum + getTotalQuestionCount(subGroup.id);
      }, 0);
      return directCount + subGroupsCount;
    },
    [questionCountMap, getSubGroups],
  );

  // 재귀적으로 모든 하위 그룹 개수 계산 (직접 하위 + 하위의 하위) (메모이제이션)
  const subGroupCountMap = useMemo(() => {
    const map = new Map<string, number>();

    const calculateCount = (groupId: string): number => {
      if (map.has(groupId)) {
        return map.get(groupId)!;
      }
      const directSubGroups = getSubGroups(groupId);
      const directCount = directSubGroups.length;
      const nestedCount = directSubGroups.reduce((sum, subGroup) => {
        return sum + calculateCount(subGroup.id);
      }, 0);
      const total = directCount + nestedCount;
      map.set(groupId, total);
      return total;
    };

    // 모든 그룹에 대해 계산
    groups.forEach((group) => {
      if (!map.has(group.id)) {
        calculateCount(group.id);
      }
    });

    return map;
  }, [groups, getSubGroups]);

  const getTotalSubGroupCount = useCallback(
    (groupId: string): number => {
      return subGroupCountMap.get(groupId) || 0;
    },
    [subGroupCountMap],
  );

  const handleCreateGroup = async () => {
    if (groupName.trim()) {
      let createdGroupId: string | undefined;

      // DB에 그룹 저장
      if (currentSurvey.id && isUUID(currentSurvey.id)) {
        try {
          const { createQuestionGroup } = await import("@/actions/survey-actions");
          const createdGroup = await createQuestionGroup({
            surveyId: currentSurvey.id,
            name: groupName.trim(),
            description: groupDescription.trim() || undefined,
            parentGroupId: parentGroupIdForNew,
          });
          createdGroupId = createdGroup.id;
        } catch (error) {
          console.error("그룹 생성 실패:", error);
          alert("그룹 생성에 실패했습니다. 다시 시도해주세요.");
          return;
        }
      }

      // 로컬 스토어 업데이트
      if (createdGroupId && isUUID(createdGroupId)) {
        // DB에서 생성된 그룹의 UUID를 사용하여 직접 추가
        const groups = currentSurvey.groups || [];
        const siblingGroups = groups.filter((g) => g.parentGroupId === parentGroupIdForNew);
        const maxOrder =
          siblingGroups.length > 0 ? Math.max(...siblingGroups.map((g) => g.order)) : -1;

        const newGroup: QuestionGroup = {
          id: createdGroupId,
          surveyId: currentSurvey.id!,
          name: groupName.trim(),
          description: groupDescription.trim() || undefined,
          order: maxOrder + 1,
          parentGroupId: parentGroupIdForNew || undefined,
          color: undefined,
          collapsed: false,
        };

        // 스토어에 직접 추가 (updateGroup을 사용하여 그룹 추가)
        // updateGroup은 기존 그룹을 업데이트하므로, 직접 스토어 상태 업데이트
        const { currentSurvey: current } = useSurveyBuilderStore.getState();
        useSurveyBuilderStore.setState({
          currentSurvey: {
            ...current,
            groups: [...(current.groups || []), newGroup],
            updatedAt: new Date(),
          },
          isDirty: true,
        });
      } else {
        // UUID가 없으면 임시 그룹으로 추가
        addGroup(groupName.trim(), groupDescription.trim() || undefined, parentGroupIdForNew);
      }

      setGroupName("");
      setGroupDescription("");
      setParentGroupIdForNew(undefined);
      setIsCreateModalOpen(false);
      // 그룹 생성은 이미 createQuestionGroup API로 저장됨
    }
  };

  const handleOpenCreateModal = (parentId?: string) => {
    setParentGroupIdForNew(parentId);
    setIsCreateModalOpen(true);
  };

  const handleToggleExpand = (groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleEditGroup = (group: QuestionGroup) => {
    // currentSurvey.groups에서 최신 그룹 정보 가져오기 (displayCondition 포함)
    const latestGroup = groups.find((g) => g.id === group.id) || group;
    setEditingGroup(latestGroup);
    setGroupName(latestGroup.name);
    setGroupDescription(latestGroup.description || "");
    setParentGroupIdForEdit(latestGroup.parentGroupId);
    setIsEditModalOpen(true);
  };

  const handleGroupConditionUpdate = (conditionGroup: QuestionConditionGroup | undefined) => {
    if (editingGroup) {
      updateGroup(editingGroup.id, { displayCondition: conditionGroup });

      // DB에 저장 (그룹 ID가 UUID인 경우에만)
      if (currentSurvey.id && isUUID(currentSurvey.id) && isUUID(editingGroup.id)) {
        import("@/actions/survey-actions").then(({ updateQuestionGroup }) => {
          updateQuestionGroup(editingGroup.id, {
            displayCondition: conditionGroup,
          }).catch((error) => {
            console.error("그룹 표시 조건 저장 실패:", error);
          });
        });
      }
    }
  };

  const handleUpdateGroup = async () => {
    if (editingGroup && groupName.trim()) {
      const oldParentGroupId = editingGroup.parentGroupId;
      const newParentGroupId = parentGroupIdForEdit;

      // currentSurvey.groups에서 최신 그룹 정보 확인
      const latestGroup = groups.find((g) => g.id === editingGroup.id);
      const finalDisplayCondition = latestGroup?.displayCondition;

      // 상위 그룹이 변경된 경우
      if (oldParentGroupId !== newParentGroupId) {
        // 순환 참조 체크: newParentGroupId가 editingGroup의 하위 그룹이 될 수 있는지 확인
        if (newParentGroupId && !canBeParentOf(newParentGroupId, editingGroup.id, groups)) {
          alert("순환 참조 방지: 선택한 그룹을 상위 그룹으로 설정할 수 없습니다.");
          return;
        }

        // 새로운 상위 그룹의 하위 그룹들 중 마지막 순서 계산
        let newOrder = 0;
        if (newParentGroupId) {
          const newSiblings = groups.filter(
            (g) => g.parentGroupId === newParentGroupId && g.id !== editingGroup.id,
          );
          newOrder = newSiblings.length > 0 ? Math.max(...newSiblings.map((g) => g.order)) + 1 : 0;
        } else {
          // 최상위로 이동하는 경우
          const topLevelSiblings = groups.filter(
            (g) => !g.parentGroupId && g.id !== editingGroup.id,
          );
          newOrder =
            topLevelSiblings.length > 0 ? Math.max(...topLevelSiblings.map((g) => g.order)) + 1 : 0;
        }

        updateGroup(editingGroup.id, {
          name: groupName.trim(),
          description: groupDescription.trim() || undefined,
          parentGroupId: newParentGroupId,
          order: newOrder,
        });

        // DB에 저장 (그룹 ID가 UUID인 경우에만)
        if (
          currentSurvey.id &&
          isUUID(currentSurvey.id) &&
          isUUID(editingGroup.id) &&
          (!newParentGroupId || isUUID(newParentGroupId))
        ) {
          try {
            const { updateQuestionGroup } = await import("@/actions/survey-actions");
            await updateQuestionGroup(editingGroup.id, {
              name: groupName.trim(),
              description: groupDescription.trim() || undefined,
              parentGroupId: newParentGroupId ?? null,
              order: newOrder,
              displayCondition: finalDisplayCondition,
            });
          } catch (error) {
            console.error("그룹 업데이트 저장 실패:", error);
          }
        }

        // 상위 그룹이 변경되면 해당 그룹을 펼침
        if (newParentGroupId) {
          setExpandedGroups((prev) => new Set(prev).add(newParentGroupId));
        }
      } else {
        // 이름/설명만 변경된 경우
        updateGroup(editingGroup.id, {
          name: groupName.trim(),
          description: groupDescription.trim() || undefined,
        });

        // DB에 저장 (그룹 ID가 UUID인 경우에만)
        if (currentSurvey.id && isUUID(currentSurvey.id) && isUUID(editingGroup.id)) {
          try {
            const { updateQuestionGroup } = await import("@/actions/survey-actions");
            await updateQuestionGroup(editingGroup.id, {
              name: groupName.trim(),
              description: groupDescription.trim() || undefined,
              displayCondition: finalDisplayCondition,
            });
          } catch (error) {
            console.error("그룹 업데이트 저장 실패:", error);
          }
        }
      }

      setEditingGroup(null);
      setGroupName("");
      setGroupDescription("");
      setParentGroupIdForEdit(undefined);
      setIsEditModalOpen(false);
      // 그룹 수정은 이미 updateQuestionGroup API로 저장됨
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    const subGroups = getSubGroups(groupId);
    const message =
      subGroups.length > 0
        ? `이 그룹과 ${subGroups.length}개의 하위 그룹을 삭제하시겠습니까? (그룹에 속한 질문들은 그룹 없음 상태가 됩니다)`
        : "이 그룹을 삭제하시겠습니까? (그룹에 속한 질문들은 그룹 없음 상태가 됩니다)";

    if (confirm(message)) {
      // DB에서 그룹 삭제 (deleteQuestionGroup이 재귀적으로 하위 그룹도 함께 처리)
      if (currentSurvey.id && isUUID(currentSurvey.id)) {
        try {
          const { deleteQuestionGroup } = await import("@/actions/survey-actions");
          // 최상위 그룹만 삭제하면, 서버 액션에서 하위 그룹도 함께 처리됨
          await deleteQuestionGroup(groupId);
        } catch (error) {
          console.error("그룹 삭제 실패:", error);
          alert("그룹 삭제에 실패했습니다. 다시 시도해주세요.");
          return;
        }
      }

      // 로컬 스토어 업데이트 (deleteGroup이 질문들의 groupId도 undefined로 설정)
      deleteGroup(groupId);
      // 그룹 삭제는 이미 deleteQuestionGroup API로 저장됨
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overIdValue = (event.over?.id as string) || null;
    setOverId(overIdValue);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setOverId(null);

    if (!over || active.id === over.id) return;

    const draggedGroup = groups.find((g) => g.id === active.id);
    const targetGroup = groups.find((g) => g.id === over.id);

    if (!draggedGroup || !targetGroup) return;

    // 자기 자신으로는 이동 불가
    if (draggedGroup.id === targetGroup.id) return;

    // 대분류는 대분류끼리만 순서 변경 가능
    if (!draggedGroup.parentGroupId && !targetGroup.parentGroupId) {
      const sameLevelGroups = groups
        .filter((g) => !g.parentGroupId)
        .sort((a, b) => a.order - b.order);

      const oldIndex = sameLevelGroups.findIndex((g) => g.id === draggedGroup.id);
      const newIndex = sameLevelGroups.findIndex((g) => g.id === targetGroup.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(sameLevelGroups, oldIndex, newIndex);
        const newGroupIds = newOrder.map((g) => g.id);
        reorderGroups(newGroupIds);

        // DB에 저장 (UUID인 그룹 ID만 필터링)
        if (currentSurvey.id && isUUID(currentSurvey.id)) {
          try {
            const { reorderGroups: reorderGroupsAction } = await import("@/actions/survey-actions");
            const uuidGroupIds = newGroupIds.filter((id) => isUUID(id));
            if (uuidGroupIds.length > 0) {
              await reorderGroupsAction(currentSurvey.id, uuidGroupIds);
            }
          } catch (error) {
            console.error("그룹 순서 저장 실패:", error);
          }
        }
        // 그룹 순서 변경은 이미 reorderGroups API로 저장됨
      }
      return;
    }

    // 소분류는 같은 대분류 내의 소분류끼리만 이동 가능
    if (draggedGroup.parentGroupId && targetGroup.parentGroupId) {
      // 같은 대분류 내의 소분류인지 확인
      if (draggedGroup.parentGroupId === targetGroup.parentGroupId) {
        // 같은 대분류 내의 소분류끼리 순서만 변경
        const sameLevelGroups = groups
          .filter((g) => g.parentGroupId === draggedGroup.parentGroupId)
          .sort((a, b) => a.order - b.order);

        const oldIndex = sameLevelGroups.findIndex((g) => g.id === draggedGroup.id);
        const newIndex = sameLevelGroups.findIndex((g) => g.id === targetGroup.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(sameLevelGroups, oldIndex, newIndex);

          // 각 그룹의 order를 업데이트
          newOrder.forEach((group, index) => {
            updateGroup(group.id, {
              order: index,
            });
          });

          // DB에 저장 (그룹 ID가 UUID인 경우에만)
          if (currentSurvey.id && isUUID(currentSurvey.id)) {
            try {
              const { updateQuestionGroup } = await import("@/actions/survey-actions");
              await Promise.all(
                newOrder
                  .filter((group) => isUUID(group.id))
                  .map((group, index) =>
                    updateQuestionGroup(group.id, {
                      order: index,
                    }),
                  ),
              );
            } catch (error) {
              console.error("하위 그룹 순서 저장 실패:", error);
            }
          }
          // 하위 그룹 순서 변경은 이미 updateQuestionGroup API로 저장됨
        }
      }
      // 다른 대분류의 소분류로는 이동 불가 (아무것도 하지 않음)
      return;
    }

    // 대분류와 소분류 간 이동 불가 (아무것도 하지 않음)
  };

  return (
    <div>
      {/* 고정 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700">📁 그룹 관리</h4>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => handleOpenCreateModal()}
        >
          <FolderPlus className="w-3 h-3 mr-1" />새 그룹
        </Button>
      </div>

      {/* 스크롤 가능한 그룹 리스트 */}
      <div className={`overflow-y-auto ${className || ""}`}>
        {topLevelGroups.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-xs">
            <p>생성된 그룹이 없습니다</p>
            <p className="mt-1">그룹을 만들어 질문을 정리하세요</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={topLevelGroups.map((g) => g.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {topLevelGroups.map((group) => {
                  const subGroups = getSubGroups(group.id);
                  const isExpanded = expandedGroups.has(group.id);

                  return (
                    <div key={group.id}>
                      <SortableGroupItem
                        group={group}
                        questionCount={getTotalQuestionCount(group.id)}
                        subGroups={subGroups}
                        isExpanded={isExpanded}
                        onEdit={handleEditGroup}
                        onDelete={handleDeleteGroup}
                        onToggleExpand={handleToggleExpand}
                        onAddSubGroup={handleOpenCreateModal}
                        totalSubGroupCount={getTotalSubGroupCount(group.id)}
                      />

                      {/* 하위 그룹 렌더링 */}
                      {isExpanded && subGroups.length > 0 && (
                        <SortableContext
                          items={subGroups.map((g) => g.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="ml-6 mt-2 space-y-2 border-l-2 border-gray-200 pl-3">
                            {subGroups.map((subGroup) => {
                              return (
                                <div key={subGroup.id}>
                                  <SortableGroupItem
                                    group={subGroup}
                                    questionCount={getTotalQuestionCount(subGroup.id)}
                                    subGroups={[]}
                                    isExpanded={false}
                                    onEdit={handleEditGroup}
                                    onDelete={handleDeleteGroup}
                                    onToggleExpand={handleToggleExpand}
                                    onAddSubGroup={handleOpenCreateModal}
                                    totalSubGroupCount={getTotalSubGroupCount(subGroup.id)}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </SortableContext>
                      )}
                    </div>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* 그룹 생성 모달 */}
      <GroupCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setGroupName("");
          setGroupDescription("");
          setParentGroupIdForNew(undefined);
        }}
        onSubmit={handleCreateGroup}
        groupName={groupName}
        setGroupName={setGroupName}
        groupDescription={groupDescription}
        setGroupDescription={setGroupDescription}
        parentGroupId={parentGroupIdForNew}
        groups={groups}
      />

      {/* 그룹 편집 모달 */}
      <GroupEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingGroup(null);
          setGroupName("");
          setGroupDescription("");
          setParentGroupIdForEdit(undefined);
        }}
        onSubmit={handleUpdateGroup}
        editingGroup={editingGroup}
        groupName={groupName}
        setGroupName={setGroupName}
        groupDescription={groupDescription}
        setGroupDescription={setGroupDescription}
        parentGroupId={parentGroupIdForEdit}
        setParentGroupId={setParentGroupIdForEdit}
        topLevelGroups={topLevelGroups}
        allGroups={groups}
        allQuestions={currentSurvey.questions}
        onConditionUpdate={handleGroupConditionUpdate}
      />
    </div>
  );
}
