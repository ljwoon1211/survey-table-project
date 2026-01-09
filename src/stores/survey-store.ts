import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Survey, Question, QuestionType, SurveySettings, SelectLevel, TableColumn, TableRow, QuestionGroup } from '@/types/survey';
import { generateSlugFromTitle, generatePrivateToken } from '@/lib/survey-url';
import { generateId } from '@/lib/utils';

interface SurveyBuilderState {
  // 현재 편집 중인 설문 (메모리에만 유지, TanStack Query로 서버와 동기화)
  currentSurvey: Survey;

  // UI 상태
  selectedQuestionId: string | null;
  isTestMode: boolean;
  isDirty: boolean; // 변경사항 있음 표시

  // 테스트용 임시 응답 데이터
  testResponses: Record<string, string | string[] | Record<string, string | string[] | object>>;

  // 서버에서 불러온 데이터 설정
  setSurvey: (survey: Survey) => void;

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
  toggleTestMode: () => void;

  // 테스트 응답 관리
  updateTestResponse: (questionId: string, value: string | string[] | Record<string, string | string[] | object>) => void;
  clearTestResponses: () => void;

  updateSurveySettings: (settings: Partial<SurveySettings>) => void;

  // 초기화
  resetSurvey: () => void;
  markClean: () => void; // 저장 후 dirty 플래그 초기화
}

const defaultSurveySettings: SurveySettings = {
  isPublic: true,
  allowMultipleResponses: false,
  showProgressBar: true,
  shuffleQuestions: false,
  requireLogin: false,
  thankYouMessage: '응답해주셔서 감사합니다!'
};

const createDefaultSurvey = (): Survey => ({
  id: generateId(),
  title: '새 설문조사',
  description: '',
  slug: '',
  privateToken: generatePrivateToken(),
  groups: [],
  questions: [],
  settings: defaultSurveySettings,
  createdAt: new Date(),
  updatedAt: new Date()
});

