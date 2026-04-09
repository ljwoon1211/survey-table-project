'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ChevronDown, ChevronLeft, ChevronRight, FileText, ListChecks } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDynamicRowLayout } from '@/hooks/use-dynamic-row-layout';
import { useDynamicRowState } from '@/hooks/use-dynamic-row-state';
import { useMobileView } from '@/hooks/use-media-query';
import { useTablePerf } from '@/hooks/use-table-perf';
import { cn } from '@/lib/utils';
import { DynamicRowGroupConfig, HeaderCell, Question, TableColumn, TableRow } from '@/types/survey';
import { shouldDisplayColumn, shouldDisplayDynamicGroup, shouldDisplayRow } from '@/utils/branch-logic';
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
import { MobileTableStepper } from './mobile-table-stepper';
import { VirtualizedTableGrid } from './virtualized-table-grid';

const VIRTUALIZATION_THRESHOLD = 100;

// ── 셀렉터 행 (동적 행 선택 버튼) ──

interface SelectorRowProps {
  groupId: string;
  label?: string;
  buttonAlign?: 'left' | 'center' | 'right';
  selectedCount: number;
  onSelect: (groupId: string) => void;
  gridRow?: number;
  isExpanded: boolean;
  onToggleExpand: (groupId: string) => void;
}

const SelectorRow = React.memo(function SelectorRow({
  groupId,
  label,
  buttonAlign,
  selectedCount,
  onSelect,
  gridRow,
  isExpanded,
  onToggleExpand,
}: SelectorRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-r border-b border-gray-300 bg-white px-3 py-2',
        buttonAlign === 'center' ? 'justify-center'
          : buttonAlign === 'right' ? 'justify-end'
          : 'justify-start',
      )}
      style={{ gridColumn: '1 / -1', gridRow }}
    >
      {/* 펼침/접힘 chevron — 선택된 행이 있을 때만 토글 */}
      {selectedCount > 0 && (
        <button
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          onClick={(e) => { e.stopPropagation(); onToggleExpand(groupId); }}
          aria-label={isExpanded ? '접기' : '펼치기'}
        >
          <ChevronDown className={cn(
            'h-4 w-4 transition-transform',
            isExpanded ? '' : '-rotate-90',
          )} />
        </button>
      )}

      {/* 그룹 바 본체 — 클릭 시 모달 열기 */}
      <button
        className="flex flex-1 items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-gray-100"
        onClick={() => onSelect(groupId)}
      >
        <ListChecks className="h-3.5 w-3.5 shrink-0 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">
          {label || '항목 선택'}
        </span>
        {selectedCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-200 px-1.5 text-xs font-semibold text-gray-700">
            {selectedCount}
          </span>
        )}
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      </button>
    </div>
  );
});

// ── 공통: 행의 셀들을 CSS Grid 셀로 렌더 ──

interface RenderRowCellsProps {
  row: TableRow;
  gridRow: number | undefined;
  completed: boolean;
  questionId: string;
  isTestMode: boolean;
  value?: Record<string, any>;
  onChange?: (v: Record<string, any>) => void;
}

