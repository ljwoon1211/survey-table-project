"use client";

import React from "react";
import { TableColumn, TableRow, TableCell } from "@/types/survey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Image, Video, FileText } from "lucide-react";
import { useSurveyBuilderStore } from "@/stores/survey-store";

interface InteractiveTableResponseProps {
  questionId: string;
  tableTitle?: string;
  columns?: TableColumn[];
  rows?: TableRow[];
  className?: string;
  isTestMode?: boolean;
}

export function InteractiveTableResponse({
  questionId,
  tableTitle,
  columns = [],
  rows = [],
  className,
  isTestMode = false,
}: InteractiveTableResponseProps) {
  const { updateTestResponse, testResponses } = useSurveyBuilderStore();

  // 현재 질문의 응답 데이터 가져오기
  const currentResponse = testResponses[questionId] || {};

  // 응답 업데이트 함수
  const updateResponse = (cellId: string, value: string | string[] | object) => {
    const updatedResponse = {
      ...currentResponse,
      [cellId]: value,
    };
    updateTestResponse(questionId, updatedResponse);
  };

  // 체크박스 변경 핸들러
  const handleCheckboxChange = (cellId: string, optionId: string, checked: boolean) => {
    const currentCellResponse = currentResponse[cellId] || [];
    let updatedResponse;
    const isOtherOption = optionId === "other-option";

    if (checked) {
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
      updatedResponse = currentCellResponse.filter((item: string | object) => {
        if (typeof item === "object" && item.optionId) {
          return item.optionId !== optionId;
        }
        return item !== optionId;
      });
    }

    updateResponse(cellId, updatedResponse);
  };

  // 라디오 버튼 변경 핸들러
  const handleRadioChange = (cellId: string, optionId: string) => {
    const isOtherOption = optionId === "other-option";
    if (isOtherOption) {
      updateResponse(cellId, {
        optionId,
        otherValue: "",
        hasOther: true,
      });
    } else {
      updateResponse(cellId, optionId);
    }
  };

  // select 변경 핸들러
  const handleSelectChange = (cellId: string, optionId: string) => {
    const isOtherOption = optionId === "other-option";
    if (isOtherOption) {
      updateResponse(cellId, {
        optionId,
        otherValue: "",
        hasOther: true,
      });
    } else {
      updateResponse(cellId, optionId);
    }
  };

  // 기타 옵션 입력 변경 핸들러
  const handleOtherInputChange = (cellId: string, optionId: string, otherValue: string) => {
    const currentCellResponse = currentResponse[cellId];

    if (Array.isArray(currentCellResponse)) {
      // 체크박스의 경우
      const updatedResponse = currentCellResponse.map((item: string | object) => {
        if (typeof item === "object" && item.optionId === optionId) {
          return { ...item, otherValue };
        }
        return item;
      });
      updateResponse(cellId, updatedResponse);
    } else if (
      typeof currentCellResponse === "object" &&
      currentCellResponse.optionId === optionId
    ) {
      // 라디오의 경우
      updateResponse(cellId, { ...currentCellResponse, otherValue });
    }
  };

  // 텍스트 입력 변경 핸들러
  const handleTextChange = (cellId: string, value: string) => {
    updateResponse(cellId, value);
  };

  // 테이블이 비어있는 경우
  if (columns.length === 0 || rows.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <div className="text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>테이블 질문이 구성되지 않았습니다</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 셀 내용 렌더링 함수
  const renderInteractiveCell = (cell: TableCell, rowIndex: number) => {
    if (!cell) return <span className="text-gray-400 text-sm">-</span>;

    const cellResponse = currentResponse[cell.id];

    switch (cell.type) {
      case "checkbox":
        return cell.checkboxOptions && cell.checkboxOptions.length > 0 ? (
          <div className="space-y-2">
            {cell.checkboxOptions.map((option) => {
              const isChecked =
                Array.isArray(cellResponse) &&
                cellResponse.some((item: string | object) => {
                  if (typeof item === "object" && item.optionId) {
                    return item.optionId === option.id;
                  }
                  return item === option.id;
                });

              const otherValue = Array.isArray(cellResponse)
                ? cellResponse.find(
                    (item: string | object) =>
                      typeof item === "object" &&
                      item !== null &&
                      "optionId" in item &&
                      (item as { optionId: string; otherValue?: string }).optionId === option.id,
                  )?.otherValue || ""
                : "";

              return (
                <div key={option.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`${cell.id}-${option.id}`}
                      checked={isChecked}
                      onChange={(e) => handleCheckboxChange(cell.id, option.id, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={!isTestMode}
                    />
                    <label
                      htmlFor={`${cell.id}-${option.id}`}
                      className="text-sm cursor-pointer select-none"
                    >
                      {option.label}
                    </label>
                  </div>
                  {option.id === "other-option" && isChecked && (
                    <div className="ml-6">
                      <Input
                        placeholder="기타 내용 입력..."
                        value={otherValue}
                        onChange={(e) => handleOtherInputChange(cell.id, option.id, e.target.value)}
                        className="text-xs h-8"
                        disabled={!isTestMode}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500">
            <span className="text-sm">체크박스 없음</span>
          </div>
        );

      case "radio":
        return cell.radioOptions && cell.radioOptions.length > 0 ? (
          <div className="space-y-2">
            {cell.radioOptions.map((option) => {
              const isSelected = (() => {
                if (typeof cellResponse === "object" && cellResponse?.optionId) {
                  return cellResponse.optionId === option.id;
                }
                return cellResponse === option.id;
              })();

              const otherValue =
                typeof cellResponse === "object" && cellResponse?.optionId === option.id
                  ? cellResponse.otherValue || ""
                  : "";

              return (
                <div key={option.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id={`${cell.id}-${option.id}`}
                      name={cell.radioGroupName || cell.id}
                      checked={isSelected}
                      onChange={() => handleRadioChange(cell.id, option.id)}
                      className="border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={!isTestMode}
                    />
                    <label
                      htmlFor={`${cell.id}-${option.id}`}
                      className="text-sm cursor-pointer select-none"
                    >
                      {option.label}
                    </label>
                  </div>
                  {option.id === "other-option" && isSelected && (
                    <div className="ml-6">
                      <Input
                        placeholder="기타 내용 입력..."
                        value={otherValue}
                        onChange={(e) => handleOtherInputChange(cell.id, option.id, e.target.value)}
                        className="text-xs h-8"
                        disabled={!isTestMode}
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
          <div className="space-y-2">
            <select
              value={
                typeof cellResponse === "object" && cellResponse?.optionId
                  ? cellResponse.optionId
                  : cellResponse || ""
              }
              onChange={(e) => handleSelectChange(cell.id, e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!isTestMode}
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
                typeof cellResponse === "object" && cellResponse?.optionId
                  ? cellResponse.optionId
                  : cellResponse;
              const isOtherSelected = selectedValue === "other-option";
              const otherValue =
                typeof cellResponse === "object" && cellResponse?.otherValue
                  ? cellResponse.otherValue
                  : "";

              return (
                isOtherSelected && (
                  <div>
                    <Input
                      placeholder="기타 내용 입력..."
                      value={otherValue}
                      onChange={(e) =>
                        handleOtherInputChange(cell.id, "other-option", e.target.value)
                      }
                      className="text-xs h-8"
                      disabled={!isTestMode}
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
          <div className="flex flex-col items-center gap-2">
            <img
              src={cell.imageUrl}
              alt="셀 이미지"
              className="max-w-full max-h-32 object-contain rounded"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                target.nextElementSibling!.classList.remove("hidden");
              }}
            />
            <div className="hidden items-center gap-1 text-red-500 text-sm">
              <Image className="w-4 h-4" />
              <span>이미지 오류</span>
            </div>
            {cell.content && (
              <div className="text-sm text-gray-700 mt-2 text-center">{cell.content}</div>
            )}
          </div>
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
            {cell.content && (
              <div className="text-sm text-gray-700 mt-2 text-center">{cell.content}</div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500">
            <Video className="w-4 h-4" />
            <span className="text-sm">동영상 없음</span>
          </div>
        );

      default:
        // 텍스트 입력이 가능한 셀인지 확인
        if (isTestMode && cell.content.includes("(") && cell.content.includes(")")) {
          return (
            <div className="space-y-2">
              <div className="text-sm">{cell.content.split("(")[0]}</div>
              <input
                type="text"
                value={cellResponse || ""}
                onChange={(e) => handleTextChange(cell.id, e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="입력하세요..."
              />
            </div>
          );
        }

        return cell.content ? (
          <div className="whitespace-pre-wrap text-sm">{cell.content}</div>
        ) : (
          <span className="text-gray-400 text-sm">내용 없음</span>
        );
    }
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

  return (
    <Card className={className}>
      {tableTitle && (
        <CardHeader>
          <CardTitle className="text-lg font-medium">{tableTitle}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            {/* 헤더 */}
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.id}
                    className="border border-gray-300 p-3 bg-gray-50 font-medium text-center min-w-[150px]"
                  >
                    {column.label || (
                      <span className="text-gray-400 italic text-sm">(제목 없음)</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            {/* 본문 */}
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {/* 셀들 */}
                  {row.cells.map((cell) => {
                    // rowspan으로 숨겨진 셀은 렌더링하지 않음
                    if (cell.isHidden) return null;

                    return (
                      <td
                        key={cell.id}
                        className="border border-gray-300 p-3 text-center align-top"
                        rowSpan={cell.rowspan || 1}
                        colSpan={cell.colspan || 1}
                      >
                        {renderInteractiveCell(cell, rowIndex)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isTestMode && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-700">
              <span className="font-medium">테스트 모드:</span> 위 테이블에서 실제로 응답해보세요.
              응답 데이터는 저장되지 않습니다.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
