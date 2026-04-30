import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Activity, ArrowLeft, Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DailyParticipationChart } from '@/components/operations/daily-participation-chart';
import { OperationsTabStrip } from '@/components/operations/operations-tab-strip';
import { DailyStatsTable } from '@/components/operations/daily-stats-table';
import { DropFunnel } from '@/components/operations/drop-funnel';
import { InquiriesEmptyCard } from '@/components/operations/inquiries-empty-card';
import { KpiRow } from '@/components/operations/kpi-row';
import { PageDwellDistribution } from '@/components/operations/page-dwell-distribution';
import { RefreshButton } from '@/components/operations/refresh-button';
import { ResponseTimeStats } from '@/components/operations/response-time-stats';
import { getSurveyById } from '@/data/surveys';
import {
  aggregateDaily,
  aggregateDailyAvailableDates,
} from '@/lib/operations/aggregate-daily.server';
import { aggregateStatus } from '@/lib/operations/aggregate-status.server';
import { getDailyStats } from '@/lib/operations/daily-stats.server';
import { getDropFunnel } from '@/lib/operations/drop-funnel.server';
import { getPageDwell } from '@/lib/operations/page-dwell.server';
import { getResponseTime } from '@/lib/operations/response-time.server';

/**
 * 플랜 §9 정책 — 30초 자동 폴링 의도.
 *
 * 본 라우트는 `searchParams` 를 사용하므로 Next.js 16 의 동적 렌더 규칙상
 * 매 요청 RSC 가 재평가된다 → `revalidate` 는 동적 라우트에서는 사실상 무력화되며
 * ISR 캐시가 활성화된 환경에서만 의미를 갖는다.
 *
 * 사용자 체감 갱신은 (a) 페이지 진입/네비게이션 (b) `<RefreshButton />` 의
 * `router.refresh()` 두 경로로 보장된다. 향후 정적/캐시 환경에서 의미를 살리기
 * 위해 의도값은 보존한다.
 */
export const revalidate = 30;

export const metadata: Metadata = {
  title: '현황 - 응답 진행 현황',
};

interface OperationsOverviewPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    mode?: 'day' | 'hour';
    date?: string;
    weekOffset?: string;
    dwellOffset?: string;
  }>;
}

/**
 * KST(Asia/Seoul) 기준 오늘 일자를 'YYYY-MM-DD' 로 반환.
 * `availableDates` 가 비어 있는 hour 모드 진입 시 fallback 으로 사용한다.
 */
function todayKst(): string {
  const now = new Date();
  // ko-KR 로케일은 'YYYY. MM. DD.' 형태로 반환되므로 정규화해서 'YYYY-MM-DD' 로 만든다.
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now); // en-CA → 'YYYY-MM-DD'
}

/**
 * 현황 콘솔 — Fieldwork report 진입 페이지.
 *
 * 슬라이스 1 의 7개 위젯을 모두 마운트한다 (A1 KPI → A2 일자별 차트 →
 * A3 일자별 통계 → A4 응답시간 → A5 Drop funnel → A6 Page dwell →
 * Inquiries placeholder).
 *
 * - 6개 어댑터를 `Promise.all` 로 병렬 호출.
 * - hour 모드에서 `date` 미지정 시 응답이 존재하는 가장 최근 일자(KST)로 자동 결정.
 *   응답이 전무하면 KST 오늘 일자로 fallback (어댑터의 `hourModeDate` 필수 조건 충족).
 * - 설문이 존재하지 않거나 soft-delete 된 경우 `notFound()` (D-7 전용 UI 는 후속 작업).
 */
export default async function OperationsOverviewPage({
  params,
  searchParams,
}: OperationsOverviewPageProps) {
  const { id: surveyId } = await params;
  const { mode = 'day', date, weekOffset: weekOffsetStr, dwellOffset: dwellOffsetStr } = await searchParams;
  const weekOffset = Math.max(0, parseInt(weekOffsetStr ?? '0', 10) || 0);
  const dwellOffset = Math.max(0, parseInt(dwellOffsetStr ?? '0', 10) || 0);

  // ── 설문 존재 확인 (soft-delete 포함) ──
  const survey = await getSurveyById(surveyId);
  if (!survey || survey.deletedAt) {
    notFound();
  }

  // ── hour 모드 일자 결정 ──
  // 1) 쿼리에 `date` 가 있으면 그 값 사용
  // 2) 없으면 응답이 존재하는 가장 최근 일자
  // 3) 응답 자체가 없으면 KST 오늘 (어댑터가 throw 하지 않도록)
  const availableDates = await aggregateDailyAvailableDates(surveyId);
  const latestAvailable =
    availableDates.length > 0 ? availableDates[availableDates.length - 1] : undefined;
  const effectiveDate =
    mode === 'hour' ? (date ?? latestAvailable ?? todayKst()) : undefined;

  // ── 6개 어댑터 병렬 호출 ──
  const [statusCounts, dailyBuckets, dailyStats, responseTime, dropFunnel, pageDwell] =
    await Promise.all([
      aggregateStatus(surveyId),
      aggregateDaily({ surveyId, mode, hourModeDate: effectiveDate }),
      getDailyStats(surveyId),
      getResponseTime(surveyId),
      getDropFunnel(surveyId),
      getPageDwell(surveyId),
    ]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 — Admin 스타일 (편집·분석 페이지와 동일 패턴) */}
      <nav className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/admin/surveys">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                목록으로
              </Button>
            </Link>
            <div className="h-6 w-px bg-gray-300" />
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <h1 className="max-w-md truncate text-lg font-medium text-gray-900">
                {survey.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <RefreshButton />
            <Link href={`/admin/surveys/${surveyId}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="mr-2 h-4 w-4" />
                설문 편집
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* 응답 현황 / 보고서 / 컨택 탭 strip — nav 헤더 아래 */}
      <OperationsTabStrip surveyId={surveyId} />

      {/* 메인 콘텐츠 */}
      <main className="mx-auto max-w-7xl space-y-4 px-6 py-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900">응답 현황</h2>
          <p className="text-sm text-slate-500">
            응답자 진행 현황 · 일자별 추이 · 응답시간 통계 · 이탈 위치 분석
          </p>
        </div>

        {/* A1 — 응답 진행 현황 KPI */}
        <KpiRow counts={statusCounts} />

        {/* A2 — 일자별/시간대별 참여자수 차트 */}
        <DailyParticipationChart
          data={dailyBuckets}
          mode={mode}
          hourModeDate={effectiveDate}
          availableDates={availableDates}
          weekOffset={weekOffset}
        />

        {/* A3 — 일자별 응답 통계 테이블 */}
        <DailyStatsTable data={dailyStats} />

        {/* A4 — 응답시간 통계 (절사평균 ± SD) */}
        <ResponseTimeStats data={responseTime} />

        {/* A5 — Drop funnel (질문별 누적 진행률 + Top10 이탈) */}
        <DropFunnel data={dropFunnel} />

        {/* A6 — Page dwell distribution (RenderStep별 평균 ± SD) */}
        <PageDwellDistribution data={pageDwell} pageOffset={dwellOffset} />

        {/* 응답자 문의사항 (백엔드 미구현 — 슬라이스 1 범위 외) */}
        <InquiriesEmptyCard />
      </main>
    </div>
  );
}
