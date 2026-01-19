'use client';

import { RefObject, useEffect, useRef, useState } from 'react';

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

    // 요소가 렌더링되고 레이아웃이 계산될 때까지 대기
    const checkLineCount = () => {
      if (!element) return;

      const computedStyle = window.getComputedStyle(element);
      const lineHeight = parseFloat(computedStyle.lineHeight);

      // lineHeight가 유효하지 않은 경우 (normal 등) 폰트 크기 * 1.2로 추정
      const effectiveLineHeight =
        isNaN(lineHeight) || lineHeight === 0
          ? parseFloat(computedStyle.fontSize) * 1.2
          : lineHeight;

      const height = element.scrollHeight;
      const lineCount = height / effectiveLineHeight;

      // 2줄 이상이면 true
      setHasMultipleLines(lineCount >= 2);
    };

    // 초기 측정
    checkLineCount();

    // ResizeObserver로 크기 변화 감지
    const resizeObserver = new ResizeObserver(() => {
      checkLineCount();
    });

    resizeObserver.observe(element);

    // 윈도우 리사이즈 시에도 재측정 (폰트 로딩 등으로 인한 지연 대응)
    const handleResize = () => {
      setTimeout(checkLineCount, 100);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobile, content]);

  return [ref, hasMultipleLines];
}
