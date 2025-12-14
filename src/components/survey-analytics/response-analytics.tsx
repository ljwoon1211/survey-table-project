'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSurveyBuilderStore } from '@/stores/survey-store';
import {
  useResponses,
  useCompletedResponses,
  useResponseSummary,
  useQuestionStatistics,
  useExportResponsesJson,
  useExportResponsesCsv,
} from '@/hooks/queries/use-responses';
import { BarChart3, PieChart, Download, Users, Clock, TrendingUp, FileText } from 'lucide-react';

interface ResponseAnalyticsProps {
  surveyId: string;
  className?: string;
}

export function ResponseAnalytics({ surveyId, className }: ResponseAnalyticsProps) {
  const { currentSurvey } = useSurveyBuilderStore();
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  const { data: allResponses = [] } = useResponses(surveyId);
  const { data: completedResponses = [] } = useCompletedResponses(surveyId);
  const { data: summary } = useResponseSummary(surveyId);
  const { mutateAsync: exportJson } = useExportResponsesJson();
  const { mutateAsync: exportCsv } = useExportResponsesCsv();

  const handleExport = async (format: 'json' | 'csv') => {
    const data = format === 'json' 
      ? await exportJson(surveyId)
      : await exportCsv(surveyId);
    
    const blob = new Blob([data], {
      type: format === 'json' ? 'application/json' : 'text/csv'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey-responses-${surveyId}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (allResponses.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <div className="text-center text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">응답 데이터가 없습니다</h3>
            <p className="text-sm">설문이 게시되면 응답 분석을 확인할 수 있습니다.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 전체 통계 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary?.totalResponses ?? 0}</p>
                <p className="text-sm text-gray-600">총 응답 수</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary?.completedResponses ?? 0}</p>
                <p className="text-sm text-gray-600">완료된 응답</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <PieChart className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{(summary?.responseRate ?? 0).toFixed(1)}%</p>
                <p className="text-sm text-gray-600">완료율</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {(summary?.averageCompletionTime ?? 0).toFixed(1)}분
                </p>
                <p className="text-sm text-gray-600">평균 완료 시간</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 질문별 분석 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>질문별 응답 분석</CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={() => handleExport('csv')}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                CSV 다운로드
              </Button>
              <Button
                onClick={() => handleExport('json')}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                JSON 다운로드
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {currentSurvey.questions.map((question, index) => {
              const isSelected = selectedQuestionId === question.id;

              return (
                <QuestionStatItem
                  key={question.id}
                  surveyId={surveyId}
                  question={question}
                  index={index}
                  isSelected={isSelected}
                  completedCount={summary?.completedResponses ?? 0}
                  onSelect={() => setSelectedQuestionId(isSelected ? null : question.id)}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 최근 응답 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>최근 응답</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...completedResponses]
              .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
              .slice(0, 10)
              .map((response) => {
                const completionTime = (
                  new Date(response.completedAt!).getTime() -
                  new Date(response.startedAt).getTime()
                ) / (1000 * 60);

                return (
                  <div
                    key={response.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          응답 #{response.id.slice(-8)}
                        </p>
                        <p className="text-xs text-gray-600">
                          {new Date(response.completedAt!).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        완료 시간: {completionTime.toFixed(1)}분
                      </p>
                      <p className="text-xs text-gray-500">
                        질문 수: {Object.keys(response.questionResponses as Record<string, unknown>).length}개
                      </p>
                    </div>
                  </div>
                );
              })}

            {completedResponses.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>아직 완료된 응답이 없습니다.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function QuestionStatItem({
  surveyId,
  question,
  index,
  isSelected,
  completedCount,
  onSelect,
}: {
  surveyId: string;
  question: any;
  index: number;
  isSelected: boolean;
  completedCount: number;
  onSelect: () => void;
}) {
  const { data: stats } = useQuestionStatistics(surveyId, question.id);

  if (!stats) {
    return (
      <div className="p-4 border rounded-lg border-gray-200">
        <p className="text-sm text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div
      className={`p-4 border rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">
            {index + 1}. {question.title}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            응답률: {stats.responseRate.toFixed(1)}% ({stats.totalResponses}/{completedCount}명)
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            stats.responseRate > 80
              ? 'bg-green-100 text-green-800'
              : stats.responseRate > 50
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {stats.responseRate.toFixed(0)}%
          </span>
        </div>
      </div>

      {isSelected && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <QuestionResponseDetail
            question={question}
            stats={stats}
          />
        </div>
      )}
    </div>
  );
}

function QuestionResponseDetail({ question, stats }: { question: any; stats: any }) {
  if (stats.totalResponses === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        <p>응답 데이터가 없습니다.</p>
      </div>
    );
  }

  switch (stats.type) {
    case 'single':
      return (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">응답 분포</h4>
          {Object.entries(stats.responseCounts as Record<string, number>).map(([value, count]) => {
            const percentage = (count / stats.totalResponses) * 100;
            return (
              <div key={value} className="flex items-center space-x-3">
                <div className="w-24 text-sm text-gray-600 truncate">{value}</div>
                <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="w-16 text-sm text-gray-900 text-right">
                  {count}명 ({percentage.toFixed(1)}%)
                </div>
              </div>
            );
          })}
        </div>
      );

    case 'multiple':
      return (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">선택된 옵션 (중복 응답 가능)</h4>
          {Object.entries(stats.optionCounts as Record<string, number>).map(([option, count]) => {
            const percentage = (count / stats.totalResponses) * 100;
            return (
              <div key={option} className="flex items-center space-x-3">
                <div className="w-24 text-sm text-gray-600 truncate">{option}</div>
                <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="w-16 text-sm text-gray-900 text-right">
                  {count}회 ({percentage.toFixed(1)}%)
                </div>
              </div>
            );
          })}
        </div>
      );

    case 'table':
      return (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">테이블 응답 요약</h4>
          <div className="text-sm text-gray-600">
            <p>총 {stats.totalResponses}개의 테이블 응답이 수집되었습니다.</p>
            <p>응답 세부 분석은 CSV 다운로드를 통해 확인하실 수 있습니다.</p>
          </div>
        </div>
      );

    default:
      return (
        <div className="text-center py-4 text-gray-500">
          <p>이 질문 유형의 분석은 준비 중입니다.</p>
        </div>
      );
  }
}
