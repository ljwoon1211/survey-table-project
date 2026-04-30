import { OperationsTabStrip } from '@/components/operations/operations-tab-strip';

interface SurveyAdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

/**
 * /admin/surveys/[id]/* 공용 레이아웃.
 *
 * - edit/, analytics/ 는 자체 헤더(<nav>)를 가지고 있어 추가 UI를 주입하지 않는다.
 * - operations/* 경로에서만 상단 탭 스트립을 노출한다 (탭 표시 여부 판단은
 *   클라이언트 자식 컴포넌트가 usePathname()으로 처리).
 */
export default async function SurveyAdminLayout({
  children,
  params,
}: SurveyAdminLayoutProps) {
  const { id } = await params;

  return (
    <>
      <OperationsTabStrip surveyId={id} />
      {children}
    </>
  );
}
