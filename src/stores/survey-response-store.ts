import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface SurveyResponse {
  id: string;
  surveyId: string;
  questionResponses: Record<string, any>;
  completedAt: Date;
  startedAt: Date;
  isCompleted: boolean;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    sessionId?: string;
  };
}

export interface SurveyResponseSummary {
  surveyId: string;
  totalResponses: number;
  completedResponses: number;
  averageCompletionTime: number;
  lastResponseAt?: Date;
  responseRate: number;
}

interface SurveyResponseState {
  // 응답 데이터
  responses: SurveyResponse[];
  currentResponse: SurveyResponse | null;

  // 통계 및 요약
  responseSummaries: Record<string, SurveyResponseSummary>;

  // 액션들
  startResponse: (surveyId: string, sessionId?: string) => string;
  updateQuestionResponse: (responseId: string, questionId: string, value: any) => void;
  completeResponse: (responseId: string) => void;
  deleteResponse: (responseId: string) => void;

  // 응답 조회
  getResponsesBySurvey: (surveyId: string) => SurveyResponse[];
  getCompletedResponses: (surveyId: string) => SurveyResponse[];
  getResponseById: (responseId: string) => SurveyResponse | undefined;

  // 통계 계산
  calculateSummary: (surveyId: string) => SurveyResponseSummary;
  getQuestionStatistics: (surveyId: string, questionId: string) => any;

  // 데이터 내보내기/가져오기
  exportResponses: (surveyId: string, format: 'json' | 'csv') => string;
  importResponses: (data: SurveyResponse[]) => void;

  // 초기화
  clearAllResponses: () => void;
  clearSurveyResponses: (surveyId: string) => void;
}

