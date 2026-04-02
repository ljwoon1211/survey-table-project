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
import { Question, QuestionConditionGroup, TableColumn } from '@/types/survey';

import { QuestionConditionEditor } from './question-condition-editor';

export interface ColumnConditionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingColumnIndex: number | null;
  columns: TableColumn[];
  currentQuestion: Question;
  onUpdateCondition: (columnIndex: number, condition: QuestionConditionGroup | undefined) => void;
}

export function ColumnConditionModal({
  open,
  onOpenChange,
  editingColumnIndex,
  columns,
  currentQuestion,
  onUpdateCondition,
}: ColumnConditionModalProps) {
  const allQuestions = useSurveyBuilderStore(useShallow((s) => s.currentSurvey.questions));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            열 조건부 표시 설정
            {editingColumnIndex !== null && columns[editingColumnIndex] && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                - {columns[editingColumnIndex].label || `열 ${editingColumnIndex + 1}`}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            다른 질문의 응답에 따라 이 열의 표시 여부를 설정합니다.
          </DialogDescription>
        </DialogHeader>

        {editingColumnIndex !== null && columns[editingColumnIndex] && (
          <QuestionConditionEditor
            question={currentQuestion}
            initialCondition={columns[editingColumnIndex].displayCondition}
            onUpdate={(conditionGroup) => {
              onUpdateCondition(editingColumnIndex, conditionGroup);
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
