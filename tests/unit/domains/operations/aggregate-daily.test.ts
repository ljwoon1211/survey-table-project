import { describe, expect, it } from 'vitest';

import { shapeDailyBuckets } from '@/lib/operations/aggregate-daily';

describe('shapeDailyBuckets — day 모드', () => {
  it('빈 입력 → 빈 배열', () => {
    expect(shapeDailyBuckets([], 'day')).toEqual([]);
  });

  it('단일 일자 → 길이 1 배열, MM-DD (요일) 라벨', () => {
    // 2026-04-22 = 수요일
    const result = shapeDailyBuckets([{ bucket: '2026-04-22', count: 7 }], 'day');
    expect(result).toEqual([
      { bucket: '2026-04-22', label: '04-22 (수)', count: 7 },
    ]);
  });

  it('희소 일자 → min~max 사이를 모두 채워 연속 x축 (gap = 0)', () => {
    // 2026-04-22(수), 23(목), 24(금), 25(토)
    const rows = [
      { bucket: '2026-04-22', count: 5 },
      { bucket: '2026-04-25', count: 3 },
    ];
    expect(shapeDailyBuckets(rows, 'day')).toEqual([
      { bucket: '2026-04-22', label: '04-22 (수)', count: 5 },
      { bucket: '2026-04-23', label: '04-23 (목)', count: 0 },
      { bucket: '2026-04-24', label: '04-24 (금)', count: 0 },
      { bucket: '2026-04-25', label: '04-25 (토)', count: 3 },
    ]);
  });

  it('월/년 경계를 가로지르는 범위에서도 정확히 채운다', () => {
    // 2025-12-31(수) → 2026-01-02(금): 1월 1일(목) 포함 3일
    const rows = [
      { bucket: '2025-12-31', count: 1 },
      { bucket: '2026-01-02', count: 2 },
    ];
    expect(shapeDailyBuckets(rows, 'day')).toEqual([
      { bucket: '2025-12-31', label: '12-31 (수)', count: 1 },
      { bucket: '2026-01-01', label: '01-01 (목)', count: 0 },
      { bucket: '2026-01-02', label: '01-02 (금)', count: 2 },
    ]);
  });

  it('역순으로 들어와도 chronological 정렬', () => {
    const rows = [
      { bucket: '2026-04-25', count: 3 },
      { bucket: '2026-04-22', count: 5 },
    ];
    const result = shapeDailyBuckets(rows, 'day');
    expect(result.map((b) => b.bucket)).toEqual([
      '2026-04-22',
      '2026-04-23',
      '2026-04-24',
      '2026-04-25',
    ]);
  });
});

describe('shapeDailyBuckets — hour 모드', () => {
  it('빈 입력 + hourModeDate → 24개 버킷, 모두 count=0, 00시~23시 라벨', () => {
    const result = shapeDailyBuckets([], 'hour', '2026-04-27');
    expect(result).toHaveLength(24);
    expect(result[0]).toEqual({ bucket: '2026-04-27 00:00', label: '00시', count: 0 });
    expect(result[9]).toEqual({ bucket: '2026-04-27 09:00', label: '09시', count: 0 });
    expect(result[23]).toEqual({ bucket: '2026-04-27 23:00', label: '23시', count: 0 });
    expect(result.every((b) => b.count === 0)).toBe(true);
  });

  it('희소 시간대 → 24개 버킷, 매칭되는 시간만 채워지고 나머지는 0', () => {
    const rows = [
      { bucket: '2026-04-27 09:00', count: 12 },
      { bucket: '2026-04-27 14:00', count: 5 },
    ];
    const result = shapeDailyBuckets(rows, 'hour', '2026-04-27');
    expect(result).toHaveLength(24);
    expect(result[9]).toEqual({ bucket: '2026-04-27 09:00', label: '09시', count: 12 });
    expect(result[14]).toEqual({ bucket: '2026-04-27 14:00', label: '14시', count: 5 });
    // 인접한 시간들은 0
    expect(result[8].count).toBe(0);
    expect(result[10].count).toBe(0);
    expect(result[13].count).toBe(0);
    expect(result[15].count).toBe(0);
    // 합계는 12+5
    expect(result.reduce((acc, b) => acc + b.count, 0)).toBe(17);
  });

  it('chronological 정렬 — bucket 시간순 (00 → 23)', () => {
    const rows = [
      { bucket: '2026-04-27 23:00', count: 1 },
      { bucket: '2026-04-27 00:00', count: 2 },
      { bucket: '2026-04-27 12:00', count: 3 },
    ];
    const result = shapeDailyBuckets(rows, 'hour', '2026-04-27');
    expect(result.map((b) => b.bucket.slice(11))).toEqual(
      Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`),
    );
    expect(result[0].count).toBe(2);
    expect(result[12].count).toBe(3);
    expect(result[23].count).toBe(1);
  });

  it('hourModeDate 누락 시 throw', () => {
    expect(() => shapeDailyBuckets([], 'hour')).toThrow();
  });
});
