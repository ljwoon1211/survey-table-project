'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CheckCircle2, ChevronLeft, ChevronRight, FileText, ListChecks } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTestResponseStore } from '@/stores/test-response-store';
import { DynamicRowGroupConfig, HeaderCell, Question, TableColumn, TableRow } from '@/types/survey';
import { shouldDisplayColumn, shouldDisplayRow } from '@/utils/branch-logic';
import {
  recalculateColspansForVisibleColumns,
  recalculateRowspansForVisibleRows,
} from '@/utils/table-merge-helpers';

import { DynamicRowSelectorModal } from './dynamic-row-selector-modal';
import { InteractiveTableCell } from './interactive-table-cell';

// ── 메모이즈된 서브 컴포넌트 ──

interface SelectorRowProps {
  groupId: string;
  label?: string;
  buttonAlign?: 'left' | 'center' | 'right';
  selectedCount: number;
  colSpan: number;
  onSelect: (groupId: string) => void;
}

const SelectorRow = React.memo(function SelectorRow({
  groupId,
  label,
  buttonAlign,
  selectedCount,
  colSpan,
  onSelect,
}: SelectorRowProps) {
  return (
    <tr className="bg-muted/30 border-b border-gray-300">
      <td
        colSpan={colSpan}
        className={`border-r border-gray-300 p-2 ${
          buttonAlign === 'center' ? 'text-center'
            : buttonAlign === 'right' ? 'text-right'
            : 'text-left'
        }`}
      >
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => onSelect(groupId)}
        >
          <ListChecks className="h-4 w-4" />
          {label || '항목 선택'}
          {selectedCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {selectedCount}개 선택
            </Badge>
          )}
        </Button>
      </td>
    </tr>
  );
});

// ── 메인 컴포넌트 ──

interface InteractiveTableResponseProps {
  questionId: string;
  tableTitle?: string;
  columns?: TableColumn[];
  rows?: TableRow[];
  tableHeaderGrid?: HeaderCell[][];
  value?: Record<string, any>;
  onChange?: (value: Record<string, any>) => void;
  className?: string;
  isTestMode?: boolean;
  allResponses?: Record<string, unknown>;
  allQuestions?: Question[];
  dynamicRowConfigs?: DynamicRowGroupConfig[];
  hideColumnLabels?: boolean;
}

