'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSearchParamsMutator } from '@/hooks/use-search-params-mutator';

interface Props {
  initialQuery: string;
  groupLabel: string;
}

/**
 * 진행 현황 리포트 필터바.
 *
 * - 그룹 라벨(조사 대상 목록 매핑된 attrs 키 라벨) 검색 한 필드만 사용
 * - 적용 / 초기화 시 q + page 둘 다 mutate (q 가 줄었을 때 빈 페이지에 머무는 거 방지)
 * - 빈 q 는 URL 키 자체를 삭제
 */
export function ProgressFilterBar({ initialQuery, groupLabel }: Props) {
  const [q, setQ] = useState(initialQuery);
  const [, startTransition] = useTransition();
  const pushParams = useSearchParamsMutator();

  const apply = () => {
    startTransition(() => {
      pushParams((p) => {
        const trimmed = q.trim();
        if (trimmed) p.set('q', trimmed);
        else p.delete('q');
        p.delete('page');
      });
    });
  };

  const reset = () => {
    setQ('');
    startTransition(() => {
      pushParams((p) => {
        p.delete('q');
        p.delete('page');
      });
    });
  };

  return (
    <div className="mb-3 flex items-center gap-2">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') apply();
        }}
        placeholder={`🔍 ${groupLabel} 검색`}
        className="max-w-xs"
      />
      <Button onClick={apply} variant="default">
        필터 적용
      </Button>
      <Button onClick={reset} variant="outline">
        초기화
      </Button>
    </div>
  );
}
