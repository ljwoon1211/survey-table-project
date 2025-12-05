"use client";

import { Card, AreaChart, Badge } from "@tremor/react";
import { TrendingUp } from "lucide-react";
import type { TimelineData } from "@/lib/analytics/types";

interface ResponseTimelineProps {
  data: TimelineData[];
  title?: string;
}

export function ResponseTimeline({ data, title = "응답 추이" }: ResponseTimelineProps) {
  // 날짜 포맷팅
  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    }),
    "전체 응답": d.responses,
    "완료된 응답": d.completed,
  }));

  // 총계 계산
  const totalResponses = data.reduce((sum, d) => sum + d.responses, 0);
  const totalCompleted = data.reduce((sum, d) => sum + d.completed, 0);

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">최근 {data.length}일간 응답 현황</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge color="blue">전체 {totalResponses}개</Badge>
          <Badge color="green">완료 {totalCompleted}개</Badge>
        </div>
      </div>

      {data.length > 0 ? (
        <AreaChart
          className="h-72 mt-4"
          data={chartData}
          index="date"
          categories={["전체 응답", "완료된 응답"]}
          colors={["blue", "green"]}
          valueFormatter={(value) => `${value}개`}
          showAnimation
          showLegend
          curveType="monotone"
        />
      ) : (
        <div className="h-72 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>아직 응답 데이터가 없습니다.</p>
          </div>
        </div>
      )}
    </Card>
  );
}
