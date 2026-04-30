interface SurveyAdminLayoutProps {
  children: React.ReactNode;
}

/**
 * /admin/surveys/[id]/* 공용 레이아웃.
 *
 * 슬라이스 1 시점에는 모든 [id] 자식 페이지(edit/analytics/operations)가
 * 자체 nav 헤더와 (operations 의 경우) 탭 스트립을 직접 렌더링하므로
 * 본 레이아웃은 단순 pass-through 만 한다.
 */
export default function SurveyAdminLayout({ children }: SurveyAdminLayoutProps) {
  return <>{children}</>;
}
