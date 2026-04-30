import { describe, expect, it } from 'vitest';

import { mapRowsToCounts } from '@/lib/operations/aggregate-status';

describe('mapRowsToCounts', () => {
  it('mixed statuses: completed/in_progress/drop → 각 버킷에 합산되고 total은 합', () => {
    const rows = [
      { status: 'completed', count: 30 },
      { status: 'in_progress', count: 10 },
      { status: 'drop', count: 5 },
    ];
    expect(mapRowsToCounts(rows)).toEqual({
      total: 45,
      completed: 30,
      screenedOut: 0,
      quotafulOut: 0,
      bad: 0,
      drop: 5,
      inProgress: 10,
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

  it('알려지지 않은 status는 throw 하지 않고 total에만 합산', () => {
    const rows = [{ status: 'unknown_value', count: 3 }];
    const result = mapRowsToCounts(rows);
    expect(result.total).toBe(3);
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

  it('total === 모든 카테고리 카운트의 합', () => {
    const rows = [
      { status: 'completed', count: 100 },
      { status: 'in_progress', count: 50 },
      { status: 'screened_out', count: 20 },
      { status: 'quotaful_out', count: 10 },
      { status: 'bad', count: 5 },
      { status: 'drop', count: 15 },
    ];
    const result = mapRowsToCounts(rows);
    const sumOfCategories =
      result.completed +
      result.inProgress +
      result.screenedOut +
      result.quotafulOut +
      result.bad +
      result.drop;
    expect(result.total).toBe(200);
    expect(result.total).toBe(sumOfCategories);
  });
});
