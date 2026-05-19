import { describe, it, expect } from 'vitest';

import { parseIdListInput } from '@/lib/operations/range-list';

describe('parseIdListInput', () => {
  it('parses a single integer', () => {
    expect(parseIdListInput('5')).toEqual([{ from: 5, to: 5 }]);
  });

  it('parses a simple range', () => {
    expect(parseIdListInput('1-30')).toEqual([{ from: 1, to: 30 }]);
  });

  it('parses mixed list of singles and ranges', () => {
    expect(parseIdListInput('1-30, 45')).toEqual([
      { from: 1, to: 30 },
      { from: 45, to: 45 },
    ]);
  });

  it('tolerates whitespace around separators', () => {
    expect(parseIdListInput('  1 - 30 ,  45  ')).toEqual([
      { from: 1, to: 30 },
      { from: 45, to: 45 },
    ]);
  });

  it('swaps reversed ranges', () => {
    expect(parseIdListInput('50-10')).toEqual([{ from: 10, to: 50 }]);
  });

  it('rejects empty input', () => {
    expect(parseIdListInput('')).toBeNull();
    expect(parseIdListInput('   ')).toBeNull();
  });

  it('rejects double commas', () => {
    expect(parseIdListInput('1,,2')).toBeNull();
    expect(parseIdListInput('1,')).toBeNull();
    expect(parseIdListInput(',1')).toBeNull();
  });

  it('rejects decimals', () => {
    expect(parseIdListInput('1.5')).toBeNull();
  });

  it('rejects values larger than int32 max', () => {
    expect(parseIdListInput('2147483648')).toBeNull();
  });

  it('rejects text', () => {
    expect(parseIdListInput('abc')).toBeNull();
    expect(parseIdListInput('1-abc')).toBeNull();
  });

  it('rejects zero (resid 는 1 부터 시작)', () => {
    expect(parseIdListInput('0')).toBeNull();
    expect(parseIdListInput('0-5')).toBeNull();
    expect(parseIdListInput('5-0')).toBeNull();
  });
});
