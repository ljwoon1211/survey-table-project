"use client";

import { Card, BarChart, Badge } from "@tremor/react";
import type { MultipleChoiceAnalytics } from "@/lib/analytics/types";
import { formatPercentage } from "@/lib/analytics/analyzer";

interface MultipleChoiceChartProps {
  data: MultipleChoiceAnalytics;
}

export function MultipleChoiceChart({ data }: MultipleChoiceChartProps) {
  const chartData = data.distribution.map((d) => ({
    name: d.label,
    "선택 수": d.count,
    선택률: d.percentage,
  }));

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{data.questionTitle}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {data.totalResponses}명 응답 · 응답률 {formatPercentage(data.responseRate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge color="emerald">복수 선택</Badge>
          <span className="text-xs text-gray-500">
            평균 {data.avgSelectionsPerResponse.toFixed(1)}개 선택
          </span>
        </div>
      </div>

      <BarChart
        className="mt-4 h-72"
        data={chartData}
        index="name"
        categories={["선택 수"]}
        colors={["emerald"]}
        valueFormatter={(value) => `${value}명`}
        layout="vertical"
        showAnimation
        showLegend={false}
      />

      {/* 상세 목록 */}
      <div className="mt-6 border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">상세 분포</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {data.distribution.map((item) => (
            <div
              key={item.value}
              className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
            >
              <span className="text-sm text-gray-600 truncate flex-1">{item.label}</span>
              <div className="flex items-center gap-2 ml-2">
                <span className="text-sm font-medium text-gray-900">{item.count}명</span>
                <span className="text-xs text-gray-500">({formatPercentage(item.percentage)})</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
