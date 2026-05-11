'use client';

import type { Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Captions,
  Columns,
  Merge,
  Paintbrush,
  Rows,
  Split,
  Trash2,
  X,
} from 'lucide-react';

import { toggleTableCaption } from './table-caption';
import { Sep, ToolBtn } from './toolbar-primitives';

interface Props {
  editor: Editor;
}

export function TableContextToolbar({ editor }: Props) {
  const captionActive = editor.isActive('tableCaption');

  const currentTableAlign = (editor.getAttributes('table').align ?? 'left') as
    | 'left' | 'center' | 'right';
  const currentCellVAlign = (editor.getAttributes('tableCell').verticalAlign ?? 'top') as
    | 'top' | 'middle' | 'bottom';
  const currentCaptionAlign = (editor.getAttributes('tableCaption').align ?? 'center') as
    | 'left' | 'center' | 'right';

  return (
    <div className="flex w-full flex-wrap items-center gap-1 border-t border-gray-200 pt-2">
      {/* 행/열 그룹 */}
      <ToolBtn title="열 추가 (뒤)" onClick={() => editor.chain().focus().addColumnAfter().run()}>
        <Columns className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="행 추가 (아래)" onClick={() => editor.chain().focus().addRowAfter().run()}>
        <Rows className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        title="열 삭제"
        disabled={!editor.can().deleteColumn()}
        onClick={() => editor.chain().focus().deleteColumn().run()}
        className="text-red-600 hover:bg-red-50"
      >
        <Columns className="h-4 w-4" />
        <span className="text-xs">−</span>
      </ToolBtn>
      <ToolBtn
        title="행 삭제"
        disabled={!editor.can().deleteRow()}
        onClick={() => editor.chain().focus().deleteRow().run()}
        className="text-red-600 hover:bg-red-50"
      >
        <Rows className="h-4 w-4" />
        <span className="text-xs">−</span>
      </ToolBtn>

      <Sep />

      {/* 병합 그룹 */}
      <ToolBtn
        title="셀 병합"
        disabled={!editor.can().mergeCells()}
        onClick={() => editor.chain().focus().mergeCells().run()}
      >
        <Merge className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        title="셀 분할"
        disabled={!editor.can().splitCell()}
        onClick={() => editor.chain().focus().splitCell().run()}
      >
        <Split className="h-4 w-4" />
      </ToolBtn>

      <Sep />

      {/* 셀 vertical-align */}
      <ToolBtn
        title="셀 위쪽"
        active={currentCellVAlign === 'top'}
        onClick={() =>
          editor.chain().focus().updateAttributes('tableCell', { verticalAlign: 'top' }).run()
        }
      >
        <AlignVerticalJustifyStart className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        title="셀 가운데"
        active={currentCellVAlign === 'middle'}
        onClick={() =>
          editor.chain().focus().updateAttributes('tableCell', { verticalAlign: 'middle' }).run()
        }
      >
        <AlignVerticalJustifyCenter className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        title="셀 아래쪽"
        active={currentCellVAlign === 'bottom'}
        onClick={() =>
          editor.chain().focus().updateAttributes('tableCell', { verticalAlign: 'bottom' }).run()
        }
      >
        <AlignVerticalJustifyEnd className="h-4 w-4" />
      </ToolBtn>

      <Sep />

      {/* 표 정렬 */}
      <ToolBtn
        title="표 왼쪽"
        active={currentTableAlign === 'left'}
        onClick={() =>
          editor.chain().focus().updateAttributes('table', { align: 'left' }).run()
        }
      >
        <AlignLeft className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        title="표 가운데"
        active={currentTableAlign === 'center'}
        onClick={() =>
          editor.chain().focus().updateAttributes('table', { align: 'center' }).run()
        }
      >
        <AlignCenter className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        title="표 오른쪽"
        active={currentTableAlign === 'right'}
        onClick={() =>
          editor.chain().focus().updateAttributes('table', { align: 'right' }).run()
        }
      >
        <AlignRight className="h-4 w-4" />
      </ToolBtn>

      <Sep />

      {/* 셀 배경 */}
      <ToolBtn
        title="셀 배경"
        onClick={() =>
          editor
            .chain()
            .focus()
            .updateAttributes('tableCell', { backgroundColor: '#e5e7eb' })
            .run()
        }
      >
        <Paintbrush className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        title="셀 배경 제거"
        className="text-red-600 hover:bg-red-50"
        onClick={() =>
          editor
            .chain()
            .focus()
            .updateAttributes('tableCell', { backgroundColor: null })
            .run()
        }
      >
        <Paintbrush className="h-4 w-4" />
        <X className="h-3 w-3" />
      </ToolBtn>

      <Sep />

      {/* 캡션 토글 */}
      <ToolBtn
        title={captionActive ? '캡션 제거' : '캡션 추가'}
        active={captionActive}
        onClick={() => toggleTableCaption(editor)}
      >
        <Captions className="h-4 w-4" />
      </ToolBtn>

      {/* 캡션 정렬 — 캡션 focus 시만 노출 */}
      {captionActive && (
        <>
          <ToolBtn
            title="캡션 왼쪽"
            active={currentCaptionAlign === 'left'}
            onClick={() =>
              editor.chain().focus().updateAttributes('tableCaption', { align: 'left' }).run()
            }
          >
            <AlignLeft className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn
            title="캡션 가운데"
            active={currentCaptionAlign === 'center'}
            onClick={() =>
              editor.chain().focus().updateAttributes('tableCaption', { align: 'center' }).run()
            }
          >
            <AlignCenter className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn
            title="캡션 오른쪽"
            active={currentCaptionAlign === 'right'}
            onClick={() =>
              editor.chain().focus().updateAttributes('tableCaption', { align: 'right' }).run()
            }
          >
            <AlignRight className="h-4 w-4" />
          </ToolBtn>
        </>
      )}

      {/* 표 삭제 — 우측 분리 */}
      <ToolBtn
        title="표 삭제"
        className="ml-auto text-red-600 hover:bg-red-50"
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        <Trash2 className="h-4 w-4" />
      </ToolBtn>
    </div>
  );
}
