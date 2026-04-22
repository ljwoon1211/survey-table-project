import type { CSSProperties } from 'react';

/**
 * 옵션 리스트의 레이아웃 (`Question.optionsColumns`) 을 className + inline style 로 변환.
 * - undefined / 1: 세로 1열 (기본)
 * - 0: 가로 한 줄 (flex-wrap)
 * - N ≥ 2: N열 그리드 — 모바일(< sm=640px)에서는 자동 1열로 fallback
 *
 * N열 그리드는 globals.css 의 `.options-grid` + CSS 변수로 반응형 처리.
 */
export function getOptionsLayout(columns: number | undefined): {
  className: string;
  style?: CSSProperties;
} {
  if (columns === 0) {
    return { className: 'flex flex-wrap gap-x-4 gap-y-2' };
  }
  if (!columns || columns === 1) {
    return { className: 'flex flex-col gap-2' };
  }
  // N열 그리드 — sm 이상에서만 N열, 모바일은 1열
  return {
    className: 'options-grid',
    style: {
      ['--options-grid-cols' as string]: `repeat(${columns}, minmax(0, 1fr))`,
    } as CSSProperties,
  };
}
