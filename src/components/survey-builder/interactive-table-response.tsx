"use client";

import React, { useState, useRef, useEffect } from "react";
import { TableColumn, TableRow, TableCell } from "@/types/survey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Image, Video, FileText, ChevronRight, ChevronLeft, CheckCircle2 } from "lucide-react";
import { useSurveyBuilderStore } from "@/stores/survey-store";
import { getProxiedImageUrl } from "@/lib/image-utils";

interface InteractiveTableResponseProps {
  questionId: string;
  tableTitle?: string;
  columns?: TableColumn[];
  rows?: TableRow[];
  value?: Record<string, any>;
  onChange?: (value: Record<string, any>) => void;
  className?: string;
  isTestMode?: boolean;
}

export function InteractiveTableResponse({
  questionId,
  tableTitle,
  columns = [],
  rows = [],
  value,
  onChange,
  className,
  isTestMode = false,
}: InteractiveTableResponseProps) {
  const { updateTestResponse, testResponses } = useSurveyBuilderStore();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 현재 질문의 응답 데이터 가져오기
  // 테스트 모드일 때는 testResponses, 실제 응답 모드일 때는 value 사용
  const currentResponse = (
    isTestMode
      ? typeof testResponses[questionId] === "object"
        ? testResponses[questionId]
        : {}
      : value || {}
  ) as Record<string, any>;

  // 모바일 여부 확인
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 스크롤 인디케이터 업데이트
  useEffect(() => {
    const handleScroll = () => {
      if (tableContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = tableContainerRef.current;
        setShowLeftShadow(scrollLeft > 10);
        setShowRightShadow(scrollLeft < scrollWidth - clientWidth - 10);
      }
    };

    const container = tableContainerRef.current;
    if (container) {
      // 초기 체크
      handleScroll();

      // 스크롤 이벤트 리스너
      container.addEventListener("scroll", handleScroll);

      // 윈도우 리사이즈 시에도 체크
      window.addEventListener("resize", handleScroll);

      // 컨텐츠 로드 후 다시 체크 (이미지 등이 로드되면서 크기가 변할 수 있음)
      const timeoutId = setTimeout(handleScroll, 100);

      return () => {
        container.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleScroll);
        clearTimeout(timeoutId);
      };
    }
  }, [columns, rows]);

  // 행이 완료되었는지 확인
  const isRowCompleted = (row: TableRow) => {
    return row.cells.every((cell) => {
      if (
        cell.type === "text" ||
        cell.type === "checkbox" ||
        cell.type === "radio" ||
        cell.type === "select" ||
        cell.type === "input"
      ) {
        return (
          currentResponse[cell.id] !== undefined &&
          currentResponse[cell.id] !== null &&
          currentResponse[cell.id] !== ""
        );
      }
      return true; // 다른 타입은 완료로 간주
    });
  };

  // 응답 업데이트 함수
  const updateResponse = (cellId: string, cellValue: string | string[] | object) => {
    const updatedResponse = {
      ...currentResponse,
      [cellId]: cellValue,
    };

    if (isTestMode) {
      updateTestResponse(questionId, updatedResponse);
    } else if (onChange) {
      onChange(updatedResponse);
    }
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
        if (typeof item === "object" && item !== null && "optionId" in item) {
          return (item as { optionId: string }).optionId !== optionId;
        }
        return item !== optionId;
      });
    }

    updateResponse(cellId, updatedResponse);
  };

  // 라디오 버튼 변경 핸들러
  const handleRadioChange = (cellId: string, optionId: string, isSelected?: boolean) => {
    // 이미 선택된 항목을 다시 클릭하면 선택 취소
    if (isSelected) {
      updateResponse(cellId, "");
      return;
    }

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
        if (
          typeof item === "object" &&
          item !== null &&
          "optionId" in item &&
          (item as { optionId: string }).optionId === optionId
        ) {
          return { ...item, otherValue };
        }
        return item;
      });
      updateResponse(cellId, updatedResponse);
    } else if (
      typeof currentCellResponse === "object" &&
      currentCellResponse !== null &&
      "optionId" in currentCellResponse &&
      (currentCellResponse as { optionId: string }).optionId === optionId
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
                  if (typeof item === "object" && item !== null && "optionId" in item) {
                    return (item as { optionId: string }).optionId === option.id;
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
                      onChange={() => handleRadioChange(cell.id, option.id, isSelected)}
                      onClick={() => handleRadioChange(cell.id, option.id, isSelected)}
                      className="border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label
                      htmlFor={`${cell.id}-${option.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleRadioChange(cell.id, option.id, isSelected);
                      }}
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
          <div className="flex flex-col items-center gap-2 w-full h-full">
            <img
              src={getProxiedImageUrl(cell.imageUrl)}
              alt="셀 이미지"
              className="w-full h-auto max-h-full object-contain rounded"
              style={{ maxWidth: "100%", maxHeight: "100%" }}
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

      case "input":
        return (
          <div className="space-y-1.5">
            <Input
              type="text"
              value={(cellResponse as string) || ""}
              onChange={(e) => handleTextChange(cell.id, e.target.value)}
              placeholder={cell.placeholder || "답변을 입력하세요..."}
              maxLength={cell.inputMaxLength}
              className="w-full text-sm"
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
        // text 타입은 단순히 텍스트만 표시
        return cell.content ? (
          <div className="whitespace-pre-wrap text-sm">{cell.content}</div>
        ) : (
          <span className="text-gray-400 text-sm"></span>
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

  // 모바일 카드 뷰 렌더링
  const renderMobileCardView = () => {
    return (
      <div className="space-y-4">
        {rows.map((row, rowIndex) => {
          const completed = isRowCompleted(row);
          return (
            <Card key={row.id} className={`${completed ? "border-green-500 border-2" : ""}`}>
              <CardContent className="p-4 space-y-3">
                {completed && (
                  <div className="flex items-center gap-2 text-green-600 text-sm font-medium mb-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>완료</span>
                  </div>
                )}
                {row.cells.map((cell, cellIndex) => {
                  if (cell.isHidden) return null;
                  const columnLabel = columns[cellIndex]?.label || `열 ${cellIndex + 1}`;
                  return (
                    <div key={cell.id} className="space-y-1">
                      <div className="text-sm font-medium text-gray-700">{columnLabel}</div>
                      <div className="pl-2">{renderInteractiveCell(cell, rowIndex)}</div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  // 스크롤 함수
  const scrollTable = (direction: "left" | "right") => {
    if (tableContainerRef.current) {
      const scrollAmount = 300;
      const currentScroll = tableContainerRef.current.scrollLeft;
      tableContainerRef.current.scrollTo({
        left: direction === "right" ? currentScroll + scrollAmount : currentScroll - scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // 데스크톱 테이블 뷰 렌더링
  const renderDesktopTableView = () => {
    return (
      <div className="relative">
        {/* 왼쪽 스크롤 버튼 */}
        {showLeftShadow && (
          <button
            onClick={() => scrollTable("left")}
            className="absolute top-1/2 left-2 -translate-y-1/2 z-30 bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full shadow-lg transition-colors"
            aria-label="왼쪽으로 스크롤"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* 오른쪽 스크롤 버튼 */}
        {showRightShadow && (
          <button
            onClick={() => scrollTable("right")}
            className="absolute top-1/2 right-2 -translate-y-1/2 z-30 bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full shadow-lg animate-pulse hover:animate-none transition-colors"
            aria-label="오른쪽으로 스크롤"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* 안내 텍스트 */}
        {!showLeftShadow && showRightShadow && (
          <div className="mb-2 text-center text-sm text-gray-500 flex items-center justify-center gap-1">
            <ChevronLeft className="w-3 h-3" />
            <span>좌우로 스크롤하여 모든 항목을 확인하세요</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        )}

        <div
          ref={tableContainerRef}
          className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <table
            className="border-collapse border border-gray-300 text-sm"
            style={{ tableLayout: "auto", minWidth: "100%" }}
          >
            {/* 열 너비 정의 */}
            <colgroup>
              {columns.map((column, index) => (
                <col key={`col-${index}`} style={{ width: `${column.width || 150}px` }} />
              ))}
            </colgroup>

            {/* 헤더 */}
            <thead>
              <tr>
                {columns.map((column, colIndex) => (
                  <th
                    key={column.id}
                    className={`border border-gray-300 p-3 bg-gray-50 font-medium text-center ${
                      colIndex === 0
                        ? "sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                        : ""
                    }`}
                    style={{ width: `${column.width || 150}px` }}
                  >
                    {column.label || <span className="text-gray-400 italic text-sm"></span>}
                  </th>
                ))}
              </tr>
            </thead>

            {/* 본문 */}
            <tbody>
              {rows.map((row, rowIndex) => {
                const completed = isRowCompleted(row);
                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-blue-50 transition-colors ${
                      completed ? "bg-green-50" : ""
                    }`}
                  >
                    {/* 셀들 */}
                    {row.cells.map((cell, cellIndex) => {
                      // rowspan으로 숨겨진 셀은 렌더링하지 않음
                      if (cell.isHidden) return null;

                      return (
                        <td
                          key={cell.id}
                          className={`border border-gray-300 p-3 text-center align-top relative ${
                            cellIndex === 0
                              ? "sticky left-0 z-10 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                              : ""
                          } ${completed ? "bg-green-50" : ""}`}
                          rowSpan={cell.rowspan || 1}
                          colSpan={cell.colspan || 1}
                        >
                          {completed && cellIndex === 0 && (
                            <div className="absolute top-2 right-2">
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            </div>
                          )}
                          {renderInteractiveCell(cell, rowIndex)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <Card className={className}>
      {tableTitle && (
        <CardHeader>
          <CardTitle className="text-lg font-medium">{tableTitle}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        {isMobile ? renderMobileCardView() : renderDesktopTableView()}

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
