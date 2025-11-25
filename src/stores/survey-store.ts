import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Survey, Question, QuestionType, SurveySettings, SelectLevel, TableColumn, TableRow, QuestionGroup } from '@/types/survey';
import { generateSlugFromTitle, generatePrivateToken } from '@/lib/survey-url';

interface SurveyBuilderState {
  // 현재 편집 중인 설문
  currentSurvey: Survey;

  // UI 상태
  selectedQuestionId: string | null;
  isPreviewMode: boolean;
  isTestMode: boolean; // 테스트 모드 (실제 응답 가능하지만 데이터 저장 안됨)

  // 테스트용 임시 응답 데이터
  testResponses: Record<string, string | string[] | Record<string, string | string[] | object>>;

  // 액션들
  updateSurveyTitle: (title: string, autoUpdateSlug?: boolean) => void;
  updateSurveyDescription: (description: string) => void;

  // URL 관련 액션들
  updateSurveySlug: (slug: string) => void;
  updatePrivateToken: (token: string) => void;
  regeneratePrivateToken: () => string;

  // 그룹 관리
  addGroup: (name: string, description?: string, parentGroupId?: string) => void;
  updateGroup: (groupId: string, updates: Partial<QuestionGroup>) => void;
  deleteGroup: (groupId: string) => void;
  reorderGroups: (groupIds: string[]) => void;
  toggleGroupCollapse: (groupId: string) => void;

  addQuestion: (type: QuestionType, groupId?: string) => void;
  addPreparedQuestion: (question: Question) => void;
  updateQuestion: (questionId: string, updates: Partial<Question>) => void;
  deleteQuestion: (questionId: string) => void;
  reorderQuestions: (questionIds: string[]) => void;

  selectQuestion: (questionId: string | null) => void;
  togglePreviewMode: () => void;
  toggleTestMode: () => void;

  // 테스트 응답 관리
  updateTestResponse: (questionId: string, value: string | string[] | Record<string, string | string[] | object>) => void;
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
  slug: '',
  privateToken: '',
  groups: [],
  questions: [],
  settings: defaultSurveySettings,
  createdAt: new Date(),
  updatedAt: new Date()
};

