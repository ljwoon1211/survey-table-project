'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  AlertCircle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  CheckSquare,
  ChevronDown,
  Circle,
  Image,
  Loader2,
  PenLine,
  Type,
  Upload,
  Video,
  X,
} from 'lucide-react';

import {
  createQuestion as createQuestionAction,
  updateQuestion as updateQuestionAction,
} from '@/actions/question-actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { getProxiedImageUrl, optimizeImage, validateImageFile } from '@/lib/image-utils';
import { generateId, isValidUUID } from '@/lib/utils';
import { useSurveyBuilderStore } from '@/stores/survey-store';
import { CheckboxOption, QuestionOption, RadioOption, TableCell } from '@/types/survey';
import {
  INTERACTIVE_CELL_TYPES,
  generateCellCode,
  generateExportLabel,
  inferSpssMeasure,
  inferSpssVarType,
} from '@/utils/table-cell-code-generator';

import { BranchRuleEditor } from './branch-rule-editor';

interface CellContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cell: TableCell;
  onSave: (cell: TableCell) => void;
  currentQuestionId?: string;
  questionCode?: string;
  questionTitle?: string;
  rowCode?: string;
  rowLabel?: string;
  columnCode?: string;
  columnLabel?: string;
}

export function CellContentModal({
  isOpen,
  onClose,
  cell,
  onSave,
  currentQuestionId = '',
  questionCode,
  questionTitle,
  rowCode,
  rowLabel,
  columnCode,
  columnLabel,
}: CellContentModalProps) {
  const { currentSurvey } = useSurveyBuilderStore();
  const [isSaving, setIsSaving] = useState(false);
  const [contentType, setContentType] = useState<
    'text' | 'image' | 'video' | 'checkbox' | 'radio' | 'select' | 'input'
  >(cell.type || 'text');
  const [textContent, setTextContent] = useState(cell.content || '');
  const [imageUrl, setImageUrl] = useState(cell.imageUrl || '');
  const [videoUrl, setVideoUrl] = useState(cell.videoUrl || '');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    cell.imageUrl && contentType === 'image' ? cell.imageUrl : null,
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortController = useRef<AbortController | null>(null);

  // 셀이 변경될 때 상태 동기화 (모달이 열릴 때마다 최신 셀 데이터 반영)
  useEffect(() => {
    if (isOpen && cell) {
      setContentType(cell.type || 'text');
      setTextContent(cell.content || '');
      setImageUrl(cell.imageUrl || '');
      setVideoUrl(cell.videoUrl || '');
      setPreviewUrl(cell.imageUrl && cell.type === 'image' ? cell.imageUrl : null);
      setCheckboxOptions(cell.checkboxOptions || []);
      setRadioOptions(cell.radioOptions || []);
      setRadioGroupName(cell.radioGroupName || '');
      setSelectOptions(cell.selectOptions || []);
      setAllowOtherOption(cell.allowOtherOption || false);
      setInputPlaceholder(cell.placeholder || '');
      setInputMaxLength(cell.inputMaxLength || '');
      setMinSelections(cell.minSelections);
      setMaxSelections(cell.maxSelections);
      setIsMergeEnabled(
        (cell.rowspan && cell.rowspan > 1) || (cell.colspan && cell.colspan > 1) || false,
      );
      setRowspan(cell.rowspan || 1);
      setColspan(cell.colspan || 1);
      setHorizontalAlign(cell.horizontalAlign || 'left');
      setVerticalAlign(cell.verticalAlign || 'top');
      setCellCode(cell.cellCode || '');
      setIsCustomCellCode(cell.isCustomCellCode ?? !!cell.cellCode);
      setExportLabel(cell.exportLabel || '');
      setIsCustomExportLabel(cell.isCustomExportLabel ?? !!cell.exportLabel);
      setSpssVarType(cell.spssVarType);
      setSpssMeasure(cell.spssMeasure);
    }
  }, [isOpen, cell]);

  // imageUrl이 바뀔 때 에러 상태 리셋
  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);
  const [checkboxOptions, setCheckboxOptions] = useState<CheckboxOption[]>(
    cell.checkboxOptions || [],
  );
  const [radioOptions, setRadioOptions] = useState<RadioOption[]>(cell.radioOptions || []);
  const [radioGroupName, setRadioGroupName] = useState(cell.radioGroupName || '');
  const [selectOptions, setSelectOptions] = useState<QuestionOption[]>(cell.selectOptions || []);
  const [allowOtherOption, setAllowOtherOption] = useState(cell.allowOtherOption || false);
  const [inputPlaceholder, setInputPlaceholder] = useState(cell.placeholder || '');
  const [inputMaxLength, setInputMaxLength] = useState<number | ''>(cell.inputMaxLength || '');
  const [minSelections, setMinSelections] = useState<number | undefined>(cell.minSelections);
  const [maxSelections, setMaxSelections] = useState<number | undefined>(cell.maxSelections);

  // 정렬 관련 state
  const [horizontalAlign, setHorizontalAlign] = useState<'left' | 'center' | 'right'>(
    cell.horizontalAlign || 'left',
  );
  const [verticalAlign, setVerticalAlign] = useState<'top' | 'middle' | 'bottom'>(
    cell.verticalAlign || 'top',
  );

  // 조건부 분기 토글 상태
  const [showBranchSettings, setShowBranchSettings] = useState(false);

  // 셀 병합 관련 state
  const [isMergeEnabled, setIsMergeEnabled] = useState(
    (cell.rowspan && cell.rowspan > 1) || (cell.colspan && cell.colspan > 1) || false,
  );
  const [rowspan, setRowspan] = useState<number | ''>(cell.rowspan || 1);
  const [colspan, setColspan] = useState<number | ''>(cell.colspan || 1);

  // 셀 코드 및 엑셀 라벨
  const [cellCode, setCellCode] = useState(cell.cellCode || '');
  const [isCustomCellCode, setIsCustomCellCode] = useState(cell.isCustomCellCode ?? !!cell.cellCode);
  const [exportLabel, setExportLabel] = useState(cell.exportLabel || '');
  const [isCustomExportLabel, setIsCustomExportLabel] = useState(cell.isCustomExportLabel ?? !!cell.exportLabel);

  // SPSS 변수 타입 / 측정 수준 (셀 단위)
  const [spssVarType, setSpssVarType] = useState<TableCell['spssVarType']>(cell.spssVarType);
  const [spssMeasure, setSpssMeasure] = useState<TableCell['spssMeasure']>(cell.spssMeasure);

  // 자동생성 셀코드/라벨 계산
  const autoCellCode = generateCellCode(questionCode, rowCode, columnCode);
  const autoExportLabel = generateExportLabel(questionTitle, columnLabel, rowLabel);

  // 기타 옵션 관리 상수들
  const OTHER_OPTION_ID = 'other-option';
  const OTHER_OPTION_LABEL = '기타';

  // 기타 옵션 헬퍼 함수들
  const addOtherCheckboxOption = (options: CheckboxOption[]) => {
    const hasOtherOption = options.some((option) => option.id === OTHER_OPTION_ID);
    if (!hasOtherOption) {
      return [
        ...options,
        {
          id: OTHER_OPTION_ID,
          label: OTHER_OPTION_LABEL,
          value: 'other',
          checked: false,
          hasOther: true,
        },
      ];
    }
    return options;
  };

  const removeOtherCheckboxOption = (options: CheckboxOption[]) => {
    return options.filter((option) => option.id !== OTHER_OPTION_ID);
  };

  const addOtherRadioOption = (options: RadioOption[]) => {
    const hasOtherOption = options.some((option) => option.id === OTHER_OPTION_ID);
    if (!hasOtherOption) {
      return [
        ...options,
        {
          id: OTHER_OPTION_ID,
          label: OTHER_OPTION_LABEL,
          value: 'other',
          selected: false,
          hasOther: true,
        },
      ];
    }
    return options;
  };

  const removeOtherRadioOption = (options: RadioOption[]) => {
    return options.filter((option) => option.id !== OTHER_OPTION_ID);
  };

  const addOtherSelectOption = (options: QuestionOption[]) => {
    const hasOtherOption = options.some((option) => option.id === OTHER_OPTION_ID);
    if (!hasOtherOption) {
      return [
        ...options,
        {
          id: OTHER_OPTION_ID,
          label: OTHER_OPTION_LABEL,
          value: 'other',
          hasOther: true,
        },
      ];
    }
    return options;
  };

  const removeOtherSelectOption = (options: QuestionOption[]) => {
    return options.filter((option) => option.id !== OTHER_OPTION_ID);
  };

  // 기타 옵션 토글 핸들러
  const handleOtherOptionToggle = (enabled: boolean) => {
    setAllowOtherOption(enabled);

    if (contentType === 'checkbox') {
      setCheckboxOptions((prev) =>
        enabled ? addOtherCheckboxOption(prev) : removeOtherCheckboxOption(prev),
      );
    } else if (contentType === 'radio') {
      setRadioOptions((prev) =>
        enabled ? addOtherRadioOption(prev) : removeOtherRadioOption(prev),
      );
    } else if (contentType === 'select') {
      setSelectOptions((prev) =>
        enabled ? addOtherSelectOption(prev) : removeOtherSelectOption(prev),
      );
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedCell: TableCell = {
        ...cell,
        type: contentType,
        // 모든 타입에서 텍스트 내용 저장 (라디오/체크박스/셀렉트에서도 설명 텍스트 표시 가능)
        content: textContent || '',
        imageUrl: contentType === 'image' ? imageUrl : undefined,
        videoUrl: contentType === 'video' ? videoUrl : undefined,
        checkboxOptions: contentType === 'checkbox' ? checkboxOptions : undefined,
        radioOptions: contentType === 'radio' ? radioOptions : undefined,
        radioGroupName: contentType === 'radio' ? radioGroupName : undefined,
        selectOptions: contentType === 'select' ? selectOptions : undefined,
        allowOtherOption: ['checkbox', 'radio', 'select'].includes(contentType)
          ? allowOtherOption
          : undefined,
        placeholder: contentType === 'input' ? inputPlaceholder : undefined,
        inputMaxLength:
          contentType === 'input' && typeof inputMaxLength === 'number'
            ? inputMaxLength
            : undefined,
        // 체크박스 선택 개수 제한 (체크박스 타입 전용)
        minSelections: contentType === 'checkbox' ? minSelections : undefined,
        maxSelections: contentType === 'checkbox' ? maxSelections : undefined,
        // 셀 병합 속성 추가
        rowspan: isMergeEnabled && typeof rowspan === 'number' && rowspan > 1 ? rowspan : undefined,
        colspan: isMergeEnabled && typeof colspan === 'number' && colspan > 1 ? colspan : undefined,
        // 정렬 속성 추가
        horizontalAlign: horizontalAlign !== 'left' ? horizontalAlign : undefined,
        verticalAlign: verticalAlign !== 'top' ? verticalAlign : undefined,
        // 셀 코드 및 엑셀 라벨 추가
        cellCode: cellCode || undefined,
        isCustomCellCode: isCustomCellCode === false ? false : isCustomCellCode || undefined,
        exportLabel: exportLabel || undefined,
        isCustomExportLabel: isCustomExportLabel === false ? false : isCustomExportLabel || undefined,
        // SPSS 변수 타입 / 측정 수준 (입력 셀만)
        spssVarType: INTERACTIVE_CELL_TYPES.has(contentType) ? spssVarType : undefined,
        spssMeasure: INTERACTIVE_CELL_TYPES.has(contentType) ? spssMeasure : undefined,
      };

      // 로컬 스토어 업데이트 (셀 저장)
      onSave(updatedCell);

      // 서버에 질문 저장/업데이트
      if (currentQuestionId && currentSurvey.id) {
        const question = currentSurvey.questions.find((q) => q.id === currentQuestionId);
        if (question && question.tableRowsData) {
          // tableRowsData에서 해당 셀을 찾아 업데이트
          const updatedRowsData = question.tableRowsData.map((row) => ({
            ...row,
            cells: row.cells.map((c) => (c.id === cell.id ? updatedCell : c)),
          }));

          try {
            if (isValidUUID(currentQuestionId)) {
              // 이미 DB에 저장된 질문: 업데이트
              await updateQuestionAction(currentQuestionId, {
                tableRowsData: updatedRowsData,
              });
            } else {
              // 임시 질문: 생성하고 반환된 UUID로 로컬 스토어의 질문 ID 업데이트
              const createdQuestion = await createQuestionAction({
                surveyId: currentSurvey.id,
                groupId: question.groupId,
                type: question.type,
                title: question.title || '',
                description: question.description,
                required: question.required ?? false,
                order: question.order ?? 0,
                options: question.options,
                selectLevels: question.selectLevels,
                tableTitle: question.tableTitle,
                tableColumns: question.tableColumns,
                tableRowsData: updatedRowsData,
                imageUrl: question.imageUrl,
                videoUrl: question.videoUrl,
                allowOtherOption: question.allowOtherOption,
                noticeContent: question.noticeContent,
                requiresAcknowledgment: question.requiresAcknowledgment,
                tableValidationRules: question.tableValidationRules,
                displayCondition: question.displayCondition,
              });

              // 반환된 UUID로 로컬 스토어의 질문 ID 업데이트
              if (createdQuestion?.id) {
                useSurveyBuilderStore.setState((state) => ({
                  currentSurvey: {
                    ...state.currentSurvey,
                    questions: state.currentSurvey.questions.map((q) =>
                      q.id === currentQuestionId ? { ...q, id: createdQuestion.id } : q,
                    ),
                  },
                }));
              }
            }
          } catch (error) {
            console.error('질문 저장/업데이트 실패:', error);
          }
        }
      }
    } catch (error) {
      console.error('셀 저장 실패:', error);
    } finally {
      setIsSaving(false);
      onClose();
    }
  };

  const handleCancel = () => {
    // 원래 값으로 되돌리기
    setContentType(cell.type || 'text');
    setTextContent(cell.content || '');
    setImageUrl(cell.imageUrl || '');
    setVideoUrl(cell.videoUrl || '');
    setPreviewUrl(cell.imageUrl && cell.type === 'image' ? cell.imageUrl : null);
    setSelectedFile(null);
    setUploadError(null);
    setUploadProgress(0);
    setIsUploading(false);
    setCheckboxOptions(cell.checkboxOptions || []);
    setRadioOptions(cell.radioOptions || []);
    setRadioGroupName(cell.radioGroupName || '');
    setSelectOptions(cell.selectOptions || []);
    setAllowOtherOption(cell.allowOtherOption || false);
    setInputPlaceholder(cell.placeholder || '');
    setInputMaxLength(cell.inputMaxLength || '');
    setMinSelections(cell.minSelections);
    setMaxSelections(cell.maxSelections);
    setIsMergeEnabled(
      (cell.rowspan && cell.rowspan > 1) || (cell.colspan && cell.colspan > 1) || false,
    );
    setRowspan(cell.rowspan || 1);
    setColspan(cell.colspan || 1);
    setHorizontalAlign(cell.horizontalAlign || 'left');
    setVerticalAlign(cell.verticalAlign || 'top');
    setCellCode(cell.cellCode || '');
    setIsCustomCellCode(cell.isCustomCellCode ?? !!cell.cellCode);
    setExportLabel(cell.exportLabel || '');
    setIsCustomExportLabel(cell.isCustomExportLabel ?? !!cell.exportLabel);
    setSpssVarType(cell.spssVarType);
    setSpssMeasure(cell.spssMeasure);
    onClose();
  };

  // YouTube URL을 임베드 URL로 변환
  const getYouTubeEmbedUrl = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}`;
    }
    return url;
  };

  // 파일 선택 핸들러
  const handleFileSelect = useCallback(async (file: File) => {
    // 파일 유효성 검사
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || '파일 검증에 실패했습니다.');
      return;
    }

    setUploadError(null);
    setSelectedFile(file);

    // 미리보기 생성
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // 드래그 앤 드롭 핸들러
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // 이미지 업로드
  const handleImageUpload = useCallback(async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    uploadAbortController.current = new AbortController();

    try {
      // 이미지 최적화
      const optimizedBlob = await optimizeImage(selectedFile);
      const optimizedFile = new File([optimizedBlob], selectedFile.name, {
        type: optimizedBlob.type || selectedFile.type,
      });

      // FormData 생성
      const formData = new FormData();
      formData.append('file', optimizedFile);

      // 업로드 (진행률 추적)
      const xhr = new XMLHttpRequest();

      // 진행률 업데이트
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      // Promise로 래핑
      const uploadPromise = new Promise<string>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            resolve(response.url);
          } else {
            const errorResponse = JSON.parse(xhr.responseText);
            reject(new Error(errorResponse.error || '업로드에 실패했습니다.'));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('네트워크 오류가 발생했습니다.'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('업로드가 취소되었습니다.'));
        });

        xhr.open('POST', '/api/upload/image');
        xhr.send(formData);
      });

      const uploadedImageUrl = await uploadPromise;

      // 이미지 URL 설정
      setImageUrl(uploadedImageUrl);
      setPreviewUrl(uploadedImageUrl);

      // 상태 초기화
      setSelectedFile(null);
      setUploadProgress(0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '업로드 중 오류가 발생했습니다.';
      setUploadError(errorMessage);
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
      uploadAbortController.current = null;
    }
  }, [selectedFile]);

  // 업로드 취소
  const handleCancelUpload = useCallback(() => {
    if (uploadAbortController.current) {
      uploadAbortController.current.abort();
    }
    setSelectedFile(null);
    if (imageUrl) {
      setPreviewUrl(imageUrl);
    } else {
      setPreviewUrl(null);
    }
    setUploadError(null);
    setUploadProgress(0);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [imageUrl]);

  // 이미지 삭제
  const handleRemoveImage = useCallback(() => {
    setImageUrl('');
    setPreviewUrl(null);
    setSelectedFile(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // X 버튼이나 ESC만 닫기 가능 (배경 클릭은 onInteractOutside에서 막음)
        if (!open && !isSaving) {
          handleCancel();
        }
      }}
    >
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>셀 내용 편집</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="common-text-content">셀 텍스트 내용</Label>
            <Textarea
              id="common-text-content"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="셀에 표시할 텍스트를 입력하세요 (모든 타입에서 표시됨)"
              rows={3}
              className="resize-none"
            />
            {textContent && (
              <div className="rounded bg-gray-50 p-2 text-xs text-gray-500">
                미리보기: {textContent}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cell-code">셀 코드</Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="cell-code"
                    value={cellCode}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCellCode(val);
                      // 사용자가 자동생성값과 다르게 수정하면 커스텀으로 표시
                      setIsCustomCellCode(val !== '' && val !== autoCellCode);
                    }}
                    placeholder={autoCellCode || '예: Q4-1_r1_c1'}
                    className="h-9"
                  />
                  {isCustomCellCode && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setCellCode(autoCellCode || '');
                        setIsCustomCellCode(false);
                      }}
                      title="자동값으로 초기화"
                      className="h-9 w-9 shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {autoCellCode && isCustomCellCode && (
                  <p className="text-[10px] text-gray-400">자동: {autoCellCode}</p>
                )}
                {!cellCode && INTERACTIVE_CELL_TYPES.has(contentType) && (
                  <p className="text-[10px] text-amber-500">셀코드가 비어있으면 내보내기에서 제외됩니다.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="export-label">엑셀 라벨</Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="export-label"
                    value={exportLabel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setExportLabel(val);
                      setIsCustomExportLabel(val !== '' && val !== autoExportLabel);
                    }}
                    placeholder={autoExportLabel || '예: 가구TV보유_TV종류_UHD'}
                    className="h-9"
                  />
                  {isCustomExportLabel && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setExportLabel(autoExportLabel || '');
                        setIsCustomExportLabel(false);
                      }}
                      title="자동값으로 초기화"
                      className="h-9 w-9 shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {autoExportLabel && isCustomExportLabel && (
                  <p className="text-[10px] text-gray-400">자동: {autoExportLabel}</p>
                )}
              </div>
            </div>

            {/* SPSS 변수 타입 / 측정 수준 (입력 셀만 표시) */}
            {INTERACTIVE_CELL_TYPES.has(contentType) && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="cell-spss-var-type" className="text-xs">변수 타입</Label>
                  <select
                    id="cell-spss-var-type"
                    value={spssVarType || ''}
                    onChange={(e) => setSpssVarType((e.target.value || undefined) as TableCell['spssVarType'])}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  >
                    <option value="" disabled>선택</option>
                    <option value="Numeric">Numeric</option>
                    <option value="String">String</option>
                    <option value="Date">Date</option>
                    <option value="DateTime">DateTime</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cell-spss-measure" className="text-xs">측정 수준</Label>
                  <select
                    id="cell-spss-measure"
                    value={spssMeasure || ''}
                    onChange={(e) => setSpssMeasure((e.target.value || undefined) as TableCell['spssMeasure'])}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  >
                    <option value="" disabled>선택</option>
                    <option value="Nominal">Nominal (명목)</option>
                    <option value="Ordinal">Ordinal (순서)</option>
                    <option value="Continuous">Continuous (척도)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        <Tabs
          value={contentType}
          onValueChange={(value) => {
            const newType = value as
              | 'text'
              | 'image'
              | 'video'
              | 'checkbox'
              | 'radio'
              | 'select'
              | 'input';
            setContentType(newType);
            // 이미지 탭으로 변경될 때 미리보기 URL 설정
            if (newType === 'image' && imageUrl) {
              setPreviewUrl(imageUrl);
            } else if (newType !== 'image') {
              setPreviewUrl(null);
            }
            // 셀 타입 변경 시 SPSS 필드 자동 처리
            if (INTERACTIVE_CELL_TYPES.has(newType)) {
              // 입력 타입으로 변경 → 변수 타입/측정 수준 자동 설정 (기존값 없을 때만)
              if (!spssVarType) setSpssVarType(inferSpssVarType(newType));
              if (!spssMeasure) setSpssMeasure(inferSpssMeasure(newType));
            } else {
              // 비입력 타입 → SPSS만 삭제, 코드는 유지
              setSpssVarType(undefined);
              setSpssMeasure(undefined);
            }
            // 모든 타입: 코드가 없고 커스텀이 아니면 자동생성
            if (!cellCode && !isCustomCellCode && autoCellCode) {
              setCellCode(autoCellCode);
            }
            if (!exportLabel && !isCustomExportLabel && autoExportLabel) {
              setExportLabel(autoExportLabel);
            }
          }}
        >
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="text" className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              텍스트
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              이미지
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              동영상
            </TabsTrigger>
            <TabsTrigger value="input" className="flex items-center gap-2">
              <PenLine className="h-4 w-4" />
              단답형
            </TabsTrigger>
            <TabsTrigger value="checkbox" className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              체크박스
            </TabsTrigger>
            <TabsTrigger value="radio" className="flex items-center gap-2">
              <Circle className="h-4 w-4" />
              라디오
            </TabsTrigger>
            <TabsTrigger value="select" className="flex items-center gap-2">
              <ChevronDown className="h-4 w-4" />
              선택
            </TabsTrigger>
          </TabsList>

          {/* 텍스트 탭 */}
          <TabsContent value="text" className="space-y-4">
            <div className="rounded-lg border bg-gray-50 p-4 text-center text-sm text-gray-600">
              <p>기본 텍스트 모드입니다.</p>
              <p className="mt-1">
                상단의 &quot;셀 텍스트 내용&quot;에 입력한 텍스트만 표시됩니다.
              </p>
            </div>
          </TabsContent>

          {/* 이미지 탭 */}
          <TabsContent value="image" className="space-y-4">
            {/* 드래그 앤 드롭 영역 또는 파일 선택 */}
            {!selectedFile && !isUploading && !imageUrl && (
              <div
                className="cursor-pointer rounded-lg border-2 border-dashed border-blue-300 p-6 text-center transition-colors hover:border-blue-400"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml,image/bmp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileSelect(file);
                    }
                  }}
                  className="hidden"
                />
                <Upload className="mx-auto mb-2 h-8 w-8 text-blue-500" />
                <p className="mb-2 text-sm text-gray-600">
                  이미지를 드래그 앤 드롭하거나 클릭하여 선택하세요
                </p>
                <p className="text-xs text-gray-500">
                  지원 형식: JPG, PNG, GIF, WebP, SVG (최대 10MB)
                </p>
              </div>
            )}

            {/* 선택된 파일 미리보기 (업로드 전) */}
            {selectedFile && previewUrl && !isUploading && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-700">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelUpload}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="overflow-hidden rounded-lg border bg-white">
                  <img
                    key={previewUrl}
                    src={getProxiedImageUrl(previewUrl || '')}
                    alt="미리보기"
                    className="max-h-48 w-full object-contain"
                  />
                </div>
                <Button type="button" size="sm" onClick={handleImageUpload} className="w-full">
                  업로드
                </Button>
              </div>
            )}

            {/* 업로드 진행 중 */}
            {isUploading && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">업로드 중...</span>
                  <span className="text-sm text-gray-500">{Math.round(uploadProgress)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                {previewUrl && (
                  <div className="overflow-hidden rounded-lg border bg-white">
                    <img
                      key={previewUrl}
                      src={getProxiedImageUrl(previewUrl)}
                      alt="업로드 중"
                      className="max-h-48 w-full object-contain opacity-50"
                    />
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelUpload}
                  className="w-full"
                  disabled={uploadProgress >= 100}
                >
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  업로드 취소
                </Button>
              </div>
            )}

            {/* 업로드된 이미지 미리보기 */}
            {imageUrl && !isUploading && !selectedFile && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>업로드된 이미지</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveImage}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="mr-1 h-4 w-4" />
                    삭제
                  </Button>
                </div>
                <div className="overflow-hidden rounded-lg border bg-gray-50">
                  <div key={imageUrl}>
                    {imageError ? (
                      <div className="p-3 text-center">
                        <p className="text-sm text-red-500">이미지를 불러올 수 없습니다.</p>
                      </div>
                    ) : (
                      <img
                        src={getProxiedImageUrl(imageUrl)}
                        alt="셀 내용 이미지 미리보기"
                        className="max-h-48 w-full object-contain"
                        onError={() => setImageError(true)}
                      />
                    )}
                  </div>
                </div>
                <div
                  className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-4 text-center transition-colors hover:border-blue-400"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml,image/bmp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileSelect(file);
                      }
                    }}
                    className="hidden"
                  />
                  <p className="text-sm text-gray-600">다른 이미지로 교체하기</p>
                </div>
              </div>
            )}

            {/* 에러 메시지 */}
            {uploadError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">업로드 실패</p>
                  <p className="mt-1 text-sm text-red-700">{uploadError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setUploadError(null);
                      if (selectedFile) {
                        handleImageUpload();
                      }
                    }}
                    className="mt-2"
                  >
                    다시 시도
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setUploadError(null)}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </TabsContent>

          {/* 동영상 탭 */}
          <TabsContent value="video" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="video-url">동영상 URL</Label>
              <Input
                id="video-url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <p className="text-sm text-gray-500">
                YouTube, Vimeo URL 또는 직접 동영상 링크를 입력하세요
              </p>
            </div>
            {videoUrl && (
              <div className="space-y-2">
                <Label>미리보기</Label>
                <div className="rounded-md border bg-gray-50 p-3">
                  {videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') ? (
                    <div className="aspect-video">
                      <iframe
                        src={getYouTubeEmbedUrl(videoUrl)}
                        className="h-full w-full rounded"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="동영상 미리보기"
                      />
                    </div>
                  ) : videoUrl.includes('vimeo.com') ? (
                    <div className="aspect-video">
                      <iframe
                        src={videoUrl.replace('vimeo.com/', 'player.vimeo.com/video/')}
                        className="h-full w-full rounded"
                        frameBorder="0"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                        title="동영상 미리보기"
                      />
                    </div>
                  ) : videoUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                    <video src={videoUrl} controls className="max-h-48 w-full rounded">
                      동영상을 지원하지 않는 브라우저입니다.
                    </video>
                  ) : (
                    <p className="text-sm text-yellow-600">
                      동영상 링크를 확인할 수 없습니다. YouTube, Vimeo 또는 직접 동영상 링크인지
                      확인해주세요.
                    </p>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* 단답형 입력 탭 */}
          <TabsContent value="input" className="space-y-4">
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="flex items-start gap-2">
                <PenLine className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">단답형 입력 필드</p>
                  <p className="mt-1 text-xs text-blue-700">
                    사용자가 짧은 텍스트를 입력할 수 있는 필드입니다. 이름, 이메일, 전화번호 등
                    간단한 정보 수집에 적합합니다.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="input-placeholder" className="text-sm font-medium">
                안내 문구 (Placeholder)
              </Label>
              <Input
                id="input-placeholder"
                value={inputPlaceholder}
                onChange={(e) => setInputPlaceholder(e.target.value)}
                placeholder="예: 이름을 입력하세요"
                className="w-full"
              />
              <p className="text-xs text-gray-500">입력 필드에 표시될 안내 문구를 입력하세요</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="input-max-length" className="text-sm font-medium">
                최대 글자 수 <span className="font-normal text-gray-500">(선택사항)</span>
              </Label>
              <Input
                id="input-max-length"
                type="number"
                min={1}
                max={500}
                value={inputMaxLength}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setInputMaxLength('');
                  } else {
                    const num = parseInt(value);
                    if (!isNaN(num) && num >= 1 && num <= 500) {
                      setInputMaxLength(num);
                    }
                  }
                }}
                placeholder="제한 없음"
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                {inputMaxLength === '' || inputMaxLength === 0
                  ? '글자 수 제한이 없습니다'
                  : `최대 ${inputMaxLength}자까지 입력 가능`}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">미리보기</Label>
              <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4">
                {/* 셀 텍스트 설명 (있는 경우) */}
                {textContent && textContent.trim() && (
                  <div className="mb-3 border-b border-gray-200 pb-2 text-sm font-medium break-words whitespace-pre-wrap text-gray-700">
                    {textContent}
                  </div>
                )}
                <div className="space-y-2">
                  <Input
                    placeholder={inputPlaceholder || '답변을 입력하세요...'}
                    maxLength={typeof inputMaxLength === 'number' ? inputMaxLength : undefined}
                    disabled
                    className="bg-white"
                  />
                  {typeof inputMaxLength === 'number' && inputMaxLength > 0 && (
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>0 / {inputMaxLength}자</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 체크박스 탭 */}
          <TabsContent value="checkbox" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>체크박스 옵션 관리</Label>
                <div className="flex items-center space-x-4">
                  {/* 기타 옵션 토글 */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="checkbox-allow-other"
                      checked={allowOtherOption}
                      onCheckedChange={handleOtherOptionToggle}
                      className="scale-75"
                    />
                    <Label htmlFor="checkbox-allow-other" className="text-xs text-gray-600">
                      기타 옵션 추가
                    </Label>
                  </div>
                  {/* 조건부 분기 토글 */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="checkbox-show-branch"
                      checked={showBranchSettings}
                      onCheckedChange={setShowBranchSettings}
                      className="scale-75"
                    />
                    <Label htmlFor="checkbox-show-branch" className="text-xs text-gray-600">
                      조건부 분기
                    </Label>
                  </div>
                </div>
              </div>

              <div className="max-h-[300px] space-y-3 overflow-y-auto pr-2">
                {checkboxOptions.map((option, index) => (
                  <div
                    key={option.id}
                    className="overflow-hidden rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-2 p-3">
                      <input
                        type="checkbox"
                        checked={option.checked || false}
                        onChange={(e) => {
                          const updated = [...checkboxOptions];
                          updated[index] = { ...option, checked: e.target.checked };
                          setCheckboxOptions(updated);
                        }}
                        className="rounded"
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex gap-2">
                          <Input
                            value={option.label}
                            onChange={(e) => {
                              const updated = [...checkboxOptions];
                              updated[index] = { ...option, label: e.target.value };
                              setCheckboxOptions(updated);
                            }}
                            placeholder="옵션 텍스트"
                            className="flex-1"
                          />
                          <Input
                            value={option.optionCode || ''}
                            onChange={(e) => {
                              const updated = [...checkboxOptions];
                              updated[index] = { ...option, optionCode: e.target.value };
                              setCheckboxOptions(updated);
                            }}
                            placeholder="코드"
                            className="w-20 text-xs"
                            title="엑셀 내보내기용 코드 (선택)"
                          />
                        </div>
                        {option.id === OTHER_OPTION_ID && (
                          <p className="text-xs text-blue-600">🔹 기타 옵션 (수정 가능)</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCheckboxOptions((prev) => prev.filter((_, i) => i !== index));
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        삭제
                      </Button>
                    </div>

                    {/* 분기 규칙 설정 - 토글이 켜져있을 때만 표시 */}
                    {showBranchSettings && (
                      <div className="px-3 pb-3">
                        <BranchRuleEditor
                          branchRule={option.branchRule}
                          allQuestions={currentSurvey.questions}
                          currentQuestionId={currentQuestionId}
                          onChange={(branchRule) => {
                            const updated = [...checkboxOptions];
                            updated[index] = { ...option, branchRule };
                            setCheckboxOptions(updated);
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const newOption: CheckboxOption = {
                    id: generateId(),
                    label: '새 옵션',
                    value: `option-${checkboxOptions.length + 1}`,
                    checked: false,
                  };
                  setCheckboxOptions((prev) => [...prev, newOption]);
                }}
                className="w-full"
              >
                옵션 추가
              </Button>

              {allowOtherOption && (
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-sm text-blue-700">
                    <strong>💡 기타 옵션이 활성화되었습니다.</strong>
                    <br />
                    마지막에 &quot;기타&quot; 체크박스가 자동으로 추가되어 사용자가 직접 텍스트를
                    입력할 수 있습니다.
                  </p>
                </div>
              )}
            </div>

            {/* 선택 개수 제한 (체크박스 셀 전용) */}
            {checkboxOptions.length > 0 && (
              <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <Label className="text-base font-medium">선택 개수 제한</Label>
                <p className="text-sm text-gray-600">
                  사용자가 선택할 수 있는 최소/최대 개수를 설정할 수 있습니다.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cell-min-selections" className="text-sm">
                      최소 선택 개수
                    </Label>
                    <Input
                      id="cell-min-selections"
                      type="number"
                      min="1"
                      max={checkboxOptions.length}
                      value={minSelections || ''}
                      onChange={(e) => {
                        const value =
                          e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                        setMinSelections(value);
                        // 최소값이 최대값보다 크면 최대값 조정
                        if (
                          value !== undefined &&
                          maxSelections !== undefined &&
                          value > maxSelections
                        ) {
                          setMaxSelections(value);
                        }
                      }}
                      placeholder="제한 없음"
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">
                      {checkboxOptions.length}개 옵션 중 최소 선택 개수
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cell-max-selections" className="text-sm">
                      최대 선택 개수
                    </Label>
                    <Input
                      id="cell-max-selections"
                      type="number"
                      min={minSelections ? minSelections : 1}
                      max={checkboxOptions.length}
                      value={maxSelections || ''}
                      onChange={(e) => {
                        const value =
                          e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                        setMaxSelections(value);
                      }}
                      placeholder="제한 없음"
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">
                      {checkboxOptions.length}개 옵션 중 최대 선택 개수
                    </p>
                  </div>
                </div>

                {minSelections !== undefined &&
                  maxSelections !== undefined &&
                  minSelections > maxSelections && (
                    <p className="text-sm text-red-500">
                      최소 선택 개수는 최대 선택 개수보다 작거나 같아야 합니다.
                    </p>
                  )}

                {minSelections !== undefined && minSelections > checkboxOptions.length && (
                  <p className="text-sm text-red-500">
                    최소 선택 개수는 옵션 개수보다 작거나 같아야 합니다.
                  </p>
                )}

                {maxSelections !== undefined && maxSelections > checkboxOptions.length && (
                  <p className="text-sm text-red-500">
                    최대 선택 개수는 옵션 개수보다 작거나 같아야 합니다.
                  </p>
                )}
              </div>
            )}

            {checkboxOptions.length > 0 && (
              <div className="space-y-2">
                <Label>미리보기</Label>
                <div className="max-h-[150px] overflow-y-auto rounded-md border bg-gray-50 p-3">
                  {/* 셀 텍스트 설명 (있는 경우) */}
                  {textContent && textContent.trim() && (
                    <div className="mb-3 border-b border-gray-200 pb-2 text-sm font-medium break-words whitespace-pre-wrap text-gray-700">
                      {textContent}
                    </div>
                  )}
                  <div className="space-y-2">
                    {checkboxOptions.map((option) => (
                      <div key={option.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={option.checked || false}
                          readOnly
                          className="rounded"
                        />
                        <span className="text-sm">{option.label}</span>
                        {option.id === OTHER_OPTION_ID && (
                          <span className="ml-2 text-xs text-blue-600">(텍스트 입력)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* 라디오 버튼 탭 */}
          <TabsContent value="radio" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="radio-group-name">라디오 그룹명</Label>
              <Input
                id="radio-group-name"
                value={radioGroupName}
                onChange={(e) => setRadioGroupName(e.target.value)}
                placeholder="라디오 버튼 그룹명 (예: payment-type)"
              />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>라디오 버튼 옵션 관리</Label>
                <div className="flex items-center space-x-4">
                  {/* 기타 옵션 토글 */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="radio-allow-other"
                      checked={allowOtherOption}
                      onCheckedChange={handleOtherOptionToggle}
                      className="scale-75"
                    />
                    <Label htmlFor="radio-allow-other" className="text-xs text-gray-600">
                      기타 옵션 추가
                    </Label>
                  </div>
                  {/* 조건부 분기 토글 */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="radio-show-branch"
                      checked={showBranchSettings}
                      onCheckedChange={setShowBranchSettings}
                      className="scale-75"
                    />
                    <Label htmlFor="radio-show-branch" className="text-xs text-gray-600">
                      조건부 분기
                    </Label>
                  </div>
                </div>
              </div>

              <div className="max-h-[300px] space-y-3 overflow-y-auto pr-2">
                {radioOptions.map((option, index) => (
                  <div
                    key={option.id}
                    className="overflow-hidden rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-2 p-3">
                      <input
                        type="radio"
                        name="preview-radio"
                        checked={option.selected || false}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const updated = radioOptions.map((opt, i) => ({
                              ...opt,
                              selected: i === index,
                            }));
                            setRadioOptions(updated);
                          }
                        }}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex gap-2">
                          <Input
                            value={option.label}
                            onChange={(e) => {
                              const updated = [...radioOptions];
                              updated[index] = { ...option, label: e.target.value };
                              setRadioOptions(updated);
                            }}
                            placeholder="옵션 텍스트"
                            className="flex-1"
                          />
                          <Input
                            value={option.optionCode || ''}
                            onChange={(e) => {
                              const updated = [...radioOptions];
                              updated[index] = { ...option, optionCode: e.target.value };
                              setRadioOptions(updated);
                            }}
                            placeholder="코드"
                            className="w-20 text-xs"
                            title="엑셀 내보내기용 코드 (선택)"
                          />
                        </div>
                        {option.id === OTHER_OPTION_ID && (
                          <p className="text-xs text-blue-600">🔹 기타 옵션 (수정 가능)</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRadioOptions((prev) => prev.filter((_, i) => i !== index));
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        삭제
                      </Button>
                    </div>

                    {/* 분기 규칙 설정 - 토글이 켜져있을 때만 표시 */}
                    {showBranchSettings && (
                      <div className="px-3 pb-3">
                        <BranchRuleEditor
                          branchRule={option.branchRule}
                          allQuestions={currentSurvey.questions}
                          currentQuestionId={currentQuestionId}
                          onChange={(branchRule) => {
                            const updated = [...radioOptions];
                            updated[index] = { ...option, branchRule };
                            setRadioOptions(updated);
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const newOption: RadioOption = {
                    id: generateId(),
                    label: '새 옵션',
                    value: `option-${radioOptions.length + 1}`,
                    selected: false,
                  };
                  setRadioOptions((prev) => [...prev, newOption]);
                }}
                className="w-full"
              >
                옵션 추가
              </Button>

              {allowOtherOption && (
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-sm text-blue-700">
                    <strong>💡 기타 옵션이 활성화되었습니다.</strong>
                    <br />
                    마지막에 &quot;기타&quot; 라디오 버튼이 자동으로 추가되어 사용자가 직접 텍스트를
                    입력할 수 있습니다.
                  </p>
                </div>
              )}
            </div>
            {radioOptions.length > 0 && (
              <div className="space-y-2">
                <Label>미리보기</Label>
                <div className="max-h-[150px] overflow-y-auto rounded-md border bg-gray-50 p-3">
                  {/* 셀 텍스트 설명 (있는 경우) */}
                  {textContent && textContent.trim() && (
                    <div className="mb-3 border-b border-gray-200 pb-2 text-sm font-medium break-words whitespace-pre-wrap text-gray-700">
                      {textContent}
                    </div>
                  )}
                  <div className="space-y-2">
                    {radioOptions.map((option) => (
                      <div key={option.id} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="preview-radio-display"
                          checked={option.selected || false}
                          readOnly
                        />
                        <span className="text-sm">{option.label}</span>
                        {option.id === OTHER_OPTION_ID && (
                          <span className="ml-2 text-xs text-blue-600">(텍스트 입력)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Select 탭 */}
          <TabsContent value="select" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Select 옵션 관리</Label>
                <div className="flex items-center space-x-4">
                  {/* 기타 옵션 토글 */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="select-allow-other"
                      checked={allowOtherOption}
                      onCheckedChange={handleOtherOptionToggle}
                      className="scale-75"
                    />
                    <Label htmlFor="select-allow-other" className="text-xs text-gray-600">
                      기타 옵션 추가
                    </Label>
                  </div>
                  {/* 조건부 분기 토글 */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="select-show-branch"
                      checked={showBranchSettings}
                      onCheckedChange={setShowBranchSettings}
                      className="scale-75"
                    />
                    <Label htmlFor="select-show-branch" className="text-xs text-gray-600">
                      조건부 분기
                    </Label>
                  </div>
                </div>
              </div>

              <div className="max-h-[300px] space-y-3 overflow-y-auto pr-2">
                {selectOptions.map((option, index) => (
                  <div
                    key={option.id}
                    className="overflow-hidden rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-2 p-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex gap-2">
                          <Input
                            value={option.label}
                            onChange={(e) => {
                              const updated = [...selectOptions];
                              updated[index] = { ...option, label: e.target.value };
                              setSelectOptions(updated);
                            }}
                            placeholder="옵션 텍스트"
                            className="flex-1"
                          />
                          <Input
                            value={option.optionCode || ''}
                            onChange={(e) => {
                              const updated = [...selectOptions];
                              updated[index] = { ...option, optionCode: e.target.value };
                              setSelectOptions(updated);
                            }}
                            placeholder="코드"
                            className="w-20 text-xs"
                            title="엑셀 내보내기용 코드 (선택)"
                          />
                        </div>
                        {option.id === OTHER_OPTION_ID && (
                          <p className="text-xs text-blue-600">🔹 기타 옵션 (수정 가능)</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectOptions((prev) => prev.filter((_, i) => i !== index));
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        삭제
                      </Button>
                    </div>

                    {/* 분기 규칙 설정 - 토글이 켜져있을 때만 표시 */}
                    {showBranchSettings && (
                      <div className="px-3 pb-3">
                        <BranchRuleEditor
                          branchRule={option.branchRule}
                          allQuestions={currentSurvey.questions}
                          currentQuestionId={currentQuestionId}
                          onChange={(branchRule) => {
                            const updated = [...selectOptions];
                            updated[index] = { ...option, branchRule };
                            setSelectOptions(updated);
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const newOption: QuestionOption = {
                    id: generateId(),
                    label: '새 옵션',
                    value: `option-${selectOptions.length + 1}`,
                  };
                  setSelectOptions((prev) => [...prev, newOption]);
                }}
                className="w-full"
              >
                옵션 추가
              </Button>

              {allowOtherOption && (
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-sm text-blue-700">
                    <strong>💡 기타 옵션이 활성화되었습니다.</strong>
                    <br />
                    마지막에 &quot;기타&quot; 선택 옵션이 자동으로 추가되어 사용자가 직접 텍스트를
                    입력할 수 있습니다.
                  </p>
                </div>
              )}
            </div>
            {selectOptions.length > 0 && (
              <div className="space-y-2">
                <Label>미리보기</Label>
                <div className="rounded-md border bg-gray-50 p-3">
                  {/* 셀 텍스트 설명 (있는 경우) */}
                  {textContent && textContent.trim() && (
                    <div className="mb-3 border-b border-gray-200 pb-2 text-sm font-medium break-words whitespace-pre-wrap text-gray-700">
                      {textContent}
                    </div>
                  )}
                  <select className="w-full rounded border p-2">
                    <option value="">선택하세요...</option>
                    {selectOptions.map((option) => (
                      <option key={option.id} value={option.value}>
                        {option.label}
                        {option.id === OTHER_OPTION_ID && ' (텍스트 입력)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* 셀 병합 설정 */}
        <div className="mt-6 border-t border-gray-200 pt-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">📐 셀 병합</h3>
            <div className="flex items-center gap-2">
              <Label htmlFor="merge-toggle" className="cursor-pointer text-sm text-gray-600">
                {isMergeEnabled ? '활성화됨' : '비활성화됨'}
              </Label>
              <Switch
                id="merge-toggle"
                checked={isMergeEnabled}
                onCheckedChange={(checked) => {
                  setIsMergeEnabled(checked);
                  if (!checked) {
                    setRowspan(1);
                    setColspan(1);
                  } else {
                    // 토글 켤 때 빈 값이면 1로 설정
                    if (rowspan === '') setRowspan(1);
                    if (colspan === '') setColspan(1);
                  }
                }}
              />
            </div>
          </div>

          {isMergeEnabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rowspan">행 병합 (세로로 아래)</Label>
                  <Input
                    id="rowspan"
                    type="number"
                    min={1}
                    value={rowspan}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setRowspan('');
                      } else {
                        const num = parseInt(value);
                        if (!isNaN(num) && num >= 1) {
                          setRowspan(num);
                        }
                      }
                    }}
                    onBlur={() => {
                      if (rowspan === '') {
                        setRowspan(1);
                      }
                    }}
                    className="w-full"
                    placeholder="1"
                  />
                  <p className="text-xs text-gray-500">
                    현재: {rowspan === '' || rowspan === 1 ? '병합 안 함' : `${rowspan}칸 병합`}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="colspan">열 병합 (가로로 우측)</Label>
                  <Input
                    id="colspan"
                    type="number"
                    min={1}
                    value={colspan}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setColspan('');
                      } else {
                        const num = parseInt(value);
                        if (!isNaN(num) && num >= 1) {
                          setColspan(num);
                        }
                      }
                    }}
                    onBlur={() => {
                      if (colspan === '') {
                        setColspan(1);
                      }
                    }}
                    className="w-full"
                    placeholder="1"
                  />
                  <p className="text-xs text-gray-500">
                    현재: {colspan === '' || colspan === 1 ? '병합 안 함' : `${colspan}칸 병합`}
                  </p>
                </div>
              </div>

              {((typeof rowspan === 'number' && rowspan > 1) ||
                (typeof colspan === 'number' && colspan > 1)) && (
                <div className="mt-3 rounded-lg bg-yellow-50 p-3">
                  <p className="text-xs text-yellow-800">
                    ⚠️ <strong>주의:</strong> 셀을 병합하면 오른쪽/아래에 있는 셀들이 자동으로
                    숨겨집니다. 병합된 영역만큼의 공간이 필요하므로 테이블 구조를 미리 확인하세요.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* 셀 컨텐츠 정렬 설정 */}
        <div className="mt-6 border-t border-gray-200 pt-6">
          <h3 className="mb-4 text-sm font-medium text-gray-900">📐 컨텐츠 정렬</h3>

          <div className="space-y-4">
            {/* 가로 정렬 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">가로 정렬</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={horizontalAlign === 'left' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setHorizontalAlign('left')}
                  className="flex-1"
                >
                  <AlignLeft className="mr-2 h-4 w-4" />
                  왼쪽
                </Button>
                <Button
                  type="button"
                  variant={horizontalAlign === 'center' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setHorizontalAlign('center')}
                  className="flex-1"
                >
                  <AlignCenter className="mr-2 h-4 w-4" />
                  가운데
                </Button>
                <Button
                  type="button"
                  variant={horizontalAlign === 'right' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setHorizontalAlign('right')}
                  className="flex-1"
                >
                  <AlignRight className="mr-2 h-4 w-4" />
                  오른쪽
                </Button>
              </div>
            </div>

            {/* 세로 정렬 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">세로 정렬</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={verticalAlign === 'top' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVerticalAlign('top')}
                  className="flex-1"
                >
                  <AlignVerticalJustifyStart className="mr-2 h-4 w-4" />
                  위쪽
                </Button>
                <Button
                  type="button"
                  variant={verticalAlign === 'middle' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVerticalAlign('middle')}
                  className="flex-1"
                >
                  <AlignVerticalJustifyCenter className="mr-2 h-4 w-4" />
                  가운데
                </Button>
                <Button
                  type="button"
                  variant={verticalAlign === 'bottom' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVerticalAlign('bottom')}
                  className="flex-1"
                >
                  <AlignVerticalJustifyEnd className="mr-2 h-4 w-4" />
                  아래쪽
                </Button>
              </div>
            </div>

            {/* 미리보기 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">정렬 미리보기</Label>
              <div className="rounded-lg border bg-gray-50 p-4">
                <div
                  className={`flex h-32 w-full rounded border-2 border-dashed border-gray-300 ${
                    horizontalAlign === 'left'
                      ? 'justify-start'
                      : horizontalAlign === 'center'
                        ? 'justify-center'
                        : 'justify-end'
                  } ${
                    verticalAlign === 'top'
                      ? 'items-start'
                      : verticalAlign === 'middle'
                        ? 'items-center'
                        : 'items-end'
                  }`}
                >
                  <div className="rounded bg-blue-500 px-4 py-2 text-sm text-white">컨텐츠</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <div className="flex items-center space-x-2">
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                <span>저장 중...</span>
              </div>
            ) : (
              '저장'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
