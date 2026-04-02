'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CheckCircle2, ChevronLeft, ChevronRight, FileText, ListChecks } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useTestResponseStore } from '@/stores/test-response-store';
import { DynamicRowGroupConfig, HeaderCell, Question, TableColumn, TableRow } from '@/types/survey';
import { shouldDisplayColumn, shouldDisplayRow } from '@/utils/branch-logic';
import {
  buildGridTemplateCols,
  calcTotalWidth,
  getAlignmentClasses,
  getGridCellAria,
  getGridSpanStyle,
} from '@/utils/table-grid-utils';
import {
  recalculateColspansForVisibleColumns,
  recalculateRowspansForVisibleRows,
} from '@/utils/table-merge-helpers';

import { InteractiveCell } from './cells';
import { DynamicRowSelectorModal } from './dynamic-row-selector-modal';

// ── 셀렉터 행 (동적 행 선택 버튼) ──

interface SelectorRowProps {
  groupId: string;
  label?: string;
  buttonAlign?: 'left' | 'center' | 'right';
  selectedCount: number;
  onSelect: (groupId: string) => void;
}

const SelectorRow = React.memo(function SelectorRow({
  groupId,
  label,
  buttonAlign,
  selectedCount,
  onSelect,
}: SelectorRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 bg-white px-4 py-2.5',
        buttonAlign === 'center' ? 'justify-center'
          : buttonAlign === 'right' ? 'justify-end'
          : 'justify-start',
      )}
      style={{ gridColumn: '1 / -1' }}
    >
      <button
        className="group flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-sm text-gray-700 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.98]"
        onClick={() => onSelect(groupId)}
      >
        <ListChecks className="h-3.5 w-3.5 text-gray-400 transition-colors group-hover:text-blue-500" />
        <span className="font-medium">{label || '항목 선택'}</span>
        {selectedCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-semibold text-blue-700">
            {selectedCount}
          </span>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-400" />
      </button>
    </div>
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

  // displayCondition 기반 가시 열 필터링 + colspan 재계산
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

    if (hasDynamicRows) {
      const selectedSet = new Set(selectedRowIds);
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

  // 스크롤 인디케이터
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

  useEffect(() => {
    checkScrollState();
    const timeoutId = setTimeout(checkScrollState, 100);
    return () => clearTimeout(timeoutId);
  }, [visibleColumns.length, visibleRows.length, checkScrollState]);

  // ref 패턴으로 안정적 참조 유지
  const dynamicRowsRef = useRef(dynamicRows);
  dynamicRowsRef.current = dynamicRows;
  const selectedRowIdsRef = useRef(selectedRowIds);
  selectedRowIdsRef.current = selectedRowIds;
  const valueRef = useRef(value);
  valueRef.current = value;

  // 동적 행 선택 확인 핸들러
  const handleDynamicRowSelect = useCallback(
    (rowIdsFromModal: string[]) => {
      const currentDynamicRows = dynamicRowsRef.current;
      const currentSelectedRowIds = selectedRowIdsRef.current;

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

  // 그룹별 셀렉터 앵커 위치
  const selectorAnchors = useMemo(() => {
    if (!hasDynamicRows) return new Map<string, string>();
    const anchors = new Map<string, string>();
    for (const [groupId, config] of groupConfigMap) {
      if (config.insertAfterRowId && visibleRows.some((r) => r.id === config.insertAfterRowId)) {
        anchors.set(groupId, config.insertAfterRowId);
        continue;
      }
      const groupRows = visibleRows.filter((r) => r.dynamicGroupId === groupId);
      if (groupRows.length > 0) {
        const firstIdx = visibleRows.indexOf(groupRows[0]);
        if (firstIdx > 0) { anchors.set(groupId, visibleRows[firstIdx - 1].id); continue; }
      }
      if (config.insertAfterRowId) {
        const origIdx = rows.findIndex((r) => r.id === config.insertAfterRowId);
        if (origIdx !== -1) {
          for (let i = origIdx; i >= 0; i--) {
            const found = visibleRows.find((vr) => vr.id === rows[i].id);
            if (found) { anchors.set(groupId, found.id); break; }
          }
        }
      }
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

  // Grid 관련 계산
  const totalWidth = useMemo(() => calcTotalWidth(visibleColumns), [visibleColumns]);
  const gridTemplateCols = useMemo(() => buildGridTemplateCols(visibleColumns), [visibleColumns]);

  // ── 빈 테이블 ──
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

  // ── 모바일 카드 뷰 ──
  const renderMobileCardView = () => (
    <div className="space-y-6">
      {displayRows.map((row, rowIndex) => {
        const completed = rowCompletionMap.get(row.id) ?? false;
        return (
          <Card
            key={row.id}
            className={cn(
              'overflow-hidden transition-all duration-200',
              completed
                ? 'border-green-500 bg-green-50/30 ring-1 ring-green-500'
                : 'border-gray-200 hover:shadow-md',
            )}
          >
            <div className={cn('border-b p-4', completed ? 'bg-green-100/50' : 'bg-gray-50/80')}>
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
              {row.cells.map((cell, index) => {
                if (cell.isHidden) return null;
                const columnLabel = visibleColumns[index]?.label || `질문 ${index + 1}`;

                return (
                  <div key={cell.id} className={cn('space-y-2 pt-4 first:pt-0', index > 0 && 'mt-2')}>
                    {!hideColumnLabels && (
                      <div className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                        <div className="text-sm leading-snug font-semibold text-gray-700">
                          {columnLabel}
                        </div>
                      </div>
                    )}
                    <div
                      className={cn(
                        'pl-3.5',
                        getAlignmentClasses(cell.horizontalAlign, cell.verticalAlign),
                      )}
                    >
                      <InteractiveCell
                        cell={cell}
                        questionId={questionId}
                        isTestMode={isTestMode}
                        value={value}
                        onChange={onChange}
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

  // ── 스크롤 함수 ──
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

  // ── 헤더 셀 렌더링 ──
  const renderHeaderCells = () => {
    if (hideColumnLabels) return null;

    if (visibleHeaderGrid && visibleHeaderGrid.length > 0) {
      return visibleHeaderGrid.flatMap((headerRow, rowIdx) =>
        headerRow.map((cell) => (
          <div
            key={cell.id}
            className="flex items-center justify-center bg-gray-50 px-4 py-3 text-center font-semibold text-gray-800"
            style={getGridSpanStyle(cell.colspan, cell.rowspan)}
            {...getGridCellAria('columnheader', cell.colspan, cell.rowspan)}
          >
            {cell.label || <span className="text-sm text-gray-400 italic" />}
          </div>
        )),
      );
    }

    // 단일 행 헤더 (폴백)
    return visibleColumns.map((column) => {
      if (column.isHeaderHidden) return null;
      const headerColspan = column.colspan || 1;
      return (
        <div
          key={column.id}
          className="bg-gray-50 px-4 py-3 text-center align-middle font-semibold text-gray-800"
          style={getGridSpanStyle(headerColspan)}
          {...getGridCellAria('columnheader', headerColspan)}
        >
          {column.label || <span className="text-sm text-gray-400 italic" />}
        </div>
      );
    });
  };

  // ── 데스크톱 Grid 뷰 ──
  const renderTableView = () => (
    <div className="group relative">
      {/* 스크롤 버튼 */}
      {showLeftShadow && (
        <button
          onClick={() => scrollTable('left')}
          className="absolute top-1/2 left-2 z-30 -translate-y-1/2 rounded-full border border-gray-300 bg-white/95 p-2.5 text-gray-700 shadow-lg transition-all hover:bg-gray-50 hover:text-blue-600 active:scale-95"
          aria-label="왼쪽으로 스크롤"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {showRightShadow && (
        <button
          onClick={() => scrollTable('right')}
          className="absolute top-1/2 right-2 z-30 -translate-y-1/2 animate-pulse rounded-full border border-gray-300 bg-white/95 p-2.5 text-gray-700 shadow-lg transition-all hover:animate-none hover:bg-gray-50 hover:text-blue-600 active:scale-95"
          aria-label="오른쪽으로 스크롤"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* 모바일 스크롤 그림자 */}
      {showRightShadow && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-8 bg-gradient-to-l from-black/5 to-transparent md:hidden" />
      )}
      {showLeftShadow && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-8 bg-gradient-to-r from-black/5 to-transparent md:hidden" />
      )}

      {/* 모바일 안내 텍스트 */}
      <div className="mb-2 flex items-center justify-end gap-1 px-1 text-xs text-gray-500 md:hidden">
        <span className="animate-pulse">좌우로 스크롤하여 응답해주세요</span>
        <ChevronRight className="h-3 w-3" />
      </div>

      <div
        ref={tableContainerRef}
        className="-mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* CSS Grid 테이블 */}
        <div
          role="grid"
          className="mx-auto overflow-hidden rounded-lg border border-gray-300 bg-gray-300 text-base shadow-sm"
          style={{
            display: 'grid',
            gridTemplateColumns: gridTemplateCols,
            gap: '1px',
            minWidth: totalWidth ? `${totalWidth}px` : '100%',
            width: totalWidth ? `${totalWidth}px` : '100%',
          }}
        >
          {/* 헤더 */}
          {renderHeaderCells()}

          {/* 바디 — flat 렌더링 + 셀렉터 행 삽입 */}
          {displayRows.map((row) => {
            const completed = rowCompletionMap.get(row.id) ?? false;

            return (
              <React.Fragment key={row.id}>
                {/* 행의 셀들 */}
                {row.cells.map((cell) => {
                  if (cell.isHidden) return null;

                  return (
                    <div
                      key={cell.id}
                      className={cn(
                        'min-w-0 p-3 transition-colors duration-200',
                        completed ? 'bg-green-50/40' : 'bg-white',
                        getAlignmentClasses(cell.horizontalAlign, cell.verticalAlign),
                      )}
                      style={getGridSpanStyle(cell.colspan, cell.rowspan)}
                      data-row-id={row.id}
                      {...getGridCellAria('gridcell', cell.colspan, cell.rowspan)}
                    >
                      <InteractiveCell
                        cell={cell}
                        questionId={questionId}
                        isTestMode={isTestMode}
                        value={value}
                        onChange={onChange}
                      />
                    </div>
                  );
                })}

                {/* 이 행 뒤에 삽입되는 셀렉터 행들 */}
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
                        onSelect={handleSelectGroup}
                      />
                    );
                  })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Card className={className}>
        {tableTitle && (
          <CardHeader>
            <CardTitle className="text-lg font-medium">{tableTitle}</CardTitle>
          </CardHeader>
        )}
        <CardContent className="overflow-hidden p-0 sm:p-6">
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
