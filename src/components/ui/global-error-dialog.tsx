'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useErrorDialogStore } from '@/stores/error-dialog-store';

/**
 * 전역 에러 다이얼로그. 단순 메시지는 description, 구조화 에러는 issues 목록으로 표시.
 * browser alert 대체 프리미티브 중 "목록형 에러" 담당 (단순 알림은 sonner 토스트).
 */
export function GlobalErrorDialog() {
  const { open, title, description, issues, close } = useErrorDialogStore();

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-600">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {issues && issues.length > 0 && (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
            {issues.map((issue, i) => (
              <div
                key={`${issue.varName}-${i}`}
                className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 text-sm last:border-b-0"
              >
                <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-xs">
                  {issue.varName}
                </span>
                <span className="shrink-0 text-xs text-gray-500">{issue.questionText}</span>
                <span className="text-xs">{issue.reason}</span>
              </div>
            ))}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogAction onClick={close}>확인</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
