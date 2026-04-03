'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Check, CheckCircle2, ChevronLeft, ChevronRight, ListChecks } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { useColumnSectionMap, useRowGroups } from '@/hooks/use-row-groups';
import { cn } from '@/lib/utils';
import type { HeaderCell, TableColumn, TableRow } from '@/types/survey';
import { getAlignmentClasses } from '@/utils/table-grid-utils';

import { InteractiveCell } from './cells';

// ── 상수 ──

const SMALL_TABLE_THRESHOLD = 10;

// ── 타입 ──

interface MobileTableStepperProps {
  questionId: string;
  displayRows: TableRow[];
  visibleColumns: TableColumn[];
  visibleHeaderGrid?: HeaderCell[][] | null;
  currentResponse: Record<string, unknown>;
  hideColumnLabels: boolean;
  isTestMode: boolean;
  value?: Record<string, unknown>;
  onChange?: (value: Record<string, unknown>) => void;
  // 동적 행
  hasDynamicRows: boolean;
  selectedRowIds: string[];
  groupConfigMap: Map<string, unknown>;
  onSelectGroup?: (groupId: string) => void;
}

// ── 유틸 ──

function getRowShortLabel(row: TableRow, idx: number): string {
  const radioCell = row.cells.find(
    (c) => c.type === 'radio' && !c.isHidden && c.radioOptions?.length === 1,
  );
  if (radioCell?.radioOptions?.[0]?.label) {
    const label = radioCell.radioOptions[0].label;
    const match = label.match(/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/);
    return match ? match[0] : `${idx + 1}`;
  }
  if (row.label) {
    return row.label.length > 6 ? row.label.slice(0, 6) + '…' : row.label;
  }
  return `${idx + 1}`;
}

/** 라디오 옵션 1개짜리 셀은 입력이 아닌 라벨 */
function isLabelOnlyRadio(cell: TableRow['cells'][number]): boolean {
  return cell.type === 'radio' && (cell.radioOptions?.length ?? 0) === 1;
}

// ── 카드 렌더러 ──

const RowCard = React.memo(function RowCard({
  row,
  visibleColumns,
  columnSectionMap,
  completed,
  hideColumnLabels,
  questionId,
  isTestMode,
  value,
  onChange,
}: {
  row: TableRow;
  visibleColumns: TableColumn[];
  columnSectionMap: ReturnType<typeof useColumnSectionMap>;
  completed: boolean;
  hideColumnLabels: boolean;
  questionId: string;
  isTestMode: boolean;
  value?: Record<string, unknown>;
  onChange?: (value: Record<string, unknown>) => void;
}) {
  const inputCells = useMemo(
    () =>
      row.cells
        .map((cell, idx) => ({ cell, colIdx: idx }))
        .filter(
          ({ cell }) =>
            !cell.isHidden &&
            !cell._isContinuation &&
            cell.type !== 'text' &&
            cell.type !== 'image' &&
            cell.type !== 'video' &&
            !isLabelOnlyRadio(cell),
        ),
    [row.cells],
  );

  const rowDesc = useMemo(() => {
    const descCell = row.cells.find(
      (c) => c.type === 'radio' && !c.isHidden && c.radioOptions?.length === 1,
    );
    return descCell?.radioOptions?.[0]?.label || row.label;
  }, [row.cells, row.label]);

  let lastSection = '';

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-200',
        completed
          ? 'border-green-400 bg-green-50/30 ring-1 ring-green-400'
          : 'border-gray-200',
      )}
    >
      <div className={cn('border-b px-4 py-3', completed ? 'bg-green-50' : 'bg-gray-50/80')}>
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            {rowDesc && (
              <p className="text-sm font-semibold leading-snug text-gray-900">{rowDesc}</p>
            )}
          </div>
          {completed && (
            <div className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              완료
            </div>
          )}
        </div>
      </div>

      <CardContent className="space-y-4 p-4">
        {inputCells.map(({ cell, colIdx }) => {
          const columnLabel = visibleColumns[colIdx]?.label || `항목 ${colIdx + 1}`;

          let sectionHeader: string | null = null;
          if (columnSectionMap) {
            const section = columnSectionMap.get(colIdx);
            if (section && section !== lastSection) {
              lastSection = section;
              sectionHeader = section;
            }
          }

          return (
            <React.Fragment key={cell.id}>
              {sectionHeader && (
                <div className="flex items-center gap-2 pt-2 first:pt-0">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-semibold text-gray-500">{sectionHeader}</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
              )}
              <div className="space-y-1.5">
                {!hideColumnLabels && (
                  <div className="flex items-start gap-1.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    <span className="text-xs font-medium text-gray-600">{columnLabel}</span>
                  </div>
                )}
                <div
                  className={cn(
                    'pl-3',
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
            </React.Fragment>
          );
        })}
      </CardContent>
    </Card>
  );
});

