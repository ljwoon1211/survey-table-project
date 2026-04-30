import { describe, expect, it } from 'vitest';

import {
  shapePageDwell,
  trimmedStats,
  type DwellInput,
} from '@/lib/operations/page-dwell';
import type {
  PageVisit,
  QuestionData,
  QuestionGroupData,
  SurveyVersionSnapshot,
} from '@/db/schema/schema-types';

// ── 헬퍼 ────────────────────────────────────────────────────────────────

/**
 * 최소한의 snapshot 빌더 — 필수 필드만 채운다 (settings 등은 캐스팅으로 회피하지 않고 더미 채움).
 */
function makeSnapshot(
  groups: QuestionGroupData[],
  questions: QuestionData[],
): SurveyVersionSnapshot {
  return {
    title: 'test',
    questions,
    groups,
    settings: {
      isPublic: true,
      allowMultipleResponses: false,
      showProgressBar: true,
      shuffleQuestions: false,
      requireLogin: false,
      thankYouMessage: '',
    },
  };
}

function makeGroup(
  id: string,
  name: string,
  order: number,
  parentGroupId?: string,
): QuestionGroupData {
  return { id, surveyId: 'survey-1', name, order, parentGroupId };
}

function makeQuestion(
  id: string,
  type: string,
  order: number,
  groupId?: string,
  extras: Partial<QuestionData> = {},
): QuestionData {
  return {
    id,
    type,
    title: id.toUpperCase(),
    required: false,
    order,
    groupId,
    ...extras,
  };
}

/** PageVisit 생성: 시작 후 dwellSeconds초 머물렀다고 가정. */
function visit(stepId: string, dwellSeconds: number): PageVisit {
  const start = new Date('2026-01-01T00:00:00.000Z').getTime();
  return {
    stepId,
    enteredAt: new Date(start).toISOString(),
    leftAt: new Date(start + dwellSeconds * 1000).toISOString(),
  };
}

// ── trimmedStats ────────────────────────────────────────────────────────

describe('trimmedStats', () => {
  it('빈 배열 → n=0, mean=null, sd=null', () => {
    expect(trimmedStats([], 0.025)).toEqual({ n: 0, mean: null, sd: null });
  });

  it('단일 값 → n=1, mean=값, sd=null (n-1=0)', () => {
    expect(trimmedStats([42], 0.025)).toEqual({ n: 1, mean: 42, sd: null });
  });

  it('두 값 → 표본 SD 계산 (n-1 분모)', () => {
    // values [10, 20], mean=15, var=(25+25)/1=50, sd=sqrt(50)
    const r = trimmedStats([10, 20], 0.025);
    expect(r.n).toBe(2);
    expect(r.mean).toBe(15);
    expect(r.sd).not.toBeNull();
    expect(r.sd!).toBeCloseTo(Math.sqrt(50), 10);
  });

  it('NaN/Infinity 사전 필터', () => {
    const r = trimmedStats([1, 2, NaN, Infinity, -Infinity, 3], 0.025);
    // 유효값 [1,2,3] 만 → mean=2, var=((1)^2+0+(1)^2)/2=1, sd=1
    expect(r.n).toBe(3);
    expect(r.mean).toBe(2);
    expect(r.sd).toBeCloseTo(1, 10);
  });

  it('n=100, 양쪽 outlier 제거 효과', () => {
    const base: number[] = [];
    for (let i = 1; i <= 96; i++) base.push(i + 100); // 101..196
    const values = [1, 2, ...base, 9000, 10000];
    const trimmed = trimmedStats(values, 0.025);
    // 양쪽 floor(100*0.025)=2개씩 제거 → base만 남음.
    const expected = base.reduce((s, v) => s + v, 0) / base.length;
    expect(trimmed.n).toBe(96);
    expect(trimmed.mean).toBeCloseTo(expected, 10);
    expect(trimmed.sd).not.toBeNull();
  });
});

// ── shapePageDwell ──────────────────────────────────────────────────────

