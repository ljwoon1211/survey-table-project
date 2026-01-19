'use client';

import { useCallback, useMemo, useState } from 'react';

import { Tab, TabGroup, TabList, TabPanel, TabPanels, TextInput } from '@tremor/react';
import { BarChart3, Filter, Grid3X3, List, Search, TrendingUp } from 'lucide-react';

import type { SurveyResponse } from '@/db/schema';
import { analyzeSurvey } from '@/lib/analytics/analyzer';
import { generateCompactExcelBlob } from '@/lib/analytics/compact-excel-export';
import { type FilterState, applyFilter, createEmptyFilter } from '@/lib/analytics/filter';
import { type ResponseData, generateFlatExcelBlob } from '@/lib/analytics/flat-excel-export';
import type { SurveyAnalytics } from '@/lib/analytics/types';
import type { Question, Survey } from '@/types/survey';

import { SummaryCards } from './cards/summary-cards';
import { ResponseTimeline } from './charts/response-timeline';
import { CrossTabPanel } from './cross-tab';
import { ExportPanel } from './export-panel';
import { FilterPanel } from './filters';
import { QuestionAnalytics } from './question-analytics';

interface AnalyticsDashboardClientProps {
  survey: {
    id: string;
    title: string;
    questions: Question[];
  };
  responses: SurveyResponse[];
  onExportJson: () => Promise<string>;
  onExportCsv: () => Promise<string>;
}

