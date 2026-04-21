import { useEffect, type RefObject } from 'react';

/**
 * 두 요소의 `scrollLeft`를 상호 동기화한다.
 *
 * 한쪽 스크롤 → 다른 쪽에 같은 값 반영. requestAnimationFrame 플래그로
 * 동기화 루프(A→B→A→...)를 막는다.
 *
 * @param disabled true면 리스너를 붙이지 않는다 (예: 모바일)
 */
export function useScrollLeftSync(
  aRef: RefObject<HTMLElement | null>,
  bRef: RefObject<HTMLElement | null>,
  disabled = false,
): void {
  useEffect(() => {
    if (disabled) return;
    const a = aRef.current;
    const b = bRef.current;
    if (!a || !b) return;

    let syncing = false;
    const makeHandler = (src: HTMLElement, dst: HTMLElement) => () => {
      if (syncing) return;
      syncing = true;
      if (dst.scrollLeft !== src.scrollLeft) dst.scrollLeft = src.scrollLeft;
      requestAnimationFrame(() => {
        syncing = false;
      });
    };
    const onA = makeHandler(a, b);
    const onB = makeHandler(b, a);
    a.addEventListener('scroll', onA, { passive: true });
    b.addEventListener('scroll', onB, { passive: true });
    return () => {
      a.removeEventListener('scroll', onA);
      b.removeEventListener('scroll', onB);
    };
  }, [aRef, bRef, disabled]);
}