function renderRowCells({ row, gridRow, completed, questionId, isTestMode, value, onChange }: RenderRowCellsProps) {
  return row.cells.map((cell, cellIndex) => {
    if (cell.isHidden) return null;
    const col = cellIndex + 1;
    const rs = cell.rowspan || 1;
    const cs = cell.colspan || 1;

    return (
      <div
        key={cell.id}
        className={cn(
          'min-w-0 border-r border-b border-gray-300 p-2 transition-colors duration-200',
          completed ? 'bg-green-50/40' : 'bg-white',
          getAlignmentClasses(cell.horizontalAlign, cell.verticalAlign),
        )}
        style={{
          gridRow: rs > 1 ? `${gridRow} / span ${rs}` : gridRow,
          gridColumn: cs > 1 ? `${col} / span ${cs}` : col,
        }}
        data-row-id={row.id}
        data-grid-cell
        {...getGridCellAria('gridcell', cs, rs)}
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
  });
}

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
  // 1) 동적 행 상태 — store 구독, 상태, 핸들러
  const {
    currentResponse,
    groupConfigMap,
    dynamicRows,
    hasDynamicRows,
    selectedRowIds,
    activeGroupId,
    handleSelectGroup,
    handleDynamicRowSelect,
    closeModal,
    expandedGroupIds,
    toggleGroupExpanded,
  } = useDynamicRowState({
    questionId,
    rows,
    dynamicRowConfigs,
    isTestMode,
    value,
    onChange,
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);
  useTablePerf(`InteractiveTable(${rows.length}×${columns.length})`);
  const isMobileView = useMobileView();
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);

  // displayCondition에서 참조하는 질문 ID만 추출 → 관련 응답만 의존
  const relevantResponseKeys = useMemo(() => {
    const ids = new Set<string>();
    const collect = (conditions?: { sourceQuestionId?: string }[]) => {
      if (!conditions) return;
      for (const c of conditions) {
        if (c.sourceQuestionId) ids.add(c.sourceQuestionId);
      }
    };
    for (const col of columns) collect(col.displayCondition?.conditions);
    for (const row of rows) collect(row.displayCondition?.conditions);
    if (dynamicRowConfigs) {
      for (const group of dynamicRowConfigs) collect(group.displayCondition?.conditions);
    }
    return ids;
  }, [columns, rows, dynamicRowConfigs]);

  // 관련 응답만 안정적으로 추출 (JSON 직렬화로 값 비교)
  const relevantResponsesJson = useMemo(() => {
    if (!allResponses || relevantResponseKeys.size === 0) return '';
    const subset: Record<string, unknown> = {};
    for (const key of relevantResponseKeys) {
      if (key in allResponses) subset[key] = allResponses[key];
    }
    return JSON.stringify(subset);
  }, [allResponses, relevantResponseKeys]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, rows, tableHeaderGrid, relevantResponsesJson, allQuestions]);

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
      // 동적 그룹 소속 행은 메인 그리드에서 제외 (아코디언에서 렌더)
      filtered = filtered.filter((row) => {
        if (row.dynamicGroupId && groupConfigMap.has(row.dynamicGroupId)) {
          return false;
        }
        if (row.showWhenDynamicGroupId && groupConfigMap.has(row.showWhenDynamicGroupId)) {
          return false;
        }
        return true;
      });
    }

    const visibleRowIds = new Set(filtered.map((r) => r.id));
    return recalculateRowspansForVisibleRows(columnFilteredRows, visibleRowIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnFilteredRows, relevantResponsesJson, allQuestions, hasDynamicRows, selectedRowIds, groupConfigMap]);

  // 스크롤 인디케이터
  const checkScrollState = useCallback(() => {
    if (tableContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tableContainerRef.current;
      setShowLeftShadow(scrollLeft > 10);
      setShowRightShadow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  }, []);

  useEffect(() => {
    if (isMobileView) return; // 모바일에서는 스크롤 리스너 불필요
    const container = tableContainerRef.current;
    if (!container) return;
    checkScrollState();
    container.addEventListener('scroll', checkScrollState);
    window.addEventListener('resize', checkScrollState);
    return () => {
      container.removeEventListener('scroll', checkScrollState);
      window.removeEventListener('resize', checkScrollState);
    };
  }, [checkScrollState, isMobileView]);

  useEffect(() => {
    if (isMobileView) return;
    checkScrollState();
    const timeoutId = setTimeout(checkScrollState, 100);
    return () => clearTimeout(timeoutId);
  }, [visibleColumns.length, visibleRows.length, checkScrollState, isMobileView]);

  // Grid 관련 계산
  const totalWidth = useMemo(() => calcTotalWidth(visibleColumns), [visibleColumns]);
  const gridTemplateCols = useMemo(() => buildGridTemplateCols(visibleColumns), [visibleColumns]);

  // 헤더 행 수 계산
  const headerRowCount = useMemo(() => {
    if (hideColumnLabels) return 0;
    if (visibleHeaderGrid && visibleHeaderGrid.length > 0) return visibleHeaderGrid.length;
    return 1;
  }, [hideColumnLabels, visibleHeaderGrid]);

  // 그룹 조건부 표시: 숨겨야 할 그룹 ID 집합
  const hiddenGroupIds = useMemo(() => {
    if (!allResponses || !allQuestions || !dynamicRowConfigs) return undefined;
    const hidden = new Set<string>();
    for (const g of dynamicRowConfigs) {
      if (g.enabled && g.displayCondition && !shouldDisplayDynamicGroup(g, allResponses, allQuestions)) {
        hidden.add(g.groupId);
      }
    }
    return hidden.size > 0 ? hidden : undefined;
  }, [dynamicRowConfigs, allResponses, allQuestions]);

  // 3) 동적 행 레이아웃 — selectorAnchors, displayRows, gridMap
  const {
    displayRows,
    selectorAnchors,
    rowGridMap,
    selectorGridMap,
    groupSelectedCountMap,
    expandedGroupRows,
  } = useDynamicRowLayout({
    rows,
    columnFilteredRows,
    visibleRows,
    groupConfigMap,
    selectedRowIds,
    hasDynamicRows,
    headerRowCount,
    expandedGroupIds,
    hiddenGroupIds,
  });

  // 행별 완료 상태 맵 (displayRows + 펼친 그룹 행 포함)
  const rowCompletionMap = useMemo(() => {
    const map = new Map<string, boolean>();
    const checkRow = (row: TableRow) => {
      const completed = row.cells.every((cell) => {
        if (cell._isContinuation) return true;
        if (['text', 'checkbox', 'radio', 'select', 'input'].includes(cell.type)) {
          const val = currentResponse[cell.id];
          return val !== undefined && val !== null && val !== '';
        }
        return true;
      });
      map.set(row.id, completed);
    };
    for (const row of displayRows) checkRow(row);
    for (const groupRows of expandedGroupRows.values()) {
      for (const row of groupRows) checkRow(row);
    }
    return map;
  }, [displayRows, expandedGroupRows, currentResponse]);

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
      // rowspan으로 점유된 열 위치를 추적하여 명시적 gridRow/gridColumn 배치
      // occupied[row][col] = true이면 이전 행의 rowspan에 의해 점유됨
      const totalRows = visibleHeaderGrid.length;
      const occupied = Array.from({ length: totalRows }, () => new Map<number, boolean>());

      return visibleHeaderGrid.flatMap((headerRow, rowIdx) => {
        let col = 1;
        return headerRow.map((cell) => {
          // rowspan으로 점유된 열 건너뛰기
          while (occupied[rowIdx]?.get(col)) col++;

          const startCol = col;
          const cs = cell.colspan || 1;
          const rs = cell.rowspan || 1;

          // 이 셀이 점유하는 영역을 후속 행에 마킹
          if (rs > 1) {
            for (let r = rowIdx + 1; r < rowIdx + rs && r < totalRows; r++) {
              for (let c = startCol; c < startCol + cs; c++) {
                occupied[r].set(c, true);
              }
            }
          }
          col += cs;

          return (
            <div
              key={cell.id}
              className="flex items-center justify-center border-r border-b border-gray-300 bg-gray-50 px-3 py-2 text-center font-semibold text-gray-800"
              style={{
                gridRow: rs > 1 ? `${rowIdx + 1} / span ${rs}` : rowIdx + 1,
                gridColumn: cs > 1 ? `${startCol} / span ${cs}` : startCol,
              }}
              {...getGridCellAria('columnheader', cs, rs)}
            >
              {cell.label || <span className="text-sm text-gray-400 italic" />}
            </div>
          );
        });
      });
    }

    // 단일 행 헤더 (폴백)
    return visibleColumns.map((column) => {
      if (column.isHeaderHidden) return null;
      const headerColspan = column.colspan || 1;
      return (
        <div
          key={column.id}
          className="flex items-center justify-center border-r border-b border-gray-300 bg-gray-50 px-3 py-2 text-center font-semibold text-gray-800"
          style={getGridSpanStyle(headerColspan)}
          {...getGridCellAria('columnheader', headerColspan)}
        >
          {column.label || <span className="text-sm text-gray-400 italic" />}
        </div>
      );
    });
  };

  // 4) 셀렉터 행 + 펼친 그룹 행 렌더링 (가상화/비가상화 공용)
  const renderSelectorRows = useCallback(
    () =>
      Array.from(selectorGridMap.entries()).flatMap(([groupId, selectorGridRow]) => {
        const config = groupConfigMap.get(groupId);
        if (!config) return [];
        // hiddenGroupIds로 이미 grid-row에서 제외됨 — 렌더도 스킵
        if (hiddenGroupIds?.has(groupId)) return [];

        const isExpanded = expandedGroupIds.has(groupId);
        const elements: React.ReactNode[] = [
          <SelectorRow
            key={`selector-${groupId}`}
            groupId={groupId}
            label={config.label}
            buttonAlign={config.buttonAlign}
            selectedCount={groupSelectedCountMap.get(groupId) ?? 0}
            onSelect={handleSelectGroup}
            gridRow={selectorGridRow}
            isExpanded={isExpanded}
            onToggleExpand={toggleGroupExpanded}
          />,
        ];

        // 펼친 그룹의 선택된 행들 렌더
        if (isExpanded) {
          for (const row of expandedGroupRows.get(groupId) ?? []) {
            elements.push(
              <React.Fragment key={row.id}>
                {renderRowCells({
                  row,
                  gridRow: rowGridMap.get(row.id),
                  completed: rowCompletionMap.get(row.id) ?? false,
                  questionId, isTestMode, value, onChange,
                })}
              </React.Fragment>,
            );
          }
        }

        return elements;
      }),
    [selectorGridMap, groupConfigMap, groupSelectedCountMap, handleSelectGroup,
     expandedGroupIds, toggleGroupExpanded, expandedGroupRows, rowGridMap,
     rowCompletionMap, questionId, isTestMode, value, onChange, hiddenGroupIds],
  );

  // ── 가상화 여부 판단 ──
  const shouldVirtualize = displayRows.length >= VIRTUALIZATION_THRESHOLD;

  // ── 데스크톱 Grid 뷰 (30행 미만 — 기존 코드) ──
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
        {shouldVirtualize ? (
          /* 가상화: 동일한 Grid 구조, 뷰포트 밖 셀만 빈 div */
          <VirtualizedTableGrid
            questionId={questionId}
            displayRows={displayRows}
            visibleColumns={visibleColumns}
            rowCompletionMap={rowCompletionMap}
            rowGridMap={rowGridMap}
            isTestMode={isTestMode}
            value={value}
            onChange={onChange}
            gridTemplateCols={gridTemplateCols}
            totalWidth={totalWidth}
            renderHeaderCells={renderHeaderCells}
            renderSelectorRows={renderSelectorRows}
          />
        ) : (
          /* 기존: CSS Grid 테이블 */
          <div
            role="grid"
            className="mx-auto overflow-hidden rounded-md border-t border-l border-r border-gray-300 bg-white text-sm"
            style={{
              display: 'grid',
              gridTemplateColumns: gridTemplateCols,
              minWidth: totalWidth ? `${totalWidth}px` : '100%',
              width: totalWidth ? `${totalWidth}px` : '100%',
            }}
          >
            {/* 헤더 */}
            {renderHeaderCells()}

            {/* 바디 — 명시적 grid-row 배치 */}
            {displayRows.map((row) => (
              <React.Fragment key={row.id}>
                {renderRowCells({
                  row,
                  gridRow: rowGridMap.get(row.id),
                  completed: rowCompletionMap.get(row.id) ?? false,
                  questionId, isTestMode, value, onChange,
                })}
              </React.Fragment>
            ))}

            {/* 셀렉터 행들 — 명시적 grid-row 배치 */}
            {renderSelectorRows()}
          </div>
        )}
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
        <CardContent className={cn('overflow-hidden', isMobileView ? 'p-3 sm:p-4' : 'p-0 sm:p-6')}>
          <div className="w-full">
            {isMobileView ? (
              <MobileTableStepper
                questionId={questionId}
                displayRows={displayRows}
                visibleColumns={visibleColumns}
                visibleHeaderGrid={visibleHeaderGrid}
                currentResponse={currentResponse}
                hideColumnLabels={hideColumnLabels}
                isTestMode={isTestMode}
                value={value}
                onChange={onChange}
                hasDynamicRows={hasDynamicRows}
                selectedRowIds={selectedRowIds}
                groupConfigMap={groupConfigMap}
                onSelectGroup={handleSelectGroup}
              />
            ) : (
              renderTableView()
            )}
          </div>

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
          onOpenChange={(open) => { if (!open) closeModal(); }}
          dynamicRows={dynamicRows.filter((r) => r.dynamicGroupId === activeGroupId)}
          selectedRowIds={selectedRowIds.filter((id) =>
            dynamicRows.some((r) => r.id === id && r.dynamicGroupId === activeGroupId)
          )}
          label={groupConfigMap.get(activeGroupId)?.label}
          onConfirm={handleDynamicRowSelect}
        />
      )}
    </>
  );
});
