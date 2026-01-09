"use client";

import { QuestionGroup } from "@/types/survey";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  GripVertical,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreVertical,
  Edit3,
  Trash2,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface SortableGroupItemProps {
  group: QuestionGroup;
  questionCount: number;
  subGroups: QuestionGroup[];
  isExpanded: boolean;
  onEdit: (group: QuestionGroup) => void;
  onDelete: (groupId: string) => void;
  onToggleExpand: (groupId: string) => void;
  onAddSubGroup: (parentGroupId: string) => void;
  totalSubGroupCount?: number;
}

export function SortableGroupItem({
  group,
  questionCount,
  subGroups,
  isExpanded,
  onEdit,
  onDelete,
  onToggleExpand,
  onAddSubGroup,
  totalSubGroupCount = 0,
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
              {totalSubGroupCount > 0 && ` • ${totalSubGroupCount}개 하위그룹`}
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

