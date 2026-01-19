"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Question, QuestionOption, SelectLevel } from "@/types/survey";
import { useSurveyBuilderStore } from "@/stores/survey-store";
import { extractImageUrlsFromQuestion } from "@/lib/image-extractor";
import { deleteImagesFromR2 } from "@/lib/image-utils";
import {
  updateQuestion as updateQuestionAction,
  createQuestion as createQuestionAction,
} from "@/actions/survey-actions";
import { isValidUUID, generateId } from "@/lib/utils";
import { UserDefinedMultiSelectPreview } from "./user-defined-multi-select";
import { DynamicTableEditor } from "./dynamic-table-editor";
import { TablePreview } from "./table-preview";
import { NoticeEditor } from "./notice-editor";
import { NoticeRenderer } from "./notice-renderer";
import { BranchRuleEditor } from "./branch-rule-editor";
import { TableValidationEditor } from "./table-validation-editor";
import { QuestionConditionEditor } from "./question-condition-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  X,
  GripVertical,
  Type,
  FileText,
  Circle,
  CheckSquare,
  ChevronDown,
  Table,
  Image,
  Video,
  Settings,
  Info,
  AlertTriangle,
  Eye,
} from "lucide-react";

interface QuestionEditModalProps {
  questionId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function QuestionEditModal({ questionId, isOpen, onClose }: QuestionEditModalProps) {
  const { currentSurvey, updateQuestion } = useSurveyBuilderStore();
  const question = currentSurvey.questions.find((q) => q.id === questionId);

  const [formData, setFormData] = useState<Partial<Question>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showBranchSettings, setShowBranchSettings] = useState(false);

  useEffect(() => {
    if (question) {
      // options의 각 항목과 branchRule을 깊은 복사
      const optionsWithDeepBranchRule = question.options
        ? question.options.map((option) => ({
            ...option,
            branchRule: option.branchRule
              ? {
                  ...option.branchRule,
                }
              : undefined,
          }))
        : [];

      setFormData({
        title: question.title,
        description: question.description,
        required: question.required,
        groupId: question.groupId,
        questionCode: question.questionCode || "",
        exportLabel: question.exportLabel || "",
        tableType: question.tableType,
        loopConfig: question.loopConfig,
        options: optionsWithDeepBranchRule,
        selectLevels: question.selectLevels ? [...question.selectLevels] : [],
        tableTitle: question.tableTitle,
        tableColumns: question.tableColumns ? [...question.tableColumns] : [],
        tableRowsData: question.tableRowsData ? [...question.tableRowsData] : [],
        allowOtherOption: question.allowOtherOption || false,
        minSelections: question.minSelections,
        maxSelections: question.maxSelections,
        noticeContent: question.noticeContent || "",
        requiresAcknowledgment: question.requiresAcknowledgment || false,
        placeholder: question.placeholder || "",
        tableValidationRules: question.tableValidationRules || [],
        displayCondition: question.displayCondition,
      });

      // 옵션들 중 하나라도 branchRule이 있으면 조건부 분기 설정 표시
      const hasBranchRule = question.options?.some((option) => option.branchRule) || false;
      setShowBranchSettings(hasBranchRule);
    }
  }, [question]);

