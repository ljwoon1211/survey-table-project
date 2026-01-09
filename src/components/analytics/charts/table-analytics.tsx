"use client";

import { Card, BarChart, Badge, TabGroup, TabList, Tab, TabPanels, TabPanel } from "@tremor/react";
import { Table, BarChart3, Grid3X3 } from "lucide-react";
import type { TableAnalytics } from "@/lib/analytics/types";
import { formatPercentage } from "@/lib/analytics/analyzer";

interface TableAnalyticsChartProps {
  data: TableAnalytics;
}

// 20가지 색상 팔레트 (Tremor 색상 + 커스텀)
const PALETTE = [
  "blue",
  "cyan",
  "indigo",
  "violet",
  "fuchsia",
  "rose",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "sky",
  "slate",
  "zinc",
  "neutral",
  "stone",
  "gray",
];

export function TableAnalyticsChart({ data }: TableAnalyticsChartProps) {
  // 스택 막대 그래프를 위한 데이터 변환
  // 각 행(Row)을 기준으로, 각 옵션(Column 값 등)의 분포를 계산해야 함.
  // 현재 data.rowSummary.details에 옵션별 분포가 들어있음.
  // details가 없으면 '응답함'으로 처리.

  // 모든 가능한 카테고리(옵션 이름들) 수집
  const allCategories = new Set<string>();
  data.rowSummary.forEach((row) => {
    if (row.details) {
      Object.keys(row.details).forEach((key) => allCategories.add(key));
    } else {
      allCategories.add("응답함");
    }
  });
  const categoriesList = Array.from(allCategories);

  // 차트 데이터 생성
  const stackChartData = data.rowSummary.map((row) => {
    const item: Record<string, any> = {
      name: row.rowLabel.length > 20 ? row.rowLabel.slice(0, 20) + "..." : row.rowLabel,
      fullName: row.rowLabel,
    };

    // details가 있으면 각 옵션별 수치를, 없으면 총 인터랙션 수를 '응답함'으로 할당
    if (row.details) {
      categoriesList.forEach((cat) => {
        item[cat] = row.details?.[cat] || 0;
      });
    } else {
      item["응답함"] = row.totalInteractions;
    }

    // 응답하지 않음(회색 처리용) 계산 (필요시)
    // 여기서는 응답한 수치만 보여주는 것이 깔끔함.

    return item;
  });

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
          <Tab icon={BarChart3}>항목별 분포</Tab>
          <Tab icon={Grid3X3}>상세 보기 (히트맵)</Tab>
        </TabList>
        <TabPanels>
          {/* 스택 막대 차트 */}
          <TabPanel>
            <BarChart
              className="mt-6 h-96"
              data={stackChartData}
              index="name"
              categories={categoriesList}
              colors={PALETTE}
              valueFormatter={(value) => `${value}명`}
              layout="vertical"
              stack={true}
              showAnimation
              showLegend={true}
              yAxisWidth={100}
            />

            {data.rowSummary.length > 15 && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                전체 {data.rowSummary.length}개 항목 중 일부만 표시될 수 있습니다.
              </p>
            )}
          </TabPanel>

          {/* 상세 테이블 (히트맵 스타일) */}
          <TabPanel>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-700 w-1/4">
                      항목 (행)
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700 w-24">응답 수</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700 w-24">선택률</th>
                    <th className="py-3 px-4 font-medium text-gray-700">상세 분포</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rowSummary.map((row, idx) => {
                    // 히트맵 배경색 농도 계산 (최대 100% 기준)
                    const intensity = Math.min(row.interactionRate, 100) / 100;
                    // Amber 색상 기반 (R=245, G=158, B=11)
                    // 투명도를 조절하여 히트맵 효과
                    const bgColor = `rgba(245, 158, 11, ${intensity * 0.3})`;

                    return (
                      <tr
                        key={row.rowId}
                        className="border-b border-gray-100 transition-colors hover:bg-gray-50"
                        style={{ backgroundColor: bgColor }}
                      >
                        <td className="py-3 px-4 text-gray-900 font-medium">{row.rowLabel}</td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {row.totalInteractions}명
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-gray-900">
                          {formatPercentage(row.interactionRate)}
                        </td>
                        <td className="py-3 px-4">
                          {/* 미니 바 차트 */}
                          <div className="flex items-center gap-2 h-4 w-full bg-white/50 rounded-full overflow-hidden border border-black/5">
                            {row.details ? (
                              Object.entries(row.details).map(([key, value], i) => {
                                const width = (value / data.totalResponses) * 100;
                                return (
                                  <div
                                    key={key}
                                    className={`h-full first:rounded-l-full last:rounded-r-full bg-${
                                      PALETTE[i % PALETTE.length]
                                    }-500`}
                                    style={{
                                      width: `${width}%`,
                                    }}
                                    title={`${key}: ${value}명`}
                                  />
                                );
                              })
                            ) : (
                              <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{ width: `${Math.min(row.interactionRate, 100)}%` }}
                              />
                            )}
                          </div>
                          {/* 텍스트 상세 */}
                          {row.details && (
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                              {Object.entries(row.details).map(([key, value]) => (
                                <span key={key}>
                                  {key}: <b>{value}</b>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 범례 및 추가 정보 */}
            <div className="mt-4 text-xs text-gray-400 text-right">
              * 배경색이 진할수록 선택률이 높은 항목입니다.
            </div>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </Card>
  );
}
