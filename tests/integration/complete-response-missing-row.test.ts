import { describe, expect, it, vi, beforeEach } from 'vitest';

// ========================
// 모듈 모킹
// ========================
// completeResponse 의 트랜잭션 내부 UPDATE ... returning() 이 빈 배열을 돌려줄 때
// (= responseId 행이 존재하지 않음: admin hardReset/동시 삭제 등) 의 동작을 검증한다.
//
// drizzle fluent chain 흉내 — response-progress.test.ts 의 패턴을 따른다.
// transaction(cb) 는 cb(tx) 를 호출하고 tx 는 동일 chainable 을 공유하므로
// tx.update(...).returning() 도 updateReturningMock 을 통해 [] 를 반환할 수 있다.

const { updateReturningMock, selectLimitMock } = vi.hoisted(() => ({
  updateReturningMock: vi.fn(),
  selectLimitMock: vi.fn(),
}));

vi.mock('@/db', () => {
  const chainable: Record<string, unknown> = {};
  chainable['update'] = vi.fn(() => chainable);
  chainable['set'] = vi.fn(() => chainable);
  chainable['where'] = vi.fn(() => chainable);
  chainable['returning'] = vi.fn(() => updateReturningMock());
  chainable['select'] = vi.fn(() => chainable);
  chainable['from'] = vi.fn(() => chainable);
  chainable['limit'] = vi.fn(() => selectLimitMock());
  chainable['transaction'] = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
    const tx = { ...chainable, delete: vi.fn(() => chainable), insert: vi.fn(() => chainable) };
    return cb(tx);
  });
  return { db: chainable };
});

vi.mock('@/features/survey-response/server/services/response-answers.service', () => ({
  replaceResponseAnswers: vi.fn(async () => undefined),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// ========================
// 테스트
// ========================

describe('completeResponse — 대상 행 없음 (빈 returning)', () => {
  beforeEach(() => {
    updateReturningMock.mockReset();
    selectLimitMock.mockReset();
  });

  it('UPDATE returning 이 빈 배열이면 명시적 에러로 throw 한다 (undefined 접근 크래시 아님)', async () => {
    // 트랜잭션 내부 UPDATE 가 0행 매칭 → returning() = []
    updateReturningMock.mockResolvedValue([]);

    const { completeResponse } = await import('@/features/survey-response/server/services/response.service');

    // data 없이 호출 → prefill SELECT 분기 skip, 곧장 트랜잭션 UPDATE 로 진입
    await expect(completeResponse({ responseId: 'does-not-exist' })).rejects.toThrow(
      /응답 행 없음/,
    );
  });

  it('정상 행이면 갱신된 행을 반환한다', async () => {
    updateReturningMock.mockResolvedValue([
      { id: 'r1', surveyId: 's1', contactTargetId: null, pageVisits: null },
    ]);

    const { completeResponse } = await import('@/features/survey-response/server/services/response.service');
    const result = await completeResponse({ responseId: 'r1' });

    expect(result).toMatchObject({ id: 'r1', surveyId: 's1' });
  });
});
