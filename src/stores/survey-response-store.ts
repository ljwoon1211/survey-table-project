import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * 설문 응답 UI 상태 관리
 * 실제 응답 데이터는 TanStack Query로 관리
 */
interface SurveyResponseUIState {
  // 현재 응답 세션 상태
  currentResponseId: string | null;
  currentQuestionIndex: number;

  // 임시 응답 데이터 (아직 서버에 저장되지 않은 것)
  pendingResponses: Record<string, unknown>;

  // UI 상태
  isSubmitting: boolean;
  showValidationErrors: boolean;
  validationErrors: Record<string, string>;

  // 액션들
  setCurrentResponseId: (responseId: string | null) => void;
  setCurrentQuestionIndex: (index: number) => void;
  goToNextQuestion: () => void;
  goToPreviousQuestion: () => void;

  // 임시 응답 관리
  setPendingResponse: (questionId: string, value: unknown) => void;
  clearPendingResponses: () => void;

  // 유효성 검사
  setValidationError: (questionId: string, error: string) => void;
  clearValidationError: (questionId: string) => void;
  clearAllValidationErrors: () => void;
  setShowValidationErrors: (show: boolean) => void;

  // 제출 상태
  setIsSubmitting: (isSubmitting: boolean) => void;

  // 초기화
  resetResponseState: () => void;
}

export const useSurveyResponseStore = create<SurveyResponseUIState>()(
  devtools(
    (set) => ({
      currentResponseId: null,
      currentQuestionIndex: 0,
      pendingResponses: {},
      isSubmitting: false,
      showValidationErrors: false,
      validationErrors: {},

      setCurrentResponseId: (responseId) =>
        set(() => ({ currentResponseId: responseId })),

      setCurrentQuestionIndex: (index) =>
        set(() => ({ currentQuestionIndex: index })),

      goToNextQuestion: () =>
        set((state) => ({ currentQuestionIndex: state.currentQuestionIndex + 1 })),

      goToPreviousQuestion: () =>
        set((state) => ({
          currentQuestionIndex: Math.max(0, state.currentQuestionIndex - 1)
        })),

      setPendingResponse: (questionId, value) =>
        set((state) => ({
          pendingResponses: {
            ...state.pendingResponses,
            [questionId]: value,
          },
        })),

      clearPendingResponses: () =>
        set(() => ({ pendingResponses: {} })),

      setValidationError: (questionId, error) =>
        set((state) => ({
          validationErrors: {
            ...state.validationErrors,
            [questionId]: error,
          },
        })),

      clearValidationError: (questionId) =>
        set((state) => {
          const { [questionId]: _, ...rest } = state.validationErrors;
          return { validationErrors: rest };
        }),

      clearAllValidationErrors: () =>
        set(() => ({ validationErrors: {} })),

      setShowValidationErrors: (show) =>
        set(() => ({ showValidationErrors: show })),

      setIsSubmitting: (isSubmitting) =>
        set(() => ({ isSubmitting })),

      resetResponseState: () =>
        set(() => ({
          currentResponseId: null,
          currentQuestionIndex: 0,
          pendingResponses: {},
          isSubmitting: false,
          showValidationErrors: false,
          validationErrors: {},
        })),
    }),
    {
      name: 'survey-response-ui-store'
    }
  )
);

// 타입 export (하위 호환성)
export interface SurveyResponse {
  id: string;
  surveyId: string;
  questionResponses: Record<string, unknown>;
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
