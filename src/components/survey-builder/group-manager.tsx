"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSurveyBuilderStore } from "@/stores/survey-store";
import { QuestionGroup } from "@/types/survey";
import { isUUID } from "@/lib/survey-url";
import {
  FolderPlus,
  Edit3,
  Trash2,
  GripVertical,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreVertical,
} from "lucide-react";
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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface GroupManagerProps {
  className?: string;
}

interface SortableGroupItemProps {
  group: QuestionGroup;
  questionCount: number;
  subGroups: QuestionGroup[];
  isExpanded: boolean;
  onEdit: (group: QuestionGroup) => void;
  onDelete: (groupId: string) => void;
  onToggleExpand: (groupId: string) => void;
  onAddSubGroup: (parentGroupId: string) => void;
  isDragOver?: boolean;
  isDragging?: boolean;
}

function SortableGroupItem({
  group,
  questionCount,
  subGroups,
  isExpanded,
  onEdit,
  onDelete,
  onToggleExpand,
  onAddSubGroup,
  isDragOver = false,
  isDragging: isDraggingProp = false,
}: SortableGroupItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasSubGroups = subGroups.length > 0;

  return (
    <div ref={setNodeRef} style={style} className={`${isDragging ? "z-50 shadow-lg" : ""}`}>
      <div
        data-group-id={group.id}
        className="flex items-center justify-between p-2 rounded-lg transition-all relative bg-gray-50 hover:bg-gray-100"
      >
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          {hasSubGroups && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(group.id);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}
          {!hasSubGroups && <div className="w-4" />}
          <div
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{group.name}</p>
            <p className="text-xs text-gray-500">
              {questionCount}개 질문
              {hasSubGroups && ` • ${subGroups.length}개 하위그룹`}
            </p>
          </div>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="end" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col">
              <button
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddSubGroup(group.id);
                }}
              >
                <Plus className="w-4 h-4" />
                하위 그룹 추가
              </button>
              <button
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(group);
                }}
              >
                <Edit3 className="w-4 h-4" />
                수정
              </button>
              <button
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(group.id);
                }}
              >
                <Trash2 className="w-4 h-4" />
                삭제
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
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

  const groups = currentSurvey.groups || [];

  // 최상위 그룹만 필터링 (parentGroupId가 없는 것들)
  const topLevelGroups = groups.filter((g) => !g.parentGroupId).sort((a, b) => a.order - b.order);

  // 특정 그룹의 하위 그룹들 가져오기
  const getSubGroups = (parentId: string) => {
    return groups.filter((g) => g.parentGroupId === parentId).sort((a, b) => a.order - b.order);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // 각 그룹에 속한 질문 개수 계산
  const getQuestionCount = (groupId: string) => {
    return currentSurvey.questions.filter((q) => q.groupId === groupId).length;
  };

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
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description || "");
    setParentGroupIdForEdit(group.parentGroupId);
    setIsEditModalOpen(true);
  };

  // 순환 참조 방지: 특정 그룹이 다른 그룹의 상위로 설정 가능한지 확인
  const canBeParentOf = (potentialParentId: string, childId: string): boolean => {
    if (potentialParentId === childId) return false;

    // 잠재적 부모가 현재 그룹의 하위 그룹인지 확인
    const checkDescendant = (targetId: string, ancestorId: string): boolean => {
      const target = groups.find((g) => g.id === targetId);
      if (!target || !target.parentGroupId) return false;
      if (target.parentGroupId === ancestorId) return true;
      return checkDescendant(target.parentGroupId, ancestorId);
    };

    return !checkDescendant(potentialParentId, childId);
  };

  // 편집 모달에서 선택 가능한 상위 그룹 목록
  const getAvailableParentGroups = (currentGroupId: string) => {
    return topLevelGroups.filter(
      (g) => g.id !== currentGroupId && canBeParentOf(g.id, currentGroupId),
    );
  };

  const handleUpdateGroup = async () => {
    if (editingGroup && groupName.trim()) {
      const oldParentGroupId = editingGroup.parentGroupId;
      const newParentGroupId = parentGroupIdForEdit;

      // 상위 그룹이 변경된 경우
      if (oldParentGroupId !== newParentGroupId) {
        // 순환 참조 체크: newParentGroupId가 editingGroup의 하위 그룹이 될 수 있는지 확인
        if (newParentGroupId && !canBeParentOf(newParentGroupId, editingGroup.id)) {
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
                  const isDragOver = overId === group.id && activeId !== group.id;
                  const isDragging = activeId === group.id;

                  return (
                    <div key={group.id}>
                      <SortableGroupItem
                        group={group}
                        questionCount={getQuestionCount(group.id)}
                        subGroups={subGroups}
                        isExpanded={isExpanded}
                        onEdit={handleEditGroup}
                        onDelete={handleDeleteGroup}
                        onToggleExpand={handleToggleExpand}
                        onAddSubGroup={handleOpenCreateModal}
                        isDragOver={isDragOver}
                        isDragging={isDragging}
                      />

                      {/* 하위 그룹 렌더링 */}
                      {isExpanded && subGroups.length > 0 && (
                        <SortableContext
                          items={subGroups.map((g) => g.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="ml-6 mt-2 space-y-2 border-l-2 border-gray-200 pl-3">
                            {subGroups.map((subGroup) => {
                              const isSubDragOver =
                                overId === subGroup.id && activeId !== subGroup.id;
                              const isSubDragging = activeId === subGroup.id;

                              return (
                                <div key={subGroup.id}>
                                  <SortableGroupItem
                                    group={subGroup}
                                    questionCount={getQuestionCount(subGroup.id)}
                                    subGroups={[]}
                                    isExpanded={false}
                                    onEdit={handleEditGroup}
                                    onDelete={handleDeleteGroup}
                                    onToggleExpand={handleToggleExpand}
                                    onAddSubGroup={handleOpenCreateModal}
                                    isDragOver={isSubDragOver}
                                    isDragging={isSubDragging}
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
      <Dialog
        open={isCreateModalOpen}
        onOpenChange={(open) => {
          // 배경 클릭으로 닫히는 것 방지, X 버튼만 닫기 가능
          if (!open) {
            setIsCreateModalOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {parentGroupIdForNew
                ? `하위 그룹 만들기 (${groups.find((g) => g.id === parentGroupIdForNew)?.name})`
                : "새 그룹 만들기"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                그룹 이름 <span className="text-red-500">*</span>
              </label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="예: 응답자 정보, 1. TV보유 현황"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleCreateGroup();
                  }
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                그룹 설명 (선택)
              </label>
              <Textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="그룹에 대한 간단한 설명을 입력하세요"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                취소
              </Button>
              <Button onClick={handleCreateGroup} disabled={!groupName.trim()}>
                생성
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 그룹 편집 모달 */}
      <Dialog
        open={isEditModalOpen}
        onOpenChange={(open) => {
          // 배경 클릭으로 닫히는 것 방지, X 버튼만 닫기 가능
          if (!open) {
            setIsEditModalOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>그룹 편집</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                그룹 이름 <span className="text-red-500">*</span>
              </label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="예: 응답자 정보, 1. TV보유 현황"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleUpdateGroup();
                  }
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                그룹 설명 (선택)
              </label>
              <Textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="그룹에 대한 간단한 설명을 입력하세요"
                rows={3}
              />
            </div>
            {/* 상위 그룹 선택 */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                상위 그룹 (선택)
              </label>
              <Select
                value={parentGroupIdForEdit || "none"}
                onValueChange={(value) =>
                  setParentGroupIdForEdit(value === "none" ? undefined : value)
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="상위 그룹 선택" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] overflow-y-auto bg-white">
                  <SelectItem value="none" className="bg-gray-50 hover:bg-gray-100">
                    없음 (최상위 그룹)
                  </SelectItem>
                  {editingGroup &&
                    getAvailableParentGroups(editingGroup.id).map((g) => (
                      <SelectItem key={g.id} value={g.id} className="hover:bg-blue-50">
                        {g.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                다른 그룹의 하위 그룹으로 설정하려면 상위 그룹을 선택하세요
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                취소
              </Button>
              <Button onClick={handleUpdateGroup} disabled={!groupName.trim()}>
                저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
