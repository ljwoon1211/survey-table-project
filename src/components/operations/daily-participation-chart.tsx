'use client';

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import type { DailyBucket, DailyMode } from '@/lib/operations/aggregate-daily';

import { EmptyState } from './empty-state';

/**
 * day 모드일 때 차트에 노출할 최근 N일.
 * hour 모드는 24버킷 고정이라 영향 없음.
 */
const RECENT_DAYS_LIMIT = 7;

interface Props {
  data: DailyBucket[];
  mode: DailyMode;
  /** mode === 'hour' 일 때 현재 선택된 일자 (KST, 'YYYY-MM-DD'). */
  hourModeDate?: string;
  /** hour 모드 날짜 select 의 옵션. day 모드에서도 토글 시 기본 날짜 결정에 쓰인다. */
  availableDates: string[];
  /** day 모드에서 보여줄 7일 구간의 offset. 0 = 최근 7일, 1 = 그 이전 7일, ... */
  weekOffset: number;
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
  weekOffset,
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
      router.push(qs ? `${pathname}?${qs}` : pathname ?? '', { scroll: false });
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

  const handleWeekOffset = useCallback(
    (delta: 1 | -1) => {
      const next = Math.max(0, weekOffset + delta);
      pushParams((p) => {
        p.set('mode', 'day');
        if (next === 0) {
          p.delete('weekOffset');
        } else {
          p.set('weekOffset', String(next));
        }
      });
    },
    [pushParams, weekOffset],
  );

  // day 모드는 weekOffset 기준 7개 슬라이스, hour 모드는 24버킷 그대로
  // weekOffset=0 → 마지막 7개, weekOffset=1 → 그 이전 7개, ...
  const visibleData = useMemo(() => {
    if (mode !== 'day') return data;
    const end = data.length - RECENT_DAYS_LIMIT * weekOffset;
    const start = Math.max(0, end - RECENT_DAYS_LIMIT);
    return data.slice(start, end);
  }, [data, mode, weekOffset]);

  const totalDays = mode === 'day' ? data.length : 0;
  const canGoPrev = mode === 'day' && (weekOffset + 1) * RECENT_DAYS_LIMIT < totalDays;
  const canGoNext = mode === 'day' && weekOffset > 0;

  return (
    <Card>
      <CardContent className="px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">일자별 참여자수</h3>
          <div className="flex items-center gap-2">
            {mode === 'day' && visibleData.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <button
                  type="button"
                  onClick={() => handleWeekOffset(1)}
                  disabled={!canGoPrev}
                  aria-label="이전 7일"
                  className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ‹
                </button>
                <span className="tabular-nums">
                  {formatRangeLabel(visibleData[0].bucket)} ~{' '}
                  {formatRangeLabel(visibleData[visibleData.length - 1].bucket)}
                </span>
                <button
                  type="button"
                  onClick={() => handleWeekOffset(-1)}
                  disabled={!canGoNext}
                  aria-label="다음 7일"
                  className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            )}
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

        {visibleData.length === 0 ? (
          <EmptyState message="참여자 데이터가 없습니다" />
        ) : (
          <ChartContainer
            config={CHART_CONFIG}
            className="aspect-auto h-64 w-full"
          >
            <BarChart
              data={visibleData}
              margin={{ top: 20, right: 8, bottom: 12, left: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                interval={0}
                height={40}
                tick={<MultiLineTick />}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                width={32}
                tickFormatter={(v: number) => numberFormatter.format(v)}
              />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="count"
                  position="top"
                  className="fill-slate-700"
                  fontSize={11}
                  formatter={(v: number) => (v > 0 ? numberFormatter.format(v) : '')}
                />
              </Bar>
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

/** 'YYYY-MM-DD' → 'MM-DD' 로 단축. 다른 형식은 그대로 (M-2). */
function formatRangeLabel(bucket: string): string {
  const m = bucket.match(/^(\d{4})-(\d{2}-\d{2})$/);
  return m ? m[2] : bucket;
}

/**
 * X축 tick 커스텀 렌더러 — day 모드의 'MM-DD (요일)' 라벨을
 * 두 줄(MM-DD / (요일))로 분리해 표기. 다른 형식은 한 줄 그대로.
 */
interface TickProps {
  x?: number;
  y?: number;
  payload?: { value?: string };
}
function MultiLineTick({ x = 0, y = 0, payload }: TickProps) {
  const value = String(payload?.value ?? '');
  const dayMatch = value.match(/^(\d{2}-\d{2})\s+(\(.\))$/);
  if (dayMatch) {
    return (
      <text x={x} y={y} textAnchor="middle" fill="#64748b" fontSize={11}>
        <tspan x={x} dy="12">{dayMatch[1]}</tspan>
        <tspan x={x} dy="14">{dayMatch[2]}</tspan>
      </text>
    );
  }
  return (
    <text x={x} y={y} dy={14} textAnchor="middle" fill="#64748b" fontSize={11}>
      {value}
    </text>
  );
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
