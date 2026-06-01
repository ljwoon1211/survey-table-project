import { describe, it, expect } from 'vitest';

import {
  parseProfilesCondition,
  PROFILES_EXTRA_CANDIDATES,
} from '@/lib/operations/profiles-filters.server';
import type { ColumnCandidate } from '@/lib/operations/progress-filters.server';

const candidates: ColumnCandidate[] = [
  ...PROFILES_EXTRA_CANDIDATES,
  { source: 'system.resid', label: '컨택번호' },
  { source: 'attrs.전시회명', label: '전시회명' },
  { source: 'pii.email', label: '이메일', piiType: 'email' },
];

describe('parseProfilesCondition', () => {
  it('col 없으면 null', () => {
    expect(parseProfilesCondition(null, '5', candidates)).toBeNull();
  });

  it('빈 q 면 null', () => {
    expect(parseProfilesCondition('browser', '', candidates)).toBeNull();
    expect(parseProfilesCondition('browser', '   ', candidates)).toBeNull();
  });

  it('idx range-list → idx ranges condition', () => {
    expect(parseProfilesCondition('idx', '1-20, 25', candidates)).toEqual({
      source: 'idx',
      mode: 'idx',
      ranges: [
        { from: 1, to: 20 },
        { from: 25, to: 25 },
      ],
    });
  });

  it('idx 단일 숫자 → 단일 idx range condition', () => {
    expect(parseProfilesCondition('idx', '5', candidates)).toEqual({
      source: 'idx',
      mode: 'idx',
      ranges: [{ from: 5, to: 5 }],
    });
  });

  it('idx 비숫자/빈 입력 → 빈 ranges (매칭 0건 보장)', () => {
    expect(parseProfilesCondition('idx', 'abc', candidates)).toEqual({
      source: 'idx',
      mode: 'idx',
      ranges: [],
    });
    expect(parseProfilesCondition('idx', '', candidates)).toEqual({
      source: 'idx',
      mode: 'idx',
      ranges: [],
    });
  });

  it('browser → text condition (trim)', () => {
    expect(parseProfilesCondition('browser', '  Chrome ', candidates)).toEqual({
      source: 'browser',
      mode: 'text',
      value: 'Chrome',
    });
  });

  it('attrs.* 는 진척률 파서로 위임', () => {
    expect(parseProfilesCondition('attrs.전시회명', '핵심', candidates)).toEqual({
      source: 'attrs.전시회명',
      mode: 'text',
      value: '핵심',
    });
  });

  it('system.resid idlist 위임', () => {
    expect(parseProfilesCondition('system.resid', '1-3, 9', candidates)).toEqual({
      source: 'system.resid',
      mode: 'idlist',
      ranges: [
        { from: 1, to: 3 },
        { from: 9, to: 9 },
      ],
    });
  });

  it('화이트리스트에 없는 col 은 null', () => {
    expect(parseProfilesCondition('attrs.unknown', 'x', candidates)).toBeNull();
  });

  it('PROFILES_EXTRA_CANDIDATES 는 idx·browser 2개', () => {
    expect(PROFILES_EXTRA_CANDIDATES.map((c) => c.source)).toEqual(['idx', 'browser']);
  });
});
