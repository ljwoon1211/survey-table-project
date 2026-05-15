'use client';

import { useEditorState, type Editor } from '@tiptap/react';
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';

import { Sep, ToolBtn } from './toolbar-primitives';

interface Props {
  editor: Editor;
}

const SIZES = [25, 50, 75, 100] as const;

export function ImageContextToolbar({ editor }: Props) {
  const s = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return { active: false, align: 'left', width: null as string | null };
      const attrs = editor.getAttributes('image');
      const style = (attrs.style ?? '') as string;
      const m = style.match(/width:\s*([^;]+)/);
      return {
        active: editor.isActive('image'),
        align:
          (editor.isActive({ textAlign: 'center' }) && 'center') ||
          (editor.isActive({ textAlign: 'right' }) && 'right') ||
          'left',
        width: m ? m[1].trim() : null,
      };
    },
  });

  if (!s.active) return null;

  const setSize = (pct: number) => {
    const currStyle = (editor.getAttributes('image').style as string | undefined) ?? '';
    const cleaned = currStyle.replace(/width:\s*[^;]+;?/g, '').trim();
    const next = `${cleaned}${cleaned ? ' ' : ''}width: ${pct}%; max-width: 100%;`;
    editor.chain().focus().updateAttributes('image', { style: next }).run();
  };

  return (
    <>
      <Sep />
      <ToolBtn
        active={s.align === 'left'}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        title="왼쪽 정렬"
      >
        <AlignLeft className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        active={s.align === 'center'}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        title="가운데 정렬"
      >
        <AlignCenter className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        active={s.align === 'right'}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        title="오른쪽 정렬"
      >
        <AlignRight className="h-4 w-4" />
      </ToolBtn>
      <Sep />
      {SIZES.map((pct) => (
        <ToolBtn
          key={pct}
          active={s.width === `${pct}%`}
          onClick={() => setSize(pct)}
          title={`${pct}% 크기`}
        >
          <span className="px-1 text-xs">{pct}%</span>
        </ToolBtn>
      ))}
    </>
  );
}
