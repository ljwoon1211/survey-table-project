'use client';

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import {
  FileArchive,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';

function pickIcon(mime: string | null) {
  if (!mime) return { Icon: FileText, color: 'text-gray-500' };
  if (mime === 'application/pdf') return { Icon: FileText, color: 'text-red-600' };
  if (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel'
  ) {
    return { Icon: FileSpreadsheet, color: 'text-green-600' };
  }
  if (
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    mime === 'application/hwp+zip'
  ) {
    return { Icon: FileArchive, color: 'text-gray-600' };
  }
  if (mime.startsWith('application/vnd.hancom.hwp') || mime.startsWith('application/x-hwp') || mime === 'application/hwp' || mime === 'application/haansofthwp' || mime === 'application/haansofthwpx') {
    return { Icon: FileText, color: 'text-purple-600' };
  }
  if (mime.startsWith('application/vnd.openxmlformats-officedocument.wordprocessingml') || mime === 'application/msword') {
    return { Icon: FileText, color: 'text-blue-600' };
  }
  if (mime.startsWith('application/vnd.openxmlformats-officedocument.presentationml') || mime === 'application/vnd.ms-powerpoint') {
    return { Icon: FileText, color: 'text-orange-600' };
  }
  return { Icon: FileText, color: 'text-gray-500' };
}

function formatSize(size: number | string | null): string {
  if (size == null) return '';
  const n = typeof size === 'string' ? parseInt(size, 10) : size;
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function FileAttachmentNodeView({ node, selected }: NodeViewProps) {
  const { label, filename, size, mime } = node.attrs as {
    label: string;
    filename: string | null;
    size: number | string | null;
    mime: string | null;
  };
  const { Icon, color } = pickIcon(mime);
  const sizeText = formatSize(size);

  return (
    <NodeViewWrapper
      as="span"
      className={`inline-flex max-w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 align-top shadow-sm ${
        selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
      }`}
      data-drag-handle
    >
      <Icon className={`h-5 w-5 flex-shrink-0 ${color}`} aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-gray-800">
          {label || filename || '첨부 파일'}
        </span>
        {(filename || sizeText) && (
          <span className="truncate text-xs text-gray-500">
            {[filename, sizeText].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
    </NodeViewWrapper>
  );
}
