'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

/**
 * 현황 콘솔 헤더용 수동 새로고침 버튼.
 *
 * - `router.refresh()` 는 RSC 페이지를 재평가하여 어댑터를 다시 호출하게 한다.
 * - `useTransition` 으로 진행 상태를 표시(버튼 disabled + 라벨 변경)해 사용자가
 *   중복 클릭하지 않도록 안내한다.
 * - 페이지 자체의 `revalidate` 폴링과 별개로, 즉시 갱신이 필요할 때 사용한다.
 */
export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {isPending ? '새로고침 중…' : '새로고침'}
    </Button>
  );
}
