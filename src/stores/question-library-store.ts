import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { DEFAULT_CATEGORIES, Question, QuestionCategory } from '@/types/survey';

/**
 * 질문 보관함 UI 상태 관리
 * 실제 보관함 데이터는 TanStack Query로 관리
 */
interface QuestionLibraryUIState {
  // UI 상태
  searchQuery: string;
  selectedCategory: string | null;
  selectedTag: string | null;
  selectedQuestionIds: string[];
  isLibraryPanelOpen: boolean;

  // 액션들
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
  setSelectedTag: (tag: string | null) => void;
  selectQuestion: (questionId: string) => void;
  deselectQuestion: (questionId: string) => void;
  toggleQuestionSelection: (questionId: string) => void;
  clearSelection: () => void;
  toggleLibraryPanel: () => void;
  openLibraryPanel: () => void;
  closeLibraryPanel: () => void;
  resetFilters: () => void;
}

export const useQuestionLibraryStore = create<QuestionLibraryUIState>()(
  devtools(
    immer<QuestionLibraryUIState>((set) => ({
      searchQuery: '',
      selectedCategory: null,
      selectedTag: null,
      selectedQuestionIds: [],
      isLibraryPanelOpen: false,

      setSearchQuery: (query) =>
        set((state) => {
          state.searchQuery = query;
        }),

      setSelectedCategory: (category) =>
        set((state) => {
          state.selectedCategory = category;
          state.selectedTag = null;
        }),

      setSelectedTag: (tag) =>
        set((state) => {
          state.selectedTag = tag;
        }),

      selectQuestion: (questionId) =>
        set((state) => {
          if (!state.selectedQuestionIds.includes(questionId)) {
            state.selectedQuestionIds.push(questionId);
          }
        }),

      deselectQuestion: (questionId) =>
        set((state) => {
          state.selectedQuestionIds = state.selectedQuestionIds.filter((id) => id !== questionId);
        }),

      toggleQuestionSelection: (questionId) =>
        set((state) => {
          if (state.selectedQuestionIds.includes(questionId)) {
            state.selectedQuestionIds = state.selectedQuestionIds.filter((id) => id !== questionId);
          } else {
            state.selectedQuestionIds.push(questionId);
          }
        }),

      clearSelection: () =>
        set((state) => {
          state.selectedQuestionIds = [];
        }),

      toggleLibraryPanel: () =>
        set((state) => {
          state.isLibraryPanelOpen = !state.isLibraryPanelOpen;
        }),

      openLibraryPanel: () =>
        set((state) => {
          state.isLibraryPanelOpen = true;
        }),

      closeLibraryPanel: () =>
        set((state) => {
          state.isLibraryPanelOpen = false;
        }),

      resetFilters: () =>
        set((state) => {
          state.searchQuery = '';
          state.selectedCategory = null;
          state.selectedTag = null;
        }),
    })) as any,
    {
      name: 'question-library-ui-store',
    },
  ),
);

// 유틸리티 함수들 (분기 로직 관련)
export function hasBranchLogic(question: Question): boolean {
  if (question.options?.some((opt) => opt.branchRule)) {
    return true;
  }

  if (question.tableValidationRules?.length) {
    return true;
  }

  if (question.tableRowsData) {
    for (const row of question.tableRowsData) {
      for (const cell of row.cells) {
        if (cell.checkboxOptions?.some((opt) => opt.branchRule)) return true;
        if (cell.radioOptions?.some((opt) => opt.branchRule)) return true;
        if (cell.selectOptions?.some((opt) => opt.branchRule)) return true;
      }
    }
  }

  if (question.displayCondition?.conditions?.length) {
    return true;
  }

  return false;
}

export function removeBranchLogic(question: Question): Question {
  const cleanedQuestion: Question = {
    ...question,
    groupId: undefined, // 라이브러리에서 가져온 질문은 그룹 ID를 제거
  };

  if (cleanedQuestion.options) {
    cleanedQuestion.options = cleanedQuestion.options.map((opt) => {
      const { branchRule: _br, ...rest } = opt;
      return rest;
    });
  }

  delete cleanedQuestion.tableValidationRules;

  if (cleanedQuestion.tableRowsData) {
    cleanedQuestion.tableRowsData = cleanedQuestion.tableRowsData.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => {
        const cleanedCell = { ...cell };
        if (cleanedCell.checkboxOptions) {
          cleanedCell.checkboxOptions = cleanedCell.checkboxOptions.map((opt) => {
            const { branchRule: _br1, ...rest } = opt;
            return rest;
          });
        }
        if (cleanedCell.radioOptions) {
          cleanedCell.radioOptions = cleanedCell.radioOptions.map((opt) => {
            const { branchRule: _br2, ...rest } = opt;
            return rest;
          });
        }
        if (cleanedCell.selectOptions) {
          cleanedCell.selectOptions = cleanedCell.selectOptions.map((opt) => {
            const { branchRule: _br3, ...rest } = opt;
            return rest;
          });
        }
        return cleanedCell;
      }),
    }));
  }

  delete cleanedQuestion.displayCondition;

  return cleanedQuestion;
}

// 기본 카테고리 export (하위 호환성)
export { DEFAULT_CATEGORIES };
export type { QuestionCategory };
