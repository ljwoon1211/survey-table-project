import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface SurveyUIState {
  // UI 상태
  selectedQuestionId: string | null;
  isTestMode: boolean;

  // 액션들
  selectQuestion: (questionId: string | null) => void;
  toggleTestMode: () => void;
  setTestMode: (isTestMode: boolean) => void;
}

export const useSurveyUIStore = create<SurveyUIState>()(
  devtools(
    (set) => ({
      selectedQuestionId: null,
      isTestMode: false,

      selectQuestion: (questionId) => set({ selectedQuestionId: questionId }),
      toggleTestMode: () => set((state) => ({ isTestMode: !state.isTestMode })),
      setTestMode: (isTestMode) => set({ isTestMode }),
    }),
    {
      name: 'survey-ui-store',
    },
  ),
);
