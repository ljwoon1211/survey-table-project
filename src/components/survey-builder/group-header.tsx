"use client";

import { QuestionGroup } from "@/types/survey";
import { useSurveyBuilderStore } from "@/stores/survey-store";
import { ChevronDown, ChevronRight, FolderOpen } from "lucide-react";

interface GroupHeaderProps {
  group: QuestionGroup;
  questionCount: number;
  subGroupCount?: number;
  className?: string;
}

export function GroupHeader({ group, questionCount, subGroupCount = 0, className }: GroupHeaderProps) {
  const { toggleGroupCollapse } = useSurveyBuilderStore();

  const handleToggle = () => {
    toggleGroupCollapse(group.id);
  };

  return (
    <div
      className={`flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg cursor-pointer hover:shadow-md transition-all ${className}`}
      onClick={handleToggle}
    >
      <div className="flex items-center space-x-3 flex-1">
        <div className="text-blue-600">
          {group.collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
        <FolderOpen className="w-5 h-5 text-blue-600" />
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-900">{group.name}</h3>
          {group.description && (
            <p className="text-xs text-gray-600 mt-0.5">{group.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
          {questionCount}개 질문{subGroupCount > 0 && ` • ${subGroupCount}개 하위그룹`}
        </span>
      </div>
    </div>
  );
}