export const useSurveyResponseStore = create<SurveyResponseState>()(
  devtools(
    persist(
      (set, get) => ({
        responses: [],
        currentResponse: null,
        responseSummaries: {},

        startResponse: (surveyId: string, sessionId?: string) => {
          const responseId = `response-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newResponse: SurveyResponse = {
            id: responseId,
            surveyId,
            questionResponses: {},
            completedAt: new Date(),
            startedAt: new Date(),
            isCompleted: false,
            metadata: {
              sessionId: sessionId || `session-${Date.now()}`,
              userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
            }
          };

          set((state) => ({
            responses: [...state.responses, newResponse],
            currentResponse: newResponse
          }));

          return responseId;
        },

        updateQuestionResponse: (responseId: string, questionId: string, value: any) => {
          set((state) => ({
            responses: state.responses.map((response) =>
              response.id === responseId
                ? {
                    ...response,
                    questionResponses: {
                      ...response.questionResponses,
                      [questionId]: value
                    }
                  }
                : response
            ),
            currentResponse: state.currentResponse?.id === responseId
              ? {
                  ...state.currentResponse,
                  questionResponses: {
                    ...state.currentResponse.questionResponses,
                    [questionId]: value
                  }
                }
              : state.currentResponse
          }));
        },

        completeResponse: (responseId: string) => {
          set((state) => ({
            responses: state.responses.map((response) =>
              response.id === responseId
                ? {
                    ...response,
                    isCompleted: true,
                    completedAt: new Date()
                  }
                : response
            ),
            currentResponse: state.currentResponse?.id === responseId
              ? {
                  ...state.currentResponse,
                  isCompleted: true,
                  completedAt: new Date()
                }
              : state.currentResponse
          }));

          // 요약 통계 업데이트
          const response = get().responses.find(r => r.id === responseId);
          if (response) {
            const summary = get().calculateSummary(response.surveyId);
            set((state) => ({
              responseSummaries: {
                ...state.responseSummaries,
                [response.surveyId]: summary
              }
            }));
          }
        },

        deleteResponse: (responseId: string) => {
          set((state) => ({
            responses: state.responses.filter((response) => response.id !== responseId),
            currentResponse: state.currentResponse?.id === responseId ? null : state.currentResponse
          }));
        },

        getResponsesBySurvey: (surveyId: string) => {
          return get().responses.filter(response => response.surveyId === surveyId);
        },

        getCompletedResponses: (surveyId: string) => {
          return get().responses.filter(response =>
            response.surveyId === surveyId && response.isCompleted
          );
        },

        getResponseById: (responseId: string) => {
          return get().responses.find(response => response.id === responseId);
        },

        calculateSummary: (surveyId: string) => {
          const allResponses = get().getResponsesBySurvey(surveyId);
          const completedResponses = get().getCompletedResponses(surveyId);

          const totalResponses = allResponses.length;
          const completedCount = completedResponses.length;

          // 평균 완료 시간 계산 (분 단위)
          const completionTimes = completedResponses.map(response => {
            const startTime = new Date(response.startedAt).getTime();
            const completedTime = new Date(response.completedAt).getTime();
            return (completedTime - startTime) / (1000 * 60); // 분 단위
          });

          const averageCompletionTime = completionTimes.length > 0
            ? completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length
            : 0;

          const lastResponse = allResponses.sort((a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
          )[0];

          return {
            surveyId,
            totalResponses,
            completedResponses: completedCount,
            averageCompletionTime,
            lastResponseAt: lastResponse ? lastResponse.startedAt : undefined,
            responseRate: totalResponses > 0 ? (completedCount / totalResponses) * 100 : 0
          };
        },

        getQuestionStatistics: (surveyId: string, questionId: string) => {
          const completedResponses = get().getCompletedResponses(surveyId);
          const questionResponses = completedResponses
            .map(response => response.questionResponses[questionId])
            .filter(response => response !== undefined && response !== null && response !== '');

          if (questionResponses.length === 0) {
            return {
              totalResponses: 0,
              responseRate: 0,
              responses: []
            };
          }

          // 응답 타입에 따른 통계 계산
          const firstResponse = questionResponses[0];

          if (Array.isArray(firstResponse)) {
            // 다중 선택 또는 체크박스
            const allOptions = questionResponses.flat();
            const optionCounts: Record<string, number> = {};

            allOptions.forEach(option => {
              optionCounts[option] = (optionCounts[option] || 0) + 1;
            });

            return {
              totalResponses: questionResponses.length,
              responseRate: (questionResponses.length / completedResponses.length) * 100,
              type: 'multiple',
              optionCounts,
              responses: questionResponses
            };
          } else if (typeof firstResponse === 'object') {
            // 테이블 응답
            return {
              totalResponses: questionResponses.length,
              responseRate: (questionResponses.length / completedResponses.length) * 100,
              type: 'table',
              responses: questionResponses
            };
          } else {
            // 단일 응답 (텍스트, 라디오)
            const responseCounts: Record<string, number> = {};

            questionResponses.forEach(response => {
              const key = String(response);
              responseCounts[key] = (responseCounts[key] || 0) + 1;
            });

            return {
              totalResponses: questionResponses.length,
              responseRate: (questionResponses.length / completedResponses.length) * 100,
              type: 'single',
              responseCounts,
              responses: questionResponses
            };
          }
        },

        exportResponses: (surveyId: string, format: 'json' | 'csv') => {
          const responses = get().getCompletedResponses(surveyId);

          if (format === 'json') {
            return JSON.stringify(responses, null, 2);
          } else {
            // CSV 형식
            if (responses.length === 0) return '';

            const headers = ['응답 ID', '시작 시간', '완료 시간', '완료 시간(분)'];
            const questionIds = new Set<string>();

            responses.forEach(response => {
              Object.keys(response.questionResponses).forEach(questionId => {
                questionIds.add(questionId);
              });
            });

            headers.push(...Array.from(questionIds));

            const csvData = responses.map(response => {
              const completionTime = (
                new Date(response.completedAt).getTime() -
                new Date(response.startedAt).getTime()
              ) / (1000 * 60);

              const row = [
                response.id,
                response.startedAt.toISOString(),
                response.completedAt.toISOString(),
                completionTime.toFixed(2)
              ];

              Array.from(questionIds).forEach(questionId => {
                const value = response.questionResponses[questionId];
                if (Array.isArray(value)) {
                  row.push(value.join('; '));
                } else if (typeof value === 'object') {
                  row.push(JSON.stringify(value));
                } else {
                  row.push(String(value || ''));
                }
              });

              return row;
            });

            return [headers, ...csvData]
              .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
              .join('\n');
          }
        },

        importResponses: (data: SurveyResponse[]) => {
          set((state) => ({
            responses: [...state.responses, ...data]
          }));
        },

        clearAllResponses: () => {
          set(() => ({
            responses: [],
            currentResponse: null,
            responseSummaries: {}
          }));
        },

        clearSurveyResponses: (surveyId: string) => {
          set((state) => ({
            responses: state.responses.filter(response => response.surveyId !== surveyId),
            currentResponse: state.currentResponse?.surveyId === surveyId ? null : state.currentResponse,
            responseSummaries: Object.fromEntries(
              Object.entries(state.responseSummaries).filter(([id]) => id !== surveyId)
            )
          }));
        },
      }),
      {
        name: 'survey-response-store',
        partialize: (state) => ({
          responses: state.responses,
          responseSummaries: state.responseSummaries
        })
      }
    ),
    {
      name: 'survey-response-store'
    }
  )
);