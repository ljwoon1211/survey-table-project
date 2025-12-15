"use client";

import { useEditor, EditorContent } from "@tiptap/react";
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
  Upload,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { createEditorExtensions } from "./editor-extensions";
import {
  optimizeImage,
  validateImageFile,
  getProxiedImageUrl,
  deleteImagesFromR2,
} from "@/lib/image-utils";
import { extractImageUrlsFromHtml } from "@/lib/image-extractor";

interface NoticeEditorProps {
  content: string;
  onChange: (content: string) => void;
  compact?: boolean; // 간소화 모드 (설명 필드용)
  placeholder?: string; // placeholder 텍스트
}

export function NoticeEditor({
  content,
  onChange,
  compact = false,
  placeholder = "",
}: NoticeEditorProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortController = useRef<AbortController | null>(null);
  const [, forceUpdate] = useState({});

  // 업로드된 이미지 URL 추적 (원본 URL로 저장)
  const uploadedImageUrlsRef = useRef<Set<string>>(new Set());
  const previousContentRef = useRef<string>(content || "");

  // 각 에디터 인스턴스마다 고유한 확장 배열 생성
  const extensions = useMemo(() => createEditorExtensions(), []);

  // 파일 선택 핸들러
  const handleFileSelect = useCallback(async (file: File) => {
    // 파일 유효성 검사
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || "파일 검증에 실패했습니다.");
      return;
    }

    setUploadError(null);
    setSelectedFile(file);

    // 미리보기 생성
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // 드래그 앤 드롭 핸들러
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const editor = useEditor({
    extensions,
    content: content || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const currentHtml = editor.getHTML();

      // 이미지 삭제 감지 및 정리
      const previousImages = extractImageUrlsFromHtml(previousContentRef.current);
      const currentImages = extractImageUrlsFromHtml(currentHtml);

      // 삭제된 이미지 찾기 (업로드한 이미지만 삭제)
      const deletedImages = previousImages.filter(
        (url) => !currentImages.includes(url) && uploadedImageUrlsRef.current.has(url),
      );

      // 삭제된 이미지가 있으면 R2에서 삭제
      if (deletedImages.length > 0) {
        deleteImagesFromR2(deletedImages).catch((error) => {
          console.error("이미지 삭제 실패:", error);
        });

        // 추적 목록에서 제거
        deletedImages.forEach((url) => {
          uploadedImageUrlsRef.current.delete(url);
        });
      }

      previousContentRef.current = currentHtml;
      onChange(currentHtml);
    },
    onSelectionUpdate: () => {
      // 선택이 변경될 때마다 컴포넌트 리렌더링
      forceUpdate({});
    },
    editorProps: {
      attributes: {
        class: compact
          ? "prose prose-sm max-w-none focus:outline-none min-h-[80px] p-3 border border-gray-200 rounded-lg " +
            "[&_table]:border-collapse [&_table]:table-fixed [&_table]:w-full [&_table]:my-2 [&_table]:overflow-hidden [&_table]:border-2 [&_table]:border-gray-300 " +
            "[&_table_td]:min-w-[1em] [&_table_td]:border [&_table_td]:border-gray-300 [&_table_td]:px-2 [&_table_td]:py-1 [&_table_td]:align-top [&_table_td]:box-border [&_table_td]:relative [&_table_td]:cursor-pointer " +
            "[&_table_th]:min-w-[1em] [&_table_th]:border [&_table_th]:border-gray-300 [&_table_th]:px-2 [&_table_th]:py-1 [&_table_th]:align-top [&_table_th]:box-border [&_table_th]:relative [&_table_th]:cursor-pointer " +
            "[&_table_th]:font-normal [&_table_th]:text-left [&_table_th]:bg-transparent " +
            "[&_table_.selectedCell]:bg-blue-100 [&_table_.selectedCell]:border-2 [&_table_.selectedCell]:border-blue-500 " +
            "[&_table_.selected]:bg-blue-50 " +
            "[&_table:hover]:border-blue-500 " +
            "[&_table_p]:m-0"
          : "prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4 border border-gray-200 rounded-lg " +
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

  // 이미지 업로드
  const handleImageUpload = useCallback(async () => {
    if (!selectedFile || !editor) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    uploadAbortController.current = new AbortController();

    try {
      // 이미지 최적화
      const optimizedBlob = await optimizeImage(selectedFile);
      const optimizedFile = new File([optimizedBlob], selectedFile.name, {
        type: optimizedBlob.type || selectedFile.type,
      });

      // FormData 생성
      const formData = new FormData();
      formData.append("file", optimizedFile);

      // 업로드 (진행률 추적)
      const xhr = new XMLHttpRequest();

      // 진행률 업데이트
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      // Promise로 래핑
      const uploadPromise = new Promise<string>((resolve, reject) => {
        xhr.addEventListener("load", () => {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            resolve(response.url);
          } else {
            const errorResponse = JSON.parse(xhr.responseText);
            reject(new Error(errorResponse.error || "업로드에 실패했습니다."));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("네트워크 오류가 발생했습니다."));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("업로드가 취소되었습니다."));
        });

        xhr.open("POST", "/api/upload/image");
        xhr.send(formData);
      });

      const imageUrl = await uploadPromise;

      // 업로드된 이미지 URL 추적 (원본 URL 저장)
      uploadedImageUrlsRef.current.add(imageUrl);
      previousContentRef.current = editor.getHTML();

      // 에디터에 이미지 추가 (프록시 URL 사용)
      // tiptap 라이브러리 타입 호환성 문제로 인해 any 타입 사용
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ed = editor as any;
      const proxiedUrl = getProxiedImageUrl(imageUrl);
      ed.chain().focus().setImage({ src: proxiedUrl }).run();

      // 업데이트 후 현재 HTML 저장
      previousContentRef.current = editor.getHTML();

      // 상태 초기화
      setSelectedFile(null);
      setPreviewUrl(null);
      setShowImageUpload(false);
      setUploadProgress(0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "업로드 중 오류가 발생했습니다.";
      setUploadError(errorMessage);
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
      uploadAbortController.current = null;
    }
  }, [selectedFile, editor]);

  // 업로드 취소
  const handleCancelUpload = useCallback(() => {
    if (uploadAbortController.current) {
      uploadAbortController.current.abort();
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadError(null);
    setUploadProgress(0);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // 이미지 업로드 패널 닫기
  const handleCloseImageUpload = useCallback(() => {
    handleCancelUpload();
    setShowImageUpload(false);
  }, [handleCancelUpload]);

  // 초기 content에서 이미지 URL 추출 및 추적
  useEffect(() => {
    if (content) {
      const initialImages = extractImageUrlsFromHtml(content);
      initialImages.forEach((url) => {
        uploadedImageUrlsRef.current.add(url);
      });
      previousContentRef.current = content;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 초기 마운트 시에만 실행

  // 컴포넌트 언마운트 시 사용되지 않은 이미지 정리
  useEffect(() => {
    // cleanup 함수에서 사용할 ref 값 복사
    const uploadedUrls = uploadedImageUrlsRef.current;
    const editorInstance = editor;

    return () => {
      // 컴포넌트가 언마운트될 때 현재 에디터의 이미지와 비교하여 사용되지 않은 이미지 삭제
      if (editorInstance && uploadedUrls.size > 0) {
        const currentHtml = editorInstance.getHTML();
        const currentImages = extractImageUrlsFromHtml(currentHtml);
        const unusedImages = Array.from(uploadedUrls).filter((url) => !currentImages.includes(url));

        if (unusedImages.length > 0) {
          deleteImagesFromR2(unusedImages).catch((error) => {
            console.error("언마운트 시 이미지 삭제 실패:", error);
          });
        }
      }
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  // tiptap 라이브러리 타입 호환성 문제로 인해 any 타입 사용
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ed = editor as any;

  const addLink = () => {
    if (linkUrl) {
      ed.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl("");
      setShowLinkInput(false);
    }
  };

  const addTable = () => {
    ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  // 선택된 셀들에 회색 배경색 적용
  const applyCellBackground = () => {
    if (!ed) return;

    ed.chain()
      .focus()
      .updateAttributes("tableCell", {
        backgroundColor: "#e5e7eb", // gray-200
      })
      .run();

    ed.chain()
      .focus()
      .updateAttributes("tableHeader", {
        backgroundColor: "#e5e7eb", // gray-200
      })
      .run();
  };

  // 선택된 셀들의 배경색 제거
  const removeCellBackground = () => {
    if (!ed) return;

    ed.chain()
      .focus()
      .updateAttributes("tableCell", {
        backgroundColor: null,
      })
      .run();

    ed.chain()
      .focus()
      .updateAttributes("tableHeader", {
        backgroundColor: null,
      })
      .run();
  };

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div
        className={`flex flex-wrap gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg ${
          compact ? "gap-1" : ""
        }`}
      >
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => ed.chain().focus().toggleBold().run()}
            className={ed.isActive("bold") ? "bg-gray-200" : ""}
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => ed.chain().focus().toggleItalic().run()}
            className={ed.isActive("italic") ? "bg-gray-200" : ""}
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
            onClick={() => ed.chain().focus().toggleHeading({ level: 1 }).run()}
            className={ed.isActive("heading", { level: 1 }) ? "bg-gray-200" : ""}
          >
            <Heading1 className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => ed.chain().focus().toggleHeading({ level: 2 }).run()}
            className={ed.isActive("heading", { level: 2 }) ? "bg-gray-200" : ""}
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
            onClick={() => ed.chain().focus().toggleBulletList().run()}
            className={ed.isActive("bulletList") ? "bg-gray-200" : ""}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => ed.chain().focus().toggleOrderedList().run()}
            className={ed.isActive("orderedList") ? "bg-gray-200" : ""}
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
            onClick={() => setShowImageUpload(!showImageUpload)}
            disabled={isUploading}
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
            onClick={() => ed.chain().focus().undo().run()}
            disabled={!ed.can().undo()}
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => ed.chain().focus().redo().run()}
            disabled={!ed.can().redo()}
          >
            <Redo className="w-4 h-4" />
          </Button>
        </div>

        {/* 표 편집 버튼 - 표가 선택되었을 때만 표시 */}
        {ed.can().deleteTable() && (
          <>
            <div className="w-px h-6 bg-gray-300" />

            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => ed.chain().focus().addColumnAfter().run()}
                title="열 추가 (뒤)"
              >
                <Columns className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => ed.chain().focus().addRowAfter().run()}
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
                onClick={() => ed.chain().focus().deleteColumn().run()}
                disabled={!ed.can().deleteColumn()}
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
                onClick={() => ed.chain().focus().deleteRow().run()}
                disabled={!ed.can().deleteRow()}
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
                onClick={() => ed.chain().focus().deleteTable().run()}
                title="표 삭제"
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}

        {/* 셀 병합/분리 버튼 - 항상 표시, 조건에 따라 활성화 */}
        {ed.can().deleteTable() && (
          <>
            <div className="w-px h-6 bg-gray-300" />

            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => ed.chain().focus().mergeCells().run()}
                disabled={!ed.can().mergeCells()}
                title="셀 병합"
              >
                <Merge className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => ed.chain().focus().splitCell().run()}
                disabled={!ed.can().splitCell()}
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

      {/* Image Upload Panel */}
      {showImageUpload && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
          {/* 드래그 앤 드롭 영역 */}
          {!selectedFile && !isUploading && (
            <div
              className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml,image/bmp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileSelect(file);
                  }
                }}
                className="hidden"
              />
              <Upload className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <p className="text-sm text-gray-600 mb-2">
                이미지를 드래그 앤 드롭하거나 클릭하여 선택하세요
              </p>
              <p className="text-xs text-gray-500 mt-2">
                지원 형식: JPG, PNG, GIF, WebP, SVG (최대 10MB)
              </p>
            </div>
          )}

          {/* 선택된 파일 미리보기 */}
          {selectedFile && previewUrl && !isUploading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelUpload}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getProxiedImageUrl(previewUrl || "")}
                  alt="미리보기"
                  className="w-full max-h-48 object-contain"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={handleImageUpload} className="flex-1">
                  업로드
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleCloseImageUpload}>
                  취소
                </Button>
              </div>
            </div>
          )}

          {/* 업로드 진행 중 */}
          {isUploading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">업로드 중...</span>
                <span className="text-sm text-gray-500">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              {previewUrl && (
                <div className="border rounded-lg overflow-hidden bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getProxiedImageUrl(previewUrl)}
                    alt="업로드 중"
                    className="w-full max-h-32 object-contain opacity-50"
                  />
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelUpload}
                className="w-full"
                disabled={uploadProgress >= 100}
              >
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                업로드 취소
              </Button>
            </div>
          )}

          {/* 에러 메시지 */}
          {uploadError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">업로드 실패</p>
                <p className="text-sm text-red-700 mt-1">{uploadError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUploadError(null);
                    if (selectedFile) {
                      handleImageUpload();
                    }
                  }}
                  className="mt-2"
                >
                  다시 시도
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setUploadError(null)}
                className="text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
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
      <div className="relative">
        <EditorContent editor={editor} />
        {compact && !content && placeholder && (
          <div className="absolute top-3 left-3 text-gray-400 text-sm pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>

      {/* Help Text - 일반 모드에서만 표시 */}
      {!compact && (
        <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded-lg">
          <p>
            💡 <strong>사용 팁:</strong> 텍스트, 이미지, 동영상 URL, 표를 자유롭게 추가할 수
            있습니다.
          </p>
          <p className="mt-1">• 이미지: 이미지 버튼 클릭 후 파일 업로드 (드래그 앤 드롭 지원)</p>
          <p>• 링크: 텍스트 선택 후 링크 버튼 클릭</p>
          <p>• 표: 표 버튼 클릭으로 3x3 표 자동 생성</p>
          <p>• 표 편집: 표 내부 클릭 시 행/열 추가/삭제, 셀 병합/분할 버튼 표시</p>
          <p>• 셀 병합: 여러 셀을 드래그하여 선택 후 병합 버튼 클릭</p>
          <p>• 셀 분할: 병합된 셀 선택 후 분할 버튼 클릭</p>
          <p>• 셀 배경색: 셀을 드래그하여 선택 후 붓 아이콘 클릭으로 회색 배경 적용/제거</p>
        </div>
      )}
    </div>
  );
}
