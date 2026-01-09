"use client";

import { useState, useEffect } from "react";
import { TableColumn, TableRow } from "@/types/survey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Image, Video, FileText } from "lucide-react";
import { getProxiedImageUrl } from "@/lib/image-utils";

// 이미지 셀 컴포넌트 (에러 상태 관리)
function ImageCell({ imageUrl, content }: { imageUrl: string; content?: string }) {
  const [error, setError] = useState(false);

  // key가 바뀔 때 (= imageUrl이 바뀔 때) 에러 상태 리셋
  useEffect(() => {
    setError(false);
  }, [imageUrl]);

  return (
    <div className="flex flex-col items-center gap-2 w-full h-full">
      <div key={imageUrl}>
        {error ? (
          <div className="flex items-center gap-1 text-red-500 text-sm">
            <Image className="w-4 h-4" />
            <span>이미지 오류</span>
          </div>
        ) : (
          <img
            src={getProxiedImageUrl(imageUrl)}
            alt="셀 이미지"
            className="w-full h-auto max-h-full object-contain rounded"
            style={{ maxWidth: "100%", maxHeight: "100%" }}
            onError={() => setError(true)}
          />
        )}
      </div>
      {content && <div className="text-sm text-gray-700 mt-2 text-left">{content}</div>}
    </div>
  );
}

interface TablePreviewProps {
  tableTitle?: string;
  columns?: TableColumn[];
  rows?: TableRow[];
  className?: string;
}