export function AnalyticsDashboardClient({
  survey,
  responses,
  onExportJson,
  onExportCsv,
}: AnalyticsDashboardClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterState>(createEmptyFilter());

  // 필터링된 응답
  const filteredResponses = useMemo(() => {
    return applyFilter(filter, responses, survey.questions);
  }, [filter, responses, survey.questions]);

  // 필터링된 응답으로 분석 데이터 재계산
  const analytics: SurveyAnalytics = useMemo(() => {
    return analyzeSurvey(survey, filteredResponses);
  }, [survey, filteredResponses]);

  // 공통 데이터 변환 함수
  const prepareExportData = useCallback(() => {
    if (filteredResponses.length === 0) return null;

    const responseData: ResponseData[] = filteredResponses.map((r) => ({
      id: r.id,
      surveyId: r.surveyId,
      questionResponses: (r.questionResponses as Record<string, unknown>) || {},
      isCompleted: r.isCompleted ?? true,
      startedAt: r.createdAt || new Date(),
      completedAt: r.completedAt || undefined,
      userAgent: r.userAgent || undefined,
    }));

    const surveyData = {
      id: survey.id,
      title: survey.title,
      questions: survey.questions,
    } as Survey;

    return { surveyData, responseData };
  }, [survey, filteredResponses]);

  // Flat Excel 내보내기 핸들러 (통계 분석용)
  const handleExportFlatExcel = useCallback(async (): Promise<Blob | null> => {
    const data = prepareExportData();
    if (!data) return null;
    return generateFlatExcelBlob(data.surveyData, data.responseData);
  }, [prepareExportData]);

  // Compact Excel 내보내기 핸들러 (데이터 확인용)
  const handleExportCompactExcel = useCallback(async (): Promise<Blob | null> => {
    const data = prepareExportData();
    if (!data) return null;
    return generateCompactExcelBlob(data.surveyData, data.responseData);
  }, [prepareExportData]);

  // 질문 검색 필터링
  const searchFilteredQuestions = analytics.questions.filter((q) =>
    q.questionTitle.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const hasActiveFilter = filter.groups.length > 0;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{analytics.surveyTitle}</h1>
          <p className="mt-1 text-sm text-gray-500">
            설문 응답 분석 대시보드
            {hasActiveFilter && (
              <span className="ml-2 text-blue-600">
                (필터 적용됨: {filteredResponses.length}/{responses.length}명)
              </span>
            )}
          </p>
        </div>
        <ExportPanel
          surveyId={analytics.surveyId}
          surveyTitle={analytics.surveyTitle}
          onExportJson={onExportJson}
          onExportCsv={onExportCsv}
          onExportFlatExcel={handleExportFlatExcel}
          onExportCompactExcel={handleExportCompactExcel}
        />
      </div>

      {/* 요약 카드 */}
      <SummaryCards summary={analytics.summary} />

      {/* 필터 패널 */}
      <FilterPanel
        questions={survey.questions}
        responses={responses}
        filter={filter}
        onFilterChange={setFilter}
      />

      {/* 교차분석 패널 */}
      <CrossTabPanel questions={survey.questions} responses={filteredResponses} />

      {/* 탭 그룹 */}
      <TabGroup>
        <TabList variant="solid">
          <Tab icon={BarChart3}>질문별 분석</Tab>
          <Tab icon={TrendingUp}>응답 추이</Tab>
          <Tab icon={List}>전체 요약</Tab>
        </TabList>
        <TabPanels>
          {/* 질문별 분석 탭 */}
          <TabPanel>
            <div className="mt-6 space-y-6">
              {/* 검색 */}
              <TextInput
                icon={Search}
                placeholder="질문 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              {/* 질문 목록 */}
              {searchFilteredQuestions.length > 0 ? (
                <div className="space-y-6">
                  {searchFilteredQuestions.map((question, index) => (
                    <div key={question.questionId}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600">
                          {index + 1}
                        </span>
                      </div>
                      <QuestionAnalytics data={question} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-gray-500">
                  <Search className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                  <p>검색 결과가 없습니다.</p>
                </div>
              )}
            </div>
          </TabPanel>

          {/* 응답 추이 탭 */}
          <TabPanel>
            <div className="mt-6">
              <ResponseTimeline data={analytics.timeline} />
            </div>
          </TabPanel>

          {/* 전체 요약 탭 */}
          <TabPanel>
            <div className="mt-6 space-y-4">
              {/* 요약 테이블 */}
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">#</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">질문</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">유형</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">응답 수</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">응답률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.questions.map((q, idx) => (
                      <tr
                        key={q.questionId}
                        className={`border-t border-gray-100 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        }`}
                      >
                        <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                        <td className="max-w-xs truncate px-4 py-3 text-gray-900">
                          {q.questionTitle}
                        </td>
                        <td className="px-4 py-3">
                          <QuestionTypeBadge type={q.type} />
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{q.totalResponses}명</td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`font-medium ${
                              q.responseRate >= 80
                                ? 'text-green-600'
                                : q.responseRate >= 50
                                  ? 'text-amber-600'
                                  : 'text-red-600'
                            }`}
                          >
                            {q.responseRate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 통계 요약 */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-blue-50 p-4">
                  <p className="text-sm text-blue-700">총 질문 수</p>
                  <p className="text-2xl font-bold text-blue-900">{analytics.questions.length}개</p>
                </div>
                <div className="rounded-lg bg-green-50 p-4">
                  <p className="text-sm text-green-700">평균 응답률</p>
                  <p className="text-2xl font-bold text-green-900">
                    {(
                      analytics.questions.reduce((sum, q) => sum + q.responseRate, 0) /
                        analytics.questions.length || 0
                    ).toFixed(1)}
                    %
                  </p>
                </div>
                <div className="rounded-lg bg-violet-50 p-4">
                  <p className="text-sm text-violet-700">응답 기간</p>
                  <p className="text-2xl font-bold text-violet-900">
                    {analytics.timeline.length}일
                  </p>
                </div>
              </div>
            </div>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}

/**
 * 질문 유형 배지
 */
function QuestionTypeBadge({ type }: { type: string }) {
  const typeConfig: Record<string, { label: string; color: string }> = {
    single: { label: '단일 선택', color: 'bg-blue-100 text-blue-700' },
    multiple: { label: '복수 선택', color: 'bg-emerald-100 text-emerald-700' },
    text: { label: '텍스트', color: 'bg-violet-100 text-violet-700' },
    table: { label: '테이블', color: 'bg-amber-100 text-amber-700' },
    multiselect: { label: '다단계', color: 'bg-indigo-100 text-indigo-700' },
    notice: { label: '공지', color: 'bg-cyan-100 text-cyan-700' },
  };

  const config = typeConfig[type] || { label: type, color: 'bg-gray-100 text-gray-700' };

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}
