"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { TableColumn, TableRow } from "@/types/survey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ChevronRight, ChevronLeft, CheckCircle2 } from "lucide-react";
import { useSurveyBuilderStore } from "@/stores/survey-store";
import { InteractiveTableCell } from "./interactive-table-cell";

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
  // Zustand 선택적 구독으로 변경
  // testResponses 전체를 구독하여 testResponses[questionId] 내부의 속성 변경도 감지
  const updateTestResponse = useSurveyBuilderStore((state) => state.updateTestResponse);
  const testResponses = useSurveyBuilderStore((state) => state.testResponses);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);

  // 현재 질문의 응답 데이터 가져오기
  // 테스트 모드일 때는 testResponses 전체를 의존성으로 사용하여 testResponses[questionId] 내부 변경도 감지
  const currentResponse = useMemo(() => {
    if (isTestMode) {
      const response = testResponses[questionId];
      return typeof response === "object" && response !== null
        ? (response as Record<string, any>)
        : {};
    }
    return (value || {}) as Record<string, any>;
  }, [isTestMode, questionId, testResponses, value]);

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

  // 응답 업데이트 함수 - 스토어에서 직접 최신 상태를 가져와서 클로저 문제 방지
  const updateResponse = useCallback(
    (cellId: string, cellValue: string | string[] | object) => {
      if (isTestMode) {
        // 테스트 모드: 스토어에서 직접 최신 상태를 가져옴
        const currentState = useSurveyBuilderStore.getState();
        const latestTestResponses = currentState.testResponses;
        const latestResponse =
          typeof latestTestResponses[questionId] === "object"
            ? latestTestResponses[questionId]
            : {};
        const updatedResponse = {
          ...(latestResponse as Record<string, any>),
          [cellId]: cellValue,
        };
        updateTestResponse(questionId, updatedResponse);
      } else if (onChange) {
        // 일반 모드: 현재 value를 기반으로 업데이트
        const latestValue = value || {};
        const updatedResponse = {
          ...(latestValue as Record<string, any>),
          [cellId]: cellValue,
        };
        onChange(updatedResponse);
      }
    },
    [isTestMode, questionId, updateTestResponse, onChange, value],
  );


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


  // 모바일 카드 뷰 렌더링
  const renderMobileCardView = () => {
    return (
      <div className="space-y-6">
        {rows.map((row, rowIndex) => {
          const completed = isRowCompleted(row);
          // 첫 번째 셀은 보통 행의 제목(Row Header) 역할을 합니다.
          const firstCell = row.cells[0];
          const restCells = row.cells.slice(1);

          return (
            <Card
              key={row.id}
              className={`overflow-hidden transition-all duration-200 ${
                completed
                  ? "border-green-500 ring-1 ring-green-500 bg-green-50/30"
                  : "hover:shadow-md border-gray-200"
              }`}
            >
              <div className={`p-4 border-b ${completed ? "bg-green-100/50" : "bg-gray-50/80"}`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-lg text-gray-900">
                    {/* 행 라벨을 타이틀로 표시 */}
                    {row.label || `항목 ${rowIndex + 1}`}
                  </div>
                  {completed && (
                    <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium bg-green-100 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>완료</span>
                    </div>
                  )}
                </div>
              </div>

              <CardContent className="p-4 space-y-6 divide-y divide-dashed divide-gray-200">
                {/* 모든 셀들을 렌더링 */}
                {row.cells.map((cell, index) => {
                  if (cell.isHidden) return null;
                  // 인덱스를 사용하여 컬럼 라벨 가져옴
                  const columnLabel = columns[index]?.label || `질문 ${index + 1}`;

                  return (
                    <div
                      key={cell.id}
                      className={`pt-4 first:pt-0 space-y-2 ${index > 0 ? "mt-2" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 mt-2" />
                        <div className="text-sm font-semibold text-gray-700 leading-snug">
                          {columnLabel}
                        </div>
                      </div>
                      <div
                        className={`pl-3.5 flex ${
                          cell.horizontalAlign === "left"
                            ? "justify-start"
                            : cell.horizontalAlign === "center"
                            ? "justify-center"
                            : "justify-end"
                        } ${
                          cell.verticalAlign === "top"
                            ? "items-start"
                            : cell.verticalAlign === "middle"
                            ? "items-center"
                            : "items-end"
                        }`}
                      >
                        <InteractiveTableCell
                          cell={cell}
                          questionId={questionId}
                          isTestMode={isTestMode}
                          value={value}
                          onChange={onChange}
                          onUpdateResponse={updateResponse}
                        />
                      </div>
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

  // 데스크톱 테이블 뷰 렌더링 (모바일에서도 사용)
  const renderTableView = () => {
    // 전체 테이블 너비 계산 (각 열의 너비 합계)
    const totalWidth = columns.reduce((acc, col) => acc + (col.width || 150), 0);

    return (
      <div className="relative group">
        {/* 왼쪽 스크롤 버튼 - 모든 화면 크기에서 표시 (터치 불가능한 장치 지원) */}
        {showLeftShadow && (
          <button
            onClick={() => scrollTable("left")}
            className="absolute top-1/2 left-2 -translate-y-1/2 z-30 bg-white/95 border border-gray-300 text-gray-700 p-2.5 rounded-full shadow-lg transition-all hover:bg-gray-50 active:scale-95 hover:text-blue-600"
            aria-label="왼쪽으로 스크롤"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* 오른쪽 스크롤 버튼 - 모든 화면 크기에서 표시 */}
        {showRightShadow && (
          <button
            onClick={() => scrollTable("right")}
            className="absolute top-1/2 right-2 -translate-y-1/2 z-30 bg-white/95 border border-gray-300 text-gray-700 p-2.5 rounded-full shadow-lg transition-all hover:bg-gray-50 active:scale-95 hover:text-blue-600 animate-pulse hover:animate-none"
            aria-label="오른쪽으로 스크롤"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* 모바일 스크롤 안내 (그림자 오버레이) */}
        {showRightShadow && (
          <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/5 to-transparent pointer-events-none z-20 md:hidden" />
        )}
        {showLeftShadow && (
          <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/5 to-transparent pointer-events-none z-20 md:hidden" />
        )}

        {/* 안내 텍스트 - 모바일 전용 */}
        <div className="md:hidden mb-2 text-xs text-gray-500 flex items-center justify-end gap-1 px-1">
          <span className="animate-pulse">좌우로 스크롤하여 응답해주세요</span>
          <ChevronRight className="w-3 h-3" />
        </div>

        <div
          ref={tableContainerRef}
          className="overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0"
          style={{ 
            WebkitOverflowScrolling: "touch",
          }}
        >
          <table
            className="border-separate border-spacing-0 text-base bg-white mx-auto shadow-sm rounded-lg overflow-hidden border-t border-l border-gray-300"
            style={{
              tableLayout: "fixed",
              minWidth: totalWidth ? `${totalWidth}px` : "100%",
              width: totalWidth ? `${totalWidth}px` : "100%",
            }}
          >
            {/* 열 너비 정의 */}
            <colgroup>
              {columns.map((column, index) => (
                <col key={`col-${index}`} style={{ width: `${column.width || 150}px` }} />
              ))}
            </colgroup>

            {/* 헤더 */}
            <thead>
              <tr className="bg-gray-50">
                {columns.map((column, colIndex) => (
                  <th
                    key={column.id}
                    className="border-b border-r border-gray-300 px-4 py-3 font-semibold text-gray-800 text-center align-middle h-full"
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
                    className={`hover:bg-blue-50/30 transition-colors ${
                      completed ? "bg-green-50/30" : "bg-white"
                    }`}
                  >
                    {/* 셀들 */}
                    {row.cells.map((cell, cellIndex) => {
                      // rowspan으로 숨겨진 셀은 렌더링하지 않음
                      if (cell.isHidden) return null;

                      // 정렬 클래스 계산 (세로 정렬만 td에 적용)
                      const verticalAlignClass =
                        cell.verticalAlign === "middle"
                          ? "align-middle"
                          : cell.verticalAlign === "bottom"
                          ? "align-bottom"
                          : "align-top";

                      return (
                        <td
                          key={cell.id}
                          className={`border-b border-r border-gray-300 p-3 ${verticalAlignClass} relative transition-colors duration-200 ${
                            completed ? "!bg-green-50/40" : ""
                          }`}
                          rowSpan={cell.rowspan || 1}
                          colSpan={cell.colspan || 1}
                        >
                          <div
                            className={`w-full flex flex-col ${
                              cell.verticalAlign === "top"
                                ? "justify-start"
                                : cell.verticalAlign === "middle"
                                ? "justify-center"
                                : "justify-end"
                            }`}
                          >
                            <div
                              className={`w-full ${
                                cell.horizontalAlign === "left"
                                  ? "flex justify-start items-start"
                                  : cell.horizontalAlign === "center"
                                  ? "flex justify-center items-center"
                                  : "flex justify-end items-end"
                              }`}
                            >
                              <InteractiveTableCell
                          cell={cell}
                          questionId={questionId}
                          isTestMode={isTestMode}
                          value={value}
                          onChange={onChange}
                          onUpdateResponse={updateResponse}
                        />
                            </div>
                          </div>
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
      <CardContent className="p-0 sm:p-6 overflow-hidden">
        {/* CSS 기반 반응형 처리 -> 모든 화면에서 테이블 뷰 사용 */}
        <div className="w-full">
          {renderTableView()}
        </div>

        {isTestMode && (
          <div className="mt-4 mx-4 mb-4 sm:mx-0 sm:mb-0 p-3 bg-blue-50 rounded-lg">
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
