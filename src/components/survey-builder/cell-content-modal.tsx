"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableCell, CheckboxOption, RadioOption, QuestionOption } from "@/types/survey";
import { Type, Image, Video, CheckSquare, Circle, ChevronDown } from "lucide-react";

interface CellContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cell: TableCell;
  onSave: (cell: TableCell) => void;
}

export function CellContentModal({ isOpen, onClose, cell, onSave }: CellContentModalProps) {
  const [contentType, setContentType] = useState<
    "text" | "image" | "video" | "checkbox" | "radio" | "select"
  >(cell.type || "text");
  const [textContent, setTextContent] = useState(cell.content || "");
  const [imageUrl, setImageUrl] = useState(cell.imageUrl || "");
  const [videoUrl, setVideoUrl] = useState(cell.videoUrl || "");
  const [checkboxOptions, setCheckboxOptions] = useState<CheckboxOption[]>(
    cell.checkboxOptions || [],
  );
  const [radioOptions, setRadioOptions] = useState<RadioOption[]>(cell.radioOptions || []);
  const [radioGroupName, setRadioGroupName] = useState(cell.radioGroupName || "");
  const [selectOptions, setSelectOptions] = useState<QuestionOption[]>(cell.selectOptions || []);
  const [allowOtherOption, setAllowOtherOption] = useState(cell.allowOtherOption || false);

  // 셀 병합 관련 state
  const [isMergeEnabled, setIsMergeEnabled] = useState(
    (cell.rowspan && cell.rowspan > 1) || (cell.colspan && cell.colspan > 1) || false,
  );
  const [rowspan, setRowspan] = useState<number | "">(cell.rowspan || 1);
  const [colspan, setColspan] = useState<number | "">(cell.colspan || 1);

  // 기타 옵션 관리 상수들
  const OTHER_OPTION_ID = "other-option";
  const OTHER_OPTION_LABEL = "기타";

  // 기타 옵션 헬퍼 함수들
  const addOtherCheckboxOption = (options: CheckboxOption[]) => {
    const hasOtherOption = options.some((option) => option.id === OTHER_OPTION_ID);
    if (!hasOtherOption) {
      return [
        ...options,
        {
          id: OTHER_OPTION_ID,
          label: OTHER_OPTION_LABEL,
          value: "other",
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
          value: "other",
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
          value: "other",
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

    if (contentType === "checkbox") {
      setCheckboxOptions((prev) =>
        enabled ? addOtherCheckboxOption(prev) : removeOtherCheckboxOption(prev),
      );
    } else if (contentType === "radio") {
      setRadioOptions((prev) =>
        enabled ? addOtherRadioOption(prev) : removeOtherRadioOption(prev),
      );
    } else if (contentType === "select") {
      setSelectOptions((prev) =>
        enabled ? addOtherSelectOption(prev) : removeOtherSelectOption(prev),
      );
    }
  };

  const handleSave = () => {
    const updatedCell: TableCell = {
      ...cell,
      type: contentType,
      content: contentType === "text" ? textContent : "",
      imageUrl: contentType === "image" ? imageUrl : undefined,
      videoUrl: contentType === "video" ? videoUrl : undefined,
      checkboxOptions: contentType === "checkbox" ? checkboxOptions : undefined,
      radioOptions: contentType === "radio" ? radioOptions : undefined,
      radioGroupName: contentType === "radio" ? radioGroupName : undefined,
      selectOptions: contentType === "select" ? selectOptions : undefined,
      allowOtherOption: ["checkbox", "radio", "select"].includes(contentType)
        ? allowOtherOption
        : undefined,
      // 셀 병합 속성 추가
      rowspan: isMergeEnabled && typeof rowspan === "number" && rowspan > 1 ? rowspan : undefined,
      colspan: isMergeEnabled && typeof colspan === "number" && colspan > 1 ? colspan : undefined,
    };

    onSave(updatedCell);
  };

  const handleCancel = () => {
    // 원래 값으로 되돌리기
    setContentType(cell.type || "text");
    setTextContent(cell.content || "");
    setImageUrl(cell.imageUrl || "");
    setVideoUrl(cell.videoUrl || "");
    setCheckboxOptions(cell.checkboxOptions || []);
    setRadioOptions(cell.radioOptions || []);
    setRadioGroupName(cell.radioGroupName || "");
    setSelectOptions(cell.selectOptions || []);
    setAllowOtherOption(cell.allowOtherOption || false);
    setIsMergeEnabled(
      (cell.rowspan && cell.rowspan > 1) || (cell.colspan && cell.colspan > 1) || false,
    );
    setRowspan(cell.rowspan || 1);
    setColspan(cell.colspan || 1);
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

  // 이미지 URL 유효성 검사
  const isValidImageUrl = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url) || url.includes("data:image");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>셀 내용 편집</DialogTitle>
        </DialogHeader>

        <Tabs
          value={contentType}
          onValueChange={(value) =>
            setContentType(value as "text" | "image" | "video" | "checkbox" | "radio" | "select")
          }
        >
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="text" className="flex items-center gap-2">
              <Type className="w-4 h-4" />
              텍스트
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              이미지
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              동영상
            </TabsTrigger>
            <TabsTrigger value="checkbox" className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              체크박스
            </TabsTrigger>
            <TabsTrigger value="radio" className="flex items-center gap-2">
              <Circle className="w-4 h-4" />
              라디오
            </TabsTrigger>
            <TabsTrigger value="select" className="flex items-center gap-2">
              <ChevronDown className="w-4 h-4" />
              선택
            </TabsTrigger>
          </TabsList>

          {/* 텍스트 탭 */}
          <TabsContent value="text" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="text-content">텍스트 내용</Label>
              <Textarea
                id="text-content"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="셀에 표시할 텍스트를 입력하세요"
                rows={4}
              />
            </div>
            {textContent && (
              <div className="space-y-2">
                <Label>미리보기</Label>
                <div className="p-3 border rounded-md bg-gray-50">
                  <p className="whitespace-pre-wrap">{textContent}</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* 이미지 탭 */}
          <TabsContent value="image" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="image-url">이미지 URL</Label>
              <Input
                id="image-url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
              <p className="text-sm text-gray-500">지원 형식: JPG, PNG, GIF, WebP, SVG</p>
            </div>
            {imageUrl && (
              <div className="space-y-2">
                <Label>미리보기</Label>
                <div className="p-3 border rounded-md bg-gray-50">
                  {isValidImageUrl(imageUrl) ? (
                    <img
                      src={imageUrl}
                      alt="셀 내용 이미지 미리보기"
                      className="max-w-full max-h-48 object-contain rounded"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        target.nextElementSibling!.textContent = "이미지를 불러올 수 없습니다.";
                      }}
                    />
                  ) : (
                    <p className="text-red-500 text-sm">올바른 이미지 URL을 입력해주세요.</p>
                  )}
                  <p className="text-red-500 text-sm hidden">이미지를 불러올 수 없습니다.</p>
                </div>
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
                <div className="p-3 border rounded-md bg-gray-50">
                  {videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be") ? (
                    <div className="aspect-video">
                      <iframe
                        src={getYouTubeEmbedUrl(videoUrl)}
                        className="w-full h-full rounded"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="동영상 미리보기"
                      />
                    </div>
                  ) : videoUrl.includes("vimeo.com") ? (
                    <div className="aspect-video">
                      <iframe
                        src={videoUrl.replace("vimeo.com/", "player.vimeo.com/video/")}
                        className="w-full h-full rounded"
                        frameBorder="0"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                        title="동영상 미리보기"
                      />
                    </div>
                  ) : videoUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                    <video src={videoUrl} controls className="w-full max-h-48 rounded">
                      동영상을 지원하지 않는 브라우저입니다.
                    </video>
                  ) : (
                    <p className="text-yellow-600 text-sm">
                      동영상 링크를 확인할 수 없습니다. YouTube, Vimeo 또는 직접 동영상 링크인지
                      확인해주세요.
                    </p>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* 체크박스 탭 */}
          <TabsContent value="checkbox" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>체크박스 옵션 관리</Label>
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
              </div>

              <div className="space-y-3">
                {checkboxOptions.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2 p-3 border rounded-md">
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
                    <div className="flex-1">
                      <Input
                        value={option.label}
                        onChange={(e) => {
                          const updated = [...checkboxOptions];
                          updated[index] = { ...option, label: e.target.value };
                          setCheckboxOptions(updated);
                        }}
                        placeholder="옵션 텍스트"
                      />
                      {option.id === OTHER_OPTION_ID && (
                        <p className="text-xs text-blue-600 mt-1">🔹 기타 옵션 (수정 가능)</p>
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
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const newOption: CheckboxOption = {
                    id: `checkbox-${Date.now()}`,
                    label: "새 옵션",
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
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>💡 기타 옵션이 활성화되었습니다.</strong>
                    <br />
                    마지막에 "기타" 체크박스가 자동으로 추가되어 사용자가 직접 텍스트를 입력할 수
                    있습니다.
                  </p>
                </div>
              )}
            </div>
            {checkboxOptions.length > 0 && (
              <div className="space-y-2">
                <Label>미리보기</Label>
                <div className="p-3 border rounded-md bg-gray-50">
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
                          <span className="text-xs text-blue-600 ml-2">(텍스트 입력)</span>
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
              </div>

              <div className="space-y-3">
                {radioOptions.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2 p-3 border rounded-md">
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
                    <div className="flex-1">
                      <Input
                        value={option.label}
                        onChange={(e) => {
                          const updated = [...radioOptions];
                          updated[index] = { ...option, label: e.target.value };
                          setRadioOptions(updated);
                        }}
                        placeholder="옵션 텍스트"
                      />
                      {option.id === OTHER_OPTION_ID && (
                        <p className="text-xs text-blue-600 mt-1">🔹 기타 옵션 (수정 가능)</p>
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
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const newOption: RadioOption = {
                    id: `radio-${Date.now()}`,
                    label: "새 옵션",
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
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>💡 기타 옵션이 활성화되었습니다.</strong>
                    <br />
                    마지막에 "기타" 라디오 버튼이 자동으로 추가되어 사용자가 직접 텍스트를 입력할 수
                    있습니다.
                  </p>
                </div>
              )}
            </div>
            {radioOptions.length > 0 && (
              <div className="space-y-2">
                <Label>미리보기</Label>
                <div className="p-3 border rounded-md bg-gray-50">
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
                          <span className="text-xs text-blue-600 ml-2">(텍스트 입력)</span>
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
              </div>

              <div className="space-y-3">
                {selectOptions.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2 p-3 border rounded-md">
                    <div className="flex-1">
                      <Input
                        value={option.label}
                        onChange={(e) => {
                          const updated = [...selectOptions];
                          updated[index] = { ...option, label: e.target.value };
                          setSelectOptions(updated);
                        }}
                        placeholder="옵션 텍스트"
                      />
                      {option.id === OTHER_OPTION_ID && (
                        <p className="text-xs text-blue-600 mt-1">🔹 기타 옵션 (수정 가능)</p>
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
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const newOption: QuestionOption = {
                    id: `select-${Date.now()}`,
                    label: "새 옵션",
                    value: `option-${selectOptions.length + 1}`,
                  };
                  setSelectOptions((prev) => [...prev, newOption]);
                }}
                className="w-full"
              >
                옵션 추가
              </Button>

              {allowOtherOption && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>💡 기타 옵션이 활성화되었습니다.</strong>
                    <br />
                    마지막에 "기타" 선택 옵션이 자동으로 추가되어 사용자가 직접 텍스트를 입력할 수
                    있습니다.
                  </p>
                </div>
              )}
            </div>
            {selectOptions.length > 0 && (
              <div className="space-y-2">
                <Label>미리보기</Label>
                <div className="p-3 border rounded-md bg-gray-50">
                  <select className="w-full p-2 border rounded">
                    <option value="">선택하세요...</option>
                    {selectOptions.map((option) => (
                      <option key={option.id} value={option.value}>
                        {option.label}
                        {option.id === OTHER_OPTION_ID && " (텍스트 입력)"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* 셀 병합 설정 */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900">📐 셀 병합</h3>
            <div className="flex items-center gap-2">
              <Label htmlFor="merge-toggle" className="text-sm text-gray-600 cursor-pointer">
                {isMergeEnabled ? "활성화됨" : "비활성화됨"}
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
                    if (rowspan === "") setRowspan(1);
                    if (colspan === "") setColspan(1);
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
                      if (value === "") {
                        setRowspan("");
                      } else {
                        const num = parseInt(value);
                        if (!isNaN(num) && num >= 1) {
                          setRowspan(num);
                        }
                      }
                    }}
                    onBlur={() => {
                      if (rowspan === "") {
                        setRowspan(1);
                      }
                    }}
                    className="w-full"
                    placeholder="1"
                  />
                  <p className="text-xs text-gray-500">
                    현재: {rowspan === "" || rowspan === 1 ? "병합 안 함" : `${rowspan}칸 병합`}
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
                      if (value === "") {
                        setColspan("");
                      } else {
                        const num = parseInt(value);
                        if (!isNaN(num) && num >= 1) {
                          setColspan(num);
                        }
                      }
                    }}
                    onBlur={() => {
                      if (colspan === "") {
                        setColspan(1);
                      }
                    }}
                    className="w-full"
                    placeholder="1"
                  />
                  <p className="text-xs text-gray-500">
                    현재: {colspan === "" || colspan === 1 ? "병합 안 함" : `${colspan}칸 병합`}
                  </p>
                </div>
              </div>

              {((typeof rowspan === "number" && rowspan > 1) ||
                (typeof colspan === "number" && colspan > 1)) && (
                <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    ⚠️ <strong>주의:</strong> 셀을 병합하면 오른쪽/아래에 있는 셀들이 자동으로
                    숨겨집니다. 병합된 영역만큼의 공간이 필요하므로 테이블 구조를 미리 확인하세요.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            취소
          </Button>
          <Button onClick={handleSave}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
