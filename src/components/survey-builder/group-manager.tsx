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
import { reorderGroups as reorderGroupsAction } from "@/actions/survey-actions";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  isNestingMode?: boolean;
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
  isNestingMode = false,
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
  const showDropZone = isDragOver && !isDraggingProp;

  // 하위 그룹으로 만들기 (오른쪽 50% 영역에 드래그할 때만 피드백 표시)
  const isNesting = showDropZone && isNestingMode;

  return (
    <div ref={setNodeRef} style={style} className={`${isDragging ? "z-50 shadow-lg" : ""}`}>
      <div
        data-group-id={group.id}
        className={`flex items-center justify-between p-2 rounded-lg transition-all relative ${
          isNesting
            ? "bg-green-100 border-2 border-green-500 border-dashed shadow-md"
            : "bg-gray-50 hover:bg-gray-100"
        }`}
      >
        {/* 오른쪽 50% 영역 표시 (하위 그룹으로 만들기 영역) */}
        <div className="absolute inset-0 pointer-events-none">
          {/* 50% 기준선 (항상 표시) */}
          {/* 오른쪽 50% 영역 (하위 그룹으로 만들기) */}
          {isNesting && (
            <div className="absolute right-0 top-0 bottom-0  bg-green-200/30 border-l-2 border-green-400 border-dashed" />
          )}
        </div>
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
            {isNesting && (
              <p className="text-xs text-green-700 font-medium mt-1">
                여기에 드롭하여 하위 그룹으로 만들기
              </p>
            )}
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
  const [isNestingMode, setIsNestingMode] = useState<boolean>(false); // true: 하위 그룹으로, false: 순서 변경

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
      // DB에 그룹 저장
      if (currentSurvey.id && isUUID(currentSurvey.id)) {
        try {
          const { createQuestionGroup } = await import("@/actions/survey-actions");
          await createQuestionGroup({
            surveyId: currentSurvey.id,
            name: groupName.trim(),
            description: groupDescription.trim() || undefined,
            parentGroupId: parentGroupIdForNew,
          });
        } catch (error) {
          console.error("그룹 생성 실패:", error);
          alert("그룹 생성에 실패했습니다. 다시 시도해주세요.");
          return;
        }
      }

      // 로컬 스토어 업데이트
      addGroup(groupName.trim(), groupDescription.trim() || undefined, parentGroupIdForNew);
      setGroupName("");
      setGroupDescription("");
      setParentGroupIdForNew(undefined);
      setIsCreateModalOpen(false);
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

        // DB에 저장
        if (currentSurvey.id && isUUID(currentSurvey.id)) {
          try {
            const { updateQuestionGroup } = await import("@/actions/survey-actions");
            await updateQuestionGroup(editingGroup.id, {
              name: groupName.trim(),
              description: groupDescription.trim() || null,
              parentGroupId: newParentGroupId || null,
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

        // DB에 저장
        if (currentSurvey.id && isUUID(currentSurvey.id)) {
          try {
            const { updateQuestionGroup } = await import("@/actions/survey-actions");
            await updateQuestionGroup(editingGroup.id, {
              name: groupName.trim(),
              description: groupDescription.trim() || null,
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
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overIdValue = (event.over?.id as string) || null;
    setOverId(overIdValue);

    // 드래그 위치에 따라 하위 그룹으로 만들지 순서 변경할지 결정
    // 오른쪽 50% 영역으로 드래그하면 하위 그룹으로
    if (overIdValue && event.active && event.over) {
      const draggedGroup = groups.find((g) => g.id === event.active.id);
      const targetGroup = groups.find((g) => g.id === overIdValue);

      // 하위 그룹이 다른 하위 그룹의 하위로 들어갈 수 없음
      if (draggedGroup?.parentGroupId && targetGroup?.parentGroupId) {
        setIsNestingMode(false);
        return;
      }

      const targetElement = document.querySelector(`[data-group-id="${overIdValue}"]`);
      const activeElement = document.querySelector(`[data-group-id="${event.active.id}"]`);

      if (targetElement && activeElement) {
        const targetRect = targetElement.getBoundingClientRect();
        const activeRect = activeElement.getBoundingClientRect();

        // 드래그된 아이템의 중심 X 좌표
        const activeCenterX = activeRect.left + activeRect.width / 2;
        // 타겟 그룹의 중심 X 좌표 (50% 기준점)
        const targetCenterX = targetRect.left + targetRect.width / 1.5;

        // 드래그된 아이템의 중심이 타겟 그룹의 오른쪽 50% 영역에 있으면 하위 그룹으로
        setIsNestingMode(activeCenterX > targetCenterX);
      } else {
        setIsNestingMode(false);
      }
    } else {
      setIsNestingMode(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    // isNestingMode 값을 초기화하기 전에 저장
    const shouldNest = isNestingMode;

    setActiveId(null);
    setOverId(null);
    setIsNestingMode(false);

    if (!over || active.id === over.id) return;

    const draggedGroup = groups.find((g) => g.id === active.id);
    const targetGroup = groups.find((g) => g.id === over.id);

    if (!draggedGroup || !targetGroup) return;

    // 자기 자신을 하위 그룹으로 만들 수 없음
    if (draggedGroup.id === targetGroup.id) return;

    // 순환 참조 방지: 타겟 그룹이 드래그된 그룹의 하위 그룹이면 안됨
    const isTargetDescendant = (targetId: string, parentId: string): boolean => {
      const target = groups.find((g) => g.id === targetId);
      if (!target || !target.parentGroupId) return false;
      if (target.parentGroupId === parentId) return true;
      return isTargetDescendant(target.parentGroupId, parentId);
    };

    if (isTargetDescendant(targetGroup.id, draggedGroup.id)) {
      return; // 순환 참조 방지
    }

    // 하위 그룹을 최상위로 올리는 경우
    if (draggedGroup.parentGroupId && !targetGroup.parentGroupId) {
      // 하위 그룹을 최상위로 이동
      const topLevelGroups = groups
        .filter((g) => !g.parentGroupId && g.id !== draggedGroup.id)
        .sort((a, b) => a.order - b.order);
      const targetIndex = topLevelGroups.findIndex((g) => g.id === targetGroup.id);
      const newOrder = [...topLevelGroups];
      newOrder.splice(targetIndex, 0, draggedGroup);

      const newGroupIds = newOrder.map((g) => g.id);
      reorderGroups(newGroupIds);

      updateGroup(draggedGroup.id, {
        parentGroupId: undefined,
      });

      // DB에 저장
      if (currentSurvey.id && isUUID(currentSurvey.id)) {
        try {
          const { updateQuestionGroup, reorderGroups: reorderGroupsAction } = await import(
            "@/actions/survey-actions"
          );
          await updateQuestionGroup(draggedGroup.id, {
            parentGroupId: null,
          });
          await reorderGroupsAction(currentSurvey.id, newGroupIds);
        } catch (error) {
          console.error("그룹 최상위 이동 저장 실패:", error);
        }
      }
    } else {
      // 같은 레벨의 그룹인 경우 위치에 따라 결정
      const isSameTopLevel = !draggedGroup.parentGroupId && !targetGroup.parentGroupId;
      const isSameSubLevel =
        draggedGroup.parentGroupId &&
        targetGroup.parentGroupId &&
        draggedGroup.parentGroupId === targetGroup.parentGroupId;

      if (isSameTopLevel && !shouldNest) {
        // 같은 최상위 레벨에서 왼쪽 50%에 드롭: 순서만 변경 (피드백 없음)
        const sameLevelGroups = groups
          .filter((g) => !g.parentGroupId)
          .sort((a, b) => a.order - b.order);

        const oldIndex = sameLevelGroups.findIndex((g) => g.id === draggedGroup.id);
        const newIndex = sameLevelGroups.findIndex((g) => g.id === targetGroup.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(sameLevelGroups, oldIndex, newIndex);
          const newGroupIds = newOrder.map((g) => g.id);
          reorderGroups(newGroupIds);

          // DB에 저장
          if (currentSurvey.id && isUUID(currentSurvey.id)) {
            try {
              await reorderGroupsAction(currentSurvey.id, newGroupIds);
            } catch (error) {
              console.error("그룹 순서 저장 실패:", error);
            }
          }
        }
      } else if (isSameSubLevel && !shouldNest) {
        // 같은 하위 그룹 레벨에서 왼쪽 50%에 드롭: 순서만 변경 (피드백 없음)
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

          // DB에 저장
          if (currentSurvey.id && isUUID(currentSurvey.id)) {
            try {
              const { updateQuestionGroup } = await import("@/actions/survey-actions");
              await Promise.all(
                newOrder.map((group, index) =>
                  updateQuestionGroup(group.id, {
                    order: index,
                  }),
                ),
              );
            } catch (error) {
              console.error("하위 그룹 순서 저장 실패:", error);
            }
          }
        }
      } else {
        // 하위 그룹으로 변경 (오른쪽 50%에 드롭 또는 다른 레벨)
        // 하위 그룹이 다른 하위 그룹의 하위로 들어갈 수 없음
        if (draggedGroup.parentGroupId && targetGroup.parentGroupId) {
          // 하위 그룹끼리는 순서만 변경 가능하므로 아무것도 하지 않음
          return;
        }

        const targetSubGroups = groups
          .filter((g) => g.parentGroupId === targetGroup.id && g.id !== draggedGroup.id)
          .sort((a, b) => a.order - b.order);
        const maxOrder =
          targetSubGroups.length > 0 ? Math.max(...targetSubGroups.map((g) => g.order)) : -1;

        updateGroup(draggedGroup.id, {
          parentGroupId: targetGroup.id,
          order: maxOrder + 1,
        });

        // DB에 저장
        if (currentSurvey.id && isUUID(currentSurvey.id)) {
          try {
            const { updateQuestionGroup } = await import("@/actions/survey-actions");
            await updateQuestionGroup(draggedGroup.id, {
              parentGroupId: targetGroup.id,
              order: maxOrder + 1,
            });
          } catch (error) {
            console.error("그룹 하위 그룹 변경 저장 실패:", error);
          }
        }

        // 하위 그룹으로 변경되면 해당 그룹을 펼침
        setExpandedGroups((prev) => new Set(prev).add(targetGroup.id));
      }
    }
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
            <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
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
                        isNestingMode={isNestingMode}
                      />

                      {/* 하위 그룹 렌더링 */}
                      {isExpanded && subGroups.length > 0 && (
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
                                  isNestingMode={isNestingMode}
                                />
                              </div>
                            );
                          })}
                        </div>
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
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
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
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
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
