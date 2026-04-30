'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import type { DailyBucket, DailyMode } from '@/lib/operations/aggregate-daily';

import { EmptyState } from './empty-state';

interface Props {
  data: DailyBucket[];
  mode: DailyMode;
  /** mode === 'hour' 일 때 현재 선택된 일자 (KST, 'YYYY-MM-DD'). */
  hourModeDate?: string;
  /** hour 모드 날짜 select 의 옵션. day 모드에서도 토글 시 기본 날짜 결정에 쓰인다. */
  availableDates: string[];
}

/**
 * 단일 색상 막대 — 차트 토큰 1개만 정의한다.
 * (디자인 팔레트의 blue-600 톤을 직접 지정 — 프로젝트 전역 --chart-1 토큰이 아직 없다.)
 */
const CHART_CONFIG: ChartConfig = {
  count: {
    label: '참여자',
    color: 'hsl(217, 91%, 60%)',
  },
};

const numberFormatter = new Intl.NumberFormat('ko-KR');

/**
 * 운영 현황 콘솔 — A2 일자별 참여자수 차트.
 *
 * - 헤더: 좌측 타이틀 + 우측 day/hour 토글 (+ hour 모드 시 일자 select)
 * - 토글/일자 변경은 URL 쿼리스트링(`?mode=...&date=...`)을 갱신해 서버 컴포넌트가 재요청하게 한다.
 *   → 다른 쿼리 파라미터는 그대로 보존한다.
 * - 데이터가 비어 있으면 (day 모드, 응답 0건) EmptyState로 대체한다.
 */
export function DailyParticipationChart({
  data,
  mode,
  hourModeDate,
  availableDates,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /** 현재 search params 를 복제하여 mutate 후 URL 으로 push. */
  const pushParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams?.toString() ?? '');
      mutate(next);
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname ?? '');
    },
    [pathname, router, searchParams],
  );

  const handleSelectDay = useCallback(() => {
    pushParams((p) => {
      p.set('mode', 'day');
      p.delete('date');
    });
  }, [pushParams]);

  const handleSelectHour = useCallback(() => {
    // 가장 최근 응답 일자를 기본 선택. 없으면 빈 문자열로 두고 서버 측 기본값(today)에 위임.
    const fallbackDate =
      hourModeDate ?? availableDates[availableDates.length - 1] ?? '';
    pushParams((p) => {
      p.set('mode', 'hour');
      if (fallbackDate) p.set('date', fallbackDate);
    });
  }, [availableDates, hourModeDate, pushParams]);

  const handleDateChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newDate = e.target.value;
      pushParams((p) => {
        p.set('mode', 'hour');
        p.set('date', newDate);
      });
    },
    [pushParams],
  );

  return (
    <Card>
      <CardContent className="px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">일자별 참여자수</h3>
          <div className="flex items-center gap-2">
            {mode === 'hour' && (
              <select
                aria-label="시간 분포를 표시할 일자"
                value={hourModeDate ?? ''}
                onChange={handleDateChange}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                {availableDates.length === 0 && hourModeDate && (
                  <option value={hourModeDate}>{hourModeDate}</option>
                )}
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
            <div
              role="tablist"
              aria-label="집계 단위"
              className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white"
            >
              <ToggleButton active={mode === 'day'} onClick={handleSelectDay}>
                일
              </ToggleButton>
              <ToggleButton active={mode === 'hour'} onClick={handleSelectHour}>
                시간
              </ToggleButton>
            </div>
          </div>
        </div>

        {data.length === 0 ? (
          <EmptyState message="참여자 데이터가 없습니다" />
        ) : (
          <ChartContainer
            config={CHART_CONFIG}
            className="aspect-auto h-60 w-full"
          >
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                interval="preserveStartEnd"
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
                content={<ChartTooltipContent indicator="dot" hideLabel={false} />}
              />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ToggleButton({ active, onClick, children }: ToggleButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'px-3 py-1 text-xs transition-colors',
        active
          ? 'bg-blue-600 text-white'
          : 'bg-white text-slate-600 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  );
}
