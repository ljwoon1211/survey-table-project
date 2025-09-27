"use client";

import { TableColumn, TableRow } from "@/types/survey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Image, Video, FileText } from "lucide-react";

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
  const renderCellContent = (cell: any) => {
    if (!cell) return <span className="text-gray-400 text-sm">-</span>;

    switch (cell.type) {
      case "checkbox":
        return cell.checkboxOptions && cell.checkboxOptions.length > 0 ? (
          <div className="space-y-2">
            {cell.checkboxOptions.map((option: any) => (
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
          <div className="space-y-2">
            {cell.radioOptions.map((option: any) => (
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

      case "image":
        return cell.imageUrl ? (
          <div className="flex flex-col items-center gap-2">
            <img
              src={cell.imageUrl}
              alt="셀 이미지"
              className="max-w-full max-h-32 object-contain rounded"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                target.nextElementSibling!.classList.remove("hidden");
              }}
            />
            <div className="hidden flex items-center gap-1 text-red-500 text-sm">
              <Image className="w-4 h-4" />
              <span>이미지 오류</span>
            </div>
          </div>
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
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500">
            <Video className="w-4 h-4" />
            <span className="text-sm">동영상 없음</span>
          </div>
        );

      default:
        return cell.content ? (
          <div className="whitespace-pre-wrap text-sm">{cell.content}</div>
        ) : (
          <span className="text-gray-400 text-sm">내용 없음</span>
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
          <table className="w-full border-collapse border border-gray-300 text-sm">
            {/* 헤더 */}
            <thead>
              <tr>
                <th className="border border-gray-300 p-3 bg-gray-50 font-medium text-left min-w-[120px]">
                  항목
                </th>
                {columns.map((column) => (
                  <th
                    key={column.id}
                    className="border border-gray-300 p-3 bg-gray-50 font-medium text-center min-w-[150px]"
                  >
                    {column.label || (
                      <span className="text-gray-400 italic text-sm">(제목 없음)</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            {/* 본문 */}
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {/* 행 제목 */}
                  <td className="border border-gray-300 p-3 bg-gray-50 font-medium">
                    {row.label || <span className="text-gray-400 italic text-sm">(제목 없음)</span>}
                  </td>

                  {/* 셀들 */}
                  {row.cells.map((cell, cellIndex) => (
                    <td
                      key={cell.id}
                      className="border border-gray-300 p-3 text-center align-middle"
                    >
                      {renderCellContent(cell)}
                    </td>
                  ))}

                  {/* 빈 셀들 (열 수가 셀 수보다 많은 경우) */}
                  {Array.from({ length: Math.max(0, columns.length - row.cells.length) }).map(
                    (_, index) => (
                      <td
                        key={`empty-${row.id}-${index}`}
                        className="border border-gray-300 p-3 text-center"
                      >
                        <span className="text-gray-400 text-sm">-</span>
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
