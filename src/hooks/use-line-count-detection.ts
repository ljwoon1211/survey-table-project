'use client';

import { type RefObject, useEffect, useRef, useState } from 'react';

/**
 * 텍스트 요소의 줄 수를 감지하여 2줄 이상인지 확인하는 커스텀 훅
 * @param isMobile 모바일 화면 여부
 * @param content 텍스트 내용 (변경 시 재측정)
 * @returns [ref, hasMultipleLines] - DOM 참조와 2줄 이상 여부
 */
export function useLineCountDetection<T extends HTMLElement>(
  isMobile: boolean,
  content?: string,
): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [hasMultipleLines, setHasMultipleLines] = useState(false);

  useEffect(() => {
    if (!ref.current || !isMobile) {
      setHasMultipleLines(false);
      return;
    }

    const element = ref.current;

    // 1회 측정만 수행 — ResizeObserver 없음
    // 이유: 폰트 크기가 결과에 따라 바뀌므로 (text-xl ↔ text-base)
    //       ResizeObserver 사용 시 true→false→true 진동 발생
    const rAF = requestAnimationFrame(() => {
      if (!element) return;
      const computedStyle = window.getComputedStyle(element);
      const lineHeight = parseFloat(computedStyle.lineHeight);
      const effectiveLineHeight =
        isNaN(lineHeight) || lineHeight === 0
          ? parseFloat(computedStyle.fontSize) * 1.2
          : lineHeight;
      const lineCount = element.scrollHeight / effectiveLineHeight;
      setHasMultipleLines(lineCount >= 2);
    });

    return () => cancelAnimationFrame(rAF);
  }, [isMobile, content]);

  return [ref, hasMultipleLines];
}
