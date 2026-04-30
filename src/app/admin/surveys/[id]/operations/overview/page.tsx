import type { Metadata } from 'next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: '현황 - Fieldwork report',
};

interface OperationsOverviewPageProps {
  params: Promise<{ id: string }>;
}

/**
 * 현황 콘솔 - Fieldwork report 진입 페이지 (placeholder).
 *
 * 슬라이스 1 (T6) 에서는 라우트 부트스트랩과 레이아웃·탭 스트립 검증을 위한
 * 자리표시자만 렌더링한다. 실제 위젯(응답 진행 / 시간대 추이 / 응답시간 통계 /
 * Drop 위치 분석)은 후속 슬라이스(T15 등)에서 채워 넣는다.
 */
export default async function OperationsOverviewPage({
  params,
}: OperationsOverviewPageProps) {
  // params Promise unwrap 패턴은 동일 프로젝트 analytics/page.tsx 와 일치
  await params;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <header>
        <h1 className="text-xl font-bold text-gray-900">현황</h1>
        <p className="text-sm text-slate-500">
          Fieldwork report — 응답자 진행 현황 · 시간대별 추이 · 응답시간 통계 · Drop 위치 분석
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>준비 중</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500">위젯이 곧 추가됩니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
