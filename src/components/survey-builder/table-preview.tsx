'use client';

import React from 'react';

import { FileText, Image, Video } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HeaderCell, TableColumn, TableRow } from '@/types/survey';

import { getYouTubeEmbedUrl, ImageCell } from './table-cell-renderers';

// 셀 내용 렌더링 컴포넌트 (외부 분리)
function CellContent({ cell }: { cell: TableRow['cells'][number] }) {
  if (!cell) return <span className="text-sm text-gray-400">-</span>;

  switch (cell.type) {
    case 'checkbox':
      return cell.checkboxOptions && cell.checkboxOptions.length > 0 ? (
        <div className="w-full space-y-2">
          {cell.content && cell.content.trim() && (
            <div className="mb-3 text-sm font-medium break-words whitespace-pre-wrap text-gray-700">
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

    case 'radio':
      return cell.radioOptions && cell.radioOptions.length > 0 ? (
        <div className="w-full space-y-2">
          {cell.content && cell.content.trim() && (
            <div className="mb-3 text-sm font-medium break-words whitespace-pre-wrap text-gray-700">
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

    case 'select':
      return cell.selectOptions && cell.selectOptions.length > 0 ? (
        <div className="flex h-full w-full flex-col space-y-2">
          {cell.content && cell.content.trim() && (
            <div className="text-sm font-medium break-words whitespace-pre-wrap text-gray-700">
              {cell.content}
            </div>
          )}
          <select className="h-full w-full rounded border border-gray-300 p-2 text-sm" disabled>
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

    case 'image':
      return cell.imageUrl ? (
        <ImageCell imageUrl={cell.imageUrl} content={cell.content} />
      ) : (
        <div className="flex items-center gap-2 text-gray-500">
          <Image className="h-4 w-4" />
          <span className="text-sm">이미지 없음</span>
        </div>
      );

    case 'video':
      return cell.videoUrl ? (
        <div className="flex flex-col items-center gap-2">
          {cell.videoUrl.includes('youtube.com') || cell.videoUrl.includes('youtu.be') ? (
            <div className="w-full max-w-xs">
              <div className="aspect-video">
                <iframe
                  src={getYouTubeEmbedUrl(cell.videoUrl)}
                  className="h-full w-full rounded"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="테이블 동영상"
                />
              </div>
            </div>
          ) : cell.videoUrl.includes('vimeo.com') ? (
            <div className="w-full max-w-xs">
              <div className="aspect-video">
                <iframe
                  src={cell.videoUrl.replace('vimeo.com/', 'player.vimeo.com/video/')}
                  className="h-full w-full rounded"
                  frameBorder="0"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  title="테이블 동영상"
                />
              </div>
            </div>
          ) : cell.videoUrl.match(/\.(mp4|webm|ogg)$/i) ? (
            <video src={cell.videoUrl} controls className="max-h-32 w-full max-w-xs rounded">
              동영상을 지원하지 않는 브라우저입니다.
            </video>
          ) : (
            <div className="flex items-center gap-2 text-yellow-600">
              <Video className="h-4 w-4" />
              <span className="text-sm">동영상 링크 오류</span>
            </div>
          )}
          {cell.content && (
            <div className="mt-2 text-left text-sm text-gray-700">{cell.content}</div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-gray-500">
          <Video className="h-4 w-4" />
          <span className="text-sm">동영상 없음</span>
        </div>
      );

    case 'input':
      return (
        <div className="flex h-full w-full flex-col space-y-2">
          {cell.content && cell.content.trim() && (
            <div className="text-sm font-medium break-words whitespace-pre-wrap text-gray-700">
              {cell.content}
            </div>
          )}
          <input
            type="text"
            placeholder={cell.placeholder || '답변을 입력하세요...'}
            maxLength={cell.inputMaxLength}
            disabled
            className="h-full w-full rounded border border-gray-300 bg-gray-50 p-2 text-sm"
          />
          {cell.inputMaxLength && (
            <div className="mt-1 text-right text-xs text-gray-500">
              최대 {cell.inputMaxLength}자
            </div>
          )}
        </div>
      );

    default:
      return cell.content ? (
        <div className="w-full text-sm leading-relaxed break-words whitespace-pre-wrap">
          {cell.content}
        </div>
      ) : (
        <span className="text-sm text-gray-400"></span>
      );
  }
}

interface TablePreviewProps {
  tableTitle?: string;
  columns?: TableColumn[];
  rows?: TableRow[];
  tableHeaderGrid?: HeaderCell[][];
  className?: string;
}

export const TablePreview = React.memo(function TablePreview({
  tableTitle,
  columns = [],
  rows = [],
  tableHeaderGrid,
  className,
}: TablePreviewProps) {
  // 테이블이 비어있는 경우
  if (columns.length === 0 || rows.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <div className="text-center text-gray-500">
            <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <p>테이블을 구성해주세요</p>
            <p className="text-sm">열과 행을 추가하여 테이블을 만들어보세요</p>
          </div>
        </CardContent>
      </Card>
    );
  }

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
            className="mx-auto border-collapse border border-gray-300 text-sm"
            style={{
              tableLayout: 'fixed',
              width: `${columns.reduce((sum, col) => sum + (col.width || 150), 0)}px`,
            }}
          >
            {/* 열 너비 정의 */}
            <colgroup>
              {columns.map((column, index) => (
                <col key={`col-${index}`} style={{ width: `${column.width || 150}px` }} />
              ))}
            </colgroup>

            {/* 헤더 */}
            <thead>
              {tableHeaderGrid && tableHeaderGrid.length > 0 ? (
                tableHeaderGrid.map((headerRow, rowIdx) => (
                  <tr key={`header-row-${rowIdx}`}>
                    {headerRow.map((cell) => (
                      <th
                        key={cell.id}
                        className="border border-gray-300 bg-gray-50 p-3 text-center font-medium"
                        colSpan={cell.colspan}
                        rowSpan={cell.rowspan}
                      >
                        {cell.label || <span className="text-sm text-gray-400 italic"></span>}
                      </th>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  {columns.map((column, colIndex) => {
                    if (column.isHeaderHidden) return null;
                    const headerColspan = column.colspan || 1;
                    const mergedWidth = headerColspan > 1
                      ? columns.slice(colIndex, colIndex + headerColspan).reduce((sum, col) => sum + (col.width || 150), 0)
                      : (column.width || 150);
                    return (
                      <th
                        key={column.id}
                        className="border border-gray-300 bg-gray-50 p-3 text-center font-medium"
                        style={{ width: `${mergedWidth}px` }}
                        colSpan={headerColspan}
                      >
                        {column.label || <span className="text-sm text-gray-400 italic"></span>}
                      </th>
                    );
                  })}
                </tr>
              )}
            </thead>

            {/* 본문 */}
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.cells.map((cell) => {
                    if (cell.isHidden) return null;

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
                          className={`flex h-full w-full flex-col ${
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
                                ? 'flex items-start justify-start'
                                : cell.horizontalAlign === 'center'
                                  ? 'flex items-center justify-center'
                                  : 'flex items-end justify-end'
                            }`}
                          >
                            <CellContent cell={cell} />
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
});
