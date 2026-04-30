import { describe, expect, it } from 'vitest';

import {
  shapeDropFunnel,
  type DropFunnelInput,
  type FunnelQuestion,
} from '@/lib/operations/drop-funnel';

/** 테스트용 snapshot 헬퍼 — id `q1`..`qN` 형식, 라벨 `Q1`..`QN`. */
function makeQuestions(n: number): FunnelQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i + 1}`,
    position: i + 1,
    label: `Q${i + 1}`,
  }));
}

describe('shapeDropFunnel', () => {
  it('빈 drops 입력 → bars 배열이 비고 totalDrops=0', () => {
    const input: DropFunnelInput = {
      questions: makeQuestions(5),
      drops: [],
      reachedCounts: {},
      totalStarted: 0,
    };
    const result = shapeDropFunnel(input);
    expect(result.bars).toEqual([]);
    expect(result.totalDrops).toBe(0);
  });

  it('한 질문에 모든 drop 집중 → 단일 막대 + cumulativeProgressPct 정확', () => {
    const input: DropFunnelInput = {
      questions: makeQuestions(5),
      drops: [
        { responseId: 'r1', lastQuestionId: 'q3', exposedQuestionIds: null },
        { responseId: 'r2', lastQuestionId: 'q3', exposedQuestionIds: null },
        { responseId: 'r3', lastQuestionId: 'q3', exposedQuestionIds: null },
      ],
      reachedCounts: { q3: 80 },
      totalStarted: 100,
    };
    const result = shapeDropFunnel(input);

    expect(result.bars).toHaveLength(1);
    expect(result.bars[0]).toMatchObject({
      questionId: 'q3',
      label: 'Q3',
      position: 3,
      dropCount: 3,
      cumulativeProgressPct: 80, // 80/100 * 100
    });
    expect(result.totalDrops).toBe(3);
  });

  it('topN=3, 5개 질문에 drop 분포 → 상위 3 막대 + 기타 1 막대', () => {
    // dropCount: q1=10, q2=8, q3=5, q4=3, q5=1 (총 27)
    const drops: DropFunnelInput['drops'] = [];
    const counts: Record<string, number> = { q1: 10, q2: 8, q3: 5, q4: 3, q5: 1 };
    let rid = 0;
    for (const [qid, n] of Object.entries(counts)) {
      for (let i = 0; i < n; i++) {
        drops.push({ responseId: `r${rid++}`, lastQuestionId: qid, exposedQuestionIds: null });
      }
    }
    const input: DropFunnelInput = {
      questions: makeQuestions(5),
      drops,
      reachedCounts: { q1: 90, q2: 70, q3: 50, q4: 30, q5: 10 },
      totalStarted: 100,
      topN: 3,
    };
    const result = shapeDropFunnel(input);

    // [q1, q2, q3, 기타(q4+q5=4)]
    expect(result.bars).toHaveLength(4);
    expect(result.bars.slice(0, 3).map((b) => b.questionId)).toEqual(['q1', 'q2', 'q3']);
    expect(result.bars.slice(0, 3).map((b) => b.dropCount)).toEqual([10, 8, 5]);

    const others = result.bars[3];
    expect(others.questionId).toBe('others');
    expect(others.label).toBe('기타');
    expect(others.dropCount).toBe(4);
    expect(others.cumulativeProgressPct).toBeNull();
    expect(others.position).toBeNull();

    expect(result.totalDrops).toBe(27);
  });

  it('lastQuestionId가 snapshot에 없는 drop → legacy 버킷', () => {
    const input: DropFunnelInput = {
      questions: makeQuestions(3),
      drops: [
        { responseId: 'r1', lastQuestionId: 'q1', exposedQuestionIds: null },
        { responseId: 'r2', lastQuestionId: 'q-deleted', exposedQuestionIds: null },
        { responseId: 'r3', lastQuestionId: 'q-other-version', exposedQuestionIds: null },
      ],
      reachedCounts: { q1: 50 },
      totalStarted: 100,
    };
    const result = shapeDropFunnel(input);

    // [q1, legacy]
    expect(result.bars).toHaveLength(2);
    expect(result.bars[0].questionId).toBe('q1');
    expect(result.bars[0].dropCount).toBe(1);

    const legacy = result.bars[1];
    expect(legacy.questionId).toBe('legacy');
    expect(legacy.label).toBe('(legacy)');
    expect(legacy.dropCount).toBe(2);
    expect(legacy.cumulativeProgressPct).toBeNull();
    expect(legacy.position).toBeNull();

    expect(result.totalDrops).toBe(3);
  });

  it('lastQuestionId가 null인 drop (답변 0건) → legacy 버킷', () => {
    const input: DropFunnelInput = {
      questions: makeQuestions(3),
      drops: [
        { responseId: 'r1', lastQuestionId: null, exposedQuestionIds: null },
        { responseId: 'r2', lastQuestionId: null, exposedQuestionIds: null },
      ],
      reachedCounts: {},
      totalStarted: 5,
    };
    const result = shapeDropFunnel(input);

    expect(result.bars).toHaveLength(1);
    expect(result.bars[0].questionId).toBe('legacy');
    expect(result.bars[0].dropCount).toBe(2);
    expect(result.totalDrops).toBe(2);
  });

  it('exposedQuestionIds 정의되어 있고 lastQuestionId 미포함 → drop 완전 제외 (어떤 버킷에도 없음)', () => {
    const input: DropFunnelInput = {
      questions: makeQuestions(5),
      drops: [
        // 정상: q3가 노출 목록에 포함.
        { responseId: 'r1', lastQuestionId: 'q3', exposedQuestionIds: ['q1', 'q2', 'q3'] },
        // 제외: q3가 노출 목록에 없음 (분기 버그).
        { responseId: 'r2', lastQuestionId: 'q3', exposedQuestionIds: ['q1', 'q2'] },
        // 제외: q5가 노출 목록에 없음.
        { responseId: 'r3', lastQuestionId: 'q5', exposedQuestionIds: ['q1', 'q4'] },
      ],
      reachedCounts: { q3: 80 },
      totalStarted: 100,
    };
    const result = shapeDropFunnel(input);

    // 정상 1건만 반영. 제외된 2건은 어떤 버킷에도 들어가지 않음.
    expect(result.bars).toHaveLength(1);
    expect(result.bars[0].questionId).toBe('q3');
    expect(result.bars[0].dropCount).toBe(1);
    expect(result.totalDrops).toBe(1);
  });

  it('exposedQuestionIds 정의되어 있고 lastQuestionId 포함 → 정상 귀속', () => {
    const input: DropFunnelInput = {
      questions: makeQuestions(3),
      drops: [
        { responseId: 'r1', lastQuestionId: 'q1', exposedQuestionIds: ['q1', 'q2'] },
        { responseId: 'r2', lastQuestionId: 'q2', exposedQuestionIds: ['q1', 'q2', 'q3'] },
      ],
      reachedCounts: { q1: 10, q2: 5 },
      totalStarted: 20,
    };
    const result = shapeDropFunnel(input);

    expect(result.bars).toHaveLength(2);
    // q1 dropCount=1, q2 dropCount=1, 동률이지만 둘 다 포함.
    expect(result.bars.map((b) => b.questionId).sort()).toEqual(['q1', 'q2']);
    expect(result.totalDrops).toBe(2);
  });

  it('exposedQuestionIds=null → 노출 정보 미상으로 간주, 정상 귀속', () => {
    const input: DropFunnelInput = {
      questions: makeQuestions(3),
      drops: [
        { responseId: 'r1', lastQuestionId: 'q2', exposedQuestionIds: null },
        { responseId: 'r2', lastQuestionId: 'q2', exposedQuestionIds: null },
      ],
      reachedCounts: { q2: 30 },
      totalStarted: 50,
    };
    const result = shapeDropFunnel(input);

    expect(result.bars).toHaveLength(1);
    expect(result.bars[0].questionId).toBe('q2');
    expect(result.bars[0].dropCount).toBe(2);
    expect(result.totalDrops).toBe(2);
  });

  it('막대 정렬 — dropCount 내림차순', () => {
    const drops: DropFunnelInput['drops'] = [];
    // q5에 5건, q1에 3건, q3에 7건 — 정렬 후 q3, q5, q1 순서.
    const counts: Record<string, number> = { q5: 5, q1: 3, q3: 7 };
    let rid = 0;
    for (const [qid, n] of Object.entries(counts)) {
      for (let i = 0; i < n; i++) {
        drops.push({ responseId: `r${rid++}`, lastQuestionId: qid, exposedQuestionIds: null });
      }
    }
    const input: DropFunnelInput = {
      questions: makeQuestions(5),
      drops,
      reachedCounts: { q1: 50, q3: 30, q5: 10 },
      totalStarted: 100,
    };
    const result = shapeDropFunnel(input);

    expect(result.bars.map((b) => b.questionId)).toEqual(['q3', 'q5', 'q1']);
    expect(result.bars.map((b) => b.dropCount)).toEqual([7, 5, 3]);
  });

  it('totalStarted=0 → 모든 cumulativeProgressPct가 null', () => {
    const input: DropFunnelInput = {
      questions: makeQuestions(3),
      drops: [
        { responseId: 'r1', lastQuestionId: 'q2', exposedQuestionIds: null },
      ],
      reachedCounts: {},
      totalStarted: 0,
    };
    const result = shapeDropFunnel(input);

    expect(result.bars).toHaveLength(1);
    expect(result.bars[0].cumulativeProgressPct).toBeNull();
  });

  it('cumulativeProgressPct 정확 계산 — reached=80, total=100 → 80%', () => {
    const input: DropFunnelInput = {
      questions: makeQuestions(3),
      drops: [
        { responseId: 'r1', lastQuestionId: 'q3', exposedQuestionIds: null },
      ],
      reachedCounts: { q3: 80 },
      totalStarted: 100,
    };
    const result = shapeDropFunnel(input);
    expect(result.bars[0].cumulativeProgressPct).toBe(80);
  });

  it('topN 기본값 10 — 12개 위치에 drop 분산 시 10막대 + 기타 1막대', () => {
    const drops: DropFunnelInput['drops'] = [];
    // 12개 질문에 dropCount 12, 11, 10, ..., 1 할당.
    let rid = 0;
    for (let i = 1; i <= 12; i++) {
      const n = 13 - i; // q1=12, q2=11, ..., q12=1
      for (let k = 0; k < n; k++) {
        drops.push({ responseId: `r${rid++}`, lastQuestionId: `q${i}`, exposedQuestionIds: null });
      }
    }
    const input: DropFunnelInput = {
      questions: makeQuestions(12),
      drops,
      reachedCounts: {},
      totalStarted: 100,
    };
    const result = shapeDropFunnel(input);

    // 상위 10개 + 기타 1개 = 11막대
    expect(result.bars).toHaveLength(11);
    // 상위 10개는 q1..q10 (가장 많은 drop).
    expect(result.bars.slice(0, 10).map((b) => b.questionId)).toEqual([
      'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10',
    ]);
    // 기타 = q11(2) + q12(1) = 3
    const others = result.bars[10];
    expect(others.questionId).toBe('others');
    expect(others.dropCount).toBe(3);
  });

  it('legacy + others 모두 존재 → [정상...상위N, others, legacy] 순서', () => {
    const drops: DropFunnelInput['drops'] = [
      // 정상: q1×3, q2×2, q3×1 (topN=2 → q1, q2 살리고 q3는 기타로)
      { responseId: 'r1', lastQuestionId: 'q1', exposedQuestionIds: null },
      { responseId: 'r2', lastQuestionId: 'q1', exposedQuestionIds: null },
      { responseId: 'r3', lastQuestionId: 'q1', exposedQuestionIds: null },
      { responseId: 'r4', lastQuestionId: 'q2', exposedQuestionIds: null },
      { responseId: 'r5', lastQuestionId: 'q2', exposedQuestionIds: null },
      { responseId: 'r6', lastQuestionId: 'q3', exposedQuestionIds: null },
      // legacy
      { responseId: 'r7', lastQuestionId: 'q-deleted', exposedQuestionIds: null },
      { responseId: 'r8', lastQuestionId: null, exposedQuestionIds: null },
    ];
    const input: DropFunnelInput = {
      questions: makeQuestions(3),
      drops,
      reachedCounts: { q1: 50, q2: 30, q3: 10 },
      totalStarted: 80,
      topN: 2,
    };
    const result = shapeDropFunnel(input);

    // [q1, q2, others(q3=1), legacy(2)]
    expect(result.bars).toHaveLength(4);
    expect(result.bars.map((b) => b.questionId)).toEqual(['q1', 'q2', 'others', 'legacy']);
    expect(result.bars.map((b) => b.dropCount)).toEqual([3, 2, 1, 2]);
    expect(result.bars[2].cumulativeProgressPct).toBeNull();
    expect(result.bars[3].cumulativeProgressPct).toBeNull();
    expect(result.totalDrops).toBe(8);
  });
});