export const useSurveyBuilderStore = create<SurveyBuilderState>()(
  devtools(
    persist(
      (set, get) => ({
        currentSurvey: defaultSurvey,
        selectedQuestionId: null,
        isPreviewMode: false,
        isTestMode: false,
        testResponses: {},

        updateSurveyTitle: (title: string, autoUpdateSlug: boolean = false) =>
          set((state) => {
            const updates: Partial<Survey> = {
              title,
              updatedAt: new Date()
            };

            // 공개 설문이고 autoUpdateSlug가 true이면 슬러그도 자동 업데이트
            if (autoUpdateSlug && state.currentSurvey.settings.isPublic) {
              updates.slug = generateSlugFromTitle(title);
            }

            return {
              currentSurvey: {
                ...state.currentSurvey,
                ...updates
              }
            };
          }),

        updateSurveyDescription: (description: string) =>
          set((state) => ({
            currentSurvey: {
              ...state.currentSurvey,
              description,
              updatedAt: new Date()
            }
          })),

        // URL 관련 액션들
        updateSurveySlug: (slug: string) =>
          set((state) => ({
            currentSurvey: {
              ...state.currentSurvey,
              slug,
              updatedAt: new Date()
            }
          })),

        updatePrivateToken: (token: string) =>
          set((state) => ({
            currentSurvey: {
              ...state.currentSurvey,
              privateToken: token,
              updatedAt: new Date()
            }
          })),

        regeneratePrivateToken: () => {
          const newToken = generatePrivateToken();
          set((state) => ({
            currentSurvey: {
              ...state.currentSurvey,
              privateToken: newToken,
              updatedAt: new Date()
            }
          }));
          return newToken;
        },

        // 그룹 관리
        addGroup: (name: string, description?: string, parentGroupId?: string) => {
          const groups = get().currentSurvey.groups || [];

          // 같은 레벨(같은 parentGroupId)의 그룹들 중 가장 큰 order 찾기
          const siblingGroups = groups.filter(g => g.parentGroupId === parentGroupId);
          const maxOrder = siblingGroups.length > 0
            ? Math.max(...siblingGroups.map(g => g.order))
            : -1;

          const newGroup: QuestionGroup = {
            id: `group-${Date.now()}`,
            name,
            description,
            parentGroupId,
            order: maxOrder + 1,
            collapsed: false
          };

          set((state) => ({
            currentSurvey: {
              ...state.currentSurvey,
              groups: [...(state.currentSurvey.groups || []), newGroup],
              updatedAt: new Date()
            }
          }));
        },

        updateGroup: (groupId: string, updates: Partial<QuestionGroup>) =>
          set((state) => ({
            currentSurvey: {
              ...state.currentSurvey,
              groups: (state.currentSurvey.groups || []).map((g) =>
                g.id === groupId ? { ...g, ...updates } : g
              ),
              updatedAt: new Date()
            }
          })),

        deleteGroup: (groupId: string) =>
          set((state) => {
            const groups = state.currentSurvey.groups || [];
            // 삭제할 그룹의 하위 그룹들도 함께 찾기
            const groupsToDelete = new Set([groupId]);
            const findChildGroups = (parentId: string) => {
              groups.forEach(g => {
                if (g.parentGroupId === parentId) {
                  groupsToDelete.add(g.id);
                  findChildGroups(g.id);
                }
              });
            };
            findChildGroups(groupId);

            return {
              currentSurvey: {
                ...state.currentSurvey,
                groups: groups.filter((g) => !groupsToDelete.has(g.id)),
                // 삭제된 그룹들에 속한 질문들의 groupId 제거
                questions: state.currentSurvey.questions.map((q) =>
                  groupsToDelete.has(q.groupId || '') ? { ...q, groupId: undefined } : q
                ),
                updatedAt: new Date()
              }
            };
          }),

        reorderGroups: (groupIds: string[]) =>
          set((state) => {
            const groupsMap = new Map((state.currentSurvey.groups || []).map(g => [g.id, g]));
            const reorderedGroups = groupIds
              .map(id => groupsMap.get(id))
              .filter((g): g is QuestionGroup => g !== undefined)
              .map((g, index) => ({ ...g, order: index }));

            return {
              currentSurvey: {
                ...state.currentSurvey,
                groups: reorderedGroups,
                updatedAt: new Date()
              }
            };
          }),

        toggleGroupCollapse: (groupId: string) =>
          set((state) => ({
            currentSurvey: {
              ...state.currentSurvey,
              groups: (state.currentSurvey.groups || []).map((g) =>
                g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
              )
            }
          })),

        addQuestion: (type: QuestionType, groupId?: string) => {
          const newQuestion: Question = {
            id: `question-${Date.now()}`,
            type,
            title: getDefaultQuestionTitle(type),
            required: false,
            order: get().currentSurvey.questions.length,
            groupId, // 그룹 ID 추가
            ...(needsOptions(type) && {
              options: [
                { id: `option-${Date.now()}-1`, label: '옵션 1', value: '옵션1' },
                { id: `option-${Date.now()}-2`, label: '옵션 2', value: '옵션2' }
              ]
            }),
            ...(needsSelectLevels(type) && { selectLevels: getDefaultSelectLevels() }),
            ...(needsTableData(type) && {
              tableTitle: '',
              tableColumns: getDefaultTableColumns(),
              tableRowsData: getDefaultTableRows()
            })
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

        addPreparedQuestion: (question: Question) => {
          const questionWithOrder = {
            ...question,
            order: get().currentSurvey.questions.length
          };

          set((state) => ({
            currentSurvey: {
              ...state.currentSurvey,
              questions: [...state.currentSurvey.questions, questionWithOrder],
              updatedAt: new Date()
            },
            selectedQuestionId: question.id
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

        updateTestResponse: (questionId: string, value: string | string[] | Record<string, string | string[] | object>) =>
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
            currentSurvey: {
              ...defaultSurvey,
              id: `survey-${Date.now()}`,
              slug: '',
              privateToken: generatePrivateToken() // 비공개 토큰은 항상 생성
            },
            selectedQuestionId: null,
            isPreviewMode: false,
            isTestMode: false,
            testResponses: {}
          }))
      }),
      {
        name: 'survey-builder-storage',
        // 현재 설문만 저장 (UI 상태는 제외)
        partialize: (state) => ({
          currentSurvey: state.currentSurvey,
        }),
        // Date 객체 직렬화/역직렬화 처리
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            const { state } = JSON.parse(str);
            return {
              state: {
                ...state,
                currentSurvey: state.currentSurvey ? {
                  ...state.currentSurvey,
                  createdAt: new Date(state.currentSurvey.createdAt),
                  updatedAt: new Date(state.currentSurvey.updatedAt),
                } : state.currentSurvey,
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
      name: 'survey-builder-store'
    }
  )
);

function getDefaultQuestionTitle(type: QuestionType): string {
  const titles: Record<QuestionType, string> = {
    text: '단답형 질문',
    textarea: '장문형 질문',
    radio: '단일 선택 질문',
    checkbox: '다중 선택 질문',
    select: '드롭다운 질문',
    multiselect: '다중 드롭다운 질문',
    table: '테이블 질문',
    notice: '공지사항'
  };
  return titles[type];
}

function needsOptions(type: QuestionType): boolean {
  return ['radio', 'checkbox', 'select'].includes(type);
}

function needsSelectLevels(type: QuestionType): boolean {
  return type === 'multiselect';
}

function needsTableData(type: QuestionType): boolean {
  return type === 'table';
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

function getDefaultTableColumns(): TableColumn[] {
  return [
    { id: 'col-1', label: '매우 좋음' },
    { id: 'col-2', label: '좋음' },
    { id: 'col-3', label: '보통' },
    { id: 'col-4', label: '나쁨' }
  ];
}

function getDefaultTableRows(): TableRow[] {
  return [
    {
      id: 'row-1',
      label: '행 1',
      height: 60, // 기본 행 높이
      minHeight: 40, // 최소 행 높이
      cells: [
        { id: 'cell-1-1', content: '', type: 'text' },
        { id: 'cell-1-2', content: '', type: 'text' },
        { id: 'cell-1-3', content: '', type: 'text' },
        { id: 'cell-1-4', content: '', type: 'text' }
      ]
    },
    {
      id: 'row-2',
      label: '행 2',
      height: 60, // 기본 행 높이
      minHeight: 40, // 최소 행 높이
      cells: [
        { id: 'cell-2-1', content: '', type: 'text' },
        { id: 'cell-2-2', content: '', type: 'text' },
        { id: 'cell-2-3', content: '', type: 'text' },
        { id: 'cell-2-4', content: '', type: 'text' }
      ]
    }
  ];
}