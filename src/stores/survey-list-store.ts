import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * 설문 목록 UI 상태 관리
 * 실제 설문 데이터는 TanStack Query로 관리
 */
interface SurveyListUIState {
  // UI 상태
  searchQuery: string;
  selectedSurveyIds: string[];
  sortBy: 'createdAt' | 'updatedAt' | 'title';
  sortOrder: 'asc' | 'desc';
  filterByPublic: boolean | null; // null = 전체, true = 공개만, false = 비공개만

  // 액션들
  setSearchQuery: (query: string) => void;
  selectSurvey: (surveyId: string) => void;
  deselectSurvey: (surveyId: string) => void;
  toggleSurveySelection: (surveyId: string) => void;
  selectAllSurveys: (surveyIds: string[]) => void;
  clearSelection: () => void;
  setSortBy: (sortBy: 'createdAt' | 'updatedAt' | 'title') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  toggleSortOrder: () => void;
  setFilterByPublic: (filter: boolean | null) => void;
  resetFilters: () => void;
}

export const useSurveyListStore = create<SurveyListUIState>()(
  devtools(
    (set) => ({
      searchQuery: '',
      selectedSurveyIds: [],
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      filterByPublic: null,

      setSearchQuery: (query: string) =>
        set(() => ({ searchQuery: query })),

      selectSurvey: (surveyId: string) =>
        set((state) => ({
          selectedSurveyIds: state.selectedSurveyIds.includes(surveyId)
            ? state.selectedSurveyIds
            : [...state.selectedSurveyIds, surveyId]
        })),

      deselectSurvey: (surveyId: string) =>
        set((state) => ({
          selectedSurveyIds: state.selectedSurveyIds.filter(id => id !== surveyId)
        })),

      toggleSurveySelection: (surveyId: string) =>
        set((state) => ({
          selectedSurveyIds: state.selectedSurveyIds.includes(surveyId)
            ? state.selectedSurveyIds.filter(id => id !== surveyId)
            : [...state.selectedSurveyIds, surveyId]
        })),

      selectAllSurveys: (surveyIds: string[]) =>
        set(() => ({ selectedSurveyIds: surveyIds })),

      clearSelection: () =>
        set(() => ({ selectedSurveyIds: [] })),

      setSortBy: (sortBy) =>
        set(() => ({ sortBy })),

      setSortOrder: (order) =>
        set(() => ({ sortOrder: order })),

      toggleSortOrder: () =>
        set((state) => ({ sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' })),

      setFilterByPublic: (filter) =>
        set(() => ({ filterByPublic: filter })),

      resetFilters: () =>
        set(() => ({
          searchQuery: '',
          sortBy: 'updatedAt',
          sortOrder: 'desc',
          filterByPublic: null,
        })),
    }),
    {
      name: 'survey-list-ui-store'
    }
  )
);

// 타입 export (하위 호환성)
export interface SurveyListItem {
  id: string;
  title: string;
  description?: string;
  slug?: string;
  privateToken?: string;
  questionCount: number;
  responseCount: number;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
}
