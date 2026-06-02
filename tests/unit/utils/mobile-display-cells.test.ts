import { describe, expect, it } from 'vitest';

import type { TableCell } from '@/types/survey';
import { splitMobileDisplayCells } from '@/utils/mobile-display-cells';

function cell(partial: Partial<TableCell>): TableCell {
  return { id: Math.random().toString(36).slice(2), content: '', type: 'text', ...partial } as TableCell;
}

describe('splitMobileDisplayCells', () => {
  it('inline / collapsed 로 분류하고 hidden·미지정은 제외', () => {
    const cells = [
      cell({ id: 'a', type: 'text', mobileDisplay: 'inline', content: '정의' }),
      cell({ id: 'b', type: 'text', mobileDisplay: 'collapsed', content: '예시' }),
      cell({ id: 'c', type: 'text', mobileDisplay: 'hidden', content: '숨김' }),
      cell({ id: 'd', type: 'text', content: '미지정' }),
    ];
    const { inline, collapsed } = splitMobileDisplayCells(cells);
    expect(inline.map((c) => c.id)).toEqual(['a']);
    expect(collapsed.map((c) => c.id)).toEqual(['b']);
  });

  it('입력 셀 타입은 mobileDisplay 와 무관하게 제외', () => {
    const cells = [
      cell({ id: 'r', type: 'radio', mobileDisplay: 'inline' }),
      cell({ id: 'i', type: 'input', mobileDisplay: 'collapsed' }),
      cell({ id: 'co', type: 'choice_opt', mobileDisplay: 'inline' }),
    ];
    const { inline, collapsed } = splitMobileDisplayCells(cells);
    expect(inline).toEqual([]);
    expect(collapsed).toEqual([]);
  });

  it('isHidden·continuation 셀 제외', () => {
    const cells = [
      cell({ id: 'h', type: 'text', mobileDisplay: 'inline', isHidden: true }),
      cell({ id: 'k', type: 'text', mobileDisplay: 'inline', _isContinuation: true }),
    ];
    const { inline, collapsed } = splitMobileDisplayCells(cells);
    expect(inline).toEqual([]);
    expect(collapsed).toEqual([]);
  });

  it('image/video 도 표시 셀로 분류', () => {
    const cells = [
      cell({ id: 'img', type: 'image', mobileDisplay: 'inline', imageUrl: 'x' }),
      cell({ id: 'vid', type: 'video', mobileDisplay: 'collapsed', videoUrl: 'y' }),
    ];
    const { inline, collapsed } = splitMobileDisplayCells(cells);
    expect(inline.map((c) => c.id)).toEqual(['img']);
    expect(collapsed.map((c) => c.id)).toEqual(['vid']);
  });
});