export const InteractiveTableResponse = React.memo(function InteractiveTableResponse({
  questionId,
  tableTitle,
  columns = [],
  rows = [],
  tableHeaderGrid,
  value,
  onChange,
  className,
  isTestMode = false,
  allResponses,
  allQuestions,
  dynamicRowConfigs,
  hideColumnLabels = false,
}: InteractiveTableResponseProps) {
  // Zustand: 현재 질문만 구독 (다른 질문 변경 시 리렌더 방지)
  const updateTestResponse = useTestResponseStore((state) => state.updateTestResponse);
  const testQuestionResponse = useTestResponseStore(
    useCallback((state) => state.testResponses[questionId], [questionId]),
  );
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // 현재 질문의 응답 데이터
  const currentResponse = useMemo(() => {
    if (isTestMode) {
      return typeof testQuestionResponse === 'object' && testQuestionResponse !== null
        ? (testQuestionResponse as Record<string, any>)
        : {};
    }
    return (value || {}) as Record<string, any>;
  }, [isTestMode, testQuestionResponse, value]);

  // displayCondition 기반 가시 열 필터링 + colspan 재계산 (열 → 행 순서)
  const { visibleColumns, columnFilteredRows, visibleHeaderGrid } = useMemo(() => {
    if (!allResponses || !allQuestions || columns.length === 0) {
      return { visibleColumns: columns, columnFilteredRows: rows, visibleHeaderGrid: tableHeaderGrid };
    }

    const hasColumnConditions = columns.some((col) => col.displayCondition);
    if (!hasColumnConditions) {
      return { visibleColumns: columns, columnFilteredRows: rows, visibleHeaderGrid: tableHeaderGrid };
    }

    const visibleColumnIds = new Set<string>();
    for (const col of columns) {
      if (shouldDisplayColumn(col, allResponses, allQuestions)) {
        visibleColumnIds.add(col.id);
      }
    }

    const result = recalculateColspansForVisibleColumns(columns, rows, visibleColumnIds, tableHeaderGrid);
    return {
      visibleColumns: result.columns,
      columnFilteredRows: result.rows,
      visibleHeaderGrid: result.headerGrid,
    };
  }, [columns, rows, tableHeaderGrid, allResponses, allQuestions]);

  // 동적 행 관련 데이터 추출 (다중 그룹)
  const groupConfigMap = useMemo(() => {
    if (!dynamicRowConfigs || !Array.isArray(dynamicRowConfigs)) return new Map<string, DynamicRowGroupConfig>();
    return new Map(dynamicRowConfigs.filter((g) => g.enabled).map((g) => [g.groupId, g]));
  }, [dynamicRowConfigs]);

  const dynamicRows = useMemo(
    () => rows.filter((r) => r.dynamicGroupId && groupConfigMap.has(r.dynamicGroupId)),
    [rows, groupConfigMap],
  );
  const hasDynamicRows = dynamicRows.length > 0;
  const selectedRowIds = useMemo(
    () => (currentResponse?.__selectedRowIds as string[]) || [],
    [currentResponse],
  );

  // displayCondition 기반 가시 행 필터링 + 동적 행 필터링 + rowspan 재계산
  const visibleRows = useMemo(() => {
    if (columnFilteredRows.length === 0) return columnFilteredRows;

    let filtered = columnFilteredRows;

    // 1. displayCondition 필터링
    if (allResponses && allQuestions) {
      const hasConditions = filtered.some((row) => row.displayCondition);
      if (hasConditions) {
        const conditionVisibleIds = new Set<string>();
        for (const row of filtered) {
          if (shouldDisplayRow(row, allResponses, allQuestions)) {
            conditionVisibleIds.add(row.id);
          }
        }
        filtered = filtered.filter((row) => conditionVisibleIds.has(row.id));
      }
    }

    // 2. 동적 행 필터링 (다중 그룹)
    if (hasDynamicRows) {
      const selectedSet = new Set(selectedRowIds);
      // 각 그룹별 선택 여부
      const groupsWithSelections = new Set<string>();
      for (const row of filtered) {
        if (row.dynamicGroupId && selectedSet.has(row.id)) {
          groupsWithSelections.add(row.dynamicGroupId);
        }
      }

      filtered = filtered.filter((row) => {
        if (row.dynamicGroupId && groupConfigMap.has(row.dynamicGroupId)) {
          return selectedSet.has(row.id);
        }
        if (row.showWhenDynamicGroupId && groupConfigMap.has(row.showWhenDynamicGroupId)) {
          return groupsWithSelections.has(row.showWhenDynamicGroupId);
        }
        return true;
      });
    }

    const visibleRowIds = new Set(filtered.map((r) => r.id));
    return recalculateRowspansForVisibleRows(columnFilteredRows, visibleRowIds);
  }, [columnFilteredRows, allResponses, allQuestions, hasDynamicRows, selectedRowIds, groupConfigMap]);

  // 스크롤 인디케이터 - 리스너 등록 (마운트 시 1회)
  const checkScrollState = useCallback(() => {
    if (tableContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tableContainerRef.current;
      setShowLeftShadow(scrollLeft > 10);
      setShowRightShadow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  }, []);

  useEffect(() => {
    const container = tableContainerRef.current;
    if (container) {
      checkScrollState();
      container.addEventListener('scroll', checkScrollState);
      window.addEventListener('resize', checkScrollState);
      return () => {
        container.removeEventListener('scroll', checkScrollState);
        window.removeEventListener('resize', checkScrollState);
      };
    }
  }, [checkScrollState]);

  // 컨텐츠 변경 시 스크롤 상태 재확인
  useEffect(() => {
    checkScrollState();
    // 이미지 등 로드 후 크기 변화 대응
    const timeoutId = setTimeout(checkScrollState, 100);
    return () => clearTimeout(timeoutId);
  }, [visibleColumns.length, visibleRows.length, checkScrollState]);

  // ref 패턴으로 안정적 참조 유지 (useCallback 의존성 안정화)
  const valueRef = useRef(value);
  valueRef.current = value;
  const dynamicRowsRef = useRef(dynamicRows);
  dynamicRowsRef.current = dynamicRows;
  const selectedRowIdsRef = useRef(selectedRowIds);
  selectedRowIdsRef.current = selectedRowIds;

  const updateResponse = useCallback(
    (cellId: string, cellValue: string | string[] | object) => {
      if (isTestMode) {
        const currentState = useTestResponseStore.getState();
        const latestTestResponses = currentState.testResponses;
        const latestResponse =
          typeof latestTestResponses[questionId] === 'object'
            ? latestTestResponses[questionId]
            : {};
        updateTestResponse(questionId, {
          ...(latestResponse as Record<string, any>),
          [cellId]: cellValue,
        });
      } else if (onChange) {
        const latestValue = valueRef.current || {};
        onChange({
          ...(latestValue as Record<string, any>),
          [cellId]: cellValue,
        });
      }
    },
    [isTestMode, questionId, updateTestResponse, onChange],
  );

  // 동적 행 선택 확인 핸들러 (그룹별 머지) - ref 패턴으로 안정적 콜백
  const handleDynamicRowSelect = useCallback(
    (rowIdsFromModal: string[]) => {
      // ref에서 최신 값 읽기
      const currentDynamicRows = dynamicRowsRef.current;
      const currentSelectedRowIds = selectedRowIdsRef.current;

      // 현재 그룹의 행 ID만 교체, 다른 그룹 유지
      const thisGroupRowIds = new Set(
        currentDynamicRows.filter((r) => r.dynamicGroupId === activeGroupId).map((r) => r.id),
      );
      const otherSelections = currentSelectedRowIds.filter((id) => !thisGroupRowIds.has(id));
      const merged = [...otherSelections, ...rowIdsFromModal];

      if (isTestMode) {
        const currentState = useTestResponseStore.getState();
        const latestResponse =
          typeof currentState.testResponses[questionId] === 'object'
            ? currentState.testResponses[questionId]
            : {};
        updateTestResponse(questionId, {
          ...(latestResponse as Record<string, any>),
          __selectedRowIds: merged,
        });
      } else if (onChange) {
        onChange({
          ...((valueRef.current || {}) as Record<string, any>),
          __selectedRowIds: merged,
        });
      }
    },
    [isTestMode, questionId, updateTestResponse, onChange, activeGroupId],
  );

  // 그룹별 셀렉터 앵커 위치 (Map<groupId, anchorRowId>)
  const selectorAnchors = useMemo(() => {
    if (!hasDynamicRows) return new Map<string, string>();
    const anchors = new Map<string, string>();

    for (const [groupId, config] of groupConfigMap) {
      // 1. 설정된 앵커가 visibleRows에 있으면 사용
      if (config.insertAfterRowId && visibleRows.some((r) => r.id === config.insertAfterRowId)) {
        anchors.set(groupId, config.insertAfterRowId);
        continue;
      }
      // 2. 이 그룹의 동적 행 직전의 visible 행
      const groupRows = visibleRows.filter((r) => r.dynamicGroupId === groupId);
      if (groupRows.length > 0) {
        const firstIdx = visibleRows.indexOf(groupRows[0]);
        if (firstIdx > 0) { anchors.set(groupId, visibleRows[firstIdx - 1].id); continue; }
      }
      // 3. 폴백: 원본 rows에서 insertAfterRowId의 위치를 기반으로 가장 가까운 visible 행 찾기
      if (config.insertAfterRowId) {
        const origIdx = rows.findIndex((r) => r.id === config.insertAfterRowId);
        if (origIdx !== -1) {
          // origIdx 이하의 행 중 visibleRows에 있는 마지막 행
          for (let i = origIdx; i >= 0; i--) {
            const found = visibleRows.find((vr) => vr.id === rows[i].id);
            if (found) { anchors.set(groupId, found.id); break; }
          }
        }
      }
      // 4. 최종 폴백: visibleRows의 마지막 비동적 행
      if (!anchors.has(groupId) && visibleRows.length > 0) {
        const lastNonDynamic = [...visibleRows].reverse().find(
          (r) => !r.dynamicGroupId && !r.showWhenDynamicGroupId,
        );
        if (lastNonDynamic) anchors.set(groupId, lastNonDynamic.id);
      }
    }
    return anchors;
  }, [hasDynamicRows, groupConfigMap, visibleRows, rows]);

  // 여러 셀렉터 행 삽입 시 rowspan 보정
  const displayRows = useMemo(() => {
    if (selectorAnchors.size === 0) return visibleRows;

    // 앵커 인덱스 수집 (중복 제거, 정렬)
    const anchorIndices: number[] = [];
    for (const [, anchorId] of selectorAnchors) {
      const idx = visibleRows.findIndex((r) => r.id === anchorId);
      if (idx !== -1) anchorIndices.push(idx);
    }
    const uniqueAnchors = [...new Set(anchorIndices)].sort((a, b) => a - b);
    if (uniqueAnchors.length === 0) return visibleRows;

    return visibleRows.map((row, rowIdx) => {
      const needsAdjust = row.cells.some((cell) => {
        if (cell.isHidden) return false;
        const span = cell.rowspan || 1;
        if (span <= 1) return false;
        return uniqueAnchors.some((ai) => ai >= rowIdx && ai < rowIdx + span - 1);
      });
      if (!needsAdjust) return row;
      return {
        ...row,
        cells: row.cells.map((cell) => {
          if (cell.isHidden) return cell;
          const span = cell.rowspan || 1;
          if (span <= 1) return cell;
          const spanEnd = rowIdx + span;
          const insertedCount = uniqueAnchors.filter((ai) => ai >= rowIdx && ai < spanEnd - 1).length;
          if (insertedCount === 0) return cell;
          return { ...cell, rowspan: span + insertedCount };
        }),
      };
    });
  }, [visibleRows, selectorAnchors]);

  // 행별 셀 값 맵 (해당 행 셀만 추출 → memo 비교용)
  const rowCellValuesMap = useMemo(() => {
    const map = new Map<string, Record<string, any>>();
    for (const row of displayRows) {
      const cellValues: Record<string, any> = {};
      for (const cell of row.cells) {
        if (currentResponse[cell.id] !== undefined) {
          cellValues[cell.id] = currentResponse[cell.id];
        }
      }
      map.set(row.id, cellValues);
    }
    return map;
  }, [displayRows, currentResponse]);

  // 행별 완료 상태 맵
  const rowCompletionMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const row of displayRows) {
      const completed = row.cells.every((cell) => {
        if (['text', 'checkbox', 'radio', 'select', 'input'].includes(cell.type)) {
          const val = currentResponse[cell.id];
          return val !== undefined && val !== null && val !== '';
        }
        return true;
      });
      map.set(row.id, completed);
    }
    return map;
  }, [displayRows, currentResponse]);

  // 그룹별 선택 카운트 맵
  const groupSelectedCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const [groupId] of groupConfigMap) {
      const count = selectedRowIds.filter((id) =>
        rows.find((r) => r.id === id)?.dynamicGroupId === groupId,
      ).length;
      map.set(groupId, count);
    }
    return map;
  }, [groupConfigMap, selectedRowIds, rows]);

  const handleSelectGroup = useCallback((groupId: string) => {
    setActiveGroupId(groupId);
  }, []);

  // 테이블이 비어있는 경우
  if (columns.length === 0 || rows.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <div className="text-center text-gray-500">
            <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />
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
        {displayRows.map((row, rowIndex) => {
          const completed = rowCompletionMap.get(row.id) ?? false;
          // 첫 번째 셀은 보통 행의 제목(Row Header) 역할을 합니다.
          const firstCell = row.cells[0];
          const restCells = row.cells.slice(1);

          return (
            <Card
              key={row.id}
              className={`overflow-hidden transition-all duration-200 ${
                completed
                  ? 'border-green-500 bg-green-50/30 ring-1 ring-green-500'
                  : 'border-gray-200 hover:shadow-md'
              }`}
            >
              <div className={`border-b p-4 ${completed ? 'bg-green-100/50' : 'bg-gray-50/80'}`}>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold text-gray-900">
                    {row.label || `항목 ${rowIndex + 1}`}
                  </div>
                  {completed && (
                    <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-2 py-1 text-sm font-medium text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>완료</span>
                    </div>
                  )}
                </div>
              </div>

              <CardContent className="space-y-6 divide-y divide-dashed divide-gray-200 p-4">
                {/* 모든 셀들을 렌더링 */}
                {row.cells.map((cell, index) => {
                  if (cell.isHidden) return null;
                  // 인덱스를 사용하여 컬럼 라벨 가져옴
                  const columnLabel = visibleColumns[index]?.label || `질문 ${index + 1}`;

                  return (
                    <div
                      key={cell.id}
                      className={`space-y-2 pt-4 first:pt-0 ${index > 0 ? 'mt-2' : ''}`}
                    >
                      {!hideColumnLabels && (
                        <div className="flex items-start gap-2">
                          <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                          <div className="text-sm leading-snug font-semibold text-gray-700">
                            {columnLabel}
                          </div>
                        </div>
                      )}
                      <div
                        className={`flex pl-3.5 ${
                          cell.horizontalAlign === 'left'
                            ? 'justify-start'
                            : cell.horizontalAlign === 'center'
                              ? 'justify-center'
                              : 'justify-end'
                        } ${
                          cell.verticalAlign === 'top'
                            ? 'items-start'
                            : cell.verticalAlign === 'middle'
                              ? 'items-center'
                              : 'items-end'
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
  const scrollTable = useCallback((direction: 'left' | 'right') => {
    if (tableContainerRef.current) {
      const scrollAmount = 300;
      const currentScroll = tableContainerRef.current.scrollLeft;
      tableContainerRef.current.scrollTo({
        left: direction === 'right' ? currentScroll + scrollAmount : currentScroll - scrollAmount,
        behavior: 'smooth',
      });
    }
  }, []);

  // 전체 테이블 너비 계산
  const totalWidth = useMemo(
    () => visibleColumns.reduce((acc, col) => acc + (col.width || 150), 0),
    [visibleColumns],
  );

  // 데스크톱 테이블 뷰 렌더링 (모바일에서도 사용)
  const renderTableView = () => {

    return (
      <div className="group relative">
        {/* 왼쪽 스크롤 버튼 - 모든 화면 크기에서 표시 (터치 불가능한 장치 지원) */}
        {showLeftShadow && (
          <button
            onClick={() => scrollTable('left')}
            className="absolute top-1/2 left-2 z-30 -translate-y-1/2 rounded-full border border-gray-300 bg-white/95 p-2.5 text-gray-700 shadow-lg transition-all hover:bg-gray-50 hover:text-blue-600 active:scale-95"
            aria-label="왼쪽으로 스크롤"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {/* 오른쪽 스크롤 버튼 - 모든 화면 크기에서 표시 */}
        {showRightShadow && (
          <button
            onClick={() => scrollTable('right')}
            className="absolute top-1/2 right-2 z-30 -translate-y-1/2 animate-pulse rounded-full border border-gray-300 bg-white/95 p-2.5 text-gray-700 shadow-lg transition-all hover:animate-none hover:bg-gray-50 hover:text-blue-600 active:scale-95"
            aria-label="오른쪽으로 스크롤"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        {/* 모바일 스크롤 안내 (그림자 오버레이) */}
        {showRightShadow && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-8 bg-gradient-to-l from-black/5 to-transparent md:hidden" />
        )}
        {showLeftShadow && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-8 bg-gradient-to-r from-black/5 to-transparent md:hidden" />
        )}

        {/* 안내 텍스트 - 모바일 전용 */}
        <div className="mb-2 flex items-center justify-end gap-1 px-1 text-xs text-gray-500 md:hidden">
          <span className="animate-pulse">좌우로 스크롤하여 응답해주세요</span>
          <ChevronRight className="h-3 w-3" />
        </div>

        <div
          ref={tableContainerRef}
          className="-mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0"
          style={{
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <table
            className="mx-auto border-separate border-spacing-0 overflow-hidden rounded-lg border-t border-l border-gray-300 bg-white text-base shadow-sm"
            style={{
              tableLayout: 'fixed',
              minWidth: totalWidth ? `${totalWidth}px` : '100%',
              width: totalWidth ? `${totalWidth}px` : '100%',
            }}
          >
            {/* 열 너비 정의 */}
            <colgroup>
              {visibleColumns.map((column, index) => (
                <col key={`col-${index}`} style={{ width: `${column.width || 150}px` }} />
              ))}
            </colgroup>

            {/* 헤더 */}
            {!hideColumnLabels && (
              <thead>
                {visibleHeaderGrid && visibleHeaderGrid.length > 0 ? (
                  // 다단계 헤더
                  visibleHeaderGrid.map((headerRow, rowIdx) => (
                    <tr key={`header-row-${rowIdx}`} className="bg-gray-50">
                      {headerRow.map((cell) => (
                        <th
                          key={cell.id}
                          className="h-full border-r border-b border-gray-300 px-4 py-3 text-center align-middle font-semibold text-gray-800"
                          colSpan={cell.colspan}
                          rowSpan={cell.rowspan}
                        >
                          {cell.label || <span className="text-sm text-gray-400 italic"></span>}
                        </th>
                      ))}
                    </tr>
                  ))
                ) : (
                  // 기존 단일 행 헤더 (폴백)
                  <tr className="bg-gray-50">
                    {visibleColumns.map((column, colIndex) => {
                      if (column.isHeaderHidden) return null;
                      const headerColspan = column.colspan || 1;
                      const mergedWidth = headerColspan > 1
                        ? visibleColumns.slice(colIndex, colIndex + headerColspan).reduce((sum, col) => sum + (col.width || 150), 0)
                        : (column.width || 150);
                      return (
                        <th
                          key={column.id}
                          className="h-full border-r border-b border-gray-300 px-4 py-3 text-center align-middle font-semibold text-gray-800"
                          style={{ width: `${mergedWidth}px` }}
                          colSpan={headerColspan}
                        >
                          {column.label || <span className="text-sm text-gray-400 italic"></span>}
                        </th>
                      );
                    })}
                  </tr>
                )}
              </thead>
            )}

            {/* 본문 */}
            <tbody>
              {displayRows.map((row, rowIndex) => {
                const completed = rowCompletionMap.get(row.id) ?? false;
                return (
                  <React.Fragment key={row.id}>
                  <tr
                    className={`transition-colors hover:bg-blue-50/30 ${
                      completed ? 'bg-green-50/30' : 'bg-white'
                    }`}
                  >
                    {/* 셀들 */}
                    {row.cells.map((cell, cellIndex) => {
                      // rowspan으로 숨겨진 셀은 렌더링하지 않음
                      if (cell.isHidden) return null;

                      // 정렬 클래스 계산 (세로 정렬만 td에 적용)
                      const verticalAlignClass =
                        cell.verticalAlign === 'middle'
                          ? 'align-middle'
                          : cell.verticalAlign === 'bottom'
                            ? 'align-bottom'
                            : 'align-top';

                      return (
                        <td
                          key={cell.id}
                          className={`border-r border-b border-gray-300 p-3 ${verticalAlignClass} relative transition-colors duration-200 ${
                            completed ? '!bg-green-50/40' : ''
                          }`}
                          rowSpan={cell.rowspan || 1}
                          colSpan={cell.colspan || 1}
                        >
                          <div
                            className={`flex w-full flex-col ${
                              cell.verticalAlign === 'top'
                                ? 'justify-start'
                                : cell.verticalAlign === 'middle'
                                  ? 'justify-center'
                                  : 'justify-end'
                            }`}
                          >
                            <div
                              className={`w-full ${
                                cell.horizontalAlign === 'left'
                                  ? 'flex items-start justify-start'
                                  : cell.horizontalAlign === 'center'
                                    ? 'flex items-center justify-center'
                                    : 'flex items-end justify-end'
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
                  {Array.from(selectorAnchors.entries())
                    .filter(([, anchorId]) => anchorId === row.id)
                    .map(([groupId]) => {
                      const config = groupConfigMap.get(groupId);
                      if (!config) return null;
                      return (
                        <SelectorRow
                          key={`selector-${groupId}`}
                          groupId={groupId}
                          label={config.label}
                          buttonAlign={config.buttonAlign}
                          selectedCount={groupSelectedCountMap.get(groupId) ?? 0}
                          colSpan={visibleColumns.length}
                          onSelect={handleSelectGroup}
                        />
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className={className}>
        {tableTitle && (
          <CardHeader>
            <CardTitle className="text-lg font-medium">{tableTitle}</CardTitle>
          </CardHeader>
        )}
        <CardContent className="overflow-hidden p-0 sm:p-6">
          {/* CSS 기반 반응형 처리 -> 모든 화면에서 테이블 뷰 사용 */}
          <div className="w-full">{renderTableView()}</div>

          {isTestMode && (
            <div className="mx-4 mt-4 mb-4 rounded-lg bg-blue-50 p-3 sm:mx-0 sm:mb-0">
              <div className="text-sm text-blue-700">
                <span className="font-medium">테스트 모드:</span> 위 테이블에서 실제로 응답해보세요.
                응답 데이터는 저장되지 않습니다.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {activeGroupId && (
        <DynamicRowSelectorModal
          open={!!activeGroupId}
          onOpenChange={(open) => { if (!open) setActiveGroupId(null); }}
          dynamicRows={dynamicRows.filter((r) => r.dynamicGroupId === activeGroupId)}
          selectedRowIds={selectedRowIds}
          label={groupConfigMap.get(activeGroupId)?.label}
          onConfirm={handleDynamicRowSelect}
        />
      )}
    </>
  );
});
