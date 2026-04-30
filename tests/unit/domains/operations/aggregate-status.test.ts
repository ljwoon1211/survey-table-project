import { describe, expect, it } from 'vitest';

import { mapRowsToCounts } from '@/lib/operations/aggregate-status';

describe('mapRowsToCounts', () => {
  it('mixed statuses: completed/in_progress/drop → 각 버킷에 합산되고 total은 in_progress 제외 합', () => {
    const rows = [
      { status: 'completed', count: 30 },
      { status: 'in_progress', count: 10 },
      { status: 'drop', count: 5 },
    ];
    expect(mapRowsToCounts(rows)).toEqual({
      total: 35,           // ← in_progress 제외 (completed 30 + drop 5)
      completed: 30,
      inProgress: 10,
      drop: 5,
      screenedOut: 0,
      quotafulOut: 0,
      bad: 0,
    });
  });

  it('빈 입력 → 모든 필드가 0', () => {
    expect(mapRowsToCounts([])).toEqual({
      total: 0,
      completed: 0,
      screenedOut: 0,
      quotafulOut: 0,
      bad: 0,
      drop: 0,
      inProgress: 0,
    });
  });

  it('알려지지 않은 status는 throw 하지 않고 어떤 버킷에도 합산되지 않음', () => {
    const rows = [{ status: 'unknown_value', count: 3 }];
    const result = mapRowsToCounts(rows);
    expect(result.total).toBe(0);  // 종결 버킷에 속하지 않으므로 total=0
    expect(result.completed).toBe(0);
    expect(result.screenedOut).toBe(0);
    expect(result.quotafulOut).toBe(0);
    expect(result.bad).toBe(0);
    expect(result.drop).toBe(0);
    expect(result.inProgress).toBe(0);
  });

  it('snake_case status를 camelCase 필드로 매핑한다', () => {
    const rows = [
      { status: 'screened_out', count: 7 },
      { status: 'quotaful_out', count: 4 },
      { status: 'bad', count: 2 },
    ];
    expect(mapRowsToCounts(rows)).toEqual({
      total: 13,
      completed: 0,
      screenedOut: 7,
      quotafulOut: 4,
      bad: 2,
      drop: 0,
      inProgress: 0,
    });
  });

  it('total === 종결 카테고리 카운트의 합 (in_progress 제외)', () => {
    const rows = [
      { status: 'completed', count: 100 },
      { status: 'in_progress', count: 50 },
      { status: 'screened_out', count: 20 },
      { status: 'quotaful_out', count: 10 },
      { status: 'bad', count: 5 },
      { status: 'drop', count: 15 },
    ];
    const result = mapRowsToCounts(rows);
    const sumOfConcluded =
      result.completed +
      result.screenedOut +
      result.quotafulOut +
      result.bad +
      result.drop;
    expect(result.total).toBe(150);  // in_progress(50) 제외
    expect(result.total).toBe(sumOfConcluded);
    expect(result.inProgress).toBe(50);  // inProgress 필드는 보존됨
  });
});
