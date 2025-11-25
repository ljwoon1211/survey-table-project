"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Save,
  Tag,
  Plus,
  X,
  Circle,
  CheckSquare,
  ChevronDown,
  Type,
  FileText,
  List,
  Table,
  Info,
  AlertCircle,
} from "lucide-react";
import { Question } from "@/types/survey";
import { useQuestionLibraryStore } from "@/stores/question-library-store";
import { cn } from "@/lib/utils";

// 질문 타입 아이콘 매핑
const questionTypeIcons: Record<string, React.ElementType> = {
  text: Type,
  textarea: FileText,
  radio: Circle,
  checkbox: CheckSquare,
  select: ChevronDown,
  multiselect: List,
  table: Table,
  notice: Info,
};

// 질문 타입 라벨
const questionTypeLabels: Record<string, string> = {
  text: "단답형",
  textarea: "장문형",
  radio: "단일선택",
  checkbox: "다중선택",
  select: "드롭다운",
  multiselect: "다단계선택",
  table: "테이블",
  notice: "공지사항",
};

interface SaveQuestionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: Question | null;
  onSaved?: () => void;
}

export function SaveQuestionModal({
  open,
  onOpenChange,
  question,
  onSaved,
}: SaveQuestionModalProps) {
  const { saveQuestion, categories, addCategory, hasBranchLogic } = useQuestionLibraryStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("custom");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [errors, setErrors] = useState<{ name?: string }>({});

  // 질문이 변경되면 기본값 설정
  useEffect(() => {
    if (question && open) {
      setName(question.title.slice(0, 50)); // 제목에서 기본 이름 추출
      setDescription(question.description || "");
      setSelectedCategory("custom");
      setTags([]);
      setNewTag("");
      setErrors({});
    }
  }, [question, open]);

  // 태그 추가
  const handleAddTag = () => {
    const trimmedTag = newTag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setNewTag("");
    }
  };

  // 태그 제거
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  // 태그 입력 키 핸들러
  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  // 새 카테고리 추가
  const handleAddCategory = () => {
    const trimmedName = newCategoryName.trim();
    if (trimmedName) {
      addCategory(trimmedName);
      // 새로 추가된 카테고리의 ID를 찾아서 선택
      const newCatId = `cat-${Date.now()}`;
      setSelectedCategory(newCatId);
      setNewCategoryName("");
      setShowNewCategory(false);
    }
  };

  // 저장 처리
  const handleSave = () => {
    // 유효성 검사
    const newErrors: { name?: string } = {};
    if (!name.trim()) {
      newErrors.name = "질문 이름을 입력해주세요.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!question) return;

    saveQuestion(question, {
      name: name.trim(),
      description: description.trim() || undefined,
      category: selectedCategory,
      tags,
    });

    onOpenChange(false);
    onSaved?.();
  };

  if (!question) return null;

  const IconComponent = questionTypeIcons[question.type] || FileText;
  const hasLogic = hasBranchLogic(question);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Save className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            질문 저장하기
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            이 질문을 저장하면 다른 설문에서 쉽게 재사용할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
          {/* 질문 미리보기 */}
          <div className="bg-gray-50 rounded-lg p-2.5 sm:p-3 border">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600 flex-shrink-0">
                <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-xs sm:text-sm line-clamp-2">
                  {question.title}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                  {questionTypeLabels[question.type]}
                  {question.options && ` · ${question.options.length}개 옵션`}
                </p>
              </div>
            </div>
          </div>

          {/* 분기 로직 경고 */}
          {hasLogic && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 sm:p-3">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-amber-700">
                <p className="font-medium">분기 로직 포함</p>
                <p className="text-[10px] sm:text-xs mt-0.5">
                  이 질문에는 분기 로직이 포함되어 있습니다. 저장 후 다른 설문에서 사용할 때 분기
                  로직을 유지하거나 제거할 수 있습니다.
                </p>
              </div>
            </div>
          )}

          {/* 질문 이름 */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="question-name" className="text-xs sm:text-sm">
              질문 이름 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="question-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors({ ...errors, name: undefined });
              }}
              placeholder="예: 성별 질문, 만족도 5점 척도"
              className={cn("h-9 sm:h-10 text-sm", errors.name && "border-red-300")}
            />
            {errors.name && <p className="text-[10px] sm:text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* 설명 */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="question-description" className="text-xs sm:text-sm">
              설명 (선택)
            </Label>
            <Textarea
              id="question-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 질문에 대한 설명을 입력하세요"
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* 카테고리 */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label className="text-xs sm:text-sm">카테고리</Label>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategory(category.id)}
                  className={cn(
                    "px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-full border transition-colors",
                    selectedCategory === category.id
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-600",
                  )}
                >
                  {category.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowNewCategory(true)}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors"
              >
                <Plus className="w-3 h-3 inline mr-0.5 sm:mr-1" />새 카테고리
              </button>
            </div>

            {/* 새 카테고리 입력 */}
            {showNewCategory && (
              <div className="flex gap-1.5 sm:gap-2 mt-2">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="카테고리 이름"
                  className="flex-1 h-8 sm:h-9 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCategory();
                    } else if (e.key === "Escape") {
                      setShowNewCategory(false);
                      setNewCategoryName("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleAddCategory}
                  className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
                >
                  추가
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowNewCategory(false);
                    setNewCategoryName("");
                  }}
                  className="h-8 sm:h-9 w-8 sm:w-9 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* 태그 */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label className="text-xs sm:text-sm">태그</Label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 sm:py-1 text-xs sm:text-sm bg-gray-100 text-gray-700 rounded-full"
                  >
                    <Tag className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-500"
                    >
                      <X className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-1.5 sm:gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="태그 입력 후 Enter"
                className="flex-1 h-8 sm:h-9 text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddTag}
                disabled={!newTag.trim()}
                className="h-8 sm:h-9 w-8 sm:w-9 p-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] sm:text-xs text-gray-400">
              태그를 추가하면 나중에 질문을 쉽게 찾을 수 있습니다.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 sm:pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm"
          >
            취소
          </Button>
          <Button onClick={handleSave} className="h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm">
            <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            저장
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
