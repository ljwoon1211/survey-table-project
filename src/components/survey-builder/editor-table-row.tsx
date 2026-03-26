'use client';

import React from 'react';

import {
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  Circle,
  Clipboard,
  Copy,
  Eye,
  Image,
  Trash2,
  Video,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/types/survey';

/** 에디터 셀 내용 표시 컴포넌트 (매 렌더마다 함수 재생성 방지) */
function EditorCellContent({ cell }: { cell: TableCell }) {
  const hasText = cell.content && cell.content.trim().length > 0;

  const textContent = hasText ? (
    <div
      className={`mb-2 w-full text-sm break-words whitespace-pre-wrap ${cell.type === 'text' ? '' : 'font-medium text-gray-700'}`}
    >
      {cell.content}
    </div>
  ) : null;

  let typeContent = null;

  switch (cell.type) {
    case 'checkbox':
      typeContent =
        cell.checkboxOptions && cell.checkboxOptions.length > 0 ? (
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-green-500" />
            <span className="truncate text-sm text-gray-600">
              체크박스 ({cell.checkboxOptions.length}개)
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">체크박스 없음</span>
        );
      break;
    case 'radio':
      typeContent =
        cell.radioOptions && cell.radioOptions.length > 0 ? (
          <div className="flex items-center justify-center gap-2">
            <Circle className="h-4 w-4 text-purple-500" />
            <span className="truncate text-sm text-gray-600">
              라디오 ({cell.radioOptions.length}개)
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">라디오 없음</span>
        );
      break;
    case 'image':
      typeContent = cell.imageUrl ? (
        <div className="flex items-center gap-2">
          <Image className="h-4 w-4 text-blue-500" aria-label="이미지 아이콘" />
          <span className="truncate text-sm text-gray-600">이미지</span>
        </div>
      ) : (
        <span className="text-sm text-gray-400">이미지 없음</span>
      );
      break;
    case 'video':
      typeContent = cell.videoUrl ? (
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-red-500" />
          <span className="truncate text-sm text-gray-600">동영상</span>
        </div>
      ) : (
        <span className="text-sm text-gray-400">동영상 없음</span>
      );
      break;
    case 'input':
      typeContent = (
        <div className="flex items-center gap-2">
          <span className="truncate text-sm text-gray-600">
            {cell.placeholder ? `입력 필드: ${cell.placeholder}` : '단답형 입력'}
          </span>
        </div>
      );
      break;
    case 'select':
      typeContent =
        cell.selectOptions && cell.selectOptions.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="truncate text-sm text-gray-600">
              선택 ({cell.selectOptions.length}개)
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">선택 옵션 없음</span>
        );
      break;
    case 'text':
      typeContent = null;
      break;
    default:
      typeContent = <span className="text-sm text-gray-400"></span>;
  }

  return (
    <div className="w-full">
      {textContent}
      {typeContent}
    </div>
  );
}

export interface EditorTableRowProps {
  row: TableRow;
  rowIndex: number;
  columnWidths: number[];
  columnCount: number;
  totalRowCount: number;
  hasQuestions: boolean;
  hasCopiedCell: boolean;
  onUpdateRowLabel: (rowIndex: number, label: string) => void;
  onUpdateRowCode: (rowIndex: number, rowCode: string) => void;
  onOpenRowConditionModal: (rowIndex: number) => void;
  onDeleteRow: (rowIndex: number) => void;
  onSelectCell: (rowId: string, cellId: string) => void;
  onMoveColumn: (cellIndex: number, direction: 'left' | 'right') => void;
  onDeleteCell: (rowIndex: number, cellIndex: number) => void;
  onCopyCell: (rowIndex: number, cellIndex: number) => void;
  onPasteCell: (rowIndex: number, cellIndex: number) => void;
}

