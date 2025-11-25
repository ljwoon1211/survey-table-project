"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSurveyBuilderStore } from "@/stores/survey-store";
import { QuestionGroup } from "@/types/survey";
import {
  FolderPlus,
  Edit3,
  Trash2,
  GripVertical,
  ChevronRight,
  ChevronDown,
  Plus,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
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
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
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
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onAddSubGroup(group.id);
            }}
            title="하위 그룹 추가"
          >
            <Plus className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(group);
            }}
          >
            <Edit3 className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(group.id);
            }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

  const handleCreateGroup = () => {
    if (groupName.trim()) {
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
    setIsEditModalOpen(true);
  };

  const handleUpdateGroup = () => {
    if (editingGroup && groupName.trim()) {
      updateGroup(editingGroup.id, {
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
      });
      setEditingGroup(null);
      setGroupName("");
      setGroupDescription("");
      setIsEditModalOpen(false);
    }
  };

  const handleDeleteGroup = (groupId: string) => {
    const subGroups = getSubGroups(groupId);
    const message =
      subGroups.length > 0
        ? `이 그룹과 ${subGroups.length}개의 하위 그룹을 삭제하시겠습니까? (그룹에 속한 질문들은 그룹 없음 상태가 됩니다)`
        : "이 그룹을 삭제하시겠습니까? (그룹에 속한 질문들은 그룹 없음 상태가 됩니다)";

    if (confirm(message)) {
      deleteGroup(groupId);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = topLevelGroups.findIndex((g) => g.id === active.id);
      const newIndex = topLevelGroups.findIndex((g) => g.id === over.id);

      const newOrder = arrayMove(topLevelGroups, oldIndex, newIndex);
      reorderGroups(newOrder.map((g) => g.id));
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
      <div className={`overflow-y-auto ${className || ''}`}>
        {topLevelGroups.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-xs">
            <p>생성된 그룹이 없습니다</p>
            <p className="mt-1">그룹을 만들어 질문을 정리하세요</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                      questionCount={getQuestionCount(group.id)}
                      subGroups={subGroups}
                      isExpanded={isExpanded}
                      onEdit={handleEditGroup}
                      onDelete={handleDeleteGroup}
                      onToggleExpand={handleToggleExpand}
                      onAddSubGroup={handleOpenCreateModal}
                    />

                    {/* 하위 그룹 렌더링 */}
                    {isExpanded && subGroups.length > 0 && (
                      <div className="ml-6 mt-2 space-y-2 border-l-2 border-gray-200 pl-3">
                        {subGroups.map((subGroup) => (
                          <div
                            key={subGroup.id}
                            className="flex items-center justify-between p-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-900 truncate">
                                  {subGroup.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {getQuestionCount(subGroup.id)}개 질문
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => handleEditGroup(subGroup)}
                              >
                                <Edit3 className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                                onClick={() => handleDeleteGroup(subGroup.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
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



