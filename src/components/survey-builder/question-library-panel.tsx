"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Library,
  ChevronDown,
  ChevronRight,
  Clock,
  TrendingUp,
  Tag,
  Plus,
  Eye,
  Trash2,
  Star,
  Users,
  ThumbsUp,
  MessageSquare,
  Heart,
  Folder,
  Type,
  FileText,
  Circle,
  CheckSquare,
  List,
  Table,
  Info,
  X,
} from "lucide-react";
import { hasBranchLogic, removeBranchLogic } from "@/stores/question-library-store";
import { useSurveyBuilderStore } from "@/stores/survey-store";
import { SavedQuestion, Question } from "@/types/survey";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  useSavedQuestions,
  useCategories,
  useRecentlyUsedQuestions,
  useMostUsedQuestions,
  useSearchQuestions,
  useDeleteSavedQuestion,
  useApplyQuestion,
  useApplyMultipleQuestions,
  useInitializePresets,
  useInitializeCategories,
} from "@/hooks/queries/use-library";

// 카테고리 아이콘 매핑
const categoryIcons: Record<string, React.ElementType> = {
  Users: Users,
  ThumbsUp: ThumbsUp,
  TrendingUp: TrendingUp,
  MessageSquare: MessageSquare,
  Heart: Heart,
  Folder: Folder,
};

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

interface QuestionLibraryPanelProps {
  onAddQuestion?: (question: Question) => void;
  targetGroupId?: string;
  className?: string;
}

