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
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
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
import { InteractiveTableResponse } from "./interactive-table-response";
import { TablePreview } from "./table-preview";
import { NoticeRenderer } from "./notice-renderer";
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
    transition: isDragging ? "none" : transition,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      data-question-index={index}
      className={`relative group transition-all duration-200 ${
        isSelected
          ? "ring-2 ring-blue-500 border-blue-200 shadow-lg"
          : "border-gray-200 hover:border-gray-300 hover:shadow-md"
      } ${
        isDragging
          ? "z-50 rotate-2 scale-105 shadow-2xl ring-4 ring-blue-300 ring-opacity-50 bg-blue-50 border-blue-300"
          : ""
      }`}
      onClick={() => onSelect(question.id)}
    >
      <div className="p-6">
        {/* Header with drag handle */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-md transition-all duration-200 ${
                isDragging
                  ? "bg-blue-200 text-blue-700 cursor-grabbing"
                  : "cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              }`}
              {...attributes}
              {...listeners}
              title="드래그하여 순서 변경"
            >
              <GripVertical className={`w-4 h-4 ${isDragging ? "animate-pulse" : ""}`} />
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
            <div
              className="text-sm text-gray-600 mb-3 prose prose-sm max-w-none
                [&_table]:border-collapse [&_table]:w-full [&_table]:my-2 [&_table]:border-2 [&_table]:border-gray-300
                [&_table_td]:border [&_table_td]:border-gray-300 [&_table_td]:px-3 [&_table_td]:py-2
                [&_table_th]:border [&_table_th]:border-gray-300 [&_table_th]:px-3 [&_table_th]:py-2
                [&_table_th]:font-normal [&_table_th]:bg-transparent
                [&_table_p]:m-0
                [&_p]:min-h-[1.6em]"
              dangerouslySetInnerHTML={{ __html: question.description }}
            />
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
      return question.tableColumns && question.tableRowsData ? (
        <TablePreview
          tableTitle={question.tableTitle}
          columns={question.tableColumns}
          rows={question.tableRowsData}
          className="border-0 shadow-none"
        />
      ) : (
        <div className="text-gray-400 text-sm text-center py-4">테이블이 구성되지 않았습니다.</div>
      );

    case "notice":
      return question.noticeContent ? (
        <NoticeRenderer
          content={question.noticeContent}
          requiresAcknowledgment={question.requiresAcknowledgment}
          value={false}
          isTestMode={false}
        />
      ) : (
        <div className="text-gray-400 text-sm text-center py-4">공지사항 내용이 없습니다.</div>
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
    <Card className="p-6 border-l-4 border-l-blue-500" data-question-index={index}>
      <div className="mb-4">
        <div className="flex items-center space-x-2 mb-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-sm font-medium">
            {index + 1}
          </span>
          {question.required && <span className="text-red-500 text-sm">*</span>}
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">{question.title}</h3>
        {question.description && (
          <div
            className="text-sm text-gray-600 mb-4 prose prose-sm max-w-none
              [&_table]:border-collapse [&_table]:w-full [&_table]:my-2 [&_table]:border-2 [&_table]:border-gray-300
              [&_table_td]:border [&_table_td]:border-gray-300 [&_table_td]:px-3 [&_table_td]:py-2
              [&_table_th]:border [&_table_th]:border-gray-300 [&_table_th]:px-3 [&_table_th]:py-2
              [&_table_th]:font-normal [&_table_th]:bg-transparent
              [&_table_p]:m-0
              [&_p]:min-h-[1.6em]"
            dangerouslySetInnerHTML={{ __html: question.description }}
          />
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
      return question.tableColumns && question.tableRowsData ? (
        <InteractiveTableResponse
          questionId={question.id}
          tableTitle={question.tableTitle}
          columns={question.tableColumns}
          rows={question.tableRowsData}
          isTestMode={true}
          className="border-0 shadow-none"
        />
      ) : (
        <div className="text-center py-4 text-gray-500">테이블이 구성되지 않았습니다.</div>
      );

    case "notice":
      return (
        <NoticeRenderer
          content={question.noticeContent || ""}
          requiresAcknowledgment={question.requiresAcknowledgment}
          value={value || false}
          onChange={onChange}
          isTestMode={true}
        />
      );

    default:
      return (
        <div className="text-center py-4 text-gray-500">이 질문 유형은 테스트할 수 없습니다.</div>
      );
  }
}

function getQuestionTypeLabel(type: string): string {
  const labels = {
    notice: "공지사항",
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    setActiveId(active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    setOverId((over?.id as string) || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex((q) => q.id === active.id);
      const newIndex = questions.findIndex((q) => q.id === over.id);

      const newOrder = arrayMove(questions, oldIndex, newIndex);
      reorderQuestions(newOrder.map((q) => q.id));
    }

    setActiveId(null);
    setOverId(null);
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {questions.map((question, index) => (
              <div key={question.id} className="relative">
                {/* 드롭 영역 표시 */}
                {overId === question.id && activeId !== question.id && (
                  <div className="absolute -top-2 left-0 right-0 h-1 bg-blue-500 rounded-full animate-pulse z-10" />
                )}
                <SortableQuestion
                  question={question}
                  index={index}
                  isSelected={selectedQuestionId === question.id}
                  onSelect={selectQuestion}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                />
              </div>
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeId ? (
            <div className="opacity-95">
              <SortableQuestion
                question={questions.find((q) => q.id === activeId)!}
                index={questions.findIndex((q) => q.id === activeId)}
                isSelected={false}
                onSelect={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
                onDuplicate={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <QuestionEditModal
        questionId={editingQuestionId}
        isOpen={!!editingQuestionId}
        onClose={() => setEditingQuestionId(null)}
      />
    </>
  );
}
