"use client";

import { Card, ProgressBar } from "@tremor/react";
import { Users, CheckCircle, Clock, TrendingUp, Calendar, BarChart3 } from "lucide-react";
import type { SurveySummary } from "@/lib/analytics/types";
import { formatMinutes, formatNumber } from "@/lib/analytics/analyzer";

interface SummaryCardsProps {
  summary: SurveySummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {/* 총 응답 수 */}
      <Card className="p-4" decoration="top" decorationColor="blue">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">총 응답</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatNumber(summary.totalResponses)}
            </p>
          </div>
          <div className="p-2 bg-blue-50 rounded-lg">
            <Users className="w-5 h-5 text-blue-500" />
          </div>
        </div>
      </Card>

      {/* 완료된 응답 */}
      <Card className="p-4" decoration="top" decorationColor="green">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">완료된 응답</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatNumber(summary.completedResponses)}
            </p>
          </div>
          <div className="p-2 bg-green-50 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
        </div>
        <ProgressBar value={summary.completionRate} color="green" className="mt-3" />
        <p className="text-xs text-gray-500 mt-1">{summary.completionRate.toFixed(1)}% 완료율</p>
      </Card>

      {/* 평균 응답 시간 */}
      <Card className="p-4" decoration="top" decorationColor="amber">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">평균 응답 시간</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatMinutes(summary.avgCompletionTime)}
            </p>
          </div>
          <div className="p-2 bg-amber-50 rounded-lg">
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
        </div>
      </Card>

      {/* 오늘 응답 */}
      <Card className="p-4" decoration="top" decorationColor="violet">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">오늘 응답</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatNumber(summary.todayResponses)}
            </p>
          </div>
          <div className="p-2 bg-violet-50 rounded-lg">
            <Calendar className="w-5 h-5 text-violet-500" />
          </div>
        </div>
      </Card>

      {/* 이번 주 응답 */}
      <Card className="p-4" decoration="top" decorationColor="cyan">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">이번 주 응답</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatNumber(summary.weekResponses)}
            </p>
          </div>
          <div className="p-2 bg-cyan-50 rounded-lg">
            <BarChart3 className="w-5 h-5 text-cyan-500" />
          </div>
        </div>
      </Card>

      {/* 마지막 응답 */}
      <Card className="p-4" decoration="top" decorationColor="rose">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">마지막 응답</p>
            <p className="text-lg font-bold text-gray-900 mt-1">
              {summary.lastResponseAt
                ? new Date(summary.lastResponseAt).toLocaleDateString("ko-KR", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "-"}
            </p>
          </div>
          <div className="p-2 bg-rose-50 rounded-lg">
            <TrendingUp className="w-5 h-5 text-rose-500" />
          </div>
        </div>
      </Card>
    </div>
  );
}
