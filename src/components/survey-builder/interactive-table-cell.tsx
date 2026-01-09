"use client";

import React, { useCallback, useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { TableCell } from "@/types/survey";
import { Input } from "@/components/ui/input";
import { Image, Video } from "lucide-react";
import { useSurveyBuilderStore } from "@/stores/survey-store";
import { getProxiedImageUrl } from "@/lib/image-utils";

// 이미지 셀 컴포넌트 (에러 상태 관리)
function ImageCell({ imageUrl, content }: { imageUrl: string; content?: string }) {
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    setError(false);
  }, [imageUrl]);

  return (
    <div className="flex flex-col items-center gap-2 w-full h-full">
      <div key={imageUrl}>
        {error ? (
          <div className="flex items-center gap-1 text-red-500 text-sm">
            <Image className="w-4 h-4" />
            <span>이미지 오류</span>
          </div>
        ) : (
          <img
            src={getProxiedImageUrl(imageUrl)}
            alt="셀 이미지"
            className="w-full h-auto max-h-full object-contain rounded"
            style={{ maxWidth: "100%", maxHeight: "100%" }}
            onError={() => setError(true)}
          />
        )}
      </div>
      {content && <div className="text-sm text-gray-700 mt-2 text-left">{content}</div>}
    </div>
  );
}

interface InteractiveTableCellProps {
  cell: TableCell;
  questionId: string;
  isTestMode: boolean;
  value?: Record<string, any>;
  onChange?: (value: Record<string, any>) => void;
  onUpdateResponse: (cellId: string, cellValue: string | string[] | object) => void;
}

// YouTube URL을 임베드 URL로 변환
function getYouTubeEmbedUrl(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }
  return url;
}

