"use client";

import { Card, BarChart, Badge, TabGroup, TabList, Tab, TabPanels, TabPanel } from "@tremor/react";
import { Table, BarChart3, Grid3X3 } from "lucide-react";
import type { TableAnalytics } from "@/lib/analytics/types";
import { formatPercentage } from "@/lib/analytics/analyzer";

interface TableAnalyticsChartProps {
  data: TableAnalytics;
}

export function TableAnalyticsChart({ data }: TableAnalyticsChartProps) {
  // 행별 요약 데이터 (상위 15개)
  const rowChartData = data.rowSummary.slice(0, 15).map((row) => ({
    name: row.rowLabel.length > 20 ? row.rowLabel.slice(0, 20) + "..." : row.rowLabel,
    fullName: row.rowLabel,
    선택률: row.interactionRate,
    "응답 수": row.totalInteractions,
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
        <Badge color="amber" icon={Table}>
          테이블 ({data.rowSummary.length}개 항목)
        </Badge>
      </div>

      <TabGroup>
        <TabList variant="solid" className="w-fit">
          <Tab icon={BarChart3}>항목별 선택률</Tab>
          <Tab icon={Grid3X3}>상세 보기</Tab>
        </TabList>
        <TabPanels>
          {/* 막대 차트 */}
          <TabPanel>
            <BarChart
              className="mt-6 h-96"
              data={rowChartData}
              index="name"
              categories={["선택률"]}
              colors={["amber"]}
              valueFormatter={(value) => `${value.toFixed(1)}%`}
              layout="vertical"
              showAnimation
              showLegend={false}
            />

            {data.rowSummary.length > 15 && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                상위 15개 항목만 표시됩니다. 전체 {data.rowSummary.length}개 항목
              </p>
            )}
          </TabPanel>

          {/* 상세 테이블 */}
          <TabPanel>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">항목</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">응답 수</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">선택률</th>
                    <th className="py-3 px-4 font-medium text-gray-700 w-40">분포</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rowSummary.map((row, idx) => (
                    <tr
                      key={row.rowId}
                      className={`border-b border-gray-100 ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }`}
                    >
                      <td className="py-3 px-4 text-gray-900">{row.rowLabel}</td>
                      <td className="py-3 px-4 text-right text-gray-600">
                        {row.totalInteractions}명
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900">
                        {formatPercentage(row.interactionRate)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(row.interactionRate, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 상세 옵션 분포 (라디오/셀렉트인 경우) */}
            {data.cellAnalytics.some((row) =>
              row.cells.some(
                (cell) => cell.optionDistribution && cell.optionDistribution.length > 0,
              ),
            ) && (
              <div className="mt-6 border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">상세 옵션 분포</h4>
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {data.cellAnalytics.map((row) =>
                    row.cells
                      .filter(
                        (cell) => cell.optionDistribution && cell.optionDistribution.length > 0,
                      )
                      .map((cell) => (
                        <div
                          key={`${row.rowId}-${cell.cellId}`}
                          className="p-3 bg-gray-50 rounded-lg"
                        >
                          <p className="text-sm font-medium text-gray-700 mb-2">
                            {row.rowLabel} - {cell.columnLabel}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {cell.optionDistribution?.map((opt) => (
                              <span
                                key={opt.value}
                                className="px-2 py-1 text-xs bg-white border border-gray-200 rounded-full"
                              >
                                {opt.label}: {opt.count}명 ({formatPercentage(opt.percentage)})
                              </span>
                            ))}
                          </div>
                        </div>
                      )),
                  )}
                </div>
              </div>
            )}
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </Card>
  );
}