export function TablePreview({
  tableTitle,
  columns = [],
  rows = [],
  className,
}: TablePreviewProps) {
  // 테이블이 비어있는 경우
  if (columns.length === 0 || rows.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <div className="text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>테이블을 구성해주세요</p>
            <p className="text-sm">열과 행을 추가하여 테이블을 만들어보세요</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 셀 내용 렌더링 함수
  const renderCellContent = (cell: TableRow["cells"][number]) => {
    if (!cell) return <span className="text-gray-400 text-sm">-</span>;

    switch (cell.type) {
      case "checkbox":
        return cell.checkboxOptions && cell.checkboxOptions.length > 0 ? (
          <div className="space-y-2 w-full">
            {/* 셀 텍스트 설명 (있는 경우) */}
            {cell.content && cell.content.trim() && (
              <div className="text-sm text-gray-700 mb-3 font-medium whitespace-pre-wrap break-words">
                {cell.content}
              </div>
            )}
            {cell.checkboxOptions.map((option) => (
              <div key={option.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={option.checked || false}
                  readOnly
                  className="rounded"
                />
                <span className="text-sm">{option.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500">
            <span className="text-sm">체크박스 없음</span>
          </div>
        );

      case "radio":
        return cell.radioOptions && cell.radioOptions.length > 0 ? (
          <div className="space-y-2 w-full">
            {/* 셀 텍스트 설명 (있는 경우) */}
            {cell.content && cell.content.trim() && (
              <div className="text-sm text-gray-700 mb-3 font-medium whitespace-pre-wrap break-words">
                {cell.content}
              </div>
            )}
            {cell.radioOptions.map((option) => (
              <div key={option.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`preview-${cell.id}`}
                  checked={option.selected || false}
                  readOnly
                />
                <span className="text-sm">{option.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500">
            <span className="text-sm">라디오 버튼 없음</span>
          </div>
        );

      case "select":
        return cell.selectOptions && cell.selectOptions.length > 0 ? (
          <div className="w-full h-full flex flex-col space-y-2">
            {/* 셀 텍스트 설명 (있는 경우) */}
            {cell.content && cell.content.trim() && (
              <div className="text-sm text-gray-700 font-medium whitespace-pre-wrap break-words">
                {cell.content}
              </div>
            )}
            <select className="w-full h-full p-2 text-sm border border-gray-300 rounded" disabled>
              <option value="">선택하세요...</option>
              {cell.selectOptions.map((option) => (
                <option key={option.id} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500">
            <span className="text-sm">선택 옵션 없음</span>
          </div>
        );

      case "image":
        return cell.imageUrl ? (
          <ImageCell imageUrl={cell.imageUrl} content={cell.content} />
        ) : (
          <div className="flex items-center gap-2 text-gray-500">
            <Image className="w-4 h-4" />
            <span className="text-sm">이미지 없음</span>
          </div>
        );

      case "video":
        return cell.videoUrl ? (
          <div className="flex flex-col items-center gap-2">
            {cell.videoUrl.includes("youtube.com") || cell.videoUrl.includes("youtu.be") ? (
              <div className="w-full max-w-xs">
                <div className="aspect-video">
                  <iframe
                    src={getYouTubeEmbedUrl(cell.videoUrl)}
                    className="w-full h-full rounded"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="테이블 동영상"
                  />
                </div>
              </div>
            ) : cell.videoUrl.includes("vimeo.com") ? (
              <div className="w-full max-w-xs">
                <div className="aspect-video">
                  <iframe
                    src={cell.videoUrl.replace("vimeo.com/", "player.vimeo.com/video/")}
                    className="w-full h-full rounded"
                    frameBorder="0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title="테이블 동영상"
                  />
                </div>
              </div>
            ) : cell.videoUrl.match(/\.(mp4|webm|ogg)$/i) ? (
              <video src={cell.videoUrl} controls className="w-full max-w-xs max-h-32 rounded">
                동영상을 지원하지 않는 브라우저입니다.
              </video>
            ) : (
              <div className="flex items-center gap-2 text-yellow-600">
                <Video className="w-4 h-4" />
                <span className="text-sm">동영상 링크 오류</span>
              </div>
            )}
            {cell.content && (
              <div className="text-sm text-gray-700 mt-2 text-left">{cell.content}</div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500">
            <Video className="w-4 h-4" />
            <span className="text-sm">동영상 없음</span>
          </div>
        );

      case "input":
        return (
          <div className="w-full h-full flex flex-col space-y-2">
            {/* 셀 텍스트 설명 (있는 경우) */}
            {cell.content && cell.content.trim() && (
              <div className="text-sm text-gray-700 font-medium whitespace-pre-wrap break-words">
                {cell.content}
              </div>
            )}
            <input
              type="text"
              placeholder={cell.placeholder || "답변을 입력하세요..."}
              maxLength={cell.inputMaxLength}
              disabled
              className="w-full h-full p-2 text-sm border border-gray-300 rounded bg-gray-50"
            />
            {cell.inputMaxLength && (
              <div className="text-xs text-gray-500 mt-1 text-right">
                최대 {cell.inputMaxLength}자
              </div>
            )}
          </div>
        );

      default:
        return cell.content ? (
          <div className="whitespace-pre-wrap text-sm leading-relaxed break-words w-full">
            {cell.content}
          </div>
        ) : (
          <span className="text-gray-400 text-sm"></span>
        );
    }
  };

  // YouTube URL을 임베드 URL로 변환
  const getYouTubeEmbedUrl = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}`;
    }
    return url;
  };

  return (
    <Card className={className}>
      {tableTitle && (
        <CardHeader>
          <CardTitle>{tableTitle}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse border border-gray-300 text-sm"
            style={{ tableLayout: "fixed" }}
          >
            {/* 열 너비 정의 */}
            <colgroup>
              {columns.map((column, index) => (
                <col key={`col-${index}`} style={{ width: `${column.width || 150}px` }} />
              ))}
            </colgroup>

            {/* 헤더 */}
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.id}
                    className="border border-gray-300 p-3 bg-gray-50 font-medium text-center"
                    style={{ width: `${column.width || 150}px` }}
                  >
                    {column.label || <span className="text-gray-400 italic text-sm"></span>}
                  </th>
                ))}
              </tr>
            </thead>

            {/* 본문 */}
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {/* 셀들 */}
                  {row.cells.map((cell) => {
                    // rowspan으로 숨겨진 셀은 렌더링하지 않음
                    if (cell.isHidden) return null;

                    // 정렬 클래스 계산 (세로 정렬만 td에 적용)
                    const verticalAlignClass =
                      cell.verticalAlign === 'middle'
                        ? 'align-middle'
                        : cell.verticalAlign === 'bottom'
                          ? 'align-bottom'
                          : 'align-top';

                    return (
                      <td
                        key={cell.id}
                        className={`border border-gray-300 p-3 ${verticalAlignClass}`}
                        rowSpan={cell.rowspan || 1}
                        colSpan={cell.colspan || 1}
                      >
                        <div
                          className={`w-full h-full flex flex-col ${
                            cell.verticalAlign === 'top'
                              ? 'justify-start'
                              : cell.verticalAlign === 'middle'
                                ? 'justify-center'
                                : 'justify-end'
                          }`}
                        >
                          <div
                            className={`w-full ${
                              cell.horizontalAlign === 'left'
                                ? 'flex justify-start items-start'
                                : cell.horizontalAlign === 'center'
                                  ? 'flex justify-center items-center'
                                  : 'flex justify-end items-end'
                            }`}
                          >
                            {renderCellContent(cell)}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
