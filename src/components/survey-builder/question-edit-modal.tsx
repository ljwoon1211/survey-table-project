'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Question, QuestionOption, SelectLevel } from '@/types/survey';
import { useSurveyBuilderStore } from '@/stores/survey-store';
import { UserDefinedMultiSelectPreview } from './user-defined-multi-select';
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
  Settings
} from 'lucide-react';

interface QuestionEditModalProps {
  questionId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function QuestionEditModal({ questionId, isOpen, onClose }: QuestionEditModalProps) {
  const { currentSurvey, updateQuestion } = useSurveyBuilderStore();
  const question = currentSurvey.questions.find(q => q.id === questionId);

  const [formData, setFormData] = useState<Partial<Question>>({});

  useEffect(() => {
    if (question) {
      setFormData({
        title: question.title,
        description: question.description,
        required: question.required,
        options: question.options ? [...question.options] : [],
        selectLevels: question.selectLevels ? [...question.selectLevels] : []
      });
    }
  }, [question]);

  if (!question) return null;

  const handleSave = () => {
    if (questionId) {
      updateQuestion(questionId, formData);
      onClose();
    }
  };

  const addOption = () => {
    const newOption: QuestionOption = {
      id: `option-${Date.now()}`,
      label: `옵션 ${(formData.options?.length || 0) + 1}`,
      value: `옵션${(formData.options?.length || 0) + 1}`
    };
    setFormData(prev => ({
      ...prev,
      options: [...(prev.options || []), newOption]
    }));
  };

  const updateOption = (optionId: string, updates: Partial<QuestionOption>) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options?.map(option =>
        option.id === optionId ? { ...option, ...updates } : option
      )
    }));
  };

  const removeOption = (optionId: string) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options?.filter(option => option.id !== optionId)
    }));
  };

  const addSelectLevel = () => {
    const newLevel: SelectLevel = {
      id: `level-${Date.now()}`,
      label: `레벨 ${(formData.selectLevels?.length || 0) + 1}`,
      placeholder: '',
      order: (formData.selectLevels?.length || 0)
    };
    setFormData(prev => ({
      ...prev,
      selectLevels: [...(prev.selectLevels || []), newLevel]
    }));
  };

  const updateSelectLevel = (levelId: string, updates: Partial<SelectLevel>) => {
    setFormData(prev => ({
      ...prev,
      selectLevels: prev.selectLevels?.map(level =>
        level.id === levelId ? { ...level, ...updates } : level
      )
    }));
  };

  const removeSelectLevel = (levelId: string) => {
    setFormData(prev => ({
      ...prev,
      selectLevels: prev.selectLevels?.filter(level => level.id !== levelId)
        ?.map((level, index) => ({ ...level, order: index }))
    }));
  };

  const addLevelOption = (levelId: string) => {
    const level = formData.selectLevels?.find(l => l.id === levelId);
    if (!level) return;

    const levelIndex = formData.selectLevels?.findIndex(l => l.id === levelId) || 0;
    const optionCount = level.options?.length || 0;

    const newOption: QuestionOption = {
      id: `${levelId}-option-${Date.now()}`,
      label: `옵션 ${optionCount + 1}`,
      value: levelIndex === 0
        ? `옵션${optionCount + 1}`
        : `상위옵션-옵션${optionCount + 1}` // 기본값, 나중에 상위 선택으로 업데이트됨
    };

    setFormData(prev => ({
      ...prev,
      selectLevels: prev.selectLevels?.map(level =>
        level.id === levelId
          ? { ...level, options: [...(level.options || []), newOption] }
          : level
      )
    }));
  };

  const updateOptionWithParent = (levelId: string, optionId: string, parentValue: string, optionLabel: string) => {
    // 한글 값을 그대로 사용하되, 공백만 제거
    const sanitizedLabel = optionLabel.trim();
    const autoValue = `${parentValue}-${sanitizedLabel}`;

    setFormData(prev => ({
      ...prev,
      selectLevels: prev.selectLevels?.map(level =>
        level.id === levelId
          ? {
              ...level,
              options: level.options?.map(option =>
                option.id === optionId
                  ? { ...option, label: optionLabel, value: autoValue }
                  : option
              )
            }
          : level
      )
    }));
  };

  const getParentLevelOptions = (currentLevelIndex: number) => {
    if (currentLevelIndex === 0) return [];
    const parentLevel = formData.selectLevels?.[currentLevelIndex - 1];
    return parentLevel?.options || [];
  };

  const updateLevelOption = (levelId: string, optionId: string, updates: Partial<QuestionOption>) => {
    setFormData(prev => ({
      ...prev,
      selectLevels: prev.selectLevels?.map(level =>
        level.id === levelId
          ? {
              ...level,
              options: level.options?.map(option =>
                option.id === optionId ? { ...option, ...updates } : option
              )
            }
          : level
      )
    }));
  };

  const removeLevelOption = (levelId: string, optionId: string) => {
    setFormData(prev => ({
      ...prev,
      selectLevels: prev.selectLevels?.map(level =>
        level.id === levelId
          ? {
              ...level,
              options: level.options?.filter(option => option.id !== optionId)
            }
          : level
      )
    }));
  };

  const needsOptions = ['radio', 'checkbox', 'select'].includes(question.type);
  const needsSelectLevels = question.type === 'multiselect';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {getQuestionTypeIcon(question.type)}
            <span>{getQuestionTypeLabel(question.type)} 편집</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 기본 정보 */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">질문 제목</Label>
              <Input
                id="title"
                value={formData.title || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="질문을 입력하세요"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="description">설명 (선택사항)</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="질문에 대한 추가 설명을 입력하세요"
                className="mt-2"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="required"
                checked={formData.required || false}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, required: checked }))}
              />
              <Label htmlFor="required">필수 질문</Label>
            </div>
          </div>

          {/* 옵션 설정 (radio, checkbox, select) */}
          {needsOptions && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>선택 옵션</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOption}
                  className="flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>옵션 추가</span>
                </Button>
              </div>

              <div className="space-y-2">
                {formData.options?.map((option, index) => (
                  <div key={option.id} className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg">
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
            </div>
          )}

          {/* 다단계 Select 설정 */}
          {needsSelectLevels && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center space-x-2">
                  <Settings className="w-4 h-4" />
                  <span>다단계 Select 설정</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSelectLevel}
                  className="flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>레벨 추가</span>
                </Button>
              </div>

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
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">레이블</Label>
                                <Input
                                  value={level.label}
                                  onChange={(e) => updateSelectLevel(level.id, { label: e.target.value })}
                                  placeholder="예: 카테고리"
                                  className="mt-1 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">플레이스홀더</Label>
                                <Input
                                  value={level.placeholder || ''}
                                  onChange={(e) => updateSelectLevel(level.id, { placeholder: e.target.value })}
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
                                    <div key={option.id} className="p-3 bg-gray-50 rounded-lg space-y-2">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs text-gray-500 w-6">{optionIndex + 1}.</span>
                                        <Input
                                          value={option.label}
                                          onChange={(e) => updateLevelOption(level.id, option.id, { label: e.target.value })}
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
                                          <span className="text-xs text-gray-600 min-w-fit">연동할 상위 옵션:</span>
                                          <select
                                            value={option.value.includes('-') ? option.value.split('-')[0] : ''}
                                            onChange={(e) => {
                                              if (e.target.value) {
                                                updateOptionWithParent(level.id, option.id, e.target.value, option.label);
                                              }
                                            }}
                                            className="text-xs h-6 px-2 border border-gray-200 rounded bg-white flex-1"
                                          >
                                            <option value="">상위 옵션 선택...</option>
                                            {parentOptions.map(parentOption => (
                                              <option key={parentOption.id} value={parentOption.value}>
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
                                  <strong>💡 자동 연동:</strong> 하위 레벨에서 "연동할 상위 옵션"을 선택하면 한글 값이 자동 생성됩니다.
                                  <br />예: 상위 "한식" 선택 + 하위 "김치찌개" → 값: "한식-김치찌개" (한글 그대로 저장)
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                  {/* 미리보기 */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <Label className="text-sm font-medium text-gray-700 mb-3 block">미리보기</Label>
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
                  <strong>🔗 다단계 Select 기능:</strong> 카테고리 → 세부항목 같은 계층적 선택을 제공합니다.
                  <br />• 1단계: 기본 옵션들 설정 (예: 한식, 중식, 양식)
                  <br />• 2단계 이상: 상위 옵션 선택으로 자동 연동 (한글 값 그대로 저장됩니다)
                  <br />• 데이터 저장: 한글로 된 값들이 그대로 저장되어 분석이 쉽습니다 📊
                </p>
              </div>
            </div>
          )}

          {/* 테이블 설정 */}
          {question.type === 'table' && (
            <div className="space-y-4">
              <Label>테이블 설정</Label>
              <div className="p-4 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600 mb-3">
                  테이블 형식 질문의 행과 열을 설정할 수 있습니다.
                </p>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="table-rows">행 항목</Label>
                    <Textarea
                      id="table-rows"
                      placeholder="각 줄에 하나씩 행 항목을 입력하세요&#10;예:&#10;서비스 품질&#10;직원 친절도&#10;매장 청결도"
                      className="mt-2"
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="table-columns">열 항목</Label>
                    <Textarea
                      id="table-columns"
                      placeholder="각 줄에 하나씩 열 항목을 입력하세요&#10;예:&#10;매우 좋음&#10;좋음&#10;보통&#10;나쁨"
                      className="mt-2"
                      rows={4}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 미디어 설정 */}
          <div className="space-y-4">
            <Label>미디어 첨부</Label>
            <div className="flex space-x-2">
              <Button type="button" variant="outline" size="sm" className="flex items-center space-x-1">
                <Image className="w-4 h-4" />
                <span>이미지 추가</span>
              </Button>
              <Button type="button" variant="outline" size="sm" className="flex items-center space-x-1">
                <Video className="w-4 h-4" />
                <span>동영상 추가</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSave}>
            저장
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getQuestionTypeIcon(type: string) {
  const icons = {
    text: Type,
    textarea: FileText,
    radio: Circle,
    checkbox: CheckSquare,
    select: ChevronDown,
    multiselect: Settings,
    table: Table
  };
  const IconComponent = icons[type as keyof typeof icons] || Type;
  return <IconComponent className="w-5 h-5" />;
}

function getQuestionTypeLabel(type: string): string {
  const labels = {
    text: '단답형',
    textarea: '장문형',
    radio: '단일선택',
    checkbox: '다중선택',
    select: '드롭다운',
    multiselect: '다단계선택',
    table: '테이블'
  };
  return labels[type as keyof typeof labels] || type;
}