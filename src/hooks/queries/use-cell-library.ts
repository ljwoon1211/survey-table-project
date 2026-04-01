'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  applySavedCellAction,
  deleteSavedCellAction,
  saveCellAction,
} from '@/actions/cell-library-actions';
import { getAllSavedCells, searchSavedCells } from '@/actions/query-actions';
import type { TableCell } from '@/types/survey';

// ========================
// Query Keys
// ========================
export const cellLibraryKeys = {
  all: ['cellLibrary'] as const,
  cells: () => [...cellLibraryKeys.all, 'cells'] as const,
  search: (query: string) => [...cellLibraryKeys.cells(), 'search', query] as const,
};

// ========================
// Queries
// ========================

/** 모든 저장된 셀 조회 */
export function useSavedCells() {
  return useQuery({
    queryKey: cellLibraryKeys.cells(),
    queryFn: () => getAllSavedCells(),
  });
}

/** 셀 이름 검색 */
export function useSearchSavedCells(query: string) {
  return useQuery({
    queryKey: cellLibraryKeys.search(query),
    queryFn: () => searchSavedCells(query),
    enabled: query.length > 0,
  });
}

// ========================
// Mutations
// ========================

/** 셀 저장 */
export function useSaveCell() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cell, name }: { cell: TableCell; name: string }) => saveCellAction(cell, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cellLibraryKeys.cells() });
    },
  });
}

/** 저장된 셀 삭제 */
export function useDeleteSavedCell() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSavedCellAction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cellLibraryKeys.cells() });
    },
  });
}

/** 셀 적용 (usageCount 증가 + cell 데이터 반환) */
export function useApplySavedCell() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => applySavedCellAction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cellLibraryKeys.cells() });
    },
  });
}