describe('shapePageDwell', () => {
  /**
   * 표준 snapshot — 그룹 G1(인적사항) 안에 q1(text)+q2(table), 그리고 ungrouped q3(text).
   * 캐노니컬 step 순서:
   *   1. group:G1 (q1)        '페이지 1: 인적사항'
   *   2. table:q2             'Q2 (table)'
   *   3. group:root (q3)      '페이지 3'  (ungrouped, name 없음)
   */
  const baseGroups: QuestionGroupData[] = [makeGroup('G1', '인적사항', 0)];
  const baseQuestions: QuestionData[] = [
    makeQuestion('q1', 'text', 0, 'G1'),
    makeQuestion('q2', 'table', 1, 'G1'),
    makeQuestion('q3', 'text', 0),
  ];
  const baseSnapshot = makeSnapshot(baseGroups, baseQuestions);

  it('빈 응답 → 모든 step이 n=0', () => {
    const out = shapePageDwell({ responses: [], snapshot: baseSnapshot });
    expect(out.pages).toHaveLength(3);
    expect(out.pages.map((p) => p.stepId)).toEqual([
      'group:G1',
      'table:q2',
      'group:root',
    ]);
    expect(out.pages.map((p) => p.label)).toEqual([
      '페이지 1: 인적사항',
      'Q2 (table)',
      '페이지 3',
    ]);
    for (const p of out.pages) {
      expect(p.n).toBe(0);
      expect(p.meanSeconds).toBeNull();
      expect(p.sdSeconds).toBeNull();
    }
  });

  it('단일 응답 2 visits → 각 step에 n=1, sd=null', () => {
    const input: DwellInput = {
      responses: [
        {
          pageVisits: [visit('group:G1', 30), visit('table:q2', 60)],
        },
      ],
      snapshot: baseSnapshot,
    };
    const out = shapePageDwell(input);
    const g1 = out.pages.find((p) => p.stepId === 'group:G1')!;
    const tq2 = out.pages.find((p) => p.stepId === 'table:q2')!;
    expect(g1.n).toBe(1);
    expect(g1.meanSeconds).toBe(30);
    expect(g1.sdSeconds).toBeNull();
    expect(tq2.n).toBe(1);
    expect(tq2.meanSeconds).toBe(60);
    expect(tq2.sdSeconds).toBeNull();
    // q3는 방문 안 함 → n=0
    expect(out.pages.find((p) => p.stepId === 'group:root')!.n).toBe(0);
  });

  it('leftAt 누락된 visit는 skip', () => {
    const input: DwellInput = {
      responses: [
        {
          pageVisits: [
            // 정상
            visit('group:G1', 30),
            // leftAt 없음 → skip
            {
              stepId: 'group:G1',
              enteredAt: new Date('2026-01-01T01:00:00.000Z').toISOString(),
            } as PageVisit,
          ],
        },
      ],
      snapshot: baseSnapshot,
    };
    const out = shapePageDwell(input);
    expect(out.pages.find((p) => p.stepId === 'group:G1')!.n).toBe(1);
  });

  it('leftAt ≤ enteredAt 인 visit는 skip', () => {
    const sameMoment = new Date('2026-01-01T00:00:00.000Z').toISOString();
    const earlier = new Date('2025-12-31T23:00:00.000Z').toISOString();
    const input: DwellInput = {
      responses: [
        {
          pageVisits: [
            // 같은 시각 → skip
            { stepId: 'group:G1', enteredAt: sameMoment, leftAt: sameMoment },
            // 더 이른 leftAt → skip
            { stepId: 'group:G1', enteredAt: sameMoment, leftAt: earlier },
            // 정상
            visit('group:G1', 10),
          ],
        },
      ],
      snapshot: baseSnapshot,
    };
    const out = shapePageDwell(input);
    expect(out.pages.find((p) => p.stepId === 'group:G1')!.n).toBe(1);
  });

  it('pageVisits=null 또는 [] → 응답 자체 skip', () => {
    const input: DwellInput = {
      responses: [{ pageVisits: null }, { pageVisits: [] }],
      snapshot: baseSnapshot,
    };
    const out = shapePageDwell(input);
    for (const p of out.pages) expect(p.n).toBe(0);
  });

  it('동일 step 여러 응답 → 평균/SD 집계', () => {
    const input: DwellInput = {
      responses: [
        { pageVisits: [visit('group:G1', 10)] },
        { pageVisits: [visit('group:G1', 20)] },
        { pageVisits: [visit('group:G1', 30)] },
      ],
      snapshot: baseSnapshot,
    };
    const out = shapePageDwell(input);
    const g1 = out.pages.find((p) => p.stepId === 'group:G1')!;
    expect(g1.n).toBe(3);
    expect(g1.meanSeconds).toBe(20);
    // var = ((10-20)^2+(20-20)^2+(30-20)^2)/(3-1) = 200/2 = 100, sd = 10
    expect(g1.sdSeconds!).toBeCloseTo(10, 10);
  });

  it('테이블 step의 라벨은 questionCode → fallback', () => {
    // questionCode 있는 q2 vs 없는 q4 두 케이스.
    // questionCode는 schema-types에 명시되지 않은 필드 — 런타임에는 들어있다 (drop-funnel 동일 패턴).
    const groups = [makeGroup('G1', 'A', 0)];
    const questions: QuestionData[] = [
      // questionCode 'Q3'를 안전하게 추가.
      { ...makeQuestion('q2', 'table', 0, 'G1'), questionCode: 'Q3' } as QuestionData & {
        questionCode: string;
      },
      makeQuestion('q4', 'table', 1, 'G1'),
    ];
    const snap = makeSnapshot(groups, questions);
    const out = shapePageDwell({ responses: [], snapshot: snap });
    const t1 = out.pages.find((p) => p.stepId === 'table:q2')!;
    const t2 = out.pages.find((p) => p.stepId === 'table:q4')!;
    expect(t1.label).toBe('Q3 (table)');
    // q4는 snapshot 인덱스 2번째 → 'Q2'
    expect(t2.label).toBe('Q2 (table)');
  });

  it('빈 snapshot (그룹 + 질문 0건) → pages=[]', () => {
    const empty = makeSnapshot([], []);
    const out = shapePageDwell({ responses: [], snapshot: empty });
    expect(out.pages).toEqual([]);
  });

  it('snapshot에 없는 stepId의 visit는 무시 (legacy)', () => {
    const input: DwellInput = {
      responses: [
        {
          pageVisits: [
            visit('group:UNKNOWN', 99),
            visit('group:G1', 12),
          ],
        },
      ],
      snapshot: baseSnapshot,
    };
    const out = shapePageDwell(input);
    const g1 = out.pages.find((p) => p.stepId === 'group:G1')!;
    expect(g1.n).toBe(1);
    expect(g1.meanSeconds).toBe(12);
    // 출력에는 알 수 없는 step은 등장하지 않는다.
    expect(out.pages.map((p) => p.stepId)).not.toContain('group:UNKNOWN');
  });

  it('트리밍: 100개 visit + 양쪽 2개 outlier → 트림된 평균이 원본보다 영향 적음', () => {
    const visits: PageVisit[] = [];
    // 1, 2 (하단 outlier), 101..196 (96개), 9000, 10000 (상단 outlier) = 100개.
    visits.push(visit('group:G1', 1));
    visits.push(visit('group:G1', 2));
    for (let i = 1; i <= 96; i++) visits.push(visit('group:G1', i + 100));
    visits.push(visit('group:G1', 9000));
    visits.push(visit('group:G1', 10000));
    expect(visits).toHaveLength(100);

    const input: DwellInput = {
      responses: [{ pageVisits: visits }],
      snapshot: baseSnapshot,
    };
    const out = shapePageDwell(input);
    const g1 = out.pages.find((p) => p.stepId === 'group:G1')!;
    // floor(100*0.025)=2 → 양쪽 2개씩 제거 → 정확히 base만 남음.
    expect(g1.n).toBe(96);
    const expected = (101 + 196) / 2; // 등차수열 평균
    expect(g1.meanSeconds!).toBeCloseTo(expected, 5);
  });

  it('테이블이 그룹 사이를 split 한다 — 페이지 카운터가 캐노니컬 순서대로 증가', () => {
    // 한 그룹 안에 [text, table, text] → group:G1(text) → table:t → group:G1(text)
    // 같은 stepId='group:G1'이 두 번 push 된다 (실제 buildRenderSteps 거동과 일치).
    const groups = [makeGroup('G1', '메인', 0)];
    const questions: QuestionData[] = [
      makeQuestion('q1', 'text', 0, 'G1'),
      makeQuestion('q2', 'table', 1, 'G1'),
      makeQuestion('q3', 'text', 2, 'G1'),
    ];
    const snap = makeSnapshot(groups, questions);
    const out = shapePageDwell({ responses: [], snapshot: snap });
    expect(out.pages).toHaveLength(3);
    expect(out.pages.map((p) => p.stepId)).toEqual([
      'group:G1',
      'table:q2',
      'group:G1',
    ]);
    expect(out.pages.map((p) => p.position)).toEqual([1, 2, 3]);
    expect(out.pages[0].label).toBe('페이지 1: 메인');
    expect(out.pages[2].label).toBe('페이지 3: 메인');
  });
});
