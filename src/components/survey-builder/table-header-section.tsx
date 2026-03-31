'use client';

import React from 'react';

import {
  ArrowLeft,
  ArrowRight,
  Combine,
  Eye,
  Settings2,
  Trash2,
  Unlink,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TableColumn } from '@/types/survey';

export interface TableHeaderSectionProps {
  columns: TableColumn[];
  editingColumnWidth: { columnIndex: number; value: string } | null;
  hasQuestions?: boolean;
  onUpdateColumnLabel: (columnIndex: number, label: string) => void;
  onUpdateColumnCode: (columnIndex: number, code: string) => void;
  onMoveColumn: (columnIndex: number, direction: 'left' | 'right') => void;
  onDeleteColumn: (columnIndex: number) => void;
  onMergeColumnHeaders: (columnIndex: number) => void;
  onUnmergeColumnHeader: (columnIndex: number) => void;
  onSetEditingColumnWidth: (value: { columnIndex: number; value: string } | null) => void;
  onColumnWidthChange: (columnIndex: number, width: number) => void;
  onOpenColumnConditionModal?: (columnIndex: number) => void;
}

export function TableHeaderSection({
  columns,
  editingColumnWidth,
  hasQuestions,
  onUpdateColumnLabel,
  onUpdateColumnCode,
  onMoveColumn,
  onDeleteColumn,
  onMergeColumnHeaders,
  onUnmergeColumnHeader,
  onSetEditingColumnWidth,
  onColumnWidthChange,
  onOpenColumnConditionModal,
}: TableHeaderSectionProps) {
  return (
    <thead>
      <tr>
        {/* 행 이름(라벨) 헤더 */}
        <th className="sticky left-0 z-10 w-[120px] min-w-[120px] border border-gray-300 bg-gray-100 p-2">
          <div
            className="truncate text-center text-xs font-semibold text-gray-600"
            title="행 라벨/코드"
          >
            행
          </div>
        </th>

        {columns.map((column, columnIndex) => {
          if (column.isHeaderHidden) return null;

          const headerColspan = column.colspan || 1;
          const isHeaderMerged = headerColspan > 1;
          const mergedWidth = isHeaderMerged
            ? columns
                .slice(columnIndex, columnIndex + headerColspan)
                .reduce((sum, col) => sum + (col.width || 150), 0)
            : (column.width || 150);
          const canMergeRight = columnIndex + headerColspan < columns.length;
          const hasCondition = column.displayCondition && column.displayCondition.conditions.length > 0;

          return (
            <th
              key={column.id}
              className="relative border border-gray-300 bg-gray-50 p-2"
              style={{ width: `${mergedWidth}px` }}
              colSpan={headerColspan}
            >
              <div className="space-y-1">
                {/* 라벨 + 메뉴 버튼 */}
                <div className="flex items-center gap-1">
                  <Input
                    value={column.label}
                    onChange={(e) => onUpdateColumnLabel(columnIndex, e.target.value)}
                    className="h-7 flex-1 border border-gray-200 bg-white text-center text-sm"
                    placeholder="열 제목"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
                        title="열 설정"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1" side="bottom" align="end">
                      <div className="space-y-0.5">
                        {/* 열 코드 */}
                        <div className="px-2 py-1.5">
                          <label className="mb-1 block text-[10px] font-medium text-gray-500">열 코드 (엑셀용)</label>
                          <Input
                            value={column.columnCode || ''}
                            onChange={(e) => onUpdateColumnCode(columnIndex, e.target.value)}
                            className="h-6 bg-gray-50 px-1.5 text-xs"
                            placeholder="열 코드"
                          />
                        </div>

                        {/* 너비 */}
                        <div className="px-2 py-1.5">
                          <label className="mb-1 block text-[10px] font-medium text-gray-500">너비 (px)</label>
                          <Input
                            type="number"
                            min={0}
                            value={editingColumnWidth?.columnIndex === columnIndex
                              ? editingColumnWidth.value
                              : String(column.width || 150)}
                            onChange={(e) => {
                              onSetEditingColumnWidth({ columnIndex, value: e.target.value });
                            }}
                            onBlur={() => {
                              if (editingColumnWidth?.columnIndex === columnIndex) {
                                const width = parseInt(editingColumnWidth.value);
                                if (!isNaN(width) && width >= 0) {
                                  onColumnWidthChange(columnIndex, width);
                                }
                                onSetEditingColumnWidth(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (editingColumnWidth?.columnIndex === columnIndex) {
                                  const width = parseInt(editingColumnWidth.value);
                                  if (!isNaN(width) && width >= 0) {
                                    onColumnWidthChange(columnIndex, width);
                                  }
                                  onSetEditingColumnWidth(null);
                                }
                              }
                            }}
                            onFocus={() => {
                              if (editingColumnWidth?.columnIndex !== columnIndex) {
                                onSetEditingColumnWidth({ columnIndex, value: String(column.width || 150) });
                              }
                            }}
                            className="h-6 bg-gray-50 px-1.5 text-xs"
                          />
                        </div>

                        <div className="my-1 border-t" />

                        {/* 이동 */}
                        <div className="flex gap-0.5 px-1">
                          <button
                            onClick={() => onMoveColumn(columnIndex, 'left')}
                            disabled={columnIndex === 0}
                            className="flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                          >
                            <ArrowLeft className="h-3 w-3" /> 왼쪽
                          </button>
                          <button
                            onClick={() => onMoveColumn(columnIndex, 'right')}
                            disabled={columnIndex === columns.length - 1}
                            className="flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                          >
                            오른쪽 <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>

                        {/* 병합/해제 */}
                        {(canMergeRight || isHeaderMerged) && (
                          <>
                            <div className="my-1 border-t" />
                            {canMergeRight && (
                              <button
                                onClick={() => onMergeColumnHeaders(columnIndex)}
                                className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                              >
                                <Combine className="h-3 w-3" /> 오른쪽 열과 병합
                              </button>
                            )}
                            {isHeaderMerged && (
                              <button
                                onClick={() => onUnmergeColumnHeader(columnIndex)}
                                className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-orange-600 hover:bg-orange-50"
                              >
                                <Unlink className="h-3 w-3" /> 병합 해제
                              </button>
                            )}
                          </>
                        )}

                        {/* 조건부 표시 */}
                        {hasQuestions && onOpenColumnConditionModal && !isHeaderMerged && (
                          <>
                            <div className="my-1 border-t" />
                            <button
                              onClick={() => onOpenColumnConditionModal(columnIndex)}
                              className={`flex w-full items-center gap-2 rounded px-2 py-1 text-xs ${
                                hasCondition
                                  ? 'text-blue-600 hover:bg-blue-50'
                                  : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              <Eye className="h-3 w-3" />
                              {hasCondition ? `조건부 표시 (${column.displayCondition!.conditions.length}개)` : '조건부 표시'}
                            </button>
                          </>
                        )}

                        {/* 삭제 */}
                        {columns.length > 1 && (
                          <>
                            <div className="my-1 border-t" />
                            <button
                              onClick={() => onDeleteColumn(columnIndex)}
                              className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" /> 열 삭제
                            </button>
                          </>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* 요약 정보 (한 줄) */}
                <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400">
                  <span>{column.columnCode || `c${columnIndex + 1}`}</span>
                  {isHeaderMerged && <span className="text-orange-500">🔗{headerColspan}</span>}
                  {hasCondition && <Eye className="h-2.5 w-2.5 text-blue-500" />}
                </div>
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
