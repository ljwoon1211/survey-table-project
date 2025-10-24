"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Link as LinkIcon,
  Table as TableIcon,
  Undo,
  Redo,
} from "lucide-react";
import { useState } from "react";

interface NoticeEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export function NoticeEditor({ content, onChange }: NoticeEditorProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline",
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: content || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4 border border-gray-200 rounded-lg",
      },
    },
  });

  if (!editor) {
    return null;
  }

  const addImage = () => {
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl("");
      setShowImageInput(false);
    }
  };

  const addLink = () => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl("");
      setShowLinkInput(false);
    }
  };

  const addTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive("bold") ? "bg-gray-200" : ""}
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive("italic") ? "bg-gray-200" : ""}
          >
            <Italic className="w-4 h-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-gray-300" />

        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={editor.isActive("heading", { level: 1 }) ? "bg-gray-200" : ""}
          >
            <Heading1 className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive("heading", { level: 2 }) ? "bg-gray-200" : ""}
          >
            <Heading2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-gray-300" />

        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive("bulletList") ? "bg-gray-200" : ""}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive("orderedList") ? "bg-gray-200" : ""}
          >
            <ListOrdered className="w-4 h-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-gray-300" />

        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowImageInput(!showImageInput)}
          >
            <ImageIcon className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowLinkInput(!showLinkInput)}
          >
            <LinkIcon className="w-4 h-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={addTable}>
            <TableIcon className="w-4 h-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-gray-300" />

        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Image URL Input */}
      {showImageInput && (
        <div className="flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="이미지 URL을 입력하세요"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <Button type="button" size="sm" onClick={addImage}>
            추가
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowImageInput(false)}
          >
            취소
          </Button>
        </div>
      )}

      {/* Link URL Input */}
      {showLinkInput && (
        <div className="flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="링크 URL을 입력하세요 (텍스트를 먼저 선택하세요)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <Button type="button" size="sm" onClick={addLink}>
            추가
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowLinkInput(false)}>
            취소
          </Button>
        </div>
      )}

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Help Text */}
      <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded-lg">
        <p>
          💡 <strong>사용 팁:</strong> 텍스트, 이미지, 동영상 URL, 표를 자유롭게 추가할 수
          있습니다.
        </p>
        <p className="mt-1">• 이미지: 이미지 버튼 클릭 후 URL 입력</p>
        <p>• 링크: 텍스트 선택 후 링크 버튼 클릭</p>
        <p>• 표: 표 버튼 클릭으로 3x3 표 자동 생성</p>
      </div>
    </div>
  );
}
