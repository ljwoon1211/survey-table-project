'use client';

import {
  ArrowLeft,
  ArrowRight,
  Combine,
  Eye,
  Trash2,
  Unlink,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
        <th className="sticky left-0 z-10 w-[70px] min-w-[70px] border border-gray-300 bg-gray-100 p-2">
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

          return (
            <th
              key={column.id}
              className="relative border border-gray-300 bg-gray-50 p-2"
              style={{ width: `${mergedWidth}px` }}
              colSpan={headerColspan}
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <Input
                      value={column.label}
                      onChange={(e) => onUpdateColumnLabel(columnIndex, e.target.value)}
                      className="h-8 border border-gray-200 bg-white text-center text-sm"
                      placeholder="열 제목"
                    />
                    <Input
                      value={column.columnCode || ''}
                      onChange={(e) => onUpdateColumnCode(columnIndex, e.target.value)}
                      className="h-5 border-none bg-gray-100 px-1 text-center text-[10px] text-gray-600 focus-visible:ring-0"
                      placeholder="열 코드 (엑셀용)"
                    />
                  </div>
                  <div className="flex items-center">
                    <Button
                      onClick={() => onMoveColumn(columnIndex, 'left')}
                      disabled={columnIndex === 0}
                      size="sm"
                      variant="ghost"
                      className="h-6 w-5 p-0 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      title="왼쪽으로 이동"
                    >
                      <ArrowLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      onClick={() => onMoveColumn(columnIndex, 'right')}
                      disabled={columnIndex === columns.length - 1}
                      size="sm"
                      variant="ghost"
                      className="h-6 w-5 p-0 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      title="오른쪽으로 이동"
                    >
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                    {columns.length > 1 && (
                      <Button
                        onClick={() => onDeleteColumn(columnIndex)}
                        size="sm"
                        variant="ghost"
                        className="ml-1 h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <span>열 #{columnIndex + 1}</span>
                    {isHeaderMerged && (
                      <span className="font-medium text-orange-600">
                        🔗 {headerColspan}열 병합
                      </span>
                    )}
                    {hasQuestions && onOpenColumnConditionModal && !isHeaderMerged && (
                      <button
                        onClick={() => onOpenColumnConditionModal(columnIndex)}
                        className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${
                          column.displayCondition && column.displayCondition.conditions.length > 0
                            ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                            : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                        }`}
                        title={
                          column.displayCondition && column.displayCondition.conditions.length > 0
                            ? `조건부 표시 (${column.displayCondition.conditions.length}개 조건)`
                            : '조건부 표시 설정'
                        }
                      >
                        <Eye className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {isHeaderMerged && (
                      <Button
                        onClick={() => onUnmergeColumnHeader(columnIndex)}
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1 text-orange-600 hover:text-orange-800"
                        title="헤더 병합 해제"
                      >
                        <Unlink className="h-3 w-3" />
                      </Button>
                    )}
                    {canMergeRight && (
                      <Button
                        onClick={() => onMergeColumnHeaders(columnIndex)}
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1 text-gray-400 hover:text-blue-600"
                        title="오른쪽 열과 헤더 병합"
                      >
                        <Combine className="h-3 w-3" />
                      </Button>
                    )}
                    {editingColumnWidth?.columnIndex === columnIndex ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          value={editingColumnWidth.value}
                          onChange={(e) => {
                            onSetEditingColumnWidth({
                              columnIndex,
                              value: e.target.value,
                            });
                          }}
                          onBlur={() => {
                            const width = parseInt(editingColumnWidth.value);
                            if (!isNaN(width) && width >= 0) {
                              onColumnWidthChange(columnIndex, width);
                            }
                            onSetEditingColumnWidth(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const width = parseInt(editingColumnWidth.value);
                              if (!isNaN(width) && width >= 0) {
                                onColumnWidthChange(columnIndex, width);
                              }
                              onSetEditingColumnWidth(null);
                            } else if (e.key === 'Escape') {
                              onSetEditingColumnWidth(null);
                            }
                          }}
                          className="h-5 w-14 px-1 text-xs"
                          autoFocus
                        />
                        <span>px</span>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:text-blue-600 hover:underline"
                        onClick={() => {
                          onSetEditingColumnWidth({
                            columnIndex,
                            value: String(column.width || 150),
                          });
                        }}
                        title="클릭하여 너비 변경"
                      >
                        {column.width ? `${column.width}px` : '150px'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
