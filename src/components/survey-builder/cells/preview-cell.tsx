'use client';

import React from 'react';

import { Image, Video } from 'lucide-react';

import type { TableCell } from '@/types/survey';

import { getYouTubeEmbedUrl } from '../table-cell-renderers';
import { ImageCell } from './image-cell';

/** 미리보기용 셀 컨텐츠 (읽기 전용) */
export const PreviewCell = React.memo(function PreviewCell({ cell }: { cell: TableCell }) {
  if (!cell) return <span className="text-sm text-gray-400">-</span>;

  switch (cell.type) {
    case 'checkbox':
      return cell.checkboxOptions && cell.checkboxOptions.length > 0 ? (
        <div className="space-y-2">
          {cell.content && cell.content.trim() && (
            <div className="mb-3 text-sm font-medium whitespace-pre-wrap [overflow-wrap:anywhere] text-gray-700">
              {cell.content}
            </div>
          )}
          {cell.checkboxOptions.map((option) => (
            <div key={option.id} className="flex items-center gap-2">
              <input type="checkbox" checked={option.checked || false} readOnly className="rounded" />
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
        <div className="space-y-2">
          {cell.content && cell.content.trim() && (
            <div className="mb-3 text-sm font-medium whitespace-pre-wrap [overflow-wrap:anywhere] text-gray-700">
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
        <div className="flex flex-col space-y-2">
          {cell.content && cell.content.trim() && (
            <div className="text-sm font-medium whitespace-pre-wrap [overflow-wrap:anywhere] text-gray-700">
              {cell.content}
            </div>
          )}
          <select className="w-full rounded border border-gray-300 p-2 text-sm" disabled>
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
        <ImageCell cell={cell} cellResponse={undefined} onUpdateValue={() => {}} />
      ) : (
        <div className="flex items-center gap-2 text-gray-500">
          <Image className="h-4 w-4" />
          <span className="text-sm">이미지 없음</span>
        </div>
      );

    case 'video':
      return cell.videoUrl ? (
        <div className="flex flex-col items-center gap-2">
          {(cell.videoUrl.includes('youtube.com') || cell.videoUrl.includes('youtu.be')) ? (
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
        <div className="flex flex-col space-y-2">
          {cell.content && cell.content.trim() && (
            <div className="text-sm font-medium whitespace-pre-wrap [overflow-wrap:anywhere] text-gray-700">
              {cell.content}
            </div>
          )}
          <input
            type="text"
            placeholder={cell.placeholder || '답변을 입력하세요...'}
            maxLength={cell.inputMaxLength}
            disabled
            className="w-full rounded border border-gray-300 bg-gray-50 p-2 text-sm"
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
        <div className="text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
          {cell.content}
        </div>
      ) : (
        <span className="text-sm text-gray-400" />
      );
  }
});
