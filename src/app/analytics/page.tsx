'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSurveyBuilderStore } from '@/stores/survey-store';
import { useSurveyResponseStore } from '@/stores/survey-response-store';
import { ResponseAnalytics } from '@/components/survey-analytics/response-analytics';
import { BarChart3, Plus, FileText, Users, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AnalyticsPage() {
  const { currentSurvey } = useSurveyBuilderStore();
  const {
    responses,
    startResponse,
    updateQuestionResponse,
    completeResponse,
    getResponsesBySurvey,
    calculateSummary
  } = useSurveyResponseStore();

  const [isGeneratingTestData, setIsGeneratingTestData] = useState(false);

  // 테스트 데이터 생성 함수
  const generateTestData = () => {
    if (!currentSurvey.questions.length) {
      alert('먼저 설문 질문을 생성해주세요.');
      return;
    }

    setIsGeneratingTestData(true);

    try {
      // 5개의 테스트 응답 생성
      for (let i = 0; i < 5; i++) {
        const responseId = startResponse('test-survey');

        currentSurvey.questions.forEach((question, questionIndex) => {
          let testValue;

          switch (question.type) {
            case 'text':
              testValue = `테스트 응답 ${i + 1} - 질문 ${questionIndex + 1}`;
              break;
            case 'textarea':
              testValue = `이것은 테스트 응답 ${i + 1}번의 장문형 답변입니다. 실제 사용자의 응답을 시뮬레이션하기 위한 샘플 텍스트입니다.`;
              break;
            case 'radio':
              if (question.options && question.options.length > 0) {
                const randomIndex = Math.floor(Math.random() * question.options.length);
                testValue = question.options[randomIndex].value;
              }
              break;
            case 'checkbox':
              if (question.options && question.options.length > 0) {
                const numSelections = Math.floor(Math.random() * question.options.length) + 1;
                const shuffled = [...question.options].sort(() => 0.5 - Math.random());
                testValue = shuffled.slice(0, numSelections).map(opt => opt.value);
              }
              break;
            case 'select':
              if (question.options && question.options.length > 0) {
                const randomIndex = Math.floor(Math.random() * question.options.length);
                testValue = question.options[randomIndex].value;
              }
              break;
            case 'multiselect':
              testValue = ['한식', '김치찌개']; // 샘플 다단계 선택
              break;
            case 'table':
              // 테이블 응답 생성 (OTT 설문의 경우)
              if (question.tableRowsData && question.tableRowsData.length > 0) {
                const tableResponse: Record<string, any> = {};

                question.tableRowsData.forEach((row) => {
                  row.cells.forEach((cell) => {
                    if (cell.type === 'checkbox') {
                      // 50% 확률로 체크
                      tableResponse[cell.id] = Math.random() > 0.5 ? [cell.checkboxOptions?.[0]?.id] : [];
                    } else if (cell.type === 'radio') {
                      // 랜덤하게 하나 선택
                      if (cell.radioOptions && cell.radioOptions.length > 0) {
                        const randomOption = cell.radioOptions[Math.floor(Math.random() * cell.radioOptions.length)];
                        tableResponse[cell.id] = randomOption.id;
                      }
                    }
                  });
                });

                testValue = tableResponse;
              }
              break;
            default:
              testValue = `테스트 값 ${i + 1}`;
          }

          if (testValue !== undefined) {
            updateQuestionResponse(responseId, question.id, testValue);
          }
        });

        // 응답 완료 처리
        completeResponse(responseId);
      }

      alert('테스트 데이터가 생성되었습니다!');
    } catch (error) {
      console.error('테스트 데이터 생성 오류:', error);
      alert('테스트 데이터 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingTestData(false);
    }
  };

  const surveyResponses = getResponsesBySurvey('test-survey');
  const summary = calculateSummary('test-survey');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  홈으로
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">설문 분석</h1>
                <p className="text-sm text-gray-600">
                  {currentSurvey.title || '새 설문조사'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Button
                onClick={generateTestData}
                disabled={isGeneratingTestData}
                variant="outline"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                {isGeneratingTestData ? '생성 중...' : '테스트 데이터 생성'}
              </Button>
              <Link href="/create">
                <Button size="sm">
                  <FileText className="w-4 h-4 mr-2" />
                  설문 편집
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto p-6">
        {currentSurvey.questions.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <div className="text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">설문 질문이 없습니다</h3>
                <p className="text-sm mb-6">먼저 설문 질문을 생성해주세요.</p>
                <Link href="/create">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    질문 추가하기
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : surveyResponses.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <div className="text-center text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">응답 데이터가 없습니다</h3>
                <p className="text-sm mb-6">
                  테스트 데이터를 생성하거나 실제 설문 응답을 받아보세요.
                </p>
                <div className="flex justify-center space-x-4">
                  <Button
                    onClick={generateTestData}
                    disabled={isGeneratingTestData}
                    variant="outline"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    테스트 데이터 생성
                  </Button>
                  <Link href="/survey/test-survey">
                    <Button>
                      <Users className="w-4 h-4 mr-2" />
                      설문 응답해보기
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* 빠른 액션 */}
            <Card>
              <CardHeader>
                <CardTitle>빠른 액션</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Link href="/survey/test-survey">
                    <Button variant="outline" size="sm">
                      <Users className="w-4 h-4 mr-2" />
                      설문 응답해보기
                    </Button>
                  </Link>
                  <Button
                    onClick={generateTestData}
                    disabled={isGeneratingTestData}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    추가 테스트 데이터
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 응답 분석 */}
            <ResponseAnalytics surveyId="test-survey" />
          </div>
        )}
      </div>
    </div>
  );
}