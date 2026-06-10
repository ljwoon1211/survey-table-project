import { create } from 'zustand';

import type { VarNameIssue } from '@/lib/spss/variable-name-guard';

interface ErrorDialogPayload {
  title: string;
  description?: string;
  issues?: VarNameIssue[];
}

interface ErrorDialogState {
  open: boolean;
  title: string;
  description?: string;
  issues?: VarNameIssue[];
  show: (payload: ErrorDialogPayload) => void;
  close: () => void;
}

/**
 * 전역 구조화 에러 다이얼로그 상태.
 * 목록이 있는 에러(SPSS 변수명 issues 등)는 토스트 대신 이 다이얼로그로 표시한다.
 */
export const useErrorDialogStore = create<ErrorDialogState>((set) => ({
  open: false,
  title: '',
  show: (payload) =>
    set({
      open: true,
      title: payload.title,
      ...(payload.description !== undefined && { description: payload.description }),
      ...(payload.issues !== undefined && { issues: payload.issues }),
    }),
  close: () => set({ open: false }),
}));
