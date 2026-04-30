'use client';

import { useCallback, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  LabelList,
  XAxis,
  YAxis,
} from 'recharts';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Card, CardContent } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { DwellOutput, DwellPage } from '@/lib/operations/page-dwell';

import { EmptyState } from './empty-state';

const DWELL_PAGE_SIZE = 10;

interface Props {
  data: DwellOutput;
  /** 페이지 offset. 0 = 첫 10개, 1 = 다음 10개, ... */
  pageOffset: number;
}

/** 단일 시리즈 — 평균 체류시간 막대. mockup 톤은 monochromatic-blue. */
const CHART_CONFIG: ChartConfig = {
  meanSeconds: {
    label: '평균 체류',
    color: 'hsl(217, 91%, 60%)', // blue-500 근사
  },
};

/**
 * 초 단위 시간 → 'M:SS' 또는 'H:MM:SS' 라벨.
 *
 * - 1시간 미만: 'M:SS'
 * - 1시간 이상: 'H:MM:SS'
 * - 음수/NaN/Infinity: '—'
 *
 * (T12 response-time-stats의 동일 함수 — 표시 전용이라 의도적으로 로컬 복제.)
 */
function formatSeconds(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '—';
  const total = Math.round(s);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    const mm = String(minutes).padStart(2, '0');
    return `${hours}:${mm}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

/**
 * X축 멀티라인 tick — mockup p1 형식 (2줄):
 *   1행: 페이지 N (page 있을 때만, 회색)
 *   2행: 라벨 (questionCode 또는 groupName)
 *
 * A5(drop-funnel)의 FunnelTick과 동일한 패턴.
 */
interface DwellTickProps {
  x?: number;
  y?: number;
  payload?: { value?: string | number; index?: number };
  pages: DwellPage[];
}

function DwellTick({ x = 0, y = 0, payload, pages }: DwellTickProps) {
  const idx = payload?.index ?? 0;
  const page = pages[idx];
  const label = String(payload?.value ?? '');
  const pageText = page?.page != null ? `페이지 ${page.page}` : '';

  return (
    <text x={x} y={y} textAnchor="middle" fontSize={11}>
      {pageText && (
        <tspan x={x} dy={12} fill="#94a3b8">
          {pageText}
        </tspan>
      )}
      <tspan x={x} dy={12} fill="#475569">
        {label}
      </tspan>
    </text>
  );
}

/**
 * 차트에 직접 들어갈 행 형태.
 * - meanSeconds: y축 값 (null인 행은 0으로 — 막대가 안 보임).
 * - errorBar: ErrorBar용 ± 오프셋 (sd가 있으면 sd, 없으면 0).
 * - sdSeconds: 툴팁에 표기하기 위해 보존.
 */
interface ChartRow {
  stepId: string;
  label: string;
  position: number;
  n: number;
  meanSeconds: number;
  sdSeconds: number | null;
  errorBar: number;
}

/**
 * 운영 현황 콘솔 — A6 페이지별 체류시간 분포.
 *
 * x축: 페이지 라벨, y축: 평균 체류시간(초).
 * 각 막대 위에 ± SD ErrorBar.
 *
 * Edge:
 *   - data.pages가 비었거나 모든 page의 n=0 → EmptyState.
 *   - n=0 또는 mean=null인 행은 차트에서 막대 높이 0 + ErrorBar 미렌더.
 */
export function PageDwellDistribution({ data, pageOffset }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 현재 offset에 해당하는 step 슬라이스
  const visiblePages = useMemo(() => {
    const start = pageOffset * DWELL_PAGE_SIZE;
    return data.pages.slice(start, start + DWELL_PAGE_SIZE);
  }, [data.pages, pageOffset]);

  const totalPages = data.pages.length;
  const canGoPrev = pageOffset > 0;
  const canGoNext = (pageOffset + 1) * DWELL_PAGE_SIZE < totalPages;

  const handlePageOffset = useCallback(
    (delta: 1 | -1) => {
      const next = Math.max(0, pageOffset + delta);
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (next === 0) {
        params.delete('dwellOffset');
      } else {
        params.set('dwellOffset', String(next));
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname ?? '', { scroll: false });
    },
    [pageOffset, pathname, router, searchParams],
  );

  // ErrorBar용 오프셋과 차트 친화적 형태로 변환. visiblePages 기준으로 렌더.
  const chartRows = useMemo<ChartRow[]>(() => {
    return visiblePages.map((p) => {
      const mean = p.meanSeconds ?? 0;
      // sdSeconds가 null이면 errorBar=0 → recharts가 막대를 안 그린다.
      const errorBar = p.sdSeconds ?? 0;
      return {
        stepId: p.stepId,
        label: p.label,
        position: p.position,
        n: p.n,
        meanSeconds: mean,
        sdSeconds: p.sdSeconds,
        errorBar,
      };
    });
  }, [visiblePages]);

  const allEmpty = visiblePages.length === 0 || data.pages.length === 0;

  return (
    <Card>
      <CardContent className="px-5 py-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              페이지별 체류시간 분포
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              평균 ± 표준편차 (상하 2.5% 트리밍)
            </p>
          </div>
          {totalPages > DWELL_PAGE_SIZE && (
            <div className="flex shrink-0 items-center gap-2 text-xs text-slate-600">
              <button
                type="button"
                onClick={() => handlePageOffset(-1)}
                disabled={!canGoPrev}
                aria-label="이전 페이지"
                className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹
              </button>
              <span className="tabular-nums">
                {pageOffset * DWELL_PAGE_SIZE + 1}~
                {Math.min((pageOffset + 1) * DWELL_PAGE_SIZE, totalPages)} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageOffset(1)}
                disabled={!canGoNext}
                aria-label="다음 페이지"
                className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {allEmpty ? (
          <EmptyState
            message="체류시간 데이터가 없습니다"
            description="응답이 누적되면 여기에 표시됩니다"
          />
        ) : (
          <ChartContainer config={CHART_CONFIG} className="aspect-auto h-72 w-full">
            <BarChart
              data={chartRows}
              margin={{ top: 16, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                interval={0}
                height={44}
                tick={(tickProps) => (
                  <DwellTick {...tickProps} pages={visiblePages} />
                )}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                width={48}
                tickFormatter={(v: number) => formatSeconds(v)}
              />
              <ChartTooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.15)' }}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    hideLabel={false}
                    formatter={(_value, _name, item) => {
                      const payload = item.payload as ChartRow;
                      const meanLine =
                        payload.n === 0
                          ? '데이터 없음'
                          : `평균 ${formatSeconds(payload.meanSeconds)}`;
                      const sdLine =
                        payload.sdSeconds === null
                          ? null
                          : `± ${formatSeconds(payload.sdSeconds)}`;
                      return (
                        <div className="flex flex-col gap-0.5">
                          <span>{meanLine}</span>
                          {sdLine && (
                            <span className="text-slate-500">{sdLine}</span>
                          )}
                          <span className="text-slate-400 text-[10px]">
                            n = {payload.n}
                          </span>
                        </div>
                      );
                    }}
                  />
                }
              />
              <Bar
                dataKey="meanSeconds"
                fill="var(--color-meanSeconds)"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              >
                <ErrorBar
                  dataKey="errorBar"
                  width={6}
                  stroke="currentColor"
                  strokeWidth={1.5}
                />
                <LabelList
                  dataKey="meanSeconds"
                  position="top"
                  className="fill-slate-700"
                  fontSize={11}
                  offset={12}
                  formatter={(v: number) => (v > 0 ? formatSeconds(v) : '')}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
