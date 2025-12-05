import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import { getSurveyWithDetails } from "@/actions/survey-actions";
import {
  getCompletedResponses,
  exportResponsesAsJson,
  exportResponsesAsCsv,
} from "@/actions/response-actions";
import { AnalyticsDashboardClient } from "@/components/analytics";
import { Button } from "@/components/ui/button";

interface AnalyticsPageProps {
  params: Promise<{ surveyId: string }>;
}

export default async function SurveyAnalyticsPage({ params }: AnalyticsPageProps) {
  const { surveyId } = await params;

  // 설문 및 응답 데이터 조회
  const [survey, responses] = await Promise.all([
    getSurveyWithDetails(surveyId),
    getCompletedResponses(surveyId),
  ]);

  if (!survey) {
    notFound();
  }

  // 내보내기 함수 (서버 액션)
  async function handleExportJson() {
    "use server";
    return exportResponsesAsJson(surveyId);
  }

  async function handleExportCsv() {
    "use server";
    return exportResponsesAsCsv(surveyId);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/analytics">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  설문 목록
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-200" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900 truncate max-w-md">
                  {survey.title}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/admin/surveys/${surveyId}/edit`}>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  설문 편집
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnalyticsDashboardClient
          survey={{
            id: survey.id,
            title: survey.title,
            questions: survey.questions,
          }}
          responses={responses}
          onExportJson={handleExportJson}
          onExportCsv={handleExportCsv}
        />
      </main>
    </div>
  );
}

// 메타데이터 생성
export async function generateMetadata({ params }: AnalyticsPageProps) {
  const { surveyId } = await params;
  const survey = await getSurveyWithDetails(surveyId);

  if (!survey) {
    return {
      title: "설문을 찾을 수 없습니다",
    };
  }

  return {
    title: `${survey.title} - 분석 | Survey Table`,
    description: `${survey.title} 설문의 응답 분석 대시보드`,
  };
}
