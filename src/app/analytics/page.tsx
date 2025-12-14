import Link from "next/link";
import { BarChart3, FileText, Users, Calendar, ArrowRight, Plus } from "lucide-react";
import { getSurveys } from "@/data/surveys";
import {
  getCompletedResponseCountBySurvey,
  getResponseCountBySurvey,
} from "@/data/responses";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function AnalyticsListPage() {
  const surveys = await getSurveys();

  // 각 설문의 응답 수 조회
  const surveysWithResponses = await Promise.all(
    surveys.map(async (survey) => {
      const [totalResponses, completedResponses] = await Promise.all([
        getResponseCountBySurvey(survey.id),
        getCompletedResponseCountBySurvey(survey.id),
      ]);
      return {
        ...survey,
        totalResponses,
        completedResponses,
      };
    }),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-blue-500" />
              <h1 className="text-xl font-semibold text-gray-900">설문 분석</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin/surveys">
                <Button variant="outline" size="sm">
                  <FileText className="w-4 h-4 mr-2" />
                  설문 관리
                </Button>
              </Link>
              <Link href="/admin/surveys/create">
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />새 설문
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {surveysWithResponses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {surveysWithResponses.map((survey) => (
              <Link key={survey.id} href={`/analytics/${survey.id}`}>
                <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                        {survey.title}
                      </h3>
                      {survey.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {survey.description}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0 ml-2" />
                  </div>

                  {/* 통계 */}
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-lg font-semibold text-gray-900">
                          {survey.completedResponses}
                        </p>
                        <p className="text-xs text-gray-500">완료된 응답</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(survey.createdAt).toLocaleDateString("ko-KR", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-gray-500">생성일</p>
                      </div>
                    </div>
                  </div>

                  {/* 상태 배지 */}
                  <div className="flex items-center gap-2 mt-4">
                    {survey.completedResponses > 0 ? (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                        {survey.completedResponses}개 응답
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                        응답 없음
                      </span>
                    )}
                    {survey.isPublic ? (
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                        공개
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                        비공개
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          // 빈 상태
          <div className="text-center py-16">
            <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">아직 설문이 없습니다</h2>
            <p className="text-gray-500 mb-6">새 설문을 만들어 응답을 수집하고 분석해보세요.</p>
            <Link href="/admin/surveys/create">
              <Button>
                <Plus className="w-4 h-4 mr-2" />첫 설문 만들기
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

export const metadata = {
  title: "설문 분석 | Survey Table",
  description: "설문 응답 데이터를 분석하고 인사이트를 확인하세요.",
};
