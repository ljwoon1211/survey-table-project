"use client";

import { useState, useEffect, useMemo } from "react";
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
import { generateId } from "@/lib/utils";
import {
  deleteQuestion as deleteQuestionAction,
  reorderQuestions as reorderQuestionsAction,
  createQuestion as createQuestionAction,
} from "@/actions/survey-actions";
import { UserDefinedMultiLevelSelectPreview } from "./user-defined-multi-level-select";
import { MultiLevelSelect } from "./multi-level-select";
import { UserDefinedMultiLevelSelect } from "./user-defined-multi-level-select";
import { InteractiveTableResponse } from "./interactive-table-response";
import { TablePreview } from "./table-preview";
import { NoticeRenderer } from "./notice-renderer";
import { GroupHeader } from "./group-header";
import { convertHtmlImageUrlsToProxy, deleteImagesFromR2 } from "@/lib/image-utils";
import { extractImageUrlsFromQuestion } from "@/lib/image-extractor";
import { isValidUUID } from "@/lib/utils";
import {
  GripVertical,
  Settings,
  Trash2,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  BookmarkPlus,
} from "lucide-react";

interface SortableQuestionProps {
  question: Question;
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onSaveToLibrary?: (question: Question) => void;
}

function SortableQuestion({
  question,
  index,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onSaveToLibrary,
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
                title="편집"
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
                title="복제"
              >
                <Copy className="w-4 h-4" />
              </Button>
              {onSaveToLibrary && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSaveToLibrary(question);
                  }}
                  title="질문 저장"
                >
                  <BookmarkPlus className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(question.id);
                }}
                title="삭제"
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
              className="text-sm text-gray-600 mb-3 prose prose-sm max-w-none overflow-x-auto
                [&_table]:border-collapse [&_table]:table-fixed [&_table]:w-full [&_table]:my-2 [&_table]:border-2 [&_table]:border-gray-300
                [&_table_td]:border [&_table_td]:border-gray-300 [&_table_td]:px-3 [&_table_td]:py-2
                [&_table_th]:border [&_table_th]:border-gray-300 [&_table_th]:px-3 [&_table_th]:py-2
                [&_table_th]:font-normal [&_table_th]:bg-transparent
                [&_table_p]:m-0
                [&_p]:min-h-[1.6em]"
              style={{
                WebkitOverflowScrolling: "touch",
              }}
              dangerouslySetInnerHTML={{
                __html: convertHtmlImageUrlsToProxy(question.description),
              }}
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
      return (
        <Input
          placeholder={question.placeholder || "답변을 입력하세요..."}
          disabled
          className="bg-white"
        />
      );

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

  const handleResponse = (value: unknown) => {
    updateTestResponse(
      question.id,
      value as string | string[] | Record<string, string | string[] | object>,
    );
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
            className="text-sm text-gray-600 mb-4 prose prose-sm max-w-none overflow-x-auto
              [&_table]:border-collapse [&_table]:table-fixed [&_table]:w-full [&_table]:my-2 [&_table]:border-2 [&_table]:border-gray-300
              [&_table_td]:border [&_table_td]:border-gray-300 [&_table_td]:px-3 [&_table_td]:py-2
              [&_table_th]:border [&_table_th]:border-gray-300 [&_table_th]:px-3 [&_table_th]:py-2
              [&_table_th]:font-normal [&_table_th]:bg-transparent
              [&_table_p]:m-0
              [&_p]:min-h-[1.6em]"
            style={{
              WebkitOverflowScrolling: "touch",
            }}
            dangerouslySetInnerHTML={{ __html: convertHtmlImageUrlsToProxy(question.description) }}
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

// 기타 옵션 관련 타입 정의
type OtherChoiceValue = {
  selectedValue: string;
  otherValue?: string;
  hasOther: true;
};

function isOtherChoiceValue(value: unknown): value is OtherChoiceValue {
  if (!value || typeof value !== "object") return false;
  return (
    "selectedValue" in value &&
    typeof (value as { selectedValue: unknown }).selectedValue === "string" &&
    "hasOther" in value &&
    (value as { hasOther: unknown }).hasOther === true
  );
}

type SingleChoiceResponse = string | null | OtherChoiceValue;
type MultiChoiceResponse = Array<string | OtherChoiceValue>;

// 테스트 모드용 Radio 질문 컴포넌트
function RadioTestInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: SingleChoiceResponse;
  onChange: (value: SingleChoiceResponse) => void;
}) {
  const [otherInput, setOtherInput] = useState("");

  useEffect(() => {
    if (isOtherChoiceValue(value) && value.otherValue) {
      setOtherInput(value.otherValue);
    } else {
      setOtherInput("");
    }
  }, [value]);

  const handleOptionChange = (optionValue: string, optionId: string) => {
    const isOtherOption = optionId === "other-option";
    const isSelected = isOtherChoiceValue(value)
      ? value.selectedValue === optionValue
      : value === optionValue;

    if (isSelected) {
      onChange(null);
      return;
    }

    if (isOtherOption) {
      onChange({
        selectedValue: optionValue,
        otherValue: otherInput,
        hasOther: true,
      });
    } else {
      onChange(optionValue);
    }
  };

  const handleOtherInputChange = (inputValue: string) => {
    setOtherInput(inputValue);
    if (isOtherChoiceValue(value)) {
      onChange({
        ...value,
        otherValue: inputValue,
      });
    }
  };

  const isSelected = (optionValue: string) => {
    if (isOtherChoiceValue(value)) {
      return value.selectedValue === optionValue;
    }
    return value === optionValue;
  };

  return (
    <div className="space-y-3">
      {question.options?.map((option) => (
        <div key={option.id} className="space-y-2">
          <div className="flex items-center space-x-3">
            <input
              type="radio"
              id={`${question.id}-${option.id}`}
              name={question.id}
              value={option.value}
              checked={isSelected(option.value)}
              onChange={() => handleOptionChange(option.value, option.id)}
              onClick={() => handleOptionChange(option.value, option.id)}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
            />
            <label
              htmlFor={`${question.id}-${option.id}`}
              onClick={(e) => {
                e.preventDefault();
                handleOptionChange(option.value, option.id);
              }}
              className="text-sm text-gray-700 cursor-pointer flex-1"
            >
              {option.label}
            </label>
          </div>
          {option.id === "other-option" && isSelected(option.value) && (
            <div className="ml-7">
              <Input
                placeholder="기타 내용을 입력하세요..."
                value={otherInput}
                onChange={(e) => handleOtherInputChange(e.target.value)}
                className="w-full"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// 테스트 모드용 Checkbox 질문 컴포넌트
function CheckboxTestInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: MultiChoiceResponse;
  onChange: (value: MultiChoiceResponse) => void;
}) {
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>({});

  const currentValues = useMemo<MultiChoiceResponse>(
    () => (Array.isArray(value) ? (value as MultiChoiceResponse) : []),
    [value],
  );

  useEffect(() => {
    const newOtherInputs: Record<string, string> = {};
    currentValues.forEach((val) => {
      if (isOtherChoiceValue(val)) {
        newOtherInputs[val.selectedValue] = val.otherValue || "";
      }
    });
    setOtherInputs(newOtherInputs);
  }, [currentValues]);

  const handleOptionChange = (optionValue: string, optionId: string, isChecked: boolean) => {
    let newValues = [...currentValues];
    const isOtherOption = optionId === "other-option";

    if (isChecked) {
      // 최대 선택 개수 체크
      const maxSelections = question.maxSelections;
      if (maxSelections !== undefined && maxSelections > 0) {
        const currentCount = newValues.length;
        if (currentCount >= maxSelections) {
          // 최대 개수 도달 시 추가 선택 불가
          return;
        }
      }

      if (isOtherOption) {
        newValues.push({
          selectedValue: optionValue,
          otherValue: otherInputs[optionValue] || "",
          hasOther: true,
        });
      } else {
        newValues.push(optionValue);
      }
    } else {
      newValues = newValues.filter((val) => {
        if (isOtherChoiceValue(val)) {
          return val.selectedValue !== optionValue;
        }
        return val !== optionValue;
      });
    }

    onChange(newValues);
  };

  const handleOtherInputChange = (optionValue: string, inputValue: string) => {
    const newOtherInputs = { ...otherInputs, [optionValue]: inputValue };
    setOtherInputs(newOtherInputs);

    const newValues = currentValues.map((val) => {
      if (isOtherChoiceValue(val) && val.selectedValue === optionValue) {
        return { ...val, otherValue: inputValue };
      }
      return val;
    });

    onChange(newValues);
  };

  const isChecked = (optionValue: string) => {
    return currentValues.some((val) => {
      if (isOtherChoiceValue(val)) {
        return val.selectedValue === optionValue;
      }
      return val === optionValue;
    });
  };

  const currentCount = currentValues.length;
  const maxSelections = question.maxSelections;
  const minSelections = question.minSelections;
  const isMaxReached =
    maxSelections !== undefined && maxSelections > 0 && currentCount >= maxSelections;
  const isMinNotMet =
    minSelections !== undefined && minSelections > 0 && currentCount < minSelections;

  const canSelect = (optionValue: string) => {
    if (isChecked(optionValue)) return true; // 이미 선택된 것은 해제 가능
    if (isMaxReached) return false; // 최대 개수 도달 시 추가 선택 불가
    return true;
  };

  return (
    <div className="space-y-3">
      {question.options?.map((option) => {
        const checked = isChecked(option.value);
        const disabled = !canSelect(option.value);

        return (
          <div key={option.id} className="space-y-2">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id={`${question.id}-${option.id}`}
                checked={checked}
                disabled={disabled}
                onChange={(e) => handleOptionChange(option.value, option.id, e.target.checked)}
                className={`w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${
                  disabled ? "opacity-50 cursor-not-allowed" : ""
                }`}
              />
              <label
                htmlFor={`${question.id}-${option.id}`}
                className={`text-sm text-gray-700 flex-1 ${
                  disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                {option.label}
              </label>
            </div>
            {option.id === "other-option" && checked && (
              <div className="ml-7">
                <Input
                  placeholder="기타 내용을 입력하세요..."
                  value={otherInputs[option.value] || ""}
                  onChange={(e) => handleOtherInputChange(option.value, e.target.value)}
                  className="w-full"
                />
              </div>
            )}
          </div>
        );
      })}

      {/* 선택 개수 표시 */}
      {(maxSelections !== undefined || minSelections !== undefined) && (
        <div className="pt-2 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {maxSelections !== undefined && maxSelections > 0
                ? `${currentCount}/${maxSelections}개 선택됨`
                : `${currentCount}개 선택됨`}
            </span>
            {isMinNotMet && (
              <span className="text-orange-600">최소 {minSelections}개 이상 선택해주세요</span>
            )}
            {isMaxReached && <span className="text-blue-600">최대 선택 개수에 도달했습니다</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// 테스트 모드용 Select 질문 컴포넌트
function SelectTestInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: SingleChoiceResponse;
  onChange: (value: SingleChoiceResponse) => void;
}) {
  const [otherInput, setOtherInput] = useState("");
  const [selectedValue, setSelectedValue] = useState<string>("");

  // value가 변경될 때 selectedValue와 otherInput 동기화
  useEffect(() => {
    if (isOtherChoiceValue(value)) {
      setSelectedValue(value.selectedValue);
      setOtherInput(value.otherValue || "");
    } else {
      setSelectedValue(value || "");
      setOtherInput("");
    }
  }, [value]);

  const handleSelectChange = (newValue: string) => {
    setSelectedValue(newValue);
    const selectedOption = question.options?.find((opt) => opt.value === newValue);

    if (selectedOption?.id === "other-option") {
      onChange({
        selectedValue: newValue,
        otherValue: otherInput,
        hasOther: true,
      });
    } else {
      onChange(newValue);
    }
  };

  const handleOtherInputChange = (inputValue: string) => {
    setOtherInput(inputValue);
    if (selectedValue) {
      const selectedOption = question.options?.find((opt) => opt.value === selectedValue);
      if (selectedOption?.id === "other-option") {
        onChange({
          selectedValue,
          otherValue: inputValue,
          hasOther: true,
        });
      }
    }
  };

  const showOtherInput = () => {
    if (!selectedValue) return false;
    const selectedOption = question.options?.find((opt) => opt.value === selectedValue);
    return selectedOption?.id === "other-option";
  };

  return (
    <div className="space-y-3">
      <select
        value={selectedValue}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">선택하세요...</option>
        {question.options?.map((option) => (
          <option key={option.id} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {showOtherInput() && (
        <div>
          <Input
            placeholder="기타 내용을 입력하세요..."
            value={otherInput}
            onChange={(e) => handleOtherInputChange(e.target.value)}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}

// 질문 타입별 테스트 입력 컴포넌트
function QuestionTestInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (question.type) {
    case "text":
      return (
        <Input
          placeholder={question.placeholder || "답변을 입력하세요..."}
          value={(value as string) || ""}
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
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "radio":
      return (
        <RadioTestInput
          question={question}
          value={value as SingleChoiceResponse}
          onChange={onChange as (value: SingleChoiceResponse) => void}
        />
      );

    case "checkbox":
      return (
        <CheckboxTestInput
          question={question}
          value={value as MultiChoiceResponse}
          onChange={onChange as (value: MultiChoiceResponse) => void}
        />
      );

    case "select":
      return (
        <SelectTestInput
          question={question}
          value={value as SingleChoiceResponse}
          onChange={onChange as (value: SingleChoiceResponse) => void}
        />
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
          value={typeof value === "object" && value !== null ? value : undefined}
          onChange={onChange}
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
          value={typeof value === "boolean" ? value : false}
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
  onSaveToLibrary?: (question: Question) => void;
}

export function SortableQuestionList({
  questions,
  selectedQuestionId,
  isTestMode = false,
  onSaveToLibrary,
}: SortableQuestionListProps) {
  const {
    currentSurvey,
    reorderQuestions,
    selectQuestion,
    deleteQuestion,
    updateQuestion,
    addQuestion,
  } = useSurveyBuilderStore();

  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const groups = currentSurvey.groups || [];

  // 중복 제거: 같은 ID를 가진 그룹이 있으면 첫 번째 것만 사용
  const uniqueGroups = Array.from(new Map(groups.map((g) => [g.id, g])).values());

  // 최상위 그룹만 필터링
  const topLevelGroups = uniqueGroups
    .filter((g) => !g.parentGroupId)
    .sort((a, b) => a.order - b.order);

  // 특정 그룹의 하위 그룹들 가져오기
  const getSubGroups = (parentId: string) => {
    return uniqueGroups
      .filter((g) => g.parentGroupId === parentId)
      .sort((a, b) => a.order - b.order);
  };

  // 그룹별로 질문 분류
  const questionsByGroup = questions.reduce((acc, question) => {
    const groupId = question.groupId || "ungrouped";
    if (!acc[groupId]) {
      acc[groupId] = [];
    }
    acc[groupId].push(question);
    return acc;
  }, {} as Record<string, Question[]>);

  // 재귀적으로 그룹과 모든 하위 그룹의 질문 개수 합계 계산
  const getTotalQuestionCount = (groupId: string): number => {
    const directCount = (questionsByGroup[groupId] || []).length;
    const subGroups = getSubGroups(groupId);
    const subGroupsCount = subGroups.reduce((sum, subGroup) => {
      return sum + getTotalQuestionCount(subGroup.id);
    }, 0);
    return directCount + subGroupsCount;
  };

  // 재귀적으로 모든 하위 그룹 개수 계산 (직접 하위 + 하위의 하위)
  const getTotalSubGroupCount = (groupId: string): number => {
    const directSubGroups = getSubGroups(groupId);
    const directCount = directSubGroups.length;
    const nestedCount = directSubGroups.reduce((sum, subGroup) => {
      return sum + getTotalSubGroupCount(subGroup.id);
    }, 0);
    return directCount + nestedCount;
  };

  // 그룹 없는 질문들
  const ungroupedQuestions = questionsByGroup["ungrouped"] || [];

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
      // 전체 질문 목록을 그룹 순서대로 정렬
      // 1. 그룹별로 질문 분류 (이미 questionsByGroup에 있음)
      // 2. 그룹 순서대로 질문들을 평탄화
      const orderedQuestions: Question[] = [];

      // 최상위 그룹 순서대로
      topLevelGroups.forEach((group) => {
        const groupQuestions = (questionsByGroup[group.id] || []).sort((a, b) => a.order - b.order);
        orderedQuestions.push(...groupQuestions);

        // 하위 그룹들도 순서대로
        const subGroups = getSubGroups(group.id);
        subGroups.forEach((subGroup) => {
          const subGroupQuestions = (questionsByGroup[subGroup.id] || []).sort(
            (a, b) => a.order - b.order,
          );
          orderedQuestions.push(...subGroupQuestions);
        });
      });

      // 그룹 없는 질문들
      const ungrouped = (questionsByGroup["ungrouped"] || []).sort((a, b) => a.order - b.order);
      orderedQuestions.push(...ungrouped);

      const oldIndex = orderedQuestions.findIndex((q) => q.id === active.id);
      const newIndex = orderedQuestions.findIndex((q) => q.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(orderedQuestions, oldIndex, newIndex);
        const questionIds = newOrder.map((q) => q.id);

        // 로컬 스토어 업데이트
        reorderQuestions(questionIds);

        // 서버에 질문 순서 변경 API 호출
        if (currentSurvey.id) {
          reorderQuestionsAction(questionIds).catch((error) => {
            console.error("질문 순서 변경 실패:", error);
          });
        }
      }
    }

    setActiveId(null);
    setOverId(null);
  }

  const handleEdit = (questionId: string) => {
    setEditingQuestionId(questionId);
  };

  const handleDelete = async (questionId: string) => {
    if (confirm("이 질문을 삭제하시겠습니까?")) {
      // 삭제 전 질문에서 이미지 추출 및 삭제
      const questionToDelete = questions.find((q) => q.id === questionId);
      if (questionToDelete) {
        const images = extractImageUrlsFromQuestion(questionToDelete);
        if (images.length > 0) {
          try {
            await deleteImagesFromR2(images);
          } catch (error) {
            console.error("질문 삭제 시 이미지 삭제 실패:", error);
            // 이미지 삭제 실패해도 질문 삭제는 진행
          }
        }
      }

      // 로컬 스토어에서 삭제
      deleteQuestion(questionId);

      // UUID 형식인 경우에만 서버에 질문 삭제 API 호출 (임시 질문은 DB에 없으므로 호출 불필요)
      if (isValidUUID(questionId)) {
        try {
          await deleteQuestionAction(questionId);
        } catch (error) {
          console.error("질문 삭제 실패:", error);
        }
      }
    }
  };

  const handleDuplicate = async (questionId: string) => {
    const questionToDuplicate = questions.find((q) => q.id === questionId);
    if (questionToDuplicate) {
      // 먼저 컬럼을 복제하여 새 컬럼 ID들을 확보
      const newTableColumns = questionToDuplicate.tableColumns
        ? questionToDuplicate.tableColumns.map((col) => ({
            ...col,
            id: generateId(),
          }))
        : undefined;

      // 기존 질문들의 최대 order를 찾아서 +1 (없으면 1부터 시작)
      const maxOrder = questions.length > 0 
        ? Math.max(...questions.map(q => q.order), 0)
        : 0;
      
      // 새로운 ID를 가진 완전한 복사본 생성
      const newQuestion: Question = {
        ...questionToDuplicate,
        id: generateId(),
        title: `${questionToDuplicate.title} (복사본)`,
        order: maxOrder + 1, // 1부터 시작하는 실제 질문 번호
        // options 복사 (새 ID 부여)
        options: questionToDuplicate.options
          ? questionToDuplicate.options.map((opt) => ({
              ...opt,
              id: generateId(),
            }))
          : undefined,
        // selectLevels 복사 (새 ID 부여)
        selectLevels: questionToDuplicate.selectLevels
          ? questionToDuplicate.selectLevels.map((level) => ({
              ...level,
              id: generateId(),
              options: level.options.map((opt) => ({
                ...opt,
                id: generateId(),
              })),
            }))
          : undefined,
        // tableColumns 복사 (위에서 생성한 새 컬럼 사용)
        tableColumns: newTableColumns,
        // tableRowsData 복사 (새 ID 부여 및 셀 ID 규칙 적용)
        tableRowsData: questionToDuplicate.tableRowsData
          ? questionToDuplicate.tableRowsData.map((row) => {
              const newRowId = generateId();
              return {
                ...row,
                id: newRowId,
                cells: row.cells.map((cell, cellIndex) => {
                  // 해당 셀의 새 컬럼 ID 찾기
                  const newColId = newTableColumns?.[cellIndex]?.id;
                  const newCellId = newColId ? `cell-${newRowId}-${newColId}` : generateId();

                  return {
                    ...cell,
                    id: newCellId,
                    // 셀 내부의 옵션들도 복사
                    checkboxOptions: cell.checkboxOptions
                      ? cell.checkboxOptions.map((opt) => ({
                          ...opt,
                          id: generateId(),
                        }))
                      : undefined,
                    radioOptions: cell.radioOptions
                      ? cell.radioOptions.map((opt) => ({
                          ...opt,
                          id: generateId(),
                        }))
                      : undefined,
                    selectOptions: cell.selectOptions
                      ? cell.selectOptions.map((opt) => ({
                          ...opt,
                          id: generateId(),
                        }))
                      : undefined,
                  };
                }),
              };
            })
          : undefined,
      };

      // 로컬 스토어에 추가
      useSurveyBuilderStore.getState().addPreparedQuestion(newQuestion);

      // 서버에 질문 생성 API 호출
      if (currentSurvey.id) {
        try {
          await createQuestionAction({
            surveyId: currentSurvey.id,
            groupId: newQuestion.groupId,
            type: newQuestion.type,
            title: newQuestion.title,
            description: newQuestion.description,
            required: newQuestion.required,
            order: newQuestion.order,
            options: newQuestion.options,
            selectLevels: newQuestion.selectLevels,
            tableTitle: newQuestion.tableTitle,
            tableColumns: newQuestion.tableColumns,
            tableRowsData: newQuestion.tableRowsData,
            imageUrl: newQuestion.imageUrl,
            videoUrl: newQuestion.videoUrl,
            allowOtherOption: newQuestion.allowOtherOption,
            noticeContent: newQuestion.noticeContent,
            requiresAcknowledgment: newQuestion.requiresAcknowledgment,
            tableValidationRules: newQuestion.tableValidationRules,
            displayCondition: newQuestion.displayCondition,
          });
        } catch (error) {
          console.error("질문 복제 실패:", error);
        }
      }
    }
  };

  if (questions.length === 0) {
    return null;
  }

  // 테스트 모드일 때는 인터랙티브한 질문 테스트 모드
  if (isTestMode) {
    return (
      <div className="space-y-6">
        {/* 그룹별로 렌더링 (2단계 계층) */}
        {topLevelGroups.map((group) => {
          const groupQuestions = questionsByGroup[group.id] || [];
          const subGroups = getSubGroups(group.id);

          return (
            <div key={group.id} className="space-y-4">
              <GroupHeader
                group={group}
                questionCount={getTotalQuestionCount(group.id)}
                subGroupCount={getTotalSubGroupCount(group.id)}
              />
              {!group.collapsed && (
                <>
                  {/* 최상위 그룹의 질문들 */}
                  {groupQuestions.length > 0 && (
                    <div className="space-y-4 pl-4">
                      {groupQuestions.map((question) => (
                        <QuestionTestCard
                          key={question.id}
                          question={question}
                          index={questions.indexOf(question)}
                        />
                      ))}
                    </div>
                  )}

                  {/* 하위 그룹들 */}
                  {subGroups.map((subGroup) => {
                    const subGroupQuestions = questionsByGroup[subGroup.id] || [];

                    return (
                      <div key={subGroup.id} className="ml-4 space-y-4">
                        <GroupHeader
                          group={subGroup}
                          questionCount={getTotalQuestionCount(subGroup.id)}
                          subGroupCount={getTotalSubGroupCount(subGroup.id)}
                        />
                        {!subGroup.collapsed && (
                          <div className="space-y-4 pl-4">
                            {subGroupQuestions.map((question) => (
                              <QuestionTestCard
                                key={question.id}
                                question={question}
                                index={questions.indexOf(question)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          );
        })}

        {/* 그룹 없는 질문들 */}
        {ungroupedQuestions.length > 0 && (
          <div className="space-y-4">
            {topLevelGroups.length > 0 && (
              <div className="flex items-center space-x-2 py-2">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">그룹 없음</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            )}
            {ungroupedQuestions.map((question, index) => (
              <QuestionTestCard
                key={question.id}
                question={question}
                index={questions.indexOf(question)}
              />
            ))}
          </div>
        )}
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
          <div className="space-y-6">
            {/* 그룹별로 렌더링 (2단계 계층) */}
            {topLevelGroups.map((group) => {
              const groupQuestions = questionsByGroup[group.id] || [];
              const subGroups = getSubGroups(group.id);

              return (
                <div key={group.id} className="space-y-4">
                  <GroupHeader
                    group={group}
                    questionCount={getTotalQuestionCount(group.id)}
                    subGroupCount={getTotalSubGroupCount(group.id)}
                  />
                  {!group.collapsed && (
                    <>
                      {/* 최상위 그룹의 질문들 */}
                      {groupQuestions.length > 0 && (
                        <div className="space-y-4 pl-4">
                          {groupQuestions.map((question) => (
                            <div key={question.id} className="relative">
                              {/* 드롭 영역 표시 */}
                              {overId === question.id && activeId !== question.id && (
                                <div className="absolute -top-2 left-0 right-0 h-1 bg-blue-500 rounded-full animate-pulse z-10" />
                              )}
                              <SortableQuestion
                                question={question}
                                index={questions.indexOf(question)}
                                isSelected={selectedQuestionId === question.id}
                                onSelect={selectQuestion}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onDuplicate={handleDuplicate}
                                onSaveToLibrary={onSaveToLibrary}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 하위 그룹들 */}
                      {subGroups.map((subGroup) => {
                        const subGroupQuestions = questionsByGroup[subGroup.id] || [];

                        return (
                          <div key={subGroup.id} className="ml-4 space-y-4">
                            <GroupHeader
                              group={subGroup}
                              questionCount={getTotalQuestionCount(subGroup.id)}
                              subGroupCount={getTotalSubGroupCount(subGroup.id)}
                            />
                            {!subGroup.collapsed && (
                              <div className="space-y-4 pl-4">
                                {subGroupQuestions.map((question) => (
                                  <div key={question.id} className="relative">
                                    {/* 드롭 영역 표시 */}
                                    {overId === question.id && activeId !== question.id && (
                                      <div className="absolute -top-2 left-0 right-0 h-1 bg-blue-500 rounded-full animate-pulse z-10" />
                                    )}
                                    <SortableQuestion
                                      question={question}
                                      index={questions.indexOf(question)}
                                      isSelected={selectedQuestionId === question.id}
                                      onSelect={selectQuestion}
                                      onEdit={handleEdit}
                                      onDelete={handleDelete}
                                      onDuplicate={handleDuplicate}
                                      onSaveToLibrary={onSaveToLibrary}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}

            {/* 그룹 없는 질문들 */}
            {ungroupedQuestions.length > 0 && (
              <div className="space-y-4">
                {topLevelGroups.length > 0 && (
                  <div className="flex items-center space-x-2 py-2">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400">그룹 없음</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}
                {ungroupedQuestions.map((question, index) => (
                  <div key={question.id} className="relative">
                    {/* 드롭 영역 표시 */}
                    {overId === question.id && activeId !== question.id && (
                      <div className="absolute -top-2 left-0 right-0 h-1 bg-blue-500 rounded-full animate-pulse z-10" />
                    )}
                    <SortableQuestion
                      question={question}
                      index={questions.indexOf(question)}
                      isSelected={selectedQuestionId === question.id}
                      onSelect={selectQuestion}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onDuplicate={handleDuplicate}
                      onSaveToLibrary={onSaveToLibrary}
                    />
                  </div>
                ))}
              </div>
            )}
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
