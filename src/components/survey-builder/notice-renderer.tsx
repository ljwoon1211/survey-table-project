"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { convertHtmlImageUrlsToProxy } from "@/lib/image-utils";

interface NoticeRendererProps {
  content: string;
  requiresAcknowledgment?: boolean;
  value?: boolean;
  onChange?: (acknowledged: boolean) => void;
  isTestMode?: boolean;
}

export function NoticeRenderer({
  content,
  requiresAcknowledgment = false,
  value = false,
  onChange,
  isTestMode = false,
}: NoticeRendererProps) {
  const [acknowledged, setAcknowledged] = useState(value);

  const handleAcknowledgmentChange = (checked: boolean) => {
    setAcknowledged(checked);
    onChange?.(checked);
  };

  return (
    <div className="space-y-4">
      {/* Rich Text Content Display */}
      <div
        className="prose prose-sm max-w-none p-6 bg-blue-50 border-2 border-blue-200 rounded-lg
          [&_table]:border-collapse [&_table]:w-full [&_table]:my-4 [&_table]:border-2 [&_table]:border-gray-300
          [&_table_td]:border [&_table_td]:border-gray-300 [&_table_td]:px-3 [&_table_td]:py-2
          [&_table_th]:border [&_table_th]:border-gray-300 [&_table_th]:px-3 [&_table_th]:py-2
          [&_table_th]:font-normal [&_table_th]:bg-transparent
          [&_table_p]:m-0
          [&_p]:min-h-[1.6em]"
        dangerouslySetInnerHTML={{ __html: convertHtmlImageUrlsToProxy(content) }}
        style={{
          // TipTap 스타일 재정의
          fontSize: "14px",
          lineHeight: "1.6",
        }}
      />

      {/* Acknowledgment Checkbox */}
      {requiresAcknowledgment && (
        <div className="flex items-start space-x-3 p-4 bg-white border-2 border-blue-300 rounded-lg">
          <input
            type="radio"
            id="acknowledgment-check"
            checked={acknowledged}
            onChange={(e) => handleAcknowledgmentChange(e.target.checked)}
            className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500 mt-0.5"
            disabled={!isTestMode && !onChange}
          />
          <Label
            htmlFor="acknowledgment-check"
            className="text-sm font-medium text-gray-900 cursor-pointer flex-1"
          >
            위 내용을 읽고 이해했습니다.
          </Label>
        </div>
      )}

      {requiresAcknowledgment && !acknowledged && (
        <div className="text-xs text-red-600 p-2 bg-red-50 rounded">
          ⚠️ 위 내용을 확인하고 체크해주세요.
        </div>
      )}
    </div>
  );
}
