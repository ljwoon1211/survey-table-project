'use client';

import type { Editor } from '@tiptap/react';
import {
  Bold,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo,
  Underline,
  Undo,
} from 'lucide-react';

import { PopoverVariableMenu } from './popover-variable-menu';
import { TableContextToolbar } from './table-context-toolbar';
import { TableInsertMenu } from './table-insert-menu';
import { Sep, ToolBtn } from './toolbar-primitives';
import type { VariableDef } from './variable-catalog';

interface Props {
  editor: Editor;
  catalog: VariableDef[];
  onPickImage: () => void;
  onPickLink: () => void;
}

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32] as const;

export function EditorToolbar({ editor, catalog, onPickImage, onPickLink }: Props) {
  const insertVar = (key: string) => {
    editor.chain().focus().insertContent(`{{${key}}}`).run();
  };

  const setFontSize = (px: string) => {
    editor.chain().focus().setFontSize(`${px}px`).run();
  };

  // 표 안에 셀렉션이 있을 때만 표 컨텍스트 툴바 노출
  const tableActive = editor.can().deleteTable();

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50/50 p-2">
      <ToolBtn
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="굵게"
      >
        <Bold className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="기울임"
      >
        <Italic className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="밑줄"
      >
        <Underline className="h-4 w-4" />
      </ToolBtn>

      <select
        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs"
        onChange={(e) => setFontSize(e.target.value)}
        defaultValue="14"
        aria-label="폰트 크기"
      >
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}px
          </option>
        ))}
      </select>

      <Sep />

      <ToolBtn
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="글머리 기호"
      >
        <List className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="번호 매기기"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolBtn>

      <Sep />

      <ToolBtn onClick={onPickImage} title="이미지">
        <ImageIcon className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn onClick={onPickLink} title="링크">
        <LinkIcon className="h-4 w-4" />
      </ToolBtn>

      <TableInsertMenu editor={editor} />

      <Sep />

      <PopoverVariableMenu catalog={catalog} onPick={insertVar} />

      <div className="ml-auto flex gap-1">
        <ToolBtn
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="실행 취소"
        >
          <Undo className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="다시 실행"
        >
          <Redo className="h-4 w-4" />
        </ToolBtn>
      </div>

      {tableActive && <TableContextToolbar editor={editor} />}
    </div>
  );
}
