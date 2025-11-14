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
  Columns,
  Rows,
  Trash2,
  Merge,
  Split,
  Paintbrush,
  X,
} from "lucide-react";
import { useState } from "react";

interface NoticeEditorProps {
  content: string;
  onChange: (content: string) => void;
}

// 배경색을 지원하는 TableCell 확장
const TableCellWithBackground = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-background-color"),
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) {
            return {};
          }
          return {
            "data-background-color": attributes.backgroundColor,
            style: `background-color: ${attributes.backgroundColor}`,
          };
        },
      },
    };
  },
});

// 배경색을 지원하는 TableHeader 확장 (기본 스타일 제거)
const TableHeaderWithBackground = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-background-color"),
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) {
            return {};
          }
          return {
            "data-background-color": attributes.backgroundColor,
            style: `background-color: ${attributes.backgroundColor}`,
          };
        },
      },
    };
  },
});

export function NoticeEditor({ content, onChange }: NoticeEditorProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [, forceUpdate] = useState({});

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
        allowTableNodeSelection: true,
      }),
      TableRow,
      TableCellWithBackground,
      TableHeaderWithBackground,
    ],
    content: content || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onSelectionUpdate: () => {
      // 선택이 변경될 때마다 컴포넌트 리렌더링
      forceUpdate({});
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4 border border-gray-200 rounded-lg " +
          "[&_table]:border-collapse [&_table]:table-fixed [&_table]:w-full [&_table]:my-4 [&_table]:overflow-hidden [&_table]:border-2 [&_table]:border-gray-300 " +
          "[&_table_td]:min-w-[1em] [&_table_td]:border [&_table_td]:border-gray-300 [&_table_td]:px-3 [&_table_td]:py-2 [&_table_td]:align-top [&_table_td]:box-border [&_table_td]:relative [&_table_td]:cursor-pointer " +
          "[&_table_th]:min-w-[1em] [&_table_th]:border [&_table_th]:border-gray-300 [&_table_th]:px-3 [&_table_th]:py-2 [&_table_th]:align-top [&_table_th]:box-border [&_table_th]:relative [&_table_th]:cursor-pointer " +
          "[&_table_th]:font-normal [&_table_th]:text-left [&_table_th]:bg-transparent " +
          "[&_table_.selectedCell]:bg-blue-100 [&_table_.selectedCell]:border-2 [&_table_.selectedCell]:border-blue-500 " +
          "[&_table_.selected]:bg-blue-50 " +
          "[&_table:hover]:border-blue-500 " +
          "[&_table_p]:m-0",
      },
      handleDOMEvents: {
        mousedown: (view, event) => {
          const target = event.target as HTMLElement;
          // 테이블 셀을 클릭했을 때 셀 선택 모드 활성화
          if (target.tagName === "TD" || target.tagName === "TH") {
            return false; // 기본 동작 허용
          }
          return false;
        },
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
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  // 선택된 셀들에 회색 배경색 적용
  const applyCellBackground = () => {
    if (!editor) return;

    editor
      .chain()
      .focus()
      .updateAttributes("tableCell", {
        backgroundColor: "#e5e7eb", // gray-200
      })
      .run();

    editor
      .chain()
      .focus()
      .updateAttributes("tableHeader", {
        backgroundColor: "#e5e7eb", // gray-200
      })
      .run();
  };

  // 선택된 셀들의 배경색 제거
  const removeCellBackground = () => {
    if (!editor) return;

    editor
      .chain()
      .focus()
      .updateAttributes("tableCell", {
        backgroundColor: null,
      })
      .run();

    editor
      .chain()
      .focus()
      .updateAttributes("tableHeader", {
        backgroundColor: null,
      })
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

        {/* 표 편집 버튼 - 표가 선택되었을 때만 표시 */}
        {editor.can().deleteTable() && (
          <>
            <div className="w-px h-6 bg-gray-300" />

            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                title="열 추가 (뒤)"
              >
                <Columns className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().addRowAfter().run()}
                title="행 추가 (아래)"
              >
                <Rows className="w-4 h-4" />
              </Button>
            </div>

            <div className="w-px h-6 bg-gray-300" />

            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().deleteColumn().run()}
                disabled={!editor.can().deleteColumn()}
                title="열 삭제"
                className="text-red-600 hover:text-red-700"
              >
                <Columns className="w-4 h-4" />
                <span className="text-xs">-</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().deleteRow().run()}
                disabled={!editor.can().deleteRow()}
                title="행 삭제"
                className="text-red-600 hover:text-red-700"
              >
                <Rows className="w-4 h-4" />
                <span className="text-xs">-</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().deleteTable().run()}
                title="표 삭제"
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}

        {/* 셀 병합/분리 버튼 - 항상 표시, 조건에 따라 활성화 */}
        {editor.can().deleteTable() && (
          <>
            <div className="w-px h-6 bg-gray-300" />

            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().mergeCells().run()}
                disabled={!editor.can().mergeCells()}
                title="셀 병합"
              >
                <Merge className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().splitCell().run()}
                disabled={!editor.can().splitCell()}
                title="셀 분할"
              >
                <Split className="w-4 h-4" />
              </Button>
            </div>

            <div className="w-px h-6 bg-gray-300" />

            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={applyCellBackground}
                title="셀 배경색 적용 (회색)"
              >
                <Paintbrush className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeCellBackground}
                title="셀 배경색 제거"
                className="text-red-600 hover:text-red-700"
              >
                <div className="relative">
                  <Paintbrush className="w-4 h-4" />
                  <X className="w-2.5 h-2.5 absolute -top-0.5 -right-0.5" />
                </div>
              </Button>
            </div>
          </>
        )}
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
          💡 <strong>사용 팁:</strong> 텍스트, 이미지, 동영상 URL, 표를 자유롭게 추가할 수 있습니다.
        </p>
        <p className="mt-1">• 이미지: 이미지 버튼 클릭 후 URL 입력</p>
        <p>• 링크: 텍스트 선택 후 링크 버튼 클릭</p>
        <p>• 표: 표 버튼 클릭으로 3x3 표 자동 생성</p>
        <p>• 표 편집: 표 내부 클릭 시 행/열 추가/삭제, 셀 병합/분할 버튼 표시</p>
        <p>• 셀 병합: 여러 셀을 드래그하여 선택 후 병합 버튼 클릭</p>
        <p>• 셀 분할: 병합된 셀 선택 후 분할 버튼 클릭</p>
        <p>• 셀 배경색: 셀을 드래그하여 선택 후 붓 아이콘 클릭으로 회색 배경 적용/제거</p>
      </div>
    </div>
  );
}
