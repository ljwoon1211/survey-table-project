import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Survey } from '@/types/survey';

export interface SurveyListItem {
  id: string;
  title: string;
  description?: string;
  questionCount: number;
  responseCount: number;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
}

interface SurveyListState {
  // 저장된 설문 목록
  surveys: Survey[];

  // 액션들
  saveSurvey: (survey: Survey) => void;
  updateSurvey: (surveyId: string, updates: Partial<Survey>) => void;
  deleteSurvey: (surveyId: string) => void;
  getSurveyById: (surveyId: string) => Survey | undefined;
  getSurveyListItems: () => SurveyListItem[];
  duplicateSurvey: (surveyId: string) => Survey | undefined;

  // 필터링 및 정렬
  searchSurveys: (query: string) => Survey[];
  getSurveysByDateRange: (startDate: Date, endDate: Date) => Survey[];

  // 일괄 작업
  deleteMultipleSurveys: (surveyIds: string[]) => void;
  exportSurveys: (surveyIds: string[]) => string;
  importSurveys: (surveysJson: string) => void;

  // 초기화
  clearAllSurveys: () => void;
}

export const useSurveyListStore = create<SurveyListState>()(
  devtools(
    persist(
      (set, get) => ({
        surveys: [],

        saveSurvey: (survey: Survey) => {
          set((state) => {
            const existingIndex = state.surveys.findIndex(s => s.id === survey.id);

            if (existingIndex >= 0) {
              // 기존 설문 업데이트
              const updatedSurveys = [...state.surveys];
              updatedSurveys[existingIndex] = {
                ...survey,
                updatedAt: new Date()
              };
              return { surveys: updatedSurveys };
            } else {
              // 새 설문 추가
              return {
                surveys: [...state.surveys, {
                  ...survey,
                  createdAt: survey.createdAt || new Date(),
                  updatedAt: new Date()
                }]
              };
            }
          });
        },

        updateSurvey: (surveyId: string, updates: Partial<Survey>) => {
          set((state) => ({
            surveys: state.surveys.map(survey =>
              survey.id === surveyId
                ? { ...survey, ...updates, updatedAt: new Date() }
                : survey
            )
          }));
        },

        deleteSurvey: (surveyId: string) => {
          set((state) => ({
            surveys: state.surveys.filter(survey => survey.id !== surveyId)
          }));
        },

        getSurveyById: (surveyId: string) => {
          return get().surveys.find(survey => survey.id === surveyId);
        },

        getSurveyListItems: () => {
          // TODO: 응답 수는 survey-response-store에서 가져와야 함
          return get().surveys.map(survey => ({
            id: survey.id,
            title: survey.title,
            description: survey.description,
            questionCount: survey.questions.length,
            responseCount: 0, // 일단 0으로 설정
            createdAt: survey.createdAt,
            updatedAt: survey.updatedAt,
            isPublic: survey.settings.isPublic
          }));
        },

        duplicateSurvey: (surveyId: string) => {
          const originalSurvey = get().getSurveyById(surveyId);
          if (!originalSurvey) return undefined;

          const newSurvey: Survey = {
            ...originalSurvey,
            id: `survey-${Date.now()}`,
            title: `${originalSurvey.title} (복사본)`,
            createdAt: new Date(),
            updatedAt: new Date(),
            questions: originalSurvey.questions.map((q, index) => ({
              ...q,
              id: `question-${Date.now()}-${index}`,
            }))
          };

          get().saveSurvey(newSurvey);
          return newSurvey;
        },

        searchSurveys: (query: string) => {
          const lowerQuery = query.toLowerCase();
          return get().surveys.filter(survey =>
            survey.title.toLowerCase().includes(lowerQuery) ||
            survey.description?.toLowerCase().includes(lowerQuery)
          );
        },

        getSurveysByDateRange: (startDate: Date, endDate: Date) => {
          return get().surveys.filter(survey => {
            const createdAt = new Date(survey.createdAt);
            return createdAt >= startDate && createdAt <= endDate;
          });
        },

        deleteMultipleSurveys: (surveyIds: string[]) => {
          set((state) => ({
            surveys: state.surveys.filter(survey => !surveyIds.includes(survey.id))
          }));
        },

        exportSurveys: (surveyIds: string[]) => {
          const surveysToExport = get().surveys.filter(survey =>
            surveyIds.includes(survey.id)
          );
          return JSON.stringify(surveysToExport, null, 2);
        },

        importSurveys: (surveysJson: string) => {
          try {
            const importedSurveys = JSON.parse(surveysJson) as Survey[];

            // Date 객체로 변환
            const processedSurveys = importedSurveys.map(survey => ({
              ...survey,
              id: `survey-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // 새 ID 생성
              createdAt: new Date(survey.createdAt),
              updatedAt: new Date(survey.updatedAt),
            }));

            set((state) => ({
              surveys: [...state.surveys, ...processedSurveys]
            }));
          } catch (error) {
            console.error('Failed to import surveys:', error);
          }
        },

        clearAllSurveys: () => {
          set(() => ({ surveys: [] }));
        },
      }),
      {
        name: 'survey-list-storage',
        // Date 객체 직렬화/역직렬화 처리
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            const { state } = JSON.parse(str);
            return {
              state: {
                ...state,
                surveys: state.surveys.map((survey: any) => ({
                  ...survey,
                  createdAt: new Date(survey.createdAt),
                  updatedAt: new Date(survey.updatedAt),
                })),
              },
            };
          },
          setItem: (name, value) => {
            localStorage.setItem(name, JSON.stringify(value));
          },
          removeItem: (name) => localStorage.removeItem(name),
        },
      }
    ),
    {
      name: 'survey-list-store'
    }
  )
);