export function QuestionLibraryPanel({
  onAddQuestion,
  targetGroupId,
  className,
}: QuestionLibraryPanelProps) {
  // TanStack Query 훅들
  const { data: savedQuestions = [], isLoading: isLoadingQuestions } = useSavedQuestions();
  const { data: categories = [], isLoading: isLoadingCategories } = useCategories();
  const { data: recentlyUsed = [] } = useRecentlyUsedQuestions(5);
  const { data: mostUsed = [] } = useMostUsedQuestions(5);

  const { mutate: initializePresets } = useInitializePresets();
  const { mutate: initializeCategories } = useInitializeCategories();
  const { mutateAsync: applyQuestion } = useApplyQuestion();
  const { mutateAsync: applyMultipleQuestions } = useApplyMultipleQuestions();
  const { mutate: deleteSavedQuestionMutation } = useDeleteSavedQuestion();

  const { addPreparedQuestion } = useSurveyBuilderStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["demographics", "recent"]),
  );
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [previewQuestion, setPreviewQuestion] = useState<SavedQuestion | null>(null);
  const [showBranchWarning, setShowBranchWarning] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<SavedQuestion | null>(null);
  const [isAddingMultiple, setIsAddingMultiple] = useState(false);
  const [addingQuestionIds, setAddingQuestionIds] = useState<Set<string>>(new Set());

  // 검색 쿼리 (enabled 옵션으로 검색어가 있을 때만 실행)
  const { data: searchResults = [] } = useSearchQuestions(searchQuery.trim());

  // 프리셋 초기화
  useEffect(() => {
    initializePresets();
    initializeCategories();
  }, [initializePresets, initializeCategories]);

  // 검색 결과
  const filteredQuestions = useMemo(() => {
    if (searchQuery.trim()) {
      return searchResults;
    }
    return savedQuestions;
  }, [searchQuery, savedQuestions, searchResults]);

  // 카테고리 토글
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // 질문 선택 토글
  const toggleQuestionSelection = (questionId: string) => {
    setSelectedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  // 질문 추가 처리
  const handleAddQuestion = async (savedQuestion: SavedQuestion, removeBranch: boolean = false) => {
    // 중복 실행 방지
    if (addingQuestionIds.has(savedQuestion.id)) {
      return;
    }

    // 분기 로직 체크
    if (!removeBranch && hasBranchLogic(savedQuestion.question)) {
      setPendingQuestion(savedQuestion);
      setShowBranchWarning(true);
      return;
    }

    setAddingQuestionIds((prev) => new Set(prev).add(savedQuestion.id));
    try {
      let questionToAdd = await applyQuestion(savedQuestion.id);
      if (!questionToAdd) {
        setAddingQuestionIds((prev) => {
          const next = new Set(prev);
          next.delete(savedQuestion.id);
          return next;
        });
        return;
      }

      // 분기 로직 제거 옵션
      if (removeBranch) {
        questionToAdd = removeBranchLogic(questionToAdd);
      }

      if (onAddQuestion) {
        onAddQuestion(questionToAdd);
      } else {
        addPreparedQuestion(questionToAdd);
      }

      // 선택 해제
      setSelectedQuestions((prev) => {
        const next = new Set(prev);
        next.delete(savedQuestion.id);
        return next;
      });
    } catch (error) {
      console.error("질문 추가 실패:", error);
    } finally {
      setAddingQuestionIds((prev) => {
        const next = new Set(prev);
        next.delete(savedQuestion.id);
        return next;
      });
    }
  };

  // 선택된 질문들 일괄 추가
  const handleAddSelectedQuestions = async () => {
    // 중복 실행 방지
    if (isAddingMultiple || selectedQuestions.size === 0) {
      return;
    }

    setIsAddingMultiple(true);
    try {
      const questionIds = Array.from(selectedQuestions);
      const questions = await applyMultipleQuestions(questionIds);
      
      // 중복 방지를 위해 한 번만 추가
      if (questions && questions.length > 0) {
        questions.forEach((q) => {
          if (onAddQuestion) {
            onAddQuestion(q);
          } else {
            addPreparedQuestion(q);
          }
        });
      }
      
      setSelectedQuestions(new Set());
    } catch (error) {
      console.error("일괄 질문 추가 실패:", error);
    } finally {
      setIsAddingMultiple(false);
    }
  };

  // 질문 삭제 확인
  const handleDeleteQuestion = (savedQuestion: SavedQuestion) => {
    if (savedQuestion.isPreset) {
      alert("프리셋 질문은 삭제할 수 없습니다.");
      return;
    }
    if (confirm(`"${savedQuestion.name}" 질문을 삭제하시겠습니까?`)) {
      deleteSavedQuestionMutation(savedQuestion.id);
    }
  };

  // 카테고리별 질문 필터링
  const getQuestionsByCategory = (categoryId: string) => {
    return savedQuestions.filter((q) => q.category === categoryId);
  };

  // 질문 카드 렌더링
  const renderQuestionCard = (savedQuestion: SavedQuestion) => {
    const IconComponent = questionTypeIcons[savedQuestion.question.type] || FileText;
    const isSelected = selectedQuestions.has(savedQuestion.id);
    const hasLogic = hasBranchLogic(savedQuestion.question);

    return (
      <Card
        key={savedQuestion.id}
        className={cn(
          "p-3 cursor-pointer transition-all duration-200 border",
          isSelected
            ? "border-blue-500 bg-blue-50"
            : "border-gray-200 hover:border-blue-200 hover:shadow-sm",
        )}
        onClick={() => toggleQuestionSelection(savedQuestion.id)}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              isSelected ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600",
            )}
          >
            <IconComponent className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900 text-sm truncate">{savedQuestion.name}</h4>
              {savedQuestion.isPreset && <Star className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
              {hasLogic && (
                <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded">
                  분기
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {questionTypeLabels[savedQuestion.question.type]}
              {savedQuestion.question.options &&
                ` · ${savedQuestion.question.options.length}개 옵션`}
            </p>
            {savedQuestion.usageCount > 0 && (
              <p className="text-[10px] text-gray-400 mt-1">사용: {savedQuestion.usageCount}회</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewQuestion(savedQuestion);
              }}
            >
              <Eye className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={(e) => {
                e.stopPropagation();
                handleAddQuestion(savedQuestion);
              }}
            >
              <Plus className="w-3 h-3" />
            </Button>
            {!savedQuestion.isPreset && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteQuestion(savedQuestion);
                }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* 태그 */}
        {savedQuestion.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {savedQuestion.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded"
              >
                {tag}
              </span>
            ))}
            {savedQuestion.tags.length > 3 && (
              <span className="text-[10px] text-gray-400">+{savedQuestion.tags.length - 3}</span>
            )}
          </div>
        )}
      </Card>
    );
  };

  // 카테고리 섹션 렌더링
  const renderCategorySection = (
    categoryId: string,
    title: string,
    questions: SavedQuestion[],
    icon?: React.ElementType,
  ) => {
    const isExpanded = expandedCategories.has(categoryId);
    const IconComponent = icon || Folder;

    return (
      <div key={categoryId} className="mb-4">
        <button
          className="flex items-center gap-2 w-full text-left px-2 py-1.5 hover:bg-gray-50 rounded-lg transition-colors"
          onClick={() => toggleCategory(categoryId)}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          <IconComponent className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">{title}</span>
          <span className="text-xs text-gray-400 ml-auto">{questions.length}</span>
        </button>

        {isExpanded && questions.length > 0 && (
          <div className="space-y-2 mt-2 pl-2">{questions.map(renderQuestionCard)}</div>
        )}

        {isExpanded && questions.length === 0 && (
          <p className="text-xs text-gray-400 pl-8 py-2">질문이 없습니다</p>
        )}
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col", className)}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <Library className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">보관함</h3>
      </div>

      {/* 검색 */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="질문 검색..."
          className="pl-9 h-9"
        />
        {searchQuery && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2"
            onClick={() => setSearchQuery("")}
          >
            <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* 선택된 질문 액션 바 */}
      {selectedQuestions.size > 0 && (
        <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2 mb-4">
          <span className="text-sm text-blue-700">{selectedQuestions.size}개 선택됨</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setSelectedQuestions(new Set())}
            >
              취소
            </Button>
            <Button 
              size="sm" 
              className="h-7 text-xs" 
              onClick={handleAddSelectedQuestions}
              disabled={isAddingMultiple || selectedQuestions.size === 0}
            >
              <Plus className="w-3 h-3 mr-1" />
              {isAddingMultiple ? "추가 중..." : "모두 추가"}
            </Button>
          </div>
        </div>
      )}

      {/* 질문 목록 */}
      <div className="flex-1">
        {searchQuery ? (
          // 검색 결과
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-2 px-2">
              검색 결과 ({filteredQuestions.length})
            </h4>
            {filteredQuestions.length > 0 ? (
              <div className="space-y-2">{filteredQuestions.map(renderQuestionCard)}</div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">검색 결과가 없습니다</p>
            )}
          </div>
        ) : (
          // 카테고리별 목록
          <div>
            {/* 최근 사용 */}
            {recentlyUsed.length > 0 &&
              renderCategorySection("recent", "최근 사용", recentlyUsed, Clock)}

            {/* 가장 많이 사용 */}
            {mostUsed.length > 0 &&
              renderCategorySection("popular", "인기 질문", mostUsed, TrendingUp)}

            {/* 카테고리별 */}
            {categories.map((category) => {
              const questions = getQuestionsByCategory(category.id);
              const IconComponent = categoryIcons[category.icon || "Folder"] || Folder;
              return renderCategorySection(category.id, category.name, questions, IconComponent);
            })}
          </div>
        )}
      </div>

      {/* 미리보기 모달 */}
      <Dialog open={!!previewQuestion} onOpenChange={() => setPreviewQuestion(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              질문 미리보기
            </DialogTitle>
            <DialogDescription>{previewQuestion?.name}</DialogDescription>
          </DialogHeader>

          {previewQuestion && (
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 rounded-lg p-4 border">
                <h4 className="font-medium text-gray-900 mb-2">{previewQuestion.question.title}</h4>
                {previewQuestion.question.description && (
                  <p className="text-sm text-gray-500 mb-3">
                    {previewQuestion.question.description}
                  </p>
                )}

                {/* 옵션 미리보기 */}
                {previewQuestion.question.options && (
                  <div className="space-y-2">
                    {previewQuestion.question.options.map((opt) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        {previewQuestion.question.type === "radio" ? (
                          <Circle className="w-4 h-4 text-gray-400" />
                        ) : previewQuestion.question.type === "checkbox" ? (
                          <CheckSquare className="w-4 h-4 text-gray-400" />
                        ) : null}
                        <span className="text-sm text-gray-700">{opt.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 텍스트 입력 미리보기 */}
                {(previewQuestion.question.type === "text" ||
                  previewQuestion.question.type === "textarea") && (
                  <div className="bg-white border rounded-lg p-3 text-sm text-gray-400">
                    {previewQuestion.question.type === "text" ? "단답형 입력..." : "장문형 입력..."}
                  </div>
                )}
              </div>

              {/* 메타 정보 */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">카테고리:</span>
                  <span className="ml-2 text-gray-900">
                    {categories.find((c) => c.id === previewQuestion.category)?.name || "기타"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">사용 횟수:</span>
                  <span className="ml-2 text-gray-900">{previewQuestion.usageCount}회</span>
                </div>
              </div>

              {previewQuestion.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {previewQuestion.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full"
                    >
                      <Tag className="w-3 h-3 inline mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 분기 로직 경고 */}
              {hasBranchLogic(previewQuestion.question) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                  ⚠️ 이 질문에는 분기 로직이 포함되어 있습니다. 추가 시 분기 로직을 유지하거나
                  제거할 수 있습니다.
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setPreviewQuestion(null)}>
              닫기
            </Button>
            <Button
              onClick={() => {
                if (previewQuestion) {
                  handleAddQuestion(previewQuestion);
                  setPreviewQuestion(null);
                }
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              설문에 추가
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 분기 로직 경고 모달 */}
      <Dialog open={showBranchWarning} onOpenChange={setShowBranchWarning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              ⚠️ 분기 로직 포함
            </DialogTitle>
            <DialogDescription>
              이 질문에는 분기 로직(조건부 이동, 표시 조건 등)이 포함되어 있습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-gray-600 mb-4">
              분기 로직은 다른 질문의 ID를 참조하므로, 새 설문에서는 정상 작동하지 않을 수 있습니다.
              어떻게 처리하시겠습니까?
            </p>

            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={async () => {
                  if (!pendingQuestion || addingQuestionIds.has(pendingQuestion.id)) {
                    return;
                  }
                  
                  setAddingQuestionIds((prev) => new Set(prev).add(pendingQuestion.id));
                  try {
                    // 분기 로직 유지
                    const question = await applyQuestion(pendingQuestion.id);
                    if (question) {
                      if (onAddQuestion) {
                        onAddQuestion(question);
                      } else {
                        addPreparedQuestion(question);
                      }
                    }
                  } catch (error) {
                    console.error("질문 적용 실패:", error);
                  } finally {
                    setAddingQuestionIds((prev) => {
                      const next = new Set(prev);
                      next.delete(pendingQuestion.id);
                      return next;
                    });
                  }
                  setShowBranchWarning(false);
                  setPendingQuestion(null);
                }}
              >
                <span className="flex-1 text-left">분기 로직 유지</span>
                <span className="text-xs text-gray-400">직접 수정 필요</span>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  if (pendingQuestion) {
                    handleAddQuestion(pendingQuestion, true);
                  }
                  setShowBranchWarning(false);
                  setPendingQuestion(null);
                }}
              >
                <span className="flex-1 text-left">분기 로직 제거</span>
                <span className="text-xs text-gray-400">깨끗한 질문만 추가</span>
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t">
            <Button
              variant="ghost"
              onClick={() => {
                setShowBranchWarning(false);
                setPendingQuestion(null);
              }}
            >
              취소
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
