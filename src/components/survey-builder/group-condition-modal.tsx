'use client';

import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSurveyBuilderStore } from '@/stores/survey-store';
import { DynamicRowGroupConfig, Question, QuestionConditionGroup } from '@/types/survey';

import { QuestionConditionEditor } from './question-condition-editor';

export interface GroupConditionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: DynamicRowGroupConfig | null;
  currentQuestion: Question;
  onUpdateCondition: (groupId: string, condition: QuestionConditionGroup | undefined) => void;
}

export function GroupConditionModal({
  open,
  onOpenChange,
  group,
  currentQuestion,
  onUpdateCondition,
}: GroupConditionModalProps) {
  const allQuestions = useSurveyBuilderStore(useShallow((s) => s.currentSurvey.questions));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            그룹 조건부 표시 설정
            {group && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                - {group.label || group.groupId}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            다른 질문의 응답에 따라 이 그룹의 표시 여부를 설정합니다.
          </DialogDescription>
        </DialogHeader>

        {group && (
          <QuestionConditionEditor
            question={currentQuestion}
            initialCondition={group.displayCondition}
            onUpdate={(conditionGroup) => {
              onUpdateCondition(group.groupId, conditionGroup);
            }}
            allQuestions={allQuestions}
            allowAllQuestions
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
