import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { getProxiedImageUrl } from "@/lib/image-utils";

// 배경색 속성 추가 함수
const addBackgroundColorAttribute = () => ({
  backgroundColor: {
    default: null,
    parseHTML: (element: HTMLElement) =>
      element.getAttribute("data-background-color"),
    renderHTML: (attributes: { backgroundColor?: string | null }) => {
      if (!attributes.backgroundColor) {
        return {};
      }
      return {
        "data-background-color": attributes.backgroundColor,
        style: `background-color: ${attributes.backgroundColor}`,
      };
    },
  },
});

// 에디터 확장을 생성하는 함수 (매번 새로운 인스턴스 생성)
// TipTap 3.x에서 여러 에디터 인스턴스를 사용할 때 플러그인 충돌을 방지하기 위해
// 각 호출마다 새로운 확장 인스턴스를 생성합니다.
export function createEditorExtensions() {
  // 배경색을 지원하는 TableCell 확장 - 매번 새로 생성
  const TableCellWithBackground = TableCell.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        ...addBackgroundColorAttribute(),
      };
    },
  });

  // 배경색을 지원하는 TableHeader 확장 - 매번 새로 생성
  const TableHeaderWithBackground = TableHeader.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        ...addBackgroundColorAttribute(),
      };
    },
  });

  // 이미지 프록시 URL을 사용하는 Image 확장
  const ImageWithProxy = Image.extend({
    renderHTML({ HTMLAttributes }) {
      // src 속성이 있으면 프록시 URL로 변환
      if (HTMLAttributes.src) {
        HTMLAttributes.src = getProxiedImageUrl(HTMLAttributes.src);
      }
      return ["img", HTMLAttributes];
    },
  });

  return [
    // StarterKit을 매번 새로 생성하여 플러그인 충돌 방지
    StarterKit.configure({}),
    ImageWithProxy.configure({
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
  ];
}


