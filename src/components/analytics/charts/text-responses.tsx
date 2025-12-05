"use client";

import { useState } from "react";
import { Card, Badge, TextInput } from "@tremor/react";
import { Search, MessageSquare, FileText } from "lucide-react";
import type { TextAnalytics } from "@/lib/analytics/types";
import { formatPercentage } from "@/lib/analytics/analyzer";

interface TextResponsesProps {
  data: TextAnalytics;
}

export function TextResponses({ data }: TextResponsesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filteredResponses = data.responses.filter((r) =>
    r.value.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const displayResponses = showAll ? filteredResponses : filteredResponses.slice(0, 10);

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{data.questionTitle}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {data.totalResponses}개 응답 · 응답률 {formatPercentage(data.responseRate)}
          </p>
        </div>
        <Badge color="violet">{data.questionType === "text" ? "단문형" : "장문형"}</Badge>
      </div>

      {/* 통계 요약 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">총 응답</span>
          </div>
          <p className="text-xl font-semibold text-gray-900 mt-1">{data.totalResponses}개</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">평균 길이</span>
          </div>
          <p className="text-xl font-semibold text-gray-900 mt-1">{Math.round(data.avgLength)}자</p>
        </div>
      </div>

      {/* 자주 사용된 단어 */}
      {data.wordFrequency && data.wordFrequency.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">자주 사용된 단어</h4>
          <div className="flex flex-wrap gap-2">
            {data.wordFrequency.slice(0, 10).map((word) => (
              <span
                key={word.word}
                className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-full"
              >
                {word.word} ({word.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 검색 */}
      <div className="mb-4">
        <TextInput
          icon={Search}
          placeholder="응답 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* 응답 목록 */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {displayResponses.length > 0 ? (
          displayResponses.map((response, idx) => (
            <div
              key={response.id}
              className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{response.value}</p>
              {response.submittedAt && (
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(response.submittedAt).toLocaleString("ko-KR")}
                </p>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>검색 결과가 없습니다.</p>
          </div>
        )}
      </div>

      {/* 더보기 버튼 */}
      {filteredResponses.length > 10 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full mt-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {showAll ? "접기" : `${filteredResponses.length - 10}개 더 보기`}
        </button>
      )}
    </Card>
  );
}
