import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Survey, Question, QuestionType, SurveySettings, SelectLevel } from '@/types/survey';

interface SurveyBuilderState {
  // 현재 편집 중인 설문
  currentSurvey: Survey;

  // UI 상태
  selectedQuestionId: string | null;
  isPreviewMode: boolean;
  isTestMode: boolean; // 테스트 모드 (실제 응답 가능하지만 데이터 저장 안됨)

  // 테스트용 임시 응답 데이터
  testResponses: Record<string, any>;

  // 액션들
  updateSurveyTitle: (title: string) => void;
  updateSurveyDescription: (description: string) => void;

  addQuestion: (type: QuestionType) => void;
  updateQuestion: (questionId: string, updates: Partial<Question>) => void;
  deleteQuestion: (questionId: string) => void;
  reorderQuestions: (questionIds: string[]) => void;

  selectQuestion: (questionId: string | null) => void;
  togglePreviewMode: () => void;
  toggleTestMode: () => void;

  // 테스트 응답 관리
  updateTestResponse: (questionId: string, value: any) => void;
  clearTestResponses: () => void;

  updateSurveySettings: (settings: Partial<SurveySettings>) => void;

  // 초기화
  resetSurvey: () => void;
}

const defaultSurveySettings: SurveySettings = {
  isPublic: true,
  allowMultipleResponses: false,
  showProgressBar: true,
  shuffleQuestions: false,
  requireLogin: false,
  thankYouMessage: '응답해주셔서 감사합니다!'
};

const defaultSurvey: Survey = {
  id: '',
  title: '새 설문조사',
  description: '',
  questions: [],
  settings: defaultSurveySettings,
  createdAt: new Date(),
  updatedAt: new Date()
};

export const useSurveyBuilderStore = create<SurveyBuilderState>()(
  devtools(
    (set, get) => ({
      currentSurvey: defaultSurvey,
      selectedQuestionId: null,
      isPreviewMode: false,
      isTestMode: false,
      testResponses: {},

      updateSurveyTitle: (title: string) =>
        set((state) => ({
          currentSurvey: {
            ...state.currentSurvey,
            title,
            updatedAt: new Date()
          }
        })),

      updateSurveyDescription: (description: string) =>
        set((state) => ({
          currentSurvey: {
            ...state.currentSurvey,
            description,
            updatedAt: new Date()
          }
        })),

      addQuestion: (type: QuestionType) => {
        const newQuestion: Question = {
          id: `question-${Date.now()}`,
          type,
          title: getDefaultQuestionTitle(type),
          required: false,
          order: get().currentSurvey.questions.length,
          ...(needsOptions(type) && {
            options: [
              { id: `option-${Date.now()}-1`, label: '옵션 1', value: '옵션1' },
              { id: `option-${Date.now()}-2`, label: '옵션 2', value: '옵션2' }
            ]
          }),
          ...(needsSelectLevels(type) && { selectLevels: getDefaultSelectLevels() })
        };

        set((state) => ({
          currentSurvey: {
            ...state.currentSurvey,
            questions: [...state.currentSurvey.questions, newQuestion],
            updatedAt: new Date()
          },
          selectedQuestionId: newQuestion.id
        }));
      },

      updateQuestion: (questionId: string, updates: Partial<Question>) =>
        set((state) => ({
          currentSurvey: {
            ...state.currentSurvey,
            questions: state.currentSurvey.questions.map((q) =>
              q.id === questionId ? { ...q, ...updates } : q
            ),
            updatedAt: new Date()
          }
        })),

      deleteQuestion: (questionId: string) =>
        set((state) => ({
          currentSurvey: {
            ...state.currentSurvey,
            questions: state.currentSurvey.questions.filter((q) => q.id !== questionId),
            updatedAt: new Date()
          },
          selectedQuestionId: state.selectedQuestionId === questionId ? null : state.selectedQuestionId
        })),

      reorderQuestions: (questionIds: string[]) =>
        set((state) => {
          const questionsMap = new Map(state.currentSurvey.questions.map(q => [q.id, q]));
          const reorderedQuestions = questionIds
            .map(id => questionsMap.get(id))
            .filter((q): q is Question => q !== undefined)
            .map((q, index) => ({ ...q, order: index }));

          return {
            currentSurvey: {
              ...state.currentSurvey,
              questions: reorderedQuestions,
              updatedAt: new Date()
            }
          };
        }),

      selectQuestion: (questionId: string | null) =>
        set(() => ({ selectedQuestionId: questionId })),

      togglePreviewMode: () =>
        set((state) => ({ isPreviewMode: !state.isPreviewMode })),

      toggleTestMode: () =>
        set((state) => ({
          isTestMode: !state.isTestMode,
          // 테스트 모드 끌 때 응답 데이터 초기화
          ...(state.isTestMode && { testResponses: {} })
        })),

      updateTestResponse: (questionId: string, value: any) =>
        set((state) => ({
          testResponses: {
            ...state.testResponses,
            [questionId]: value
          }
        })),

      clearTestResponses: () =>
        set(() => ({ testResponses: {} })),

      updateSurveySettings: (settings: Partial<SurveySettings>) =>
        set((state) => ({
          currentSurvey: {
            ...state.currentSurvey,
            settings: { ...state.currentSurvey.settings, ...settings },
            updatedAt: new Date()
          }
        })),

      resetSurvey: () =>
        set(() => ({
          currentSurvey: { ...defaultSurvey, id: `survey-${Date.now()}` },
          selectedQuestionId: null,
          isPreviewMode: false,
          isTestMode: false,
          testResponses: {}
        }))
    }),
    {
      name: 'survey-builder-store'
    }
  )
);

function getDefaultQuestionTitle(type: QuestionType): string {
  const titles = {
    text: '단답형 질문',
    textarea: '장문형 질문',
    radio: '단일 선택 질문',
    checkbox: '다중 선택 질문',
    select: '드롭다운 질문',
    multiselect: '다단계 선택 질문',
    table: '테이블 질문'
  };
  return titles[type];
}

function needsOptions(type: QuestionType): boolean {
  return ['radio', 'checkbox', 'select'].includes(type);
}

function needsSelectLevels(type: QuestionType): boolean {
  return type === 'multiselect';
}

function getDefaultSelectLevels(): SelectLevel[] {
  return [
    {
      id: 'level-1',
      label: '음식종류',
      placeholder: '음식종류를 선택하세요',
      order: 0,
      options: [
        { id: 'cat1', label: '한식', value: '한식' },
        { id: 'cat2', label: '중식', value: '중식' },
        { id: 'cat3', label: '양식', value: '양식' }
      ]
    },
    {
      id: 'level-2',
      label: '메뉴',
      placeholder: '메뉴를 선택하세요',
      order: 1,
      options: [
        { id: 'sub1-1', label: '김치찌개', value: '한식-김치찌개' },
        { id: 'sub1-2', label: '불고기', value: '한식-불고기' },
        { id: 'sub1-3', label: '비빔밥', value: '한식-비빔밥' },
        { id: 'sub2-1', label: '짜장면', value: '중식-짜장면' },
        { id: 'sub2-2', label: '짬뽕', value: '중식-짬뽕' },
        { id: 'sub2-3', label: '탕수육', value: '중식-탕수육' },
        { id: 'sub3-1', label: '스테이크', value: '양식-스테이크' },
        { id: 'sub3-2', label: '파스타', value: '양식-파스타' },
        { id: 'sub3-3', label: '피자', value: '양식-피자' }
      ]
    }
  ];
}