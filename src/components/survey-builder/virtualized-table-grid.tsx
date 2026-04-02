'use client';

/**
 * 가상화 테이블 Grid — "측정 후 교체" + 행 단위 메모이제이션
 *
 * 성능 핵심:
 * - 각 행을 React.memo로 분리 → visibility 바뀐 행만 리렌더 (O(1))
 * - 뷰포트 밖 행: 캐시된 정확한 높이의 placeholder (지터 0)
 * - CSS Grid 구조 100% 보존 (border, rowspan, colspan)
 */
import React, { useMemo } from 'react';

import { cn } from '@/lib/utils';
import type { CellHeightCache } from '@/hooks/use-cell-height-cache';
import { useCellHeightCache } from '@/hooks/use-cell-height-cache';
import { useRowHeights } from '@/hooks/use-row-heights';
import type { RowVisibilityResult } from '@/hooks/use-row-visibility';
import { useRowVisibility } from '@/hooks/use-row-visibility';
import { useTablePerf } from '@/hooks/use-table-perf';
import type { TableCell, TableColumn, TableRow } from '@/types/survey';
import {
  getAlignmentClasses,
  getGridCellAria,
} from '@/utils/table-grid-utils';

import { InteractiveCell } from './cells';

// ── 행 단위 메모이제이션 컴포넌트 ──

interface VirtualizedRowProps {
  row: TableRow;
  rowIdx: number;
  gridRow: number | undefined;
  completed: boolean;
  visible: boolean;
  cachedHeight: number | undefined;
  estimatedHeight: number;
  questionId: string;
  isTestMode: boolean;
  value?: Record<string, any>;
  onChange?: (value: Record<string, any>) => void;
  sentinelRef: (el: HTMLElement | null) => void;
  measureRef: (el: HTMLElement | null) => void;
}

const VirtualizedRow = React.memo(
  function VirtualizedRow({
    row,
    gridRow,
    completed,
    visible,
    cachedHeight,
    estimatedHeight,
    questionId,
    isTestMode,
    value,
    onChange,
    sentinelRef,
    measureRef,
  }: VirtualizedRowProps) {
    return (
      <>
        {row.cells.map((cell, cellIndex) => {
          if (cell.isHidden) return null;

          const col = cellIndex + 1;
          const rs = cell.rowspan || 1;
          const cs = cell.colspan || 1;
          const isFirstVisibleCell =
            cellIndex === 0 || row.cells.slice(0, cellIndex).every((c) => c.isHidden);

          return (
            <div
              key={cell.id}
              ref={isFirstVisibleCell ? sentinelRef : undefined}
              className={cn(
                'min-w-0 border-r border-b border-gray-300 p-3 transition-colors duration-200',
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
              {visible ? (
                <div ref={isFirstVisibleCell ? measureRef : undefined}>
                  <InteractiveCell
                    cell={cell}
                    questionId={questionId}
                    isTestMode={isTestMode}
                    value={value}
                    onChange={onChange}
                  />
                </div>
              ) : cachedHeight != null ? (
                <div style={{ height: cachedHeight }}>
                  <span className="sr-only">{cell.content}</span>
                </div>
              ) : (
                <div style={{ height: estimatedHeight }}>
                  <span className="sr-only">{cell.content}</span>
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  },
  // 커스텀 비교: visible, completed, row 변경 시에만 리렌더
  (prev, next) =>
    prev.visible === next.visible &&
    prev.completed === next.completed &&
    prev.row === next.row &&
    prev.gridRow === next.gridRow &&
    prev.cachedHeight === next.cachedHeight &&
    prev.value === next.value,
);

// ── Props ──

interface VirtualizedTableGridProps {
  questionId: string;
  displayRows: TableRow[];
  visibleColumns: TableColumn[];
  rowCompletionMap: Map<string, boolean>;
  rowGridMap: Map<string, number>;
  isTestMode?: boolean;
  value?: Record<string, any>;
  onChange?: (value: Record<string, any>) => void;
  renderSelectorRows?: () => React.ReactNode;
  renderHeaderCells?: () => React.ReactNode;
  gridTemplateCols: string;
  totalWidth: number;
}

// ── 메인 컴포넌트 ──

export const VirtualizedTableGrid = React.memo(function VirtualizedTableGrid({
  questionId,
  displayRows,
  visibleColumns,
  rowCompletionMap,
  rowGridMap,
  isTestMode = false,
  value,
  onChange,
  renderSelectorRows,
  renderHeaderCells,
  gridTemplateCols,
  totalWidth,
}: VirtualizedTableGridProps) {
  useTablePerf(`VirtualizedTable(${displayRows.length}×${visibleColumns.length})`);

  const columnWidths = useMemo(
    () => visibleColumns.map((col) => col.width ?? 150),
    [visibleColumns],
  );

  const estimatedHeights = useRowHeights({ displayRows, columnWidths });
  const heightCache = useCellHeightCache(displayRows, columnWidths);
  const { isVisible, sentinelRef } = useRowVisibility(displayRows);

  return (
    <div
      role="grid"
      className="mx-auto overflow-hidden rounded-md border-t border-l border-r border-gray-300 bg-white text-base"
      style={{
        display: 'grid',
        gridTemplateColumns: gridTemplateCols,
        minWidth: totalWidth ? `${totalWidth}px` : '100%',
        width: totalWidth ? `${totalWidth}px` : '100%',
      }}
    >
      {renderHeaderCells?.()}

      {displayRows.map((row, rowIdx) => (
        <VirtualizedRow
          key={row.id}
          row={row}
          rowIdx={rowIdx}
          gridRow={rowGridMap.get(row.id)}
          completed={rowCompletionMap.get(row.id) ?? false}
          visible={isVisible(rowIdx)}
          cachedHeight={heightCache.get(row.id)}
          estimatedHeight={estimatedHeights[rowIdx] ?? 44}
          questionId={questionId}
          isTestMode={isTestMode}
          value={value}
          onChange={onChange}
          sentinelRef={sentinelRef(rowIdx)}
          measureRef={heightCache.measureRef(row.id)}
        />
      ))}

      {renderSelectorRows?.()}
    </div>
  );
});
