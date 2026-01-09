"use client";

import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuestionGroup, QuestionConditionGroup, Question } from "@/types/survey";
import {
  QuestionConditionEditor,
  QuestionConditionEditorRef,
} from "@/components/survey-builder/question-condition-editor";
import { getAvailableParentGroups } from "./group-helpers";

interface GroupEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  editingGroup: QuestionGroup | null;
  groupName: string;
  setGroupName: (name: string) => void;
  groupDescription: string;
  setGroupDescription: (description: string) => void;
  parentGroupId: string | undefined;
  setParentGroupId: (id: string | undefined) => void;
  topLevelGroups: QuestionGroup[];
  allGroups: QuestionGroup[];
  allQuestions: Question[];
  onConditionUpdate: (conditionGroup: QuestionConditionGroup | undefined) => void;
}

export function GroupEditModal({
  isOpen,
  onClose,
  onSubmit,
  editingGroup,
  groupName,
  setGroupName,
  groupDescription,
  setGroupDescription,
  parentGroupId,
  setParentGroupId,
  topLevelGroups,
  allGroups,
  allQuestions,
  onConditionUpdate,
}: GroupEditModalProps) {
  const conditionEditorRef = useRef<QuestionConditionEditorRef>(null);

  if (!editingGroup) return null;

  const availableParents = getAvailableParentGroups(editingGroup.id, topLevelGroups, allGroups);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>그룹 편집</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4 overflow-y-auto flex-1 min-h-0 pr-2">
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
                  onSubmit();
                }
              }}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">그룹 설명 (선택)</label>
            <Textarea
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              placeholder="그룹에 대한 간단한 설명을 입력하세요"
              rows={3}
            />
          </div>
          {/* 상위 그룹 선택 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">상위 그룹 (선택)</label>
            <Select
              value={parentGroupId || "none"}
              onValueChange={(value) => setParentGroupId(value === "none" ? undefined : value)}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="상위 그룹 선택" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px] overflow-y-auto bg-white">
                <SelectItem value="none" className="bg-gray-50 hover:bg-gray-100">
                  없음 (최상위 그룹)
                </SelectItem>
                {availableParents.map((g) => (
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
          {/* 표시 조건 설정 */}
          <div className="pt-4 border-t border-gray-200">
            <QuestionConditionEditor
              ref={conditionEditorRef}
              question={{
                id: editingGroup.id,
                type: "notice",
                title: editingGroup.name,
                required: false,
                order: 0,
                displayCondition: editingGroup.displayCondition,
              }}
              onUpdate={onConditionUpdate}
              allQuestions={allQuestions}
              allowAllQuestions={true}
            />
          </div>
        </div>
        <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 mt-4 flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={onSubmit} disabled={!groupName.trim()}>
            저장
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
