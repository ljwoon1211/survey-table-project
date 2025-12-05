import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, ExternalLink, BarChart3 } from "lucide-react";
import { getSurveyWithDetails } from "@/actions/survey-actions";
import {
  getCompletedResponses,
  exportResponsesAsJson,
  exportResponsesAsCsv,
} from "@/actions/response-actions";
import { analyzeSurvey } from "@/lib/analytics";
import { SurveyAnalyticsDashboard } from "@/components/analytics";
import { Button } from "@/components/ui/button";

interface AdminAnalyticsPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminSurveyAnalyticsPage({ params }: AdminAnalyticsPageProps) {
  const { id } = await params;

  // 설문 및 응답 데이터 조회
  const [survey, responses] = await Promise.all([
    getSurveyWithDetails(id),
    getCompletedResponses(id),
  ]);

  if (!survey) {
    notFound();
  }

  // 분석 데이터 생성
  const analytics = analyzeSurvey(
    {
      id: survey.id,
      title: survey.title,
      questions: survey.questions,
    },
    responses,
  );

  // 내보내기 함수 (서버 액션)
  async function handleExportJson() {
    "use server";
    return exportResponsesAsJson(id);
  }

  async function handleExportCsv() {
    "use server";
    return exportResponsesAsCsv(id);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 - Admin 스타일 */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/admin/surveys">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                목록으로
              </Button>
            </Link>
            <div className="h-6 w-px bg-gray-300" />
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <h1 className="text-lg font-medium text-gray-900 truncate max-w-md">
                {survey.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link href={`/admin/surveys/${id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="w-4 h-4 mr-2" />
                설문 편집
              </Button>
            </Link>
            <Link href={`/analytics/${id}`} target="_blank">
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                상세 분석
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <SurveyAnalyticsDashboard
          analytics={analytics}
          onExportJson={handleExportJson}
          onExportCsv={handleExportCsv}
        />
      </main>
    </div>
  );
}

// 메타데이터 생성
export async function generateMetadata({ params }: AdminAnalyticsPageProps) {
  const { id } = await params;
  const survey = await getSurveyWithDetails(id);

  if (!survey) {
    return {
      title: "설문을 찾을 수 없습니다",
    };
  }

  return {
    title: `${survey.title} - 분석 | Survey Table 관리자`,
    description: `${survey.title} 설문의 응답 분석`,
  };
}
