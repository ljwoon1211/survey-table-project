import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { generatePrivateToken, generateSlugFromTitle } from '@/lib/survey-url';
import { generateId } from '@/lib/utils';
import {
  Question,
  QuestionGroup,
  QuestionType,
  SelectLevel,
  Survey,
  SurveySettings,
  TableColumn,
  TableRow,
} from '@/types/survey';

export interface SurveyBuilderState {
  // 현재 편집 중인 설문 (메모리에만 유지, TanStack Query로 서버와 동기화)
  currentSurvey: Survey;
  isDirty: boolean; // 변경사항 있음 표시

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
  thankYouMessage: '응답해주셔서 감사합니다!',
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
  updatedAt: new Date(),
});
export const useSurveyBuilderStore = create<SurveyBuilderState>()(
  devtools(
    immer<SurveyBuilderState>((set, get) => ({
      currentSurvey: createDefaultSurvey(),
      isDirty: false,

      // 서버에서 불러온 설문 데이터 설정
      setSurvey: (survey: Survey) =>
        set((state) => {
          state.currentSurvey = survey;
          state.isDirty = false;
        }),

      updateSurveyTitle: (title: string, autoUpdateSlug: boolean = false) =>
        set((state) => {
          state.currentSurvey.title = title;
          state.currentSurvey.updatedAt = new Date();

          if (autoUpdateSlug && state.currentSurvey.settings.isPublic) {
            state.currentSurvey.slug = generateSlugFromTitle(title);
          }
          state.isDirty = true;
        }),

      updateSurveyDescription: (description: string) =>
        set((state) => {
          state.currentSurvey.description = description;
          state.currentSurvey.updatedAt = new Date();
          state.isDirty = true;
        }),

      updateSurveySlug: (slug: string) =>
        set((state) => {
          state.currentSurvey.slug = slug;
          state.currentSurvey.updatedAt = new Date();
          state.isDirty = true;
        }),

      updatePrivateToken: (token: string) =>
        set((state) => {
          state.currentSurvey.privateToken = token;
          state.currentSurvey.updatedAt = new Date();
          state.isDirty = true;
        }),

      regeneratePrivateToken: () => {
        const newToken = generatePrivateToken();
        set((state) => {
          state.currentSurvey.privateToken = newToken;
          state.currentSurvey.updatedAt = new Date();
          state.isDirty = true;
        });
        return newToken;
      },

      addGroup: (name: string, description?: string, parentGroupId?: string) => {
        const groups = get().currentSurvey.groups || [];

        const siblingGroups = groups.filter((g) => g.parentGroupId === parentGroupId);
        const maxOrder =
          siblingGroups.length > 0 ? Math.max(...siblingGroups.map((g) => g.order)) : -1;

        const newGroup: QuestionGroup = {
          id: generateId(),
          surveyId: get().currentSurvey.id,
          name,
          description,
          parentGroupId,
          order: maxOrder + 1,
          collapsed: false,
        };

        set((state) => {
          if (!state.currentSurvey.groups) {
            state.currentSurvey.groups = [];
          }
          state.currentSurvey.groups.push(newGroup);
          state.currentSurvey.updatedAt = new Date();
          state.isDirty = true;
        });
      },

      updateGroup: (groupId: string, updates: Partial<QuestionGroup>) =>
        set((state) => {
          const group = state.currentSurvey.groups?.find((g) => g.id === groupId);
          if (group) {
            Object.assign(group, updates);
            state.currentSurvey.updatedAt = new Date();
            state.isDirty = true;
          }
        }),

      deleteGroup: (groupId: string) =>
        set((state) => {
          const groups = state.currentSurvey.groups || [];
          const groupsToDelete = new Set([groupId]);

          const findChildGroups = (parentId: string) => {
            groups.forEach((g) => {
              if (g.parentGroupId === parentId) {
                groupsToDelete.add(g.id);
                findChildGroups(g.id);
              }
            });
          };
          findChildGroups(groupId);

          state.currentSurvey.groups = groups.filter((g) => !groupsToDelete.has(g.id));

          state.currentSurvey.questions.forEach((q) => {
            if (q.groupId && groupsToDelete.has(q.groupId)) {
              q.groupId = undefined;
            }
          });

          state.currentSurvey.updatedAt = new Date();
          state.isDirty = true;
        }),

      reorderGroups: (groupIds: string[]) =>
        set((state) => {
          if (!state.currentSurvey.groups) return;

          const groups = state.currentSurvey.groups;
          const groupMap = new Map<string, QuestionGroup>(groups.map((g) => [g.id, g]));

          const topLevelGroups: QuestionGroup[] = [];

          // 1. groupIds에 있는 그룹들을 순서대로 재배치하고 order 업데이트
          groupIds.forEach((id, index) => {
            const g = groupMap.get(id);
            if (g) {
              g.order = index;
              topLevelGroups.push(g);
              groupMap.delete(id); // 처리된 그룹 제거
            }
          });

          // 2. 남은 그룹들 (하위 그룹이거나, groupIds에 포함되지 않은 상위 그룹 등)
          const remainingGroups = Array.from(groupMap.values());

          // 합치기
          state.currentSurvey.groups = [...topLevelGroups, ...remainingGroups];
          state.currentSurvey.updatedAt = new Date();
          state.isDirty = true;
        }),

      toggleGroupCollapse: (groupId: string) =>
        set((state) => {
          const group = state.currentSurvey.groups?.find((g) => g.id === groupId);
          if (group) {
            group.collapsed = !group.collapsed;
          }
        }),

      addQuestion: (type: QuestionType, groupId?: string) => {
        const questions = get().currentSurvey.questions;
        const maxOrder = questions.length > 0 ? Math.max(...questions.map((q) => q.order), 0) : 0;

        const newQuestion: Question = {
          id: generateId(),
          type,
          title: getDefaultQuestionTitle(type),
          required: false,
          order: maxOrder + 1, // 1부터 시작하는 실제 질문 번호
          groupId,
          ...(needsOptions(type) && {
            options: [
              { id: generateId(), label: '옵션 1', value: '옵션1' },
              { id: generateId(), label: '옵션 2', value: '옵션2' },
            ],
          }),
          ...(needsSelectLevels(type) && { selectLevels: getDefaultSelectLevels() }),
          ...(needsTableData(type) && {
            tableTitle: '',
            tableColumns: getDefaultTableColumns(),
            tableRowsData: getDefaultTableRows(),
          }),
        };

        set((state) => {
          state.currentSurvey.questions.push(newQuestion);
          state.currentSurvey.updatedAt = new Date();
          state.isDirty = true;
        });
      },

      addPreparedQuestion: (question: Question) => {
        const questions = get().currentSurvey.questions;
        const maxOrder = questions.length > 0 ? Math.max(...questions.map((q) => q.order), 0) : 0;

        const questionWithOrder = {
          ...question,
          order: maxOrder + 1,
        };

        set((state) => {
          state.currentSurvey.questions.push(questionWithOrder);
          state.currentSurvey.updatedAt = new Date();
          state.isDirty = true;
        });
      },

      updateQuestion: (questionId: string, updates: Partial<Question>) =>
        set((state) => {
          const question = state.currentSurvey.questions.find((q) => q.id === questionId);
          if (question) {
            Object.assign(question, updates);
            state.currentSurvey.updatedAt = new Date();
            state.isDirty = true;
          }
        }),

      deleteQuestion: (questionId: string) =>
        set((state) => {
          state.currentSurvey.questions = state.currentSurvey.questions.filter(
            (q) => q.id !== questionId,
          );
          state.currentSurvey.updatedAt = new Date();
          state.isDirty = true;
        }),

      reorderQuestions: (questionIds: string[]) =>
        set((state) => {
          const questions = state.currentSurvey.questions;
          const questionMap = new Map<string, Question>(questions.map((q) => [q.id, q]));

          const reorderedQuestions: Question[] = [];

          questionIds.forEach((id, index) => {
            const q = questionMap.get(id);
            if (q) {
              q.order = index + 1;
              reorderedQuestions.push(q);
              questionMap.delete(id);
            }
          });

          // 남은 질문들 추가 (혹시 모를 누락 방지)
          Array.from(questionMap.values()).forEach((q) => reorderedQuestions.push(q));

          state.currentSurvey.questions = reorderedQuestions;
          state.currentSurvey.updatedAt = new Date();
          state.isDirty = true;
        }),

      updateSurveySettings: (settings: Partial<SurveySettings>) =>
        set((state) => {
          Object.assign(state.currentSurvey.settings, settings);
          state.currentSurvey.updatedAt = new Date();
          state.isDirty = true;
        }),

      resetSurvey: () =>
        set((state) => {
          state.currentSurvey = createDefaultSurvey();
          state.isDirty = false;
        }),

      markClean: () =>
        set((state) => {
          state.isDirty = false;
        }),
    })) as any,
    {
      name: 'survey-builder-store',
    },
  ),
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
    notice: '공지사항',
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
        { id: generateId(), label: '양식', value: '양식' },
      ],
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
        { id: generateId(), label: '피자', value: '양식-피자' },
      ],
    },
  ];
}

function getDefaultTableColumns(): TableColumn[] {
  return [
    { id: generateId(), label: '매우 좋음' },
    { id: generateId(), label: '좋음' },
    { id: generateId(), label: '보통' },
    { id: generateId(), label: '나쁨' },
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
        { id: generateId(), content: '', type: 'text' },
      ],
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
        { id: generateId(), content: '', type: 'text' },
      ],
    },
  ];
}