  // 검증 로직
  const validateForm = useCallback(() => {
    if (!question) return false;

    const needsOptions = ["radio", "checkbox", "select"].includes(question.type);
    const needsSelectLevels = question.type === "multiselect";
    const errors: Record<string, string> = {};

    if (!formData.title?.trim()) {
      errors.title = "질문 제목은 필수입니다.";
    }

    if (needsOptions && (!formData.options || formData.options.length === 0)) {
      errors.options = "최소 하나의 선택 옵션이 필요합니다.";
    }

    if (needsSelectLevels && (!formData.selectLevels || formData.selectLevels.length === 0)) {
      errors.selectLevels = "최소 하나의 선택 레벨이 필요합니다.";
    }

    // 테이블 타입은 title만 있으면 저장 가능 (테이블 데이터는 선택적)
    // 공지사항 타입은 title만 있으면 저장 가능 (내용은 선택적)
    // text, textarea 타입은 title만 있으면 저장 가능

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [question, formData]);

  // 저장 핸들러
  const handleSave = useCallback(async () => {
    if (!questionId || !validateForm()) return;

    setIsSaving(true);
    try {
      // 저장 전: 현재 질문에서 사용 중인 이미지 추출
      const updatedQuestion = {
        ...question,
        ...formData,
      } as Question;
      const usedImages = extractImageUrlsFromQuestion(updatedQuestion);

      // 저장된 질문의 이미지와 비교하여 사용되지 않은 이미지 삭제
      if (question) {
        const previousImages = extractImageUrlsFromQuestion(question);
        const unusedImages = previousImages.filter((url) => !usedImages.includes(url));

        if (unusedImages.length > 0) {
          await deleteImagesFromR2(unusedImages);
        }
      }

      // 로컬 스토어 업데이트
      updateQuestion(questionId, formData);

      // 서버에 질문 저장/업데이트 API 호출
      if (currentSurvey.id && questionId) {
        try {
          if (isValidUUID(questionId)) {
            // 이미 DB에 저장된 질문: 업데이트
            // placeholder는 빈 문자열도 저장할 수 있도록 명시적으로 전달
            const updateData = {
              ...formData,
              placeholder:
                formData.placeholder !== undefined ? formData.placeholder : question?.placeholder,
            };
            await updateQuestionAction(questionId, updateData);
          } else {
            // 임시 질문: 생성하고 반환된 UUID로 로컬 스토어의 질문 ID 업데이트
            const createdQuestion = await createQuestionAction({
              surveyId: currentSurvey.id,
              groupId: question?.groupId,
              type: formData.type || question?.type || "text",
              title: formData.title || question?.title || "",
              description: formData.description || question?.description,
              required: formData.required ?? question?.required ?? false,
              order: question?.order ?? 0,
              options: formData.options || question?.options,
              selectLevels: formData.selectLevels || question?.selectLevels,
              tableTitle: formData.tableTitle || question?.tableTitle,
              tableColumns: formData.tableColumns || question?.tableColumns,
              tableRowsData: formData.tableRowsData || question?.tableRowsData,
              imageUrl: formData.imageUrl || question?.imageUrl,
              videoUrl: formData.videoUrl || question?.videoUrl,
              allowOtherOption: formData.allowOtherOption ?? question?.allowOtherOption,
              noticeContent: formData.noticeContent || question?.noticeContent,
              requiresAcknowledgment:
                formData.requiresAcknowledgment ?? question?.requiresAcknowledgment,
              placeholder:
                formData.placeholder !== undefined ? formData.placeholder : question?.placeholder,
              tableValidationRules: formData.tableValidationRules || question?.tableValidationRules,
              displayCondition: formData.displayCondition || question?.displayCondition,
            });

            // 반환된 UUID로 로컬 스토어의 질문 ID 업데이트
            if (createdQuestion?.id) {
              useSurveyBuilderStore.setState((state) => ({
                currentSurvey: {
                  ...state.currentSurvey,
                  questions: state.currentSurvey.questions.map((q) =>
                    q.id === questionId ? { ...q, id: createdQuestion.id } : q,
                  ),
                },
              }));
            }
          }
        } catch (error) {
          console.error("질문 저장/업데이트 실패:", error);
          // 저장 실패해도 모달은 닫음 (로컬 상태는 이미 업데이트됨)
        }
      }

      onClose();
    } catch (error) {
      console.error("저장 중 오류가 발생했습니다:", error);
    } finally {
      setIsSaving(false);
    }
  }, [questionId, validateForm, updateQuestion, formData, onClose, question, currentSurvey.id]);

  // 키보드 이벤트 핸들러
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      }
    },
    [onClose, handleSave],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // 기타 옵션 관리 헬퍼 함수들
  const OTHER_OPTION_ID = "other-option";
  const OTHER_OPTION_LABEL = "기타";

  const addOtherOptionIfNeeded = (options: QuestionOption[]) => {
    const hasOtherOption = options.some((option) => option.id === OTHER_OPTION_ID);
    if (!hasOtherOption) {
      return [
        ...options,
        {
          id: OTHER_OPTION_ID,
          label: OTHER_OPTION_LABEL,
          value: "other",
          hasOther: true,
        },
      ];
    }
    return options;
  };

  const removeOtherOption = (options: QuestionOption[]) => {
    return options.filter((option) => option.id !== OTHER_OPTION_ID);
  };

  // allowOtherOption 토글 핸들러
  const handleOtherOptionToggle = (enabled: boolean) => {
    setFormData((prev) => {
      const currentOptions = prev.options || [];
      const updatedOptions = enabled
        ? addOtherOptionIfNeeded(currentOptions)
        : removeOtherOption(currentOptions);

      return {
        ...prev,
        allowOtherOption: enabled,
        options: updatedOptions,
      };
    });
  };

  if (!question) return null;

  const needsOptions = ["radio", "checkbox", "select"].includes(question.type);
  const needsSelectLevels = question.type === "multiselect";

  // 모달 크기 결정 (테이블 편집시 큰 화면 사용)
  const isTableType = question.type === "table";
  const modalSize = isTableType ? "max-w-6xl" : "max-w-3xl";

  const addOption = () => {
    const newOption: QuestionOption = {
      id: generateId(),
      label: `옵션 ${(formData.options?.length || 0) + 1}`,
      value: `옵션${(formData.options?.length || 0) + 1}`,
    };
    setFormData((prev) => ({
      ...prev,
      options: [...(prev.options || []), newOption],
    }));
  };

  const updateOption = (optionId: string, updates: Partial<QuestionOption>) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options?.map((option) =>
        option.id === optionId ? { ...option, ...updates } : option,
      ),
    }));
  };

  const removeOption = (optionId: string) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options?.filter((option) => option.id !== optionId),
    }));
  };

  const addSelectLevel = () => {
    const newLevel: SelectLevel = {
      id: generateId(),
      label: `레벨 ${(formData.selectLevels?.length || 0) + 1}`,
      placeholder: "",
      order: formData.selectLevels?.length || 0,
      options: [],
    };
    setFormData((prev) => ({
      ...prev,
      selectLevels: [...(prev.selectLevels || []), newLevel],
    }));
  };

  const updateSelectLevel = (levelId: string, updates: Partial<SelectLevel>) => {
    setFormData((prev) => ({
      ...prev,
      selectLevels: prev.selectLevels?.map((level) =>
        level.id === levelId ? { ...level, ...updates } : level,
      ),
    }));
  };

  const removeSelectLevel = (levelId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectLevels: prev.selectLevels
        ?.filter((level) => level.id !== levelId)
        ?.map((level, index) => ({ ...level, order: index })),
    }));
  };

  const addLevelOption = (levelId: string) => {
    const level = formData.selectLevels?.find((l) => l.id === levelId);
    if (!level) return;

    const levelIndex = formData.selectLevels?.findIndex((l) => l.id === levelId) || 0;
    const optionCount = level.options?.length || 0;

    const newOption: QuestionOption = {
      id: generateId(),
      label: `옵션 ${optionCount + 1}`,
      value: levelIndex === 0 ? `옵션${optionCount + 1}` : `상위옵션-옵션${optionCount + 1}`, // 기본값, 나중에 상위 선택으로 업데이트됨
    };

    setFormData((prev) => ({
      ...prev,
      selectLevels: prev.selectLevels?.map((level) =>
        level.id === levelId ? { ...level, options: [...(level.options || []), newOption] } : level,
      ),
    }));
  };

  const updateOptionWithParent = (
    levelId: string,
    optionId: string,
    parentValue: string,
    optionLabel: string,
  ) => {
    // 한글 값을 그대로 사용하되, 공백만 제거
    const sanitizedLabel = optionLabel.trim();
    const autoValue = `${parentValue}-${sanitizedLabel}`;

    setFormData((prev) => ({
      ...prev,
      selectLevels: prev.selectLevels?.map((level) =>
        level.id === levelId
          ? {
              ...level,
              options: level.options?.map((option) =>
                option.id === optionId
                  ? { ...option, label: optionLabel, value: autoValue }
                  : option,
              ),
            }
          : level,
      ),
    }));
  };

  const getParentLevelOptions = (currentLevelIndex: number) => {
    if (currentLevelIndex === 0) return [];
    const parentLevel = formData.selectLevels?.[currentLevelIndex - 1];
    return parentLevel?.options || [];
  };

  const updateLevelOption = (
    levelId: string,
    optionId: string,
    updates: Partial<QuestionOption>,
  ) => {
    setFormData((prev) => ({
      ...prev,
      selectLevels: prev.selectLevels?.map((level) =>
        level.id === levelId
          ? {
              ...level,
              options: level.options?.map((option) =>
                option.id === optionId ? { ...option, ...updates } : option,
              ),
            }
          : level,
      ),
    }));
  };

  const removeLevelOption = (levelId: string, optionId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectLevels: prev.selectLevels?.map((level) =>
        level.id === levelId
          ? {
              ...level,
              options: level.options?.filter((option) => option.id !== optionId),
            }
          : level,
      ),
    }));
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // X 버튼이나 ESC만 닫기 가능 (배경 클릭은 onInteractOutside에서 막음)
        if (!open && !isSaving) {
          onClose();
        }
      }}
    >
      <DialogContent
        className={`${modalSize} max-h-[95vh] flex flex-col p-0`}
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        {/* 고정 헤더 */}
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getQuestionTypeIcon(question.type)}
              <span>{getQuestionTypeLabel(question.type)} 편집</span>
            </div>
            {/* 키보드 단축키 안내 */}
            <div className="hidden sm:flex items-center text-xs text-gray-500 space-x-4">
              <span>저장: Ctrl+S</span>
              <span>닫기: ESC</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* 스크롤 가능한 본문 */}
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none px-6">
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                기본 설정
              </TabsTrigger>
              {isTableType && (
                <TabsTrigger value="validation" className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  검증 규칙
                </TabsTrigger>
              )}
              <TabsTrigger value="display-condition" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                표시 조건
              </TabsTrigger>
            </TabsList>

            {/* 기본 설정 탭 */}
            <TabsContent value="basic" className="px-6 py-4 space-y-6">
              {/* 기본 정보 */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">
                    질문 제목 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={formData.title || ""}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, title: e.target.value }));
                      if (validationErrors.title) {
                        setValidationErrors((prev) => ({ ...prev, title: "" }));
                      }
                    }}
                    placeholder="질문을 입력하세요"
                    className={`mt-2 ${
                      validationErrors.title ? "border-red-500 focus:border-red-500" : ""
                    }`}
                  />
                  {validationErrors.title && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.title}</p>
                  )}
                </div>

                {/* 질문 코드 및 엑셀 라벨 (Flat 내보내기용) */}
                <div className="grid grid-cols-2 gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div>
                    <Label htmlFor="questionCode">질문 코드 (선택사항)</Label>
                    <Input
                      id="questionCode"
                      value={formData.questionCode || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, questionCode: e.target.value }))
                      }
                      placeholder="예: Q1, A2, A8_1"
                      className="mt-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      엑셀 내보내기 시 사용할 질문 식별자 (미입력 시 자동 생성)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="exportLabel">엑셀 라벨 (선택사항)</Label>
                    <Input
                      id="exportLabel"
                      value={formData.exportLabel || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, exportLabel: e.target.value }))
                      }
                      placeholder="예: 성별, TV보유현황"
                      className="mt-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      엑셀 헤더에 표시될 라벨 (미입력 시 질문 제목 사용)
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="group">그룹 선택 (선택사항)</Label>
                  <select
                    id="group"
                    value={formData.groupId || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        groupId: e.target.value || undefined,
                      }))
                    }
                    className="w-full mt-2 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">그룹 없음</option>
                    {(() => {
                      const groups = currentSurvey.groups || [];
                      const topLevelGroups = groups
                        .filter((g) => !g.parentGroupId)
                        .sort((a, b) => a.order - b.order);
                      const getSubGroups = (parentId: string) =>
                        groups
                          .filter((g) => g.parentGroupId === parentId)
                          .sort((a, b) => a.order - b.order);

                      const options: React.ReactElement[] = [];

                      topLevelGroups.forEach((group) => {
                        options.push(
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>,
                        );

                        // 하위 그룹들 추가
                        const subGroups = getSubGroups(group.id);
                        subGroups.forEach((subGroup) => {
                          options.push(
                            <option key={subGroup.id} value={subGroup.id}>
                              └─ {subGroup.name}
                            </option>,
                          );
                        });
                      });

                      return options;
                    })()}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    이 질문을 특정 그룹에 포함시킬 수 있습니다.
                  </p>
                </div>

                <div>
                  <Label htmlFor="description">설명 (선택사항)</Label>
                  <div className="mt-2">
                    <NoticeEditor
                      content={formData.description || ""}
                      onChange={(content) =>
                        setFormData((prev) => ({ ...prev, description: content }))
                      }
                      compact={true}
                      placeholder="질문에 대한 추가 설명을 입력하세요..."
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="required"
                    checked={formData.required || false}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, required: checked }))
                    }
                  />
                  <Label htmlFor="required">필수 질문</Label>
                </div>

                {/* 단답형 질문용 placeholder 설정 */}
                {question.type === "text" && (
                  <div>
                    <Label htmlFor="placeholder">안내 문구 (Placeholder)</Label>
                    <Input
                      id="placeholder"
                      value={formData.placeholder || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, placeholder: e.target.value }))
                      }
                      placeholder="예: 이름을 입력하세요"
                      className="mt-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      입력 필드에 표시될 안내 문구를 입력하세요
                    </p>
                  </div>
                )}
              </div>

              {/* 옵션 설정 (radio, checkbox, select) */}
              {needsOptions && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>
                      선택 옵션 <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex items-center space-x-4">
                      {/* 기타 옵션 토글 */}
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="allow-other-option"
                          checked={formData.allowOtherOption || false}
                          onCheckedChange={handleOtherOptionToggle}
                          className="scale-75"
                        />
                        <Label htmlFor="allow-other-option" className="text-xs text-gray-600">
                          기타 옵션 추가
                        </Label>
                      </div>
                      {/* 조건부 분기 토글 */}
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="show-branch-settings"
                          checked={showBranchSettings}
                          onCheckedChange={setShowBranchSettings}
                          className="scale-75"
                        />
                        <Label htmlFor="show-branch-settings" className="text-xs text-gray-600">
                          조건부 분기
                        </Label>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          addOption();
                          if (validationErrors.options) {
                            setValidationErrors((prev) => ({ ...prev, options: "" }));
                          }
                        }}
                        className="flex items-center space-x-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>옵션 추가</span>
                      </Button>
                    </div>
                  </div>
                  {validationErrors.options && (
                    <p className="text-red-500 text-sm">{validationErrors.options}</p>
                  )}

                  <div className="space-y-2">
                    {formData.options?.map((option, index) => (
                      <div
                        key={option.id}
                        className="border border-gray-200 rounded-lg bg-white hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center space-x-2 p-3">
                          <div className="cursor-grab">
                            <GripVertical className="w-4 h-4 text-gray-400" />
                          </div>

                          <div className="flex-1">
                            <Input
                              value={option.label}
                              onChange={(e) => updateOption(option.id, { label: e.target.value })}
                              placeholder={`옵션 ${index + 1}`}
                              className="border-none bg-transparent px-0 focus:bg-white focus:border focus:border-blue-200"
                            />
                            {option.id === OTHER_OPTION_ID && (
                              <p className="text-xs text-blue-600 mt-1 px-0">
                                🔹 기타 옵션 (수정 가능)
                              </p>
                            )}
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOption(option.id)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* 분기 규칙 설정 - 토글이 켜져있을 때만 표시 */}
                        {showBranchSettings && (
                          <div className="px-3 pb-3">
                            <BranchRuleEditor
                              branchRule={option.branchRule}
                              allQuestions={currentSurvey.questions}
                              currentQuestionId={questionId || ""}
                              onChange={(branchRule) => updateOption(option.id, { branchRule })}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {(formData.options?.length || 0) === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p className="mb-2">아직 옵션이 없습니다.</p>
                      <Button type="button" variant="outline" onClick={addOption}>
                        첫 번째 옵션 추가
                      </Button>
                    </div>
                  )}

                  {formData.allowOtherOption && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <strong>💡 기타 옵션이 활성화되었습니다.</strong>
                        <br />
                        마지막에 &ldquo;기타&rdquo; 선택지가 자동으로 추가되어 사용자가 직접
                        텍스트를 입력할 수 있습니다.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 선택 개수 제한 (checkbox 타입 전용) */}
              {question?.type === "checkbox" && (
                <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <Label className="text-base font-medium">선택 개수 제한</Label>
                  <p className="text-sm text-gray-600">
                    사용자가 선택할 수 있는 최소/최대 개수를 설정할 수 있습니다.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min-selections" className="text-sm">
                        최소 선택 개수
                      </Label>
                      <Input
                        id="min-selections"
                        type="number"
                        min="1"
                        max={formData.options?.length || 0}
                        value={formData.minSelections || ""}
                        onChange={(e) => {
                          const value =
                            e.target.value === "" ? undefined : parseInt(e.target.value, 10);
                          setFormData((prev) => ({ ...prev, minSelections: value }));
                          // 최소값이 최대값보다 크면 최대값 조정
                          if (
                            value !== undefined &&
                            formData.maxSelections !== undefined &&
                            value > formData.maxSelections
                          ) {
                            setFormData((prev) => ({ ...prev, maxSelections: value }));
                          }
                        }}
                        placeholder="제한 없음"
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500">
                        {formData.options?.length || 0}개 옵션 중 최소 선택 개수
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="max-selections" className="text-sm">
                        최대 선택 개수
                      </Label>
                      <Input
                        id="max-selections"
                        type="number"
                        min={formData.minSelections ? formData.minSelections : 1}
                        max={formData.options?.length || 0}
                        value={formData.maxSelections || ""}
                        onChange={(e) => {
                          const value =
                            e.target.value === "" ? undefined : parseInt(e.target.value, 10);
                          setFormData((prev) => ({ ...prev, maxSelections: value }));
                        }}
                        placeholder="제한 없음"
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500">
                        {formData.options?.length || 0}개 옵션 중 최대 선택 개수
                      </p>
                    </div>
                  </div>

                  {formData.minSelections !== undefined &&
                    formData.maxSelections !== undefined &&
                    formData.minSelections > formData.maxSelections && (
                      <p className="text-sm text-red-500">
                        최소 선택 개수는 최대 선택 개수보다 작거나 같아야 합니다.
                      </p>
                    )}

                  {formData.minSelections !== undefined &&
                    formData.minSelections > (formData.options?.length || 0) && (
                      <p className="text-sm text-red-500">
                        최소 선택 개수는 옵션 개수보다 작거나 같아야 합니다.
                      </p>
                    )}

                  {formData.maxSelections !== undefined &&
                    formData.maxSelections > (formData.options?.length || 0) && (
                      <p className="text-sm text-red-500">
                        최대 선택 개수는 옵션 개수보다 작거나 같아야 합니다.
                      </p>
                    )}
                </div>
              )}

              {/* 다단계 Select 설정 */}
              {needsSelectLevels && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <Label className="flex items-center space-x-2">
                      <Settings className="w-4 h-4" />
                      <span>
                        다단계 Select 설정 <span className="text-red-500">*</span>
                      </span>
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        addSelectLevel();
                        if (validationErrors.selectLevels) {
                          setValidationErrors((prev) => ({ ...prev, selectLevels: "" }));
                        }
                      }}
                      className="flex items-center space-x-1 w-full sm:w-auto"
                    >
                      <Plus className="w-4 h-4" />
                      <span>레벨 추가</span>
                    </Button>
                  </div>
                  {validationErrors.selectLevels && (
                    <p className="text-red-500 text-sm">{validationErrors.selectLevels}</p>
                  )}

                  {formData.selectLevels && formData.selectLevels.length > 0 ? (
                    <div className="space-y-4">
                      {formData.selectLevels
                        .sort((a, b) => a.order - b.order)
                        .map((level, index) => (
                          <div key={level.id} className="p-4 border border-gray-200 rounded-lg">
                            <div className="flex items-start space-x-3">
                              <div className="cursor-grab">
                                <GripVertical className="w-4 h-4 text-gray-400" />
                              </div>

                              <div className="flex-1 space-y-4">
                                {/* 레벨 기본 정보 */}
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-medium text-gray-600">
                                    레벨 {index + 1}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeSelectLevel(level.id)}
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 p-1 h-auto"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>

                                {/* 레벨 설정 */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <Label className="text-xs">레이블</Label>
                                    <Input
                                      value={level.label}
                                      onChange={(e) =>
                                        updateSelectLevel(level.id, { label: e.target.value })
                                      }
                                      placeholder="예: 카테고리"
                                      className="mt-1 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">플레이스홀더</Label>
                                    <Input
                                      value={level.placeholder || ""}
                                      onChange={(e) =>
                                        updateSelectLevel(level.id, { placeholder: e.target.value })
                                      }
                                      placeholder="예: 카테고리를 선택하세요"
                                      className="mt-1 text-sm"
                                    />
                                  </div>
                                </div>

                                {/* 레벨 옵션들 */}
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-xs font-medium">옵션 목록</Label>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => addLevelOption(level.id)}
                                      className="h-6 px-2 text-xs"
                                    >
                                      <Plus className="w-3 h-3 mr-1" />
                                      추가
                                    </Button>
                                  </div>

                                  <div className="space-y-2">
                                    {level.options?.map((option, optionIndex) => {
                                      const parentOptions = getParentLevelOptions(index);
                                      const isFirstLevel = index === 0;

                                      return (
                                        <div
                                          key={option.id}
                                          className="p-3 bg-gray-50 rounded-lg space-y-2"
                                        >
                                          <div className="flex items-center space-x-2">
                                            <span className="text-xs text-gray-500 w-6">
                                              {optionIndex + 1}.
                                            </span>
                                            <Input
                                              value={option.label}
                                              onChange={(e) =>
                                                updateLevelOption(level.id, option.id, {
                                                  label: e.target.value,
                                                })
                                              }
                                              placeholder="옵션명 (예: 김치찌개)"
                                              className="flex-1 text-xs h-8"
                                            />
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => removeLevelOption(level.id, option.id)}
                                              className="text-red-500 hover:text-red-600 hover:bg-red-100 p-1 h-6 w-6"
                                            >
                                              <X className="w-3 h-3" />
                                            </Button>
                                          </div>

                                          {!isFirstLevel && parentOptions.length > 0 && (
                                            <div className="flex items-center space-x-2 ml-8">
                                              <span className="text-xs text-gray-600 min-w-fit">
                                                연동할 상위 옵션:
                                              </span>
                                              <select
                                                value={
                                                  option.value.includes("-")
                                                    ? option.value.split("-")[0]
                                                    : ""
                                                }
                                                onChange={(e) => {
                                                  if (e.target.value) {
                                                    updateOptionWithParent(
                                                      level.id,
                                                      option.id,
                                                      e.target.value,
                                                      option.label,
                                                    );
                                                  }
                                                }}
                                                className="text-xs h-6 px-2 border border-gray-200 rounded bg-white flex-1"
                                              >
                                                <option value="">상위 옵션 선택...</option>
                                                {parentOptions.map((parentOption) => (
                                                  <option
                                                    key={parentOption.id}
                                                    value={parentOption.value}
                                                  >
                                                    {parentOption.label}
                                                  </option>
                                                ))}
                                              </select>
                                              <div className="text-xs text-gray-400 min-w-fit">
                                                → {option.value}
                                              </div>
                                            </div>
                                          )}

                                          {isFirstLevel && (
                                            <div className="ml-8">
                                              <div className="text-xs text-gray-400">
                                                값: {option.value}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}

                                    {(!level.options || level.options.length === 0) && (
                                      <div className="text-center py-4 text-gray-400 text-xs">
                                        옵션이 없습니다. 추가해주세요.
                                      </div>
                                    )}
                                  </div>

                                  {index > 0 && (
                                    <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                                      <strong>💡 자동 연동:</strong> 하위 레벨에서 &ldquo;연동할
                                      상위 옵션&rdquo;을 선택하면 한글 값이 자동 생성됩니다.
                                      <br />
                                      예: 상위 &ldquo;한식&rdquo; 선택 + 하위 &ldquo;김치찌개&rdquo;
                                      → 값: &ldquo;한식-김치찌개&rdquo; (한글 그대로 저장)
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                      {/* 미리보기 */}
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <Label className="text-sm font-medium text-gray-700 mb-3 block">
                          미리보기
                        </Label>
                        <UserDefinedMultiSelectPreview levels={formData.selectLevels} />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
                      <Settings className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="mb-2">아직 레벨이 없습니다.</p>
                      <Button type="button" variant="outline" onClick={addSelectLevel}>
                        첫 번째 레벨 추가
                      </Button>
                    </div>
                  )}

                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>🔗 다단계 Select 기능:</strong> 카테고리 → 세부항목 같은 계층적 선택을
                      제공합니다.
                      <br />• 1단계: 기본 옵션들 설정 (예: 한식, 중식, 양식)
                      <br />• 2단계 이상: 상위 옵션 선택으로 자동 연동 (한글 값 그대로 저장됩니다)
                      <br />• 데이터 저장: 한글로 된 값들이 그대로 저장되어 분석이 쉽습니다 📊
                    </p>
                  </div>
                </div>
              )}

              {/* 공지사항 설정 */}
              {question.type === "notice" && (
                <div className="space-y-6">
                  <div>
                    <Label className="text-base font-medium mb-3 block">공지사항 내용 편집</Label>
                    <NoticeEditor
                      content={formData.noticeContent || ""}
                      onChange={(content) =>
                        setFormData((prev) => ({ ...prev, noticeContent: content }))
                      }
                    />
                  </div>

                  {/* 이해 확인 체크 옵션 */}
                  <div className="flex items-center space-x-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <Switch
                      id="requires-acknowledgment"
                      checked={formData.requiresAcknowledgment || false}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, requiresAcknowledgment: checked }))
                      }
                    />
                    <Label htmlFor="requires-acknowledgment" className="cursor-pointer">
                      이해했다는 체크 필요 (필수 확인)
                    </Label>
                  </div>

                  {/* 미리보기 */}
                  {formData.noticeContent && (
                    <div className="space-y-3">
                      <Label className="text-base font-medium">미리보기</Label>
                      <NoticeRenderer
                        content={formData.noticeContent}
                        requiresAcknowledgment={formData.requiresAcknowledgment}
                        isTestMode={true}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* 테이블 설정 */}
              {question.type === "table" && (
                <div className="space-y-6">
                  <Label className="text-lg font-medium">테이블 설정</Label>

                  {/* 테이블 패턴 설정 (Flat 엑셀 내보내기용) */}
                  <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">테이블 패턴 (엑셀 내보내기용)</Label>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div
                        onClick={() => setFormData((prev) => ({ ...prev, tableType: "matrix", loopConfig: undefined }))}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          formData.tableType !== "loop"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="font-medium text-sm mb-1">Matrix (고정 행)</div>
                        <div className="text-xs text-gray-500">
                          UHD TV, 디지털 TV 등 고정된 행 목록
                        </div>
                        <div className="text-xs text-gray-400 mt-2">
                          예: A2_UHD_보유, A2_DIGITAL_보유
                        </div>
                      </div>
                      
                      <div
                        onClick={() => setFormData((prev) => ({ 
                          ...prev, 
                          tableType: "loop",
                          loopConfig: prev.loopConfig || { prefix: "TV", maxCount: 10 }
                        }))}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          formData.tableType === "loop"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="font-medium text-sm mb-1">Loop (반복)</div>
                        <div className="text-xs text-gray-500">
                          TV1, TV2, TV3... 동적 반복 행
                        </div>
                        <div className="text-xs text-gray-400 mt-2">
                          예: A8_TV1_종류, A8_TV2_종류
                        </div>
                      </div>
                    </div>

                    {/* Loop 설정 (Loop 패턴 선택 시만 표시) */}
                    {formData.tableType === "loop" && (
                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
                        <div>
                          <Label htmlFor="loop-prefix" className="text-sm">반복 접두사</Label>
                          <Input
                            id="loop-prefix"
                            value={formData.loopConfig?.prefix || "TV"}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                loopConfig: {
                                  ...prev.loopConfig,
                                  prefix: e.target.value,
                                  maxCount: prev.loopConfig?.maxCount || 10,
                                },
                              }))
                            }
                            placeholder="예: TV, 제품"
                            className="mt-1"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            열 헤더에 사용: TV1, TV2, TV3...
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="loop-max" className="text-sm">최대 반복 수</Label>
                          <Input
                            id="loop-max"
                            type="number"
                            min={1}
                            max={100}
                            value={formData.loopConfig?.maxCount || 10}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                loopConfig: {
                                  ...prev.loopConfig,
                                  prefix: prev.loopConfig?.prefix || "TV",
                                  maxCount: parseInt(e.target.value) || 10,
                                },
                              }))
                            }
                            className="mt-1"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            최대 반복 가능 횟수
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                      💡 테이블 패턴은 엑셀 내보내기 시 열 이름 형식에 영향을 줍니다.
                    </div>
                  </div>

                  <DynamicTableEditor
                    tableTitle={formData.tableTitle}
                    columns={formData.tableColumns}
                    rows={formData.tableRowsData}
                    currentQuestionId={questionId || ""}
                    onTableChange={(data) => {
                      setFormData((prev) => ({
                        ...prev,
                        tableTitle: data.tableTitle,
                        tableColumns: data.tableColumns,
                        tableRowsData: data.tableRowsData,
                      }));
                    }}
                  />

                  {/* 미리보기 */}
                  {formData.tableColumns && formData.tableColumns.length > 0 && (
                    <div className="space-y-3">
                      <Label className="text-base font-medium">미리보기</Label>
                      <TablePreview
                        tableTitle={formData.tableTitle}
                        columns={formData.tableColumns}
                        rows={formData.tableRowsData}
                        className="border-2 border-dashed border-gray-300"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* 미디어 설정 */}
              <div className="space-y-4">
                <Label>미디어 첨부</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex items-center justify-center space-x-1 w-full sm:w-auto"
                    disabled
                  >
                    <Image className="w-4 h-4" />
                    <span>이미지 추가</span>
                    <span className="text-xs text-gray-400 ml-1">(준비 중)</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex items-center justify-center space-x-1 w-full sm:w-auto"
                    disabled
                  >
                    <Video className="w-4 h-4" />
                    <span>동영상 추가</span>
                    <span className="text-xs text-gray-400 ml-1">(준비 중)</span>
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* 검증 규칙 탭 (테이블 타입만) */}
            {isTableType && (
              <TabsContent value="validation" className="px-6 py-4">
                <TableValidationEditor
                  question={question}
                  onUpdate={(rules) =>
                    setFormData((prev) => ({ ...prev, tableValidationRules: rules }))
                  }
                  allQuestions={currentSurvey.questions}
                />
              </TabsContent>
            )}

            {/* 표시 조건 탭 */}
            <TabsContent value="display-condition" className="px-6 py-4">
              <QuestionConditionEditor
                question={question}
                onUpdate={async (conditionGroup) => {
                  setFormData((prev) => ({ ...prev, displayCondition: conditionGroup }));

                  // 조건 변경 시 즉시 DB에 저장 (질문 ID가 UUID인 경우에만)
                  if (questionId && currentSurvey.id && isValidUUID(questionId)) {
                    try {
                      await updateQuestionAction(questionId, {
                        displayCondition: conditionGroup,
                      });
                    } catch (error) {
                      console.error("조건 저장 실패:", error);
                    }
                  }
                }}
                allQuestions={currentSurvey.questions}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* 고정 푸터 (액션 버튼) */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            {/* 저장 상태 표시 */}
            <div className="flex items-center text-sm text-gray-600">
              {isSaving && (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>저장 중...</span>
                </div>
              )}
              {Object.keys(validationErrors).length > 0 && !isSaving && (
                <span className="text-red-600">입력 정보를 확인해주세요</span>
              )}
            </div>

            {/* 액션 버튼 */}
            <div className="flex space-x-2">
              <Button variant="outline" onClick={onClose} disabled={isSaving}>
                취소
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || Object.keys(validationErrors).length > 0}
                className="min-w-[80px]"
              >
                {isSaving ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>저장</span>
                  </div>
                ) : (
                  "저장"
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getQuestionTypeIcon(type: string) {
  const icons = {
    notice: Info,
    text: Type,
    textarea: FileText,
    radio: Circle,
    checkbox: CheckSquare,
    select: ChevronDown,
    multiselect: Settings,
    table: Table,
  };
  const IconComponent = icons[type as keyof typeof icons] || Type;
  return <IconComponent className="w-5 h-5" />;
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
