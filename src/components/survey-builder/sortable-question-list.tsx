"use client";

import { useState } from "react";
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
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Question } from "@/types/survey";
import { useSurveyBuilderStore } from "@/stores/survey-store";
import { QuestionEditModal } from "./question-edit-modal";
import { UserDefinedMultiLevelSelectPreview } from "./user-defined-multi-level-select";
import { MultiLevelSelect } from "./multi-level-select";
import { UserDefinedMultiLevelSelect } from "./user-defined-multi-level-select";
import { GripVertical, Settings, Trash2, Copy, Edit3, Eye, EyeOff } from "lucide-react";

interface SortableQuestionProps {
  question: Question;
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

function SortableQuestion({
  question,
  index,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
}: SortableQuestionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`relative group transition-all duration-200 ${
        isSelected
          ? "ring-2 ring-blue-500 border-blue-200 shadow-lg"
          : "border-gray-200 hover:border-gray-300 hover:shadow-md"
      } ${isDragging ? "z-50 rotate-1 scale-105" : ""}`}
      onClick={() => onSelect(question.id)}
    >
      <div className="p-6">
        {/* Header with drag handle */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div
              className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="w-4 h-4" />
            </div>
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
              {index + 1}
            </span>
            <span className="text-sm font-medium text-gray-600 capitalize">
              {getQuestionTypeLabel(question.type)}
            </span>
          </div>

          <div className="flex items-center space-x-1">
            {question.required && (
              <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">필수</span>
            )}

            {/* Action buttons - show on hover */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(question.id);
                }}
              >
                <Edit3 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(question.id);
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(question.id);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Question content */}
        <div className="mb-4">
          <h4 className="text-base font-medium text-gray-900 mb-2">{question.title}</h4>
          {question.description && (
            <p className="text-sm text-gray-600 mb-3">{question.description}</p>
          )}
        </div>

        {/* Question preview */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <QuestionPreview question={question} />
        </div>
      </div>
    </Card>
  );
}

function QuestionPreview({ question }: { question: Question }) {
  switch (question.type) {
    case "text":
      return <Input placeholder="답변을 입력하세요..." disabled className="bg-white" />;

    case "textarea":
      return (
        <textarea
          className="w-full p-3 border border-gray-200 rounded-md resize-none bg-white"
          rows={3}
          placeholder="답변을 입력하세요..."
          disabled
        />
      );

    case "radio":
    case "checkbox":
      return (
        <div className="space-y-2">
          {question.options?.map((option) => (
            <div key={option.id} className="flex items-center space-x-2">
              <input type={question.type} name={question.id} disabled className="text-blue-500" />
              <label className="text-sm text-gray-700">{option.label}</label>
            </div>
          ))}
          <div className="flex items-center space-x-2 text-gray-400">
            <input type={question.type} disabled className="text-gray-300" />
            <span className="text-sm">기타</span>
            <Input placeholder="직접 입력..." disabled className="ml-2 text-xs h-8 bg-white" />
          </div>
        </div>
      );

    case "select":
      return (
        <select disabled className="w-full p-3 border border-gray-200 rounded-md bg-white">
          <option>선택하세요...</option>
          {question.options?.map((option) => (
            <option key={option.id}>{option.label}</option>
          ))}
          <option>기타</option>
        </select>
      );

    case "multiselect":
      return question.selectLevels ? (
        <UserDefinedMultiLevelSelectPreview levels={question.selectLevels} />
      ) : (
        <div className="text-gray-400 text-sm">다단계 Select가 설정되지 않았습니다.</div>
      );

    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-200 rounded">
            <thead className="bg-gray-100">
              <tr>
                <th className="border-r border-gray-200 p-2 text-left text-sm font-medium text-gray-700">
                  항목
                </th>
                <th className="border-r border-gray-200 p-2 text-center text-sm font-medium text-gray-700">
                  매우 좋음
                </th>
                <th className="border-r border-gray-200 p-2 text-center text-sm font-medium text-gray-700">
                  좋음
                </th>
                <th className="p-2 text-center text-sm font-medium text-gray-700">보통</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-r border-gray-200 p-2 text-sm">서비스 품질</td>
                <td className="border-r border-gray-200 p-2 text-center">
                  <input type="radio" disabled className="text-blue-500" />
                </td>
                <td className="border-r border-gray-200 p-2 text-center">
                  <input type="radio" disabled className="text-blue-500" />
                </td>
                <td className="p-2 text-center">
                  <input type="radio" disabled className="text-blue-500" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );

    default:
      return <div className="text-gray-400 text-sm">미리보기 준비 중...</div>;
  }
}

// 테스트 모드용 인터랙티브 질문 카드 컴포넌트
function QuestionTestCard({ question, index }: { question: Question; index: number }) {
  const { testResponses, updateTestResponse } = useSurveyBuilderStore();

  const handleResponse = (value: any) => {
    updateTestResponse(question.id, value);
  };

  return (
    <Card className="p-6 border-l-4 border-l-blue-500">
      <div className="mb-4">
        <div className="flex items-center space-x-2 mb-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-sm font-medium">
            {index + 1}
          </span>
          {question.required && <span className="text-red-500 text-sm">*</span>}
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">{question.title}</h3>
        {question.description && (
          <p className="text-sm text-gray-600 mb-4">{question.description}</p>
        )}
      </div>

      <div className="space-y-3">
        <QuestionTestInput
          question={question}
          value={testResponses[question.id]}
          onChange={handleResponse}
        />
      </div>
    </Card>
  );
}

