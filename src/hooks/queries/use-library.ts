'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  saveQuestion as saveQuestionAction,
  updateSavedQuestion as updateSavedQuestionAction,
  deleteSavedQuestion as deleteSavedQuestionAction,
  getAllSavedQuestions,
  getQuestionsByCategory,
  searchSavedQuestions,
  getRecentlyUsedQuestions,
  getMostUsedQuestions,
  applyQuestion as applyQuestionAction,
  applyMultipleQuestions as applyMultipleQuestionsAction,
  getAllTags,
  getQuestionsByTag,
  exportLibrary as exportLibraryAction,
  importLibrary as importLibraryAction,
  getAllCategories,
  createCategory as createCategoryAction,
  updateCategory as updateCategoryAction,
  deleteCategory as deleteCategoryAction,
  initializeDefaultCategories,
  initializePresetQuestions,
} from '@/actions/library-actions';
import type { Question } from '@/types/survey';

// ========================
// Query Keys
// ========================
export const libraryKeys = {
  all: ['library'] as const,
  questions: () => [...libraryKeys.all, 'questions'] as const,
  questionsByCategory: (category: string) => [...libraryKeys.questions(), 'category', category] as const,
  questionsByTag: (tag: string) => [...libraryKeys.questions(), 'tag', tag] as const,
  searchQuestions: (query: string) => [...libraryKeys.questions(), 'search', query] as const,
  recentlyUsed: (limit?: number) => [...libraryKeys.questions(), 'recent', limit] as const,
  mostUsed: (limit?: number) => [...libraryKeys.questions(), 'popular', limit] as const,
  tags: () => [...libraryKeys.all, 'tags'] as const,
  categories: () => [...libraryKeys.all, 'categories'] as const,
};

// ========================
// Queries
// ========================

/**
 * 모든 저장된 질문 조회
 */
export function useSavedQuestions() {
  return useQuery({
    queryKey: libraryKeys.questions(),
    queryFn: () => getAllSavedQuestions(),
  });
}

/**
 * 카테고리별 질문 조회
 */
export function useQuestionsByCategory(category: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.questionsByCategory(category!),
    queryFn: () => getQuestionsByCategory(category!),
    enabled: !!category,
  });
}

/**
 * 질문 검색
 */
export function useSearchQuestions(query: string) {
  return useQuery({
    queryKey: libraryKeys.searchQuestions(query),
    queryFn: () => searchSavedQuestions(query),
    enabled: query.length > 0,
  });
}

/**
 * 최근 사용 질문 조회
 */
export function useRecentlyUsedQuestions(limit?: number) {
  return useQuery({
    queryKey: libraryKeys.recentlyUsed(limit),
    queryFn: () => getRecentlyUsedQuestions(limit),
  });
}

/**
 * 가장 많이 사용된 질문 조회
 */
export function useMostUsedQuestions(limit?: number) {
  return useQuery({
    queryKey: libraryKeys.mostUsed(limit),
    queryFn: () => getMostUsedQuestions(limit),
  });
}

/**
 * 태그별 질문 조회
 */
export function useQuestionsByTag(tag: string | undefined) {
  return useQuery({
    queryKey: libraryKeys.questionsByTag(tag!),
    queryFn: () => getQuestionsByTag(tag!),
    enabled: !!tag,
  });
}

/**
 * 모든 태그 조회
 */
export function useAllTags() {
  return useQuery({
    queryKey: libraryKeys.tags(),
    queryFn: () => getAllTags(),
  });
}

/**
 * 모든 카테고리 조회
 */
export function useCategories() {
  return useQuery({
    queryKey: libraryKeys.categories(),
    queryFn: () => getAllCategories(),
  });
}

// ========================
// Mutations
// ========================

/**
 * 질문 저장
 */
export function useSaveQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      question,
      metadata,
    }: {
      question: Question;
      metadata: {
        name: string;
        description?: string;
        category: string;
        tags?: string[];
      };
    }) => saveQuestionAction(question, metadata),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.questions() });
      queryClient.invalidateQueries({ queryKey: libraryKeys.tags() });
    },
  });
}

/**
 * 저장된 질문 업데이트
 */
export function useUpdateSavedQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<{
        name: string;
        description: string;
        category: string;
        tags: string[];
        question: Question;
      }>;
    }) => updateSavedQuestionAction(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.questions() });
      queryClient.invalidateQueries({ queryKey: libraryKeys.tags() });
    },
  });
}

/**
 * 저장된 질문 삭제
 */
export function useDeleteSavedQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSavedQuestionAction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.questions() });
    },
  });
}

/**
 * 질문 적용 (복제해서 반환)
 */
export function useApplyQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => applyQuestionAction(id),
    onSuccess: () => {
      // usageCount 증가로 인한 캐시 무효화
      queryClient.invalidateQueries({ queryKey: libraryKeys.questions() });
    },
  });
}

/**
 * 여러 질문 적용
 */
export function useApplyMultipleQuestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => applyMultipleQuestionsAction(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.questions() });
    },
  });
}

/**
 * 카테고리 생성
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, color }: { name: string; color?: string }) =>
      createCategoryAction(name, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.categories() });
    },
  });
}

/**
 * 카테고리 업데이트
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<{
        name: string;
        color: string;
        icon: string;
        order: number;
      }>;
    }) => updateCategoryAction(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.categories() });
    },
  });
}

/**
 * 카테고리 삭제
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCategoryAction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.categories() });
      queryClient.invalidateQueries({ queryKey: libraryKeys.questions() });
    },
  });
}

/**
 * 라이브러리 내보내기
 */
export function useExportLibrary() {
  return useMutation({
    mutationFn: () => exportLibraryAction(),
  });
}

/**
 * 라이브러리 가져오기
 */
export function useImportLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (json: string) => importLibraryAction(json),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
    },
  });
}

/**
 * 기본 카테고리 초기화
 */
export function useInitializeCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => initializeDefaultCategories(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.categories() });
    },
  });
}

/**
 * 프리셋 질문 초기화
 */
export function useInitializePresets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => initializePresetQuestions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.questions() });
    },
  });
}