export function InteractiveTableCell({
  cell,
  questionId,
  isTestMode,
  value,
  onChange,
  onUpdateResponse,
}: InteractiveTableCellProps) {
  // 테스트 모드에서 Zustand store 직접 구독
  const questionResponse = useSurveyBuilderStore((state) => 
    state.testResponses[questionId]
  );

  // store에서 가져온 셀 응답
  const storeResponse = isTestMode
    ? (() => {
        if (typeof questionResponse === "object" && questionResponse !== null) {
          return (questionResponse as Record<string, any>)[cell.id];
        }
        return undefined;
      })()
    : value?.[cell.id];

  // 로컬 상태로 UI 즉시 반응 보장
  const [localResponse, setLocalResponse] = useState(storeResponse);
  
  // store 응답이 변경되면 로컬 상태 동기화
  useEffect(() => {
    setLocalResponse(storeResponse);
  }, [storeResponse]);

  // 실제 사용할 응답 (로컬 상태 우선)
  const cellResponse = localResponse;

  // 체크박스 변경 핸들러
  const handleCheckboxChange = useCallback(
    (optionId: string, checked: boolean) => {
      const currentCellResponse = (Array.isArray(cellResponse) ? cellResponse : []) as (
        | string
        | { optionId: string; otherValue?: string; hasOther?: boolean }
      )[];
      let updatedResponse: (string | { optionId: string; otherValue?: string; hasOther?: boolean })[];
      const isOtherOption = optionId === "other-option";

      if (checked) {
        // 최대 선택 개수 체크
        const maxSelections = cell.maxSelections;
        if (maxSelections !== undefined && maxSelections > 0) {
          const currentCount = currentCellResponse.length;
          if (currentCount >= maxSelections) {
            return;
          }
        }

        if (isOtherOption) {
          updatedResponse = [
            ...currentCellResponse,
            {
              optionId,
              otherValue: "",
              hasOther: true,
            },
          ];
        } else {
          updatedResponse = [...currentCellResponse, optionId];
        }
      } else {
        updatedResponse = currentCellResponse.filter((item) => {
          if (typeof item === "object" && item !== null && "optionId" in item) {
            return (item as { optionId: string }).optionId !== optionId;
          }
          return item !== optionId;
        });
      }

      setLocalResponse(updatedResponse); // 로컬 상태 먼저 업데이트
      onUpdateResponse(cell.id, updatedResponse);
    },
    [cell.id, cell.maxSelections, cellResponse, onUpdateResponse],
  );

  // 라디오 버튼 변경 핸들러
  const handleRadioChange = useCallback(
    (optionId: string) => {
      // 현재 선택 상태 확인
      const isCurrentlySelected = (() => {
        if (typeof cellResponse === "object" && cellResponse?.optionId) {
          return (cellResponse as { optionId: string }).optionId === optionId;
        }
        return cellResponse === optionId;
      })();

      // 이미 선택된 항목을 다시 클릭하면 선택 취소
      if (isCurrentlySelected) {
        // flushSync로 동기 업데이트 강제 (React 18 자동 배칭 문제 해결)
        flushSync(() => {
          setLocalResponse("");
        });
        onUpdateResponse(cell.id, "");
        return;
      }

      const isOtherOption = optionId === "other-option";
      if (isOtherOption) {
        const newValue = {
          optionId,
          otherValue: "",
          hasOther: true,
        };
        flushSync(() => {
          setLocalResponse(newValue);
        });
        onUpdateResponse(cell.id, newValue);
      } else {
        flushSync(() => {
          setLocalResponse(optionId);
        });
        onUpdateResponse(cell.id, optionId);
      }
    },
    [cell.id, cellResponse, onUpdateResponse],
  );

  // select 변경 핸들러
  const handleSelectChange = useCallback(
    (optionId: string) => {
      const isOtherOption = optionId === "other-option";
      if (isOtherOption) {
        const newValue = {
          optionId,
          otherValue: "",
          hasOther: true,
        };
        setLocalResponse(newValue); // 로컬 상태 먼저 업데이트
        onUpdateResponse(cell.id, newValue);
      } else {
        setLocalResponse(optionId); // 로컬 상태 먼저 업데이트
        onUpdateResponse(cell.id, optionId);
      }
    },
    [cell.id, onUpdateResponse],
  );

  // 기타 옵션 입력 변경 핸들러
  const handleOtherInputChange = useCallback(
    (optionId: string, otherValue: string) => {
      if (Array.isArray(cellResponse)) {
        // 체크박스의 경우
        const updatedResponse = (cellResponse as (string | { optionId: string; otherValue?: string })[]).map(
          (item) => {
            if (typeof item === "object" && item !== null && "optionId" in item && item.optionId === optionId) {
              return { ...item, otherValue };
            }
            return item;
          },
        );
        setLocalResponse(updatedResponse); // 로컬 상태 먼저 업데이트
        onUpdateResponse(cell.id, updatedResponse);
      } else if (
        typeof cellResponse === "object" &&
        cellResponse !== null &&
        "optionId" in cellResponse &&
        (cellResponse as { optionId: string }).optionId === optionId
      ) {
        // 라디오의 경우
        const newValue = { ...(cellResponse as { optionId: string; otherValue?: string }), otherValue };
        setLocalResponse(newValue); // 로컬 상태 먼저 업데이트
        onUpdateResponse(cell.id, newValue);
      }
    },
    [cell.id, cellResponse, onUpdateResponse],
  );

  // 텍스트 입력 변경 핸들러
  const handleTextChange = useCallback(
    (textValue: string) => {
      setLocalResponse(textValue); // 로컬 상태 먼저 업데이트
      onUpdateResponse(cell.id, textValue);
    },
    [cell.id, onUpdateResponse],
  );

  if (!cell) return <span className="text-gray-400 text-sm">-</span>;

  switch (cell.type) {
    case "checkbox":
      if (!cell.checkboxOptions || cell.checkboxOptions.length === 0) {
        return (
          <div className="flex items-center gap-2 text-gray-500">
            <span className="text-sm">체크박스 없음</span>
          </div>
        );
      }

      const cellResponseArray = Array.isArray(cellResponse) ? cellResponse : [];
      const currentCount = cellResponseArray.length;
      const maxSelections = cell.maxSelections;
      const minSelections = cell.minSelections;
      const isMaxReached =
        maxSelections !== undefined && maxSelections > 0 && currentCount >= maxSelections;
      const isMinNotMet = minSelections !== undefined && minSelections > 0 && currentCount < minSelections;

      const canSelect = (optionId: string) => {
        const isChecked = cellResponseArray.some((item) => {
          if (typeof item === "object" && item !== null && "optionId" in item) {
            return (item as { optionId: string }).optionId === optionId;
          }
          return item === optionId;
        });
        if (isChecked) return true;
        if (isMaxReached) return false;
        return true;
      };

      return (
        <div className="space-y-2 w-full">
          {/* 셀 텍스트 설명 (있는 경우) */}
          {cell.content && cell.content.trim() && (
            <div className="text-sm text-gray-700 mb-3 font-medium whitespace-pre-wrap break-words">
              {cell.content}
            </div>
          )}
          
          {cell.checkboxOptions.map((option) => {
            const isChecked = cellResponseArray.some((item) => {
              if (typeof item === "object" && item !== null && "optionId" in item) {
                return (item as { optionId: string }).optionId === option.id;
              }
              return item === option.id;
            });

            const otherValue =
              (cellResponseArray.find(
                (item) =>
                  typeof item === "object" &&
                  item !== null &&
                  "optionId" in item &&
                  (item as { optionId: string; otherValue?: string }).optionId === option.id,
              ) as { optionId: string; otherValue?: string } | undefined)?.otherValue || "";

            const disabled = !canSelect(option.id);

            return (
              <div key={option.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`${cell.id}-${option.id}`}
                    checked={isChecked}
                    disabled={disabled}
                    onChange={(e) => handleCheckboxChange(option.id, e.target.checked)}
                    className={`rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${
                      disabled ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  />
                  <label
                    htmlFor={`${cell.id}-${option.id}`}
                    className={`text-base select-none ${
                      disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    {option.label}
                  </label>
                </div>
                {option.id === "other-option" && isChecked && (
                  <div className="ml-6">
                    <Input
                      placeholder="기타 내용 입력..."
                      value={otherValue}
                      onChange={(e) => handleOtherInputChange(option.id, e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                )}
              </div>
            );
          })}

          {(maxSelections !== undefined || minSelections !== undefined) && (
            <div className="pt-2 border-t border-gray-200 mt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">
                  {maxSelections !== undefined && maxSelections > 0
                    ? `${currentCount}/${maxSelections}개 선택됨`
                    : `${currentCount}개 선택됨`}
                </span>
                {isMinNotMet && <span className="text-orange-600">최소 {minSelections}개 이상</span>}
                {isMaxReached && <span className="text-blue-600">최대 도달</span>}
              </div>
            </div>
          )}
        </div>
      );

    case "radio":
      return cell.radioOptions && cell.radioOptions.length > 0 ? (
        <div className="space-y-2 w-full">
          {/* 셀 텍스트 설명 (있는 경우) */}
          {cell.content && cell.content.trim() && (
            <div className="text-sm text-gray-700 mb-3 font-medium whitespace-pre-wrap break-words">
              {cell.content}
            </div>
          )}
          
          {cell.radioOptions.map((option) => {
            const isSelected = (() => {
              if (typeof cellResponse === "object" && cellResponse?.optionId) {
                return (cellResponse as { optionId: string }).optionId === option.id;
              }
              return cellResponse === option.id;
            })();

            const otherValue =
              typeof cellResponse === "object" &&
              (cellResponse as { optionId: string; otherValue?: string })?.optionId === option.id
                ? (cellResponse as { optionId: string; otherValue?: string }).otherValue || ""
                : "";

            return (
              <div key={option.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id={`${cell.id}-${option.id}`}
                    // name 속성을 제거하여 브라우저의 자동 그룹핑 방지 (React가 상태로 완전 제어)
                    checked={isSelected}
                    onChange={() => {}} // React controlled component 경고 방지용 (실제 처리는 onClick에서)
                    onClick={() => handleRadioChange(option.id)}
                    className="border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label 
                    htmlFor={`${cell.id}-${option.id}`} 
                    className="text-base cursor-pointer select-none"
                  >
                    {option.label}
                  </label>
                </div>
                {option.id === "other-option" && isSelected && (
                  <div className="ml-6">
                    <Input
                      placeholder="기타 내용 입력..."
                      value={otherValue}
                      onChange={(e) => handleOtherInputChange(option.id, e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-gray-500">
          <span className="text-sm">라디오 버튼 없음</span>
        </div>
      );

    case "select":
      return cell.selectOptions && cell.selectOptions.length > 0 ? (
        <div className="space-y-2 w-full flex flex-col">
          {/* 셀 텍스트 설명 (있는 경우) */}
          {cell.content && cell.content.trim() && (
            <div className="text-sm text-gray-700 mb-2 font-medium whitespace-pre-wrap break-words">
              {cell.content}
            </div>
          )}
          
          <select
            value={
              typeof cellResponse === "object" && (cellResponse as { optionId?: string })?.optionId
                ? (cellResponse as { optionId: string }).optionId
                : (cellResponse as string) || ""
            }
            onChange={(e) => handleSelectChange(e.target.value)}
            className="w-full p-2 text-base border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">선택하세요...</option>
            {cell.selectOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          {(() => {
            const selectedValue =
              typeof cellResponse === "object" && (cellResponse as { optionId?: string })?.optionId
                ? (cellResponse as { optionId: string }).optionId
                : (cellResponse as string);
            const isOtherSelected = selectedValue === "other-option";
            const otherValue =
              typeof cellResponse === "object" && (cellResponse as { otherValue?: string })?.otherValue
                ? (cellResponse as { otherValue: string }).otherValue
                : "";

            return (
              isOtherSelected && (
                <div>
                  <Input
                    placeholder="기타 내용 입력..."
                    value={otherValue}
                    onChange={(e) => handleOtherInputChange("other-option", e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              )
            );
          })()}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-gray-500">
          <span className="text-sm">선택 옵션 없음</span>
        </div>
      );

    case "image":
      return cell.imageUrl ? (
        <ImageCell imageUrl={cell.imageUrl} content={cell.content} />
      ) : (
        <div className="flex items-center gap-2 text-gray-500">
          <Image className="w-4 h-4" />
          <span className="text-sm">이미지 없음</span>
        </div>
      );

    case "video":
      return cell.videoUrl ? (
        <div className="flex flex-col items-center gap-2">
          {cell.videoUrl.includes("youtube.com") || cell.videoUrl.includes("youtu.be") ? (
            <div className="w-full max-w-xs">
              <div className="aspect-video">
                <iframe
                  src={getYouTubeEmbedUrl(cell.videoUrl)}
                  className="w-full h-full rounded"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="테이블 동영상"
                />
              </div>
            </div>
          ) : cell.videoUrl.includes("vimeo.com") ? (
            <div className="w-full max-w-xs">
              <div className="aspect-video">
                <iframe
                  src={cell.videoUrl.replace("vimeo.com/", "player.vimeo.com/video/")}
                  className="w-full h-full rounded"
                  frameBorder="0"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  title="테이블 동영상"
                />
              </div>
            </div>
          ) : cell.videoUrl.match(/\.(mp4|webm|ogg)$/i) ? (
            <video src={cell.videoUrl} controls className="w-full max-w-xs max-h-32 rounded">
              동영상을 지원하지 않는 브라우저입니다.
            </video>
          ) : (
            <div className="flex items-center gap-2 text-yellow-600">
              <Video className="w-4 h-4" />
              <span className="text-sm">동영상 링크 오류</span>
            </div>
          )}
          {cell.content && <div className="text-sm text-gray-700 mt-2 text-left">{cell.content}</div>}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-gray-500">
          <Video className="w-4 h-4" />
          <span className="text-sm">동영상 없음</span>
        </div>
      );

    case "input":
      return (
        <div className="space-y-1.5 w-full flex flex-col">
          {/* 셀 텍스트 설명 (있는 경우) */}
          {cell.content && cell.content.trim() && (
            <div className="text-sm text-gray-700 mb-2 font-medium whitespace-pre-wrap break-words">
              {cell.content}
            </div>
          )}
          
          <Input
            type="text"
            value={(cellResponse as string) || ""}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={cell.placeholder || "답변을 입력하세요..."}
            maxLength={cell.inputMaxLength}
            className="w-full text-base"
          />
          {cell.inputMaxLength && (
            <div className="flex justify-end">
              <p className="text-xs text-gray-500">
                <span
                  className={
                    ((cellResponse as string) || "").length >= cell.inputMaxLength
                      ? "text-red-500 font-medium"
                      : ""
                  }
                >
                  {((cellResponse as string) || "").length}
                </span>
                {" / "}
                {cell.inputMaxLength}자
              </p>
            </div>
          )}
        </div>
      );

    case "text":
    default:
      return cell.content ? (
        <div className="whitespace-pre-wrap text-base leading-relaxed break-words w-full">
          {cell.content}
        </div>
      ) : (
        <span className="text-gray-400 text-sm"></span>
      );
  }
}
