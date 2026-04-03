import { useEffect, useState } from 'react';

/**
 * matchMedia 기반 반응형 감지 훅.
 * - resize 이벤트 대신 matchMedia 'change' 이벤트만 구독 → 레이아웃 reflow 루프 방지
 * - SSR에서는 기본값(false) 반환, 클라이언트 mount 후 실제 값으로 전환
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** 1024px 미만 = 모바일/태블릿 (lg 브레이크포인트) */
export function useMobileView(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}