// 질문 타입별 테스트 입력 컴포넌트
function QuestionTestInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: any;
  onChange: (value: any) => void;
}) {
  switch (question.type) {
    case "text":
      return (
        <Input
          placeholder="답변을 입력하세요..."
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full"
        />
      );

    case "textarea":
      return (
        <textarea
          className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
          placeholder="답변을 입력하세요..."
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "radio":
      return (
        <div className="space-y-3">
          {question.options?.map((option) => (
            <div key={option.id} className="flex items-center space-x-3">
              <input
                type="radio"
                name={question.id}
                value={option.value}
                checked={value === option.value}
                onChange={(e) => onChange(e.target.value)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <label
                className="text-sm text-gray-700 cursor-pointer flex-1"
                onClick={() => onChange(option.value)}
              >
                {option.label}
              </label>
            </div>
          ))}
        </div>
      );

    case "checkbox":
      return (
        <div className="space-y-3">
          {question.options?.map((option) => {
            const currentValues = Array.isArray(value) ? value : [];
            const isChecked = currentValues.includes(option.value);

            return (
              <div key={option.id} className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    const newValues = e.target.checked
                      ? [...currentValues, option.value]
                      : currentValues.filter((v) => v !== option.value);
                    onChange(newValues);
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label
                  className="text-sm text-gray-700 cursor-pointer flex-1"
                  onClick={() => {
                    const newValues = isChecked
                      ? currentValues.filter((v) => v !== option.value)
                      : [...currentValues, option.value];
                    onChange(newValues);
                  }}
                >
                  {option.label}
                </label>
              </div>
            );
          })}
        </div>
      );

    case "select":
      return (
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">선택하세요...</option>
          {question.options?.map((option) => (
            <option key={option.id} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case "multiselect":
      return question.selectLevels ? (
        <UserDefinedMultiLevelSelect
          levels={question.selectLevels}
          values={Array.isArray(value) ? value : []}
          onChange={onChange}
          className="w-full"
        />
      ) : null;

    case "table":
      return (
        <div className="text-center py-4 text-gray-500">
          테이블 질문 테스트 기능은 준비 중입니다.
        </div>
      );

    default:
      return (
        <div className="text-center py-4 text-gray-500">이 질문 유형은 테스트할 수 없습니다.</div>
      );
  }
}

function getQuestionTypeLabel(type: string): string {
  const labels = {
    text: "단답형",
    textarea: "장문형",
    radio: "단일선택",
    checkbox: "다중선택",
    select: "드롭다운",
    multiselect: "다단계선택",
    table: "테이블",
  };
  return labels[type as keyof typeof labels] || type;
}

interface SortableQuestionListProps {
  questions: Question[];
  selectedQuestionId: string | null;
  isTestMode?: boolean;
}

export function SortableQuestionList({
  questions,
  selectedQuestionId,
  isTestMode = false,
}: SortableQuestionListProps) {
  const { reorderQuestions, selectQuestion, deleteQuestion, updateQuestion, addQuestion } =
    useSurveyBuilderStore();

  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex((q) => q.id === active.id);
      const newIndex = questions.findIndex((q) => q.id === over.id);

      const newOrder = arrayMove(questions, oldIndex, newIndex);
      reorderQuestions(newOrder.map((q) => q.id));
    }
  }

  const handleEdit = (questionId: string) => {
    setEditingQuestionId(questionId);
  };

  const handleDelete = (questionId: string) => {
    if (confirm("이 질문을 삭제하시겠습니까?")) {
      deleteQuestion(questionId);
    }
  };

  const handleDuplicate = (questionId: string) => {
    const questionToDuplicate = questions.find((q) => q.id === questionId);
    if (questionToDuplicate) {
      addQuestion(questionToDuplicate.type);
      // Get the newly added question and update its details
      setTimeout(() => {
        const currentQuestions = questions;
        const lastQuestion = currentQuestions[currentQuestions.length - 1];
        if (lastQuestion) {
          updateQuestion(lastQuestion.id, {
            title: `${questionToDuplicate.title} (복사본)`,
            description: questionToDuplicate.description,
            required: questionToDuplicate.required,
            options: questionToDuplicate.options
              ? [
                  ...questionToDuplicate.options.map((opt) => ({
                    ...opt,
                    id: `option-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  })),
                ]
              : undefined,
            selectLevels: questionToDuplicate.selectLevels
              ? [...questionToDuplicate.selectLevels]
              : undefined,
          });
        }
      }, 100);
    }
  };

  if (questions.length === 0) {
    return null;
  }

  // 테스트 모드일 때는 인터랙티브한 질문 테스트 모드
  if (isTestMode) {
    return (
      <div className="space-y-6">
        {questions.map((question, index) => (
          <QuestionTestCard key={question.id} question={question} index={index} />
        ))}
      </div>
    );
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {questions.map((question, index) => (
              <SortableQuestion
                key={question.id}
                question={question}
                index={index}
                isSelected={selectedQuestionId === question.id}
                onSelect={selectQuestion}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <QuestionEditModal
        questionId={editingQuestionId}
        isOpen={!!editingQuestionId}
        onClose={() => setEditingQuestionId(null)}
      />
    </>
  );
}