export const useSurveyBuilderStore = create<SurveyBuilderState>()(
  devtools(
    (set, get) => ({
      currentSurvey: createDefaultSurvey(),
      selectedQuestionId: null,
      isTestMode: false,
      isDirty: false,
      testResponses: {},

      // 서버에서 불러온 설문 데이터 설정
      setSurvey: (survey: Survey) =>
        set(() => ({
          currentSurvey: survey,
          selectedQuestionId: null,
          isTestMode: false,
          isDirty: false,
          testResponses: {},
        })),

      updateSurveyTitle: (title: string, autoUpdateSlug: boolean = false) =>
        set((state) => {
          const updates: Partial<Survey> = {
            title,
            updatedAt: new Date()
          };

          if (autoUpdateSlug && state.currentSurvey.settings.isPublic) {
            updates.slug = generateSlugFromTitle(title);
          }

          return {
            currentSurvey: {
              ...state.currentSurvey,
              ...updates
            },
            isDirty: true,
          };
        }),

      updateSurveyDescription: (description: string) =>
        set((state) => ({
          currentSurvey: {
            ...state.currentSurvey,
            description,
            updatedAt: new Date()
          },
          isDirty: true,
        })),

      updateSurveySlug: (slug: string) =>
        set((state) => ({
          currentSurvey: {
            ...state.currentSurvey,
            slug,
            updatedAt: new Date()
          },
          isDirty: true,
        })),

      updatePrivateToken: (token: string) =>
        set((state) => ({
          currentSurvey: {
            ...state.currentSurvey,
            privateToken: token,
            updatedAt: new Date()
          },
          isDirty: true,
        })),

      regeneratePrivateToken: () => {
        const newToken = generatePrivateToken();
        set((state) => ({
          currentSurvey: {
            ...state.currentSurvey,
            privateToken: newToken,
            updatedAt: new Date()
          },
          isDirty: true,
        }));
        return newToken;
      },

      addGroup: (name: string, description?: string, parentGroupId?: string) => {
        const groups = get().currentSurvey.groups || [];

        const siblingGroups = groups.filter(g => g.parentGroupId === parentGroupId);
        const maxOrder = siblingGroups.length > 0
          ? Math.max(...siblingGroups.map(g => g.order))
          : -1;

        const newGroup: QuestionGroup = {
          id: generateId(),
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
          },
          isDirty: true,
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
          },
          isDirty: true,
        })),

      deleteGroup: (groupId: string) =>
        set((state) => {
          const groups = state.currentSurvey.groups || [];
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
              questions: state.currentSurvey.questions.map((q) =>
                groupsToDelete.has(q.groupId || '') ? { ...q, groupId: undefined } : q
              ),
              updatedAt: new Date()
            },
            isDirty: true,
          };
        }),

      reorderGroups: (groupIds: string[]) =>
        set((state) => {
          const allGroups = state.currentSurvey.groups || [];
          const groupsMap = new Map(allGroups.map(g => [g.id, g]));

          // 재정렬할 그룹들 (최상위 그룹만)
          const reorderedTopGroups = groupIds
            .map(id => groupsMap.get(id))
            .filter((g): g is QuestionGroup => g !== undefined)
            .map((g, index) => ({ ...g, order: index }));

          // 하위 그룹들은 그대로 유지
          const subGroups = allGroups.filter(g => g.parentGroupId !== undefined);

          // 재정렬된 최상위 그룹 + 하위 그룹들 (중복 제거)
          const allReorderedGroups = [...reorderedTopGroups, ...subGroups];
          const reorderedGroups = Array.from(
            new Map(allReorderedGroups.map(g => [g.id, g])).values()
          );

          return {
            currentSurvey: {
              ...state.currentSurvey,
              groups: reorderedGroups,
              updatedAt: new Date()
            },
            isDirty: true,
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
          // 접힘 상태는 dirty로 표시하지 않음 (UI 상태)
        })),

      addQuestion: (type: QuestionType, groupId?: string) => {
        const newQuestion: Question = {
          id: generateId(),
          type,
          title: getDefaultQuestionTitle(type),
          required: false,
          order: get().currentSurvey.questions.length,
          groupId,
          ...(needsOptions(type) && {
            options: [
              { id: generateId(), label: '옵션 1', value: '옵션1' },
              { id: generateId(), label: '옵션 2', value: '옵션2' }
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
          selectedQuestionId: newQuestion.id,
          isDirty: true,
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
          selectedQuestionId: question.id,
          isDirty: true,
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
          },
          isDirty: true,
        })),

      deleteQuestion: (questionId: string) =>
        set((state) => ({
          currentSurvey: {
            ...state.currentSurvey,
            questions: state.currentSurvey.questions.filter((q) => q.id !== questionId),
            updatedAt: new Date()
          },
          selectedQuestionId: state.selectedQuestionId === questionId ? null : state.selectedQuestionId,
          isDirty: true,
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
            },
            isDirty: true,
          };
        }),

      selectQuestion: (questionId: string | null) =>
        set(() => ({ selectedQuestionId: questionId })),

      toggleTestMode: () =>
        set((state) => ({
          isTestMode: !state.isTestMode,
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
          },
          isDirty: true,
        })),

      resetSurvey: () =>
        set(() => ({
          currentSurvey: createDefaultSurvey(),
          selectedQuestionId: null,
          isTestMode: false,
          isDirty: false,
          testResponses: {}
        })),

      markClean: () =>
        set(() => ({ isDirty: false })),
    }),
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
  const level1Id = generateId();
  const level2Id = generateId();
  return [
    {
      id: level1Id,
      label: '음식종류',
      placeholder: '음식종류를 선택하세요',
      order: 0,
      options: [
        { id: generateId(), label: '한식', value: '한식' },
        { id: generateId(), label: '중식', value: '중식' },
        { id: generateId(), label: '양식', value: '양식' }
      ]
    },
    {
      id: level2Id,
      label: '메뉴',
      placeholder: '메뉴를 선택하세요',
      order: 1,
      options: [
        { id: generateId(), label: '김치찌개', value: '한식-김치찌개' },
        { id: generateId(), label: '불고기', value: '한식-불고기' },
        { id: generateId(), label: '비빔밥', value: '한식-비빔밥' },
        { id: generateId(), label: '짜장면', value: '중식-짜장면' },
        { id: generateId(), label: '짬뽕', value: '중식-짬뽕' },
        { id: generateId(), label: '탕수육', value: '중식-탕수육' },
        { id: generateId(), label: '스테이크', value: '양식-스테이크' },
        { id: generateId(), label: '파스타', value: '양식-파스타' },
        { id: generateId(), label: '피자', value: '양식-피자' }
      ]
    }
  ];
}

function getDefaultTableColumns(): TableColumn[] {
  return [
    { id: generateId(), label: '매우 좋음' },
    { id: generateId(), label: '좋음' },
    { id: generateId(), label: '보통' },
    { id: generateId(), label: '나쁨' }
  ];
}

function getDefaultTableRows(): TableRow[] {
  const row1Id = generateId();
  const row2Id = generateId();
  return [
    {
      id: row1Id,
      label: '행 1',
      height: 60,
      minHeight: 40,
      cells: [
        { id: generateId(), content: '', type: 'text' },
        { id: generateId(), content: '', type: 'text' },
        { id: generateId(), content: '', type: 'text' },
        { id: generateId(), content: '', type: 'text' }
      ]
    },
    {
      id: row2Id,
      label: '행 2',
      height: 60,
      minHeight: 40,
      cells: [
        { id: generateId(), content: '', type: 'text' },
        { id: generateId(), content: '', type: 'text' },
        { id: generateId(), content: '', type: 'text' },
        { id: generateId(), content: '', type: 'text' }
      ]
    }
  ];
}
