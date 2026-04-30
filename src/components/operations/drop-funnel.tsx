'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { DropFunnelOutput } from '@/lib/operations/drop-funnel';

import { EmptyState } from './empty-state';

interface Props {
  data: DropFunnelOutput;
}

/** 단일 시리즈 — drop 막대 색상은 mockup의 rose 톤. */
const CHART_CONFIG: ChartConfig = {
  dropCount: {
    label: '이탈자',
    color: 'hsl(351, 83%, 70%)', // rose-400 근사
  },
};

const numberFormatter = new Intl.NumberFormat('ko-KR');

/** x축 눈금 라벨이 길면 8자 + ellipsis로 잘라낸다. */
function tickFormatter(value: string): string {
  if (typeof value !== 'string') return String(value);
  if (value.length <= 8) return value;
  return `${value.slice(0, 8)}…`;
}

/**
 * LabelList formatter — 누적 진행률 % 라벨.
 * - null (others/legacy)이면 빈 문자열 → 라벨 미표시.
 * - 0~100 사이 숫자 → 정수 % 표기 (예: '80%').
 *
 * recharts의 formatter 시그니처: (value: ValueType, ...) => ReactNode | string.
 * value는 LabelList가 dataKey로 추출한 cumulativeProgressPct 값.
 */
function formatProgressLabel(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return `${Math.round(value)}%`;
}

/**
 * 운영 현황 콘솔 — A5 Drop funnel.
 *
 * x축: 질문 위치 (라벨), y축: 이탈자 수.
 * 막대 위 라벨: 누적 진행률(%). '기타'/'(legacy)' 막대는 단일 위치가 아니므로 라벨 생략.
 *
 * 빈 상태:
 *   bars 배열이 비어 있으면 EmptyState로 대체 (drop 응답이 없는 경우).
 */
export function DropFunnel({ data }: Props) {
  return (
    <Card>
      <CardContent className="px-5 py-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Drop 응답 위치별 사례 (Funnel)
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            x: 질문 위치 · y: 이탈자 수 · 라벨: 누적 진행률 %
          </p>
        </div>

        {data.bars.length === 0 ? (
          <EmptyState message="drop 응답이 없습니다" />
        ) : (
          <ChartContainer
            config={CHART_CONFIG}
            className="aspect-auto h-72 w-full"
          >
            <BarChart
              data={data.bars}
              margin={{ top: 24, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                interval={0}
                tickFormatter={tickFormatter}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                width={32}
                tickFormatter={(v: number) => numberFormatter.format(v)}
              />
              <ChartTooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.15)' }}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    hideLabel={false}
                    formatter={(value, _name, item) => {
                      // 'value' = dropCount (number). 'item.payload' = DropFunnelBar.
                      const payload = item.payload as {
                        cumulativeProgressPct: number | null;
                      };
                      const lines: React.ReactNode[] = [
                        <span key="count">
                          이탈자 {numberFormatter.format(Number(value))}명
                        </span>,
                      ];
                      if (
                        typeof payload.cumulativeProgressPct === 'number' &&
                        Number.isFinite(payload.cumulativeProgressPct)
                      ) {
                        lines.push(
                          <span key="pct" className="ml-2 text-slate-500">
                            누적 {Math.round(payload.cumulativeProgressPct)}%
                          </span>,
                        );
                      }
                      return <div className="flex items-center">{lines}</div>;
                    }}
                  />
                }
              />
              <Bar
                dataKey="dropCount"
                fill="var(--color-dropCount)"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="cumulativeProgressPct"
                  position="top"
                  formatter={formatProgressLabel}
                  className="fill-slate-500 text-[10px]"
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
