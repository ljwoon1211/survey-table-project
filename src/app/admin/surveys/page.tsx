"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSurveyListStore } from "@/stores/survey-list-store";
import {
  FileText,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  BarChart3,
  Copy,
  ExternalLink,
  ArrowLeft,
  Globe,
  Lock,
} from "lucide-react";
import { getSurveyAccessUrl } from "@/lib/survey-url";
import Link from "next/link";

export default function SurveyListPage() {
  const { surveys, deleteSurvey } = useSurveyListStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filteredSurveys = surveys.filter((survey) =>
    survey.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleDeleteSurvey = (surveyId: string) => {
    if (confirm("이 설문을 삭제하시겠습니까?")) {
      deleteSurvey(surveyId);
      setOpenMenuId(null);
    }
  };

  const handleCopyLink = (survey: (typeof surveys)[0]) => {
    const link = getSurveyAccessUrl(survey);
    navigator.clipboard.writeText(link);
    alert("링크가 복사되었습니다!");
    setOpenMenuId(null);
  };

  // 설문 접근 URL 가져오기 (미리보기용)
  const getSurveyUrl = (survey: (typeof surveys)[0]) => {
    if (survey.settings.isPublic && survey.slug) {
      return `/survey/${survey.slug}`;
    }
    if (survey.privateToken) {
      return `/survey/${survey.privateToken}`;
    }
    return `/survey/${survey.id}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                홈으로
              </Button>
            </Link>
            <div className="h-6 w-px bg-gray-300" />
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-gray-900">설문 관리</span>
            </div>
          </div>

          <Button asChild>
            <Link href="/admin/surveys/create">
              <Plus className="w-4 h-4 mr-2" />새 설문 만들기
            </Link>
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="설문 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Survey List */}
        {filteredSurveys.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? "검색 결과가 없습니다" : "아직 설문이 없습니다"}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery ? "다른 검색어로 시도해보세요" : "첫 번째 설문을 만들어보세요!"}
            </p>
            {!searchQuery && (
              <Button asChild>
                <Link href="/admin/surveys/create">
                  <Plus className="w-4 h-4 mr-2" />새 설문 만들기
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSurveys.map((survey) => (
              <Card
                key={survey.id}
                className="p-6 hover:shadow-lg transition-shadow duration-200 relative group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setOpenMenuId(openMenuId === survey.id ? null : survey.id)}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>

                    {openMenuId === survey.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                        <div className="py-1">
                          <Link
                            href={`/admin/surveys/${survey.id}/edit`}
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setOpenMenuId(null)}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            수정
                          </Link>
                          <Link
                            href={`/admin/surveys/${survey.id}/analytics`}
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setOpenMenuId(null)}
                          >
                            <BarChart3 className="w-4 h-4 mr-2" />
                            분석
                          </Link>
                          <button
                            onClick={() => handleCopyLink(survey)}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            링크 복사
                          </button>
                          <Link
                            href={getSurveyUrl(survey)}
                            target="_blank"
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setOpenMenuId(null)}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            설문 열기
                          </Link>
                          <hr className="my-1" />
                          <button
                            onClick={() => handleDeleteSurvey(survey.id)}
                            className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            삭제
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">
                  {survey.title}
                </h3>
                <p className="text-sm text-gray-500 mb-4">{survey.questions.length}개 질문</p>

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>수정일: {new Date(survey.updatedAt).toLocaleDateString()}</span>
                  <span
                    className={`px-2 py-1 rounded-full flex items-center gap-1 ${
                      survey.settings.isPublic
                        ? "bg-green-100 text-green-600"
                        : "bg-amber-100 text-amber-600"
                    }`}
                  >
                    {survey.settings.isPublic ? (
                      <>
                        <Globe className="w-3 h-3" />
                        공개
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3" />
                        비공개
                      </>
                    )}
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex space-x-2">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href={`/admin/surveys/${survey.id}/edit`}>
                      <Edit className="w-3 h-3 mr-1" />
                      수정
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href={`/admin/surveys/${survey.id}/analytics`}>
                      <BarChart3 className="w-3 h-3 mr-1" />
                      분석
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Click outside to close menu */}
      {openMenuId && <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />}
    </div>
  );
}
