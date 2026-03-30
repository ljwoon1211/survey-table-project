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
  Zap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DynamicRowGroupConfig, TableCell, TableRow } from '@/types/survey';

const GROUP_COLORS = [
  'bg-purple-500', 'bg-green-500', 'bg-yellow-500', 'bg-blue-500',
  'bg-pink-500', 'bg-orange-500', 'bg-teal-500', 'bg-red-500',
  'bg-indigo-500', 'bg-cyan-500', 'bg-lime-500', 'bg-rose-500',
  'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-sky-500',
  'bg-fuchsia-500', 'bg-stone-500',
];

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
  hasCopiedRegion: boolean;
  // 드래그 복사
  isDragCopyActive: boolean;
  dragSelectionCellsKey: string; // 선택 영역 셀 indices ("2,3,5" 형태, 빈 문자열이면 없음)
  onStartDragCopy: (rowIndex: number, cellIndex: number) => void;
  // 기존 핸들러
  onUpdateRowLabel: (rowIndex: number, label: string) => void;
  onUpdateRowCode: (rowIndex: number, rowCode: string) => void;
  onOpenRowConditionModal: (rowIndex: number) => void;
  dynamicRowConfigs: DynamicRowGroupConfig[];
  onSetDynamicGroupId: (rowId: string, groupId: string | undefined) => void;
  onSetShowWhenDynamicGroupId: (rowId: string, groupId: string | undefined) => void;
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
  hasCopiedRegion,
  isDragCopyActive,
  dragSelectionCellsKey,
  onStartDragCopy,
  onUpdateRowLabel,
  onUpdateRowCode,
  onOpenRowConditionModal,
  dynamicRowConfigs,
  onSetDynamicGroupId,
  onSetShowWhenDynamicGroupId,
  onDeleteRow,
  onSelectCell,
  onMoveColumn,
  onDeleteCell,
  onCopyCell,
  onPasteCell,
}: EditorTableRowProps) {
  // 드래그 선택 영역 셀 Set (문자열 → Set<number>)
  const dragSelectionCells = React.useMemo(() => {
    if (!dragSelectionCellsKey) return null;
    return new Set(dragSelectionCellsKey.split(',').map(Number));
  }, [dragSelectionCellsKey]);
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
          <div className="flex items-center justify-center gap-0.5">
            {hasQuestions && (
              <button
                onClick={() => onOpenRowConditionModal(rowIndex)}
                className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${
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
          </div>
          {dynamicRowConfigs.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="mx-auto flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-gray-200"
                  title={
                    row.dynamicGroupId
                      ? `동적 그룹: ${dynamicRowConfigs.find((g) => g.groupId === row.dynamicGroupId)?.label || row.dynamicGroupId}`
                      : row.showWhenDynamicGroupId
                        ? `소계 연동: ${dynamicRowConfigs.find((g) => g.groupId === row.showWhenDynamicGroupId)?.label || row.showWhenDynamicGroupId}`
                        : '그룹 배정'
                  }
                >
                  {row.showWhenDynamicGroupId ? (
                    <Zap className={`h-3 w-3 ${GROUP_COLORS[dynamicRowConfigs.findIndex((g) => g.groupId === row.showWhenDynamicGroupId) % GROUP_COLORS.length]?.replace('bg-', 'text-') || 'text-amber-500'}`} />
                  ) : (
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                      row.dynamicGroupId
                        ? GROUP_COLORS[dynamicRowConfigs.findIndex((g) => g.groupId === row.dynamicGroupId) % GROUP_COLORS.length] || 'bg-purple-500'
                        : 'bg-gray-300'
                    }`} />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-1" side="right" align="start">
                <div className="space-y-0.5">
                  <button
                    onClick={() => { onSetDynamicGroupId(row.id, undefined); onSetShowWhenDynamicGroupId(row.id, undefined); }}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-gray-100 ${
                      !row.dynamicGroupId && !row.showWhenDynamicGroupId ? 'bg-gray-100 font-medium' : ''
                    }`}
                  >
                    <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
                    그룹없음
                  </button>
                  <div className="my-1 border-t" />
                  {dynamicRowConfigs.map((g, idx) => (
                    <button
                      key={g.groupId}
                      onClick={() => onSetDynamicGroupId(row.id, g.groupId)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-gray-100 ${
                        row.dynamicGroupId === g.groupId ? 'bg-gray-100 font-medium' : ''
                      }`}
                    >
                      <span className={`inline-block h-2 w-2 rounded-full ${GROUP_COLORS[idx % GROUP_COLORS.length]}`} />
                      {g.label || g.groupId}
                    </button>
                  ))}
                  <div className="my-1 border-t" />
                  {dynamicRowConfigs.map((g, idx) => (
                    <button
                      key={`link-${g.groupId}`}
                      onClick={() => onSetShowWhenDynamicGroupId(row.id, g.groupId)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-gray-100 ${
                        row.showWhenDynamicGroupId === g.groupId ? 'bg-gray-100 font-medium' : ''
                      }`}
                    >
                      <Zap className={`h-3 w-3 ${GROUP_COLORS[idx % GROUP_COLORS.length]?.replace('bg-', 'text-') || 'text-gray-400'}`} />
                      {g.label || g.groupId} (소계)
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
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

        const isSelected = dragSelectionCells?.has(cellIndex) ?? false;

        return (
          <td
            key={cell.id}
            data-row-index={rowIndex}
            data-cell-index={cellIndex}
            className={`relative border border-gray-300 p-2 ${verticalAlignClass} ${
              isSelected ? 'ring-2 ring-inset ring-blue-500 bg-blue-50' : ''
            }`}
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
                  {(hasCopiedCell || hasCopiedRegion) && (
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
              {/* Fill Handle — 드래그 복사 시작점 */}
              {!isDragCopyActive && (
                <div
                  className="absolute bottom-0 right-0 z-10 flex h-3 w-3 cursor-crosshair items-center justify-center opacity-0 group-hover:opacity-100"
                  style={{ padding: '3px', margin: '-3px' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onStartDragCopy(rowIndex, cellIndex);
                  }}
                >
                  <div className="h-1.5 w-1.5 rounded-sm bg-blue-500" />
                </div>
              )}
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