/** 에디터 테이블 행 컴포넌트 (React.memo로 변경 안 된 행 리렌더 방지) */
export const EditorTableRow = React.memo(function EditorTableRow({
  row,
  rowIndex,
  columnWidths,
  columnCount,
  totalRowCount,
  hasQuestions,
  hasCopiedCell,
  onUpdateRowLabel,
  onUpdateRowCode,
  onOpenRowConditionModal,
  onDeleteRow,
  onSelectCell,
  onMoveColumn,
  onDeleteCell,
  onCopyCell,
  onPasteCell,
}: EditorTableRowProps) {
  return (
    <tr
      style={{ height: row.height ? `${row.height}px` : '60px' }}
      className="group/row"
    >
      {/* 행 이름(라벨) 입력칸 */}
      <td className="group/label sticky left-0 z-10 w-[70px] min-w-[70px] border border-gray-300 bg-gray-50 p-1">
        <div className="relative space-y-1">
          <Input
            value={row.label}
            onChange={(e) => onUpdateRowLabel(rowIndex, e.target.value)}
            className="h-6 bg-white px-1 text-center text-xs"
            placeholder="행 라벨"
            title={`행 라벨: ${row.label}`}
          />
          <Input
            value={row.rowCode || ''}
            onChange={(e) => onUpdateRowCode(rowIndex, e.target.value)}
            className="h-6 bg-gray-100 px-1 text-center text-xs font-medium text-gray-700"
            placeholder="행 코드"
            title={`엑셀 코드: ${row.rowCode || '(자동)'}`}
          />
          {hasQuestions && (
            <button
              onClick={() => onOpenRowConditionModal(rowIndex)}
              className={`mx-auto flex h-5 w-5 items-center justify-center rounded transition-colors ${
                row.displayCondition && row.displayCondition.conditions.length > 0
                  ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'
              }`}
              title={
                row.displayCondition && row.displayCondition.conditions.length > 0
                  ? `조건부 표시 (${row.displayCondition.conditions.length}개 조건)`
                  : '조건부 표시 설정'
              }
            >
              <Eye className="h-3 w-3" />
            </button>
          )}
          {totalRowCount > 1 && (
            <button
              onClick={() => onDeleteRow(rowIndex)}
              className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600 group-hover/label:flex"
              title="행 삭제"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </td>

      {/* 셀들 */}
      {row.cells.map((cell, cellIndex) => {
        if (cell.isHidden) return null;

        const columnWidth = columnWidths[cellIndex] ?? 150;
        const rowspan = cell.rowspan || 1;
        const colspan = cell.colspan || 1;
        const isMerged = rowspan > 1 || colspan > 1;

        const verticalAlignClass =
          cell.verticalAlign === 'middle'
            ? 'align-middle'
            : cell.verticalAlign === 'bottom'
              ? 'align-bottom'
              : 'align-top';

        return (
          <td
            key={cell.id}
            className={`relative border border-gray-300 p-2 ${verticalAlignClass}`}
            style={{
              width: `${columnWidth}px`,
              maxWidth: `${columnWidth}px`,
              height: row.height ? `${row.height}px` : '60px',
            }}
            rowSpan={rowspan}
            colSpan={colspan}
          >
            <div
              className={`group relative flex h-full cursor-pointer flex-col rounded p-2 transition-colors hover:bg-gray-50 ${
                cell.verticalAlign === 'top'
                  ? 'justify-start'
                  : cell.verticalAlign === 'middle'
                    ? 'justify-center'
                    : 'justify-end'
              }`}
              onClick={() => onSelectCell(row.id, cell.id)}
              style={{
                minHeight: row.minHeight ? `${row.minHeight - 16}px` : '40px',
              }}
            >
              <div
                className={`mb-2 flex items-start justify-between ${
                  cell.type === 'radio' ? 'w-full justify-center' : ''
                }`}
              >
                <div
                  className={`${cell.type === 'radio' ? '' : 'w-full flex-1'} ${
                    cell.horizontalAlign === 'left'
                      ? 'flex items-start justify-start'
                      : cell.horizontalAlign === 'center'
                        ? 'flex items-center justify-center'
                        : 'flex items-end justify-end'
                  }`}
                >
                  <EditorCellContent cell={cell} />
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="mr-1 flex items-center border-r border-gray-200 pr-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-5 p-0 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveColumn(cellIndex, 'left');
                      }}
                      disabled={cellIndex === 0}
                      title="열 왼쪽으로 이동"
                    >
                      <ArrowLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-5 p-0 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveColumn(cellIndex, 'right');
                      }}
                      disabled={cellIndex === columnCount - 1}
                      title="열 오른쪽으로 이동"
                    >
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCell(rowIndex, cellIndex);
                    }}
                    title="셀 삭제"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyCell(rowIndex, cellIndex);
                    }}
                    title="셀 복사"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  {hasCopiedCell && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPasteCell(rowIndex, cellIndex);
                      }}
                      title="셀 붙여넣기"
                    >
                      <Clipboard className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-1 border-t border-gray-100 pt-1 text-xs text-gray-400">
                <div className="flex items-center justify-between">
                  <span>
                    셀 ({rowIndex + 1}, {cellIndex + 1})
                  </span>
                  <span className="font-medium capitalize">{cell.type}</span>
                </div>
                {isMerged && (
                  <div className="mt-1 font-medium text-orange-600">
                    🔗 병합: {rowspan}행 × {colspan}열
                  </div>
                )}
                {cell.type === 'checkbox' && cell.checkboxOptions && (
                  <div className="mt-1 text-green-600">
                    체크박스 {cell.checkboxOptions.length}개
                  </div>
                )}
                {cell.type === 'radio' && cell.radioOptions && (
                  <div className="mt-1 text-purple-600">
                    라디오 {cell.radioOptions.length}개
                  </div>
                )}
                {cell.type === 'select' && cell.selectOptions && (
                  <div className="mt-1 text-indigo-600">
                    선택 {cell.selectOptions.length}개
                  </div>
                )}
                {cell.type === 'input' && (
                  <div className="mt-1 text-teal-600">
                    {cell.placeholder || '단답형 입력'}
                  </div>
                )}
                {cell.type === 'image' && cell.imageUrl && (
                  <div className="mt-1 text-blue-600">이미지 설정됨</div>
                )}
                {cell.type === 'video' && cell.videoUrl && (
                  <div className="mt-1 text-red-600">비디오 설정됨</div>
                )}
              </div>
            </div>
          </td>
        );
      })}
    </tr>
  );
});
