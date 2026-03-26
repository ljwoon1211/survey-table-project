'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Question, QuestionConditionGroup, TableRow } from '@/types/survey';

import { QuestionConditionEditor } from './question-condition-editor';

export interface RowConditionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRowIndex: number | null;
  rows: TableRow[];
  currentQuestion: Question;
  allQuestions: Question[];
  onUpdateCondition: (rowIndex: number, condition: QuestionConditionGroup | undefined) => void;
}

export function RowConditionModal({
  open,
  onOpenChange,
  editingRowIndex,
  rows,
  currentQuestion,
  allQuestions,
  onUpdateCondition,
}: RowConditionModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            행 조건부 표시 설정
            {editingRowIndex !== null && rows[editingRowIndex] && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                - {rows[editingRowIndex].label || `행 ${editingRowIndex + 1}`}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            다른 질문의 응답에 따라 이 행의 표시 여부를 설정합니다.
          </DialogDescription>
        </DialogHeader>

        {editingRowIndex !== null && rows[editingRowIndex] && (
          <QuestionConditionEditor
            question={currentQuestion}
            initialCondition={rows[editingRowIndex].displayCondition}
            onUpdate={(conditionGroup) => {
              onUpdateCondition(editingRowIndex, conditionGroup);
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