// ── 메인 컴포넌트 ──

export const MobileTableStepper = React.memo(function MobileTableStepper({
  questionId,
  displayRows,
  visibleColumns,
  visibleHeaderGrid,
  currentResponse,
  hideColumnLabels,
  isTestMode,
  value,
  onChange,
  hasDynamicRows,
  selectedRowIds,
  groupConfigMap,
  onSelectGroup,
}: MobileTableStepperProps) {
  // ── 내부에서 훅으로 계산 (props drilling 제거) ──
  const rowGroups = useRowGroups(displayRows);
  const columnSectionMap = useColumnSectionMap(visibleHeaderGrid);

  const rowCompletionMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const row of displayRows) {
      const completed = row.cells.every((cell) => {
        if (cell._isContinuation) return true;
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

  const [currentGroupIdx, setCurrentGroupIdx] = useState(0);
  const [currentRowInGroup, setCurrentRowInGroup] = useState(0);
  const groupPillsRef = useRef<HTMLDivElement>(null);
  const rowPillsRef = useRef<HTMLDivElement>(null);

  // ── 인덱스 clamp ──
  useEffect(() => {
    if (rowGroups.length === 0) return;
    if (currentGroupIdx >= rowGroups.length) {
      setCurrentGroupIdx(rowGroups.length - 1);
      setCurrentRowInGroup(0);
      return;
    }
    const group = rowGroups[currentGroupIdx];
    if (currentRowInGroup >= group.rows.length) {
      setCurrentRowInGroup(group.rows.length - 1);
    }
  }, [rowGroups, currentGroupIdx, currentRowInGroup]);

  // ── pill 자동 스크롤 ──
  useEffect(() => {
    const el = groupPillsRef.current?.children[currentGroupIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [currentGroupIdx]);

  useEffect(() => {
    const el = rowPillsRef.current?.children[currentRowInGroup] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [currentRowInGroup]);

  // ── 네비게이션 ──
  const hasGroups = rowGroups.length > 1;

  const goPrev = useCallback(() => {
    if (currentRowInGroup > 0) {
      setCurrentRowInGroup((c) => c - 1);
    } else if (hasGroups && currentGroupIdx > 0) {
      const prevGroup = rowGroups[currentGroupIdx - 1];
      setCurrentGroupIdx((c) => c - 1);
      setCurrentRowInGroup(prevGroup.rows.length - 1);
    }
  }, [currentRowInGroup, currentGroupIdx, hasGroups, rowGroups]);

  const goNext = useCallback(() => {
    const group = rowGroups[currentGroupIdx];
    if (!group) return;
    if (currentRowInGroup < group.rows.length - 1) {
      setCurrentRowInGroup((c) => c + 1);
    } else if (hasGroups && currentGroupIdx < rowGroups.length - 1) {
      setCurrentGroupIdx((c) => c + 1);
      setCurrentRowInGroup(0);
    }
  }, [currentRowInGroup, currentGroupIdx, hasGroups, rowGroups]);

  const isFirst = currentRowInGroup === 0 && currentGroupIdx === 0;
  const isLast =
    rowGroups.length > 0 &&
    currentGroupIdx === rowGroups.length - 1 &&
    currentRowInGroup === (rowGroups[rowGroups.length - 1]?.rows.length ?? 1) - 1;

  // ── 소형 테이블 ──
  if (displayRows.length <= SMALL_TABLE_THRESHOLD) {
    return (
      <div className="space-y-4">
        {displayRows.map((row) => (
          <RowCard
            key={row.id}
            row={row}
            visibleColumns={visibleColumns}
            columnSectionMap={columnSectionMap}
            completed={rowCompletionMap.get(row.id) ?? false}
            hideColumnLabels={hideColumnLabels}
            questionId={questionId}
            isTestMode={isTestMode}
            value={value}
            onChange={onChange}
          />
        ))}
      </div>
    );
  }

  // ── 스테퍼 ──
  const currentGroup = rowGroups[currentGroupIdx] || rowGroups[0];
  if (!currentGroup) return null;
  const currentRow = currentGroup.rows[currentRowInGroup];
  if (!currentRow) return null;

  const groupCompletedCount = currentGroup.rows.filter(
    (r) => rowCompletionMap.get(r.id),
  ).length;

  return (
    <div className="space-y-3">
      {hasDynamicRows && onSelectGroup && (
        <button
          onClick={() => {
            const firstGroupId = Array.from(groupConfigMap.keys())[0];
            if (firstGroupId) onSelectGroup(firstGroupId);
          }}
          className="flex w-full items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
        >
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            <span>항목 선택</span>
          </div>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs">
            {selectedRowIds.length}개 선택됨
          </span>
        </button>
      )}

      {hasGroups && (
        <div
          ref={groupPillsRef}
          className="flex gap-1.5 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {rowGroups.map((group, idx) => {
            const isActive = idx === currentGroupIdx;
            const allDone = group.rows.every((r) => rowCompletionMap.get(r.id));
            return (
              <button
                key={idx}
                onClick={() => {
                  setCurrentGroupIdx(idx);
                  setCurrentRowInGroup(0);
                }}
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : allDone
                      ? 'bg-green-50 text-green-700 ring-1 ring-green-300'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                )}
              >
                {allDone && !isActive && <Check className="h-3 w-3" />}
                <span className="max-w-[120px] truncate">{group.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {currentGroup.rows.length > 1 && (
        <div
          ref={rowPillsRef}
          className="flex gap-1 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {currentGroup.rows.map((row, idx) => {
            const isActive = idx === currentRowInGroup;
            const isDone = rowCompletionMap.get(row.id) ?? false;
            const rowLabel = getRowShortLabel(row, idx);
            return (
              <button
                key={row.id}
                onClick={() => setCurrentRowInGroup(idx)}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-all',
                  isActive
                    ? 'bg-gray-800 text-white'
                    : isDone
                      ? 'bg-green-50 text-green-600'
                      : 'bg-gray-100 text-gray-400',
                )}
              >
                {isDone && !isActive ? '✓' : ''}
                {rowLabel}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          {hasGroups && <span className="font-medium text-gray-600">{currentGroup.label}</span>}
          {hasGroups && ' · '}
          {currentRowInGroup + 1} / {currentGroup.rows.length}
        </span>
        <span>
          {groupCompletedCount} / {currentGroup.rows.length} 완료
        </span>
      </div>

      <RowCard
        row={currentRow}
        visibleColumns={visibleColumns}
        columnSectionMap={columnSectionMap}
        completed={rowCompletionMap.get(currentRow.id) ?? false}
        hideColumnLabels={hideColumnLabels}
        questionId={questionId}
        isTestMode={isTestMode}
        value={value}
        onChange={onChange}
      />

      <div className="flex gap-2 pt-1">
        <button
          onClick={goPrev}
          disabled={isFirst}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> 이전
        </button>
        <button
          onClick={goNext}
          disabled={isLast}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          다음 <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});
