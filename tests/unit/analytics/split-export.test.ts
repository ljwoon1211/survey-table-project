import { describe, it, expect } from 'vitest';

import { valueMatchSet, bucketQuestions, optionTokensForBasis, planSplit, detectSplitCandidates } from '@/lib/analytics/split-export';
import { buildSplitWorkbook } from '@/lib/excel-transformer';
import type { RawExportResponseRow } from '@/lib/excel-transformer';
import type { Question, QuestionConditionGroup } from '@/types/survey';

const vm = (sourceQuestionId: string, requiredValues: string[]): QuestionConditionGroup => ({
  logicType: 'AND',
  conditions: [
    { id: 'c1', sourceQuestionId, conditionType: 'value-match', requiredValues, logicType: 'AND' },
  ],
});

describe('valueMatchSet', () => {
  it('value-match 조건의 requiredValues를 Set으로 모은다', () => {
    const set = valueMatchSet(vm('Q2', ['opt1', 'opt3']), 'Q2');
    expect(set).not.toBeNull();
    expect([...set!].sort()).toEqual(['opt1', 'opt3']);
  });

  it('다른 sourceQuestionId는 무시한다', () => {
    expect(valueMatchSet(vm('Q9', ['opt1']), 'Q2')).toBeNull();
  });

  it('value-match가 아닌 conditionType은 무시한다', () => {
    const dc: QuestionConditionGroup = {
      logicType: 'AND',
      conditions: [
        { id: 'c1', sourceQuestionId: 'Q2', conditionType: 'table-cell-check', logicType: 'AND' },
      ],
    };
    expect(valueMatchSet(dc, 'Q2')).toBeNull();
  });

  it('조건이 없으면 null', () => {
    expect(valueMatchSet(undefined, 'Q2')).toBeNull();
  });
});

const q = (over: Partial<Question>): Question => ({
  id: 'x', surveyId: 's', type: 'text', title: 't', required: false, order: 0,
  questionCode: over.id ?? 'x',
  ...over,
} as unknown as Question);

describe('bucketQuestions', () => {
  // basis Q2 + 공통질문 A + opt1전용 B + 테이블 T(공통행 r0 / opt1행 r1 / opt2행 r2)
  const basis = q({ id: 'Q2', type: 'checkbox', questionCode: 'Q2' });
  const A = q({ id: 'A', type: 'text' });
  const B = q({ id: 'B', type: 'radio', displayCondition: vm('Q2', ['opt1']) });
  const T = q({
    id: 'T', type: 'table',
    tableRowsData: [
      { id: 'r0', label: '', cells: [] },
      { id: 'r1', label: '', cells: [], displayCondition: vm('Q2', ['opt1']) },
      { id: 'r2', label: '', cells: [], displayCondition: vm('Q2', ['opt2']) },
    ],
  } as Partial<Question>);
  const all = [basis, A, B, T];

  it('common: 조건 없는 질문 + basis 조건 없는 테이블 행만', () => {
    const out = bucketQuestions(all, 'Q2', 'common');
    expect(out.map((x) => x.id).sort()).toEqual(['A', 'Q2', 'T']);
    const t = out.find((x) => x.id === 'T')!;
    expect(t.tableRowsData!.map((r) => r.id)).toEqual(['r0']);
  });

  it('opt1: opt1 전용 질문 + opt1 행만', () => {
    const out = bucketQuestions(all, 'Q2', 'opt1');
    expect(out.map((x) => x.id).sort()).toEqual(['B', 'T']);
    const t = out.find((x) => x.id === 'T')!;
    expect(t.tableRowsData!.map((r) => r.id)).toEqual(['r1']);
  });

  it('opt2: 전용 질문 없고 opt2 행만', () => {
    const out = bucketQuestions(all, 'Q2', 'opt2');
    expect(out.map((x) => x.id)).toEqual(['T']);
    expect(out[0].tableRowsData!.map((r) => r.id)).toEqual(['r2']);
  });

  it('멀티토큰 비테이블 질문은 각 버킷에 모두 복사된다', () => {
    // M의 displayCondition이 opt1·opt2 두 값을 모두 requiredValues로 가짐
    const M = q({ id: 'M', type: 'text', displayCondition: vm('Q2', ['opt1', 'opt2']) });
    const questions = [basis, A, M];
    const inOpt1 = bucketQuestions(questions, 'Q2', 'opt1');
    const inOpt2 = bucketQuestions(questions, 'Q2', 'opt2');
    expect(inOpt1.map((x) => x.id)).toContain('M');
    expect(inOpt2.map((x) => x.id)).toContain('M');
  });
});

describe('optionTokensForBasis', () => {
  it('basis.options 순서로 정렬하고, 옵션에 없는 토큰(other)은 뒤에 붙인다', () => {
    const basis = q({
      id: 'Q2', type: 'checkbox', questionCode: 'Q2',
      options: [
        { id: 'o1', value: 'opt1', label: '제재목' },
        { id: 'o2', value: 'opt2', label: '합판' },
      ],
    } as Partial<Question>);
    const B = q({ id: 'B', displayCondition: vm('Q2', ['opt2']) });
    const C = q({ id: 'C', displayCondition: vm('Q2', ['opt1', 'other']) });
    const tokens = optionTokensForBasis([basis, B, C], basis);
    expect(tokens).toEqual(['opt1', 'opt2', 'other']);
  });
});

describe('planSplit', () => {
  const basis = q({
    id: 'Q2', type: 'radio', questionCode: 'Q2', title: '품목',
    options: [
      { id: 'o1', value: 'opt1', label: '제재목' },
      { id: 'o2', value: 'opt2', label: '합판' },
    ],
  } as Partial<Question>);
  const common = q({ id: 'A', type: 'text', title: '공통질문' });
  const only1 = q({ id: 'B', type: 'text', title: 'opt1전용', displayCondition: vm('Q2', ['opt1']) });
  const all = [basis, common, only1];

  it('공통/옵션 시트 변수 수와 메타를 계산한다', () => {
    const plan = planSplit(all, 'Q2', { opt1: 12, opt2: 5 });
    expect(plan.basisCode).toBe('Q2');
    expect(plan.basisLabel).toBe('품목');
    // 공통: basis(radio=1열) + 공통 text(1열) = 2
    expect(plan.common).toBe(2);
    // opt1 시트: only1 text 1열, opt2 시트: 변수 0 → 시트 제외
    const opt1 = plan.sheets.find((s) => s.token === 'opt1')!;
    expect(opt1.vars).toBe(1);
    expect(opt1.name).toBe('제재목');
    expect(opt1.resp).toBe(12);
    expect(plan.sheets.find((s) => s.token === 'opt2')).toBeUndefined(); // 빈 버킷 제외
    expect(plan.maxVars).toBe(2); // 공통이 최대
    expect(plan.exceedsSoftLimit).toBe(false);
  });
});

describe('detectSplitCandidates', () => {
  it('value-match 참조 문항을 후보로, maxVars 오름차순 정렬·권장 표시한다', () => {
    const basis = q({
      id: 'Q2', type: 'radio', questionCode: 'Q2', title: '품목',
      options: [
        { id: 'o1', value: 'opt1', label: '제재목' },
        { id: 'o2', value: 'opt2', label: '합판' },
      ],
    } as Partial<Question>);
    const b1 = q({ id: 'B1', type: 'text', displayCondition: vm('Q2', ['opt1']) });
    const b2 = q({ id: 'B2', type: 'text', displayCondition: vm('Q2', ['opt2']) });
    const cands = detectSplitCandidates([basis, b1, b2]);
    expect(cands).toHaveLength(1);
    expect(cands[0].questionId).toBe('Q2');
    expect(cands[0].refCount).toBe(2);
    expect(cands[0].buckets).toBe(2);
    expect(cands[0].recommended).toBe(true);
    expect(cands[0].note).not.toBe('');
  });

  it('시트가 2개 미만이면 후보에서 제외한다', () => {
    const basis = q({
      id: 'Q2', type: 'radio', questionCode: 'Q2',
      options: [{ id: 'o1', value: 'opt1', label: 'A' }],
    } as Partial<Question>);
    const b1 = q({ id: 'B1', type: 'text', displayCondition: vm('Q2', ['opt1']) });
    expect(detectSplitCandidates([basis, b1])).toHaveLength(0);
  });
});

describe('buildSplitWorkbook ↔ planSplit 일관성', () => {
  const basis = q({
    id: 'Q2', type: 'radio', questionCode: 'Q2', title: '품목', order: 0,
    options: [
      { id: 'o1', value: 'opt1', label: '제재목' },
      { id: 'o2', value: 'opt2', label: '합판' },
    ],
  } as Partial<Question>);
  const commonQ = q({ id: 'A', type: 'text', title: '공통', order: 1 });
  const only1 = q({ id: 'B', type: 'text', title: 'opt1전용', order: 2, displayCondition: vm('Q2', ['opt1']) });
  const only2 = q({ id: 'C', type: 'text', title: 'opt2전용', order: 3, displayCondition: vm('Q2', ['opt2']) });
  const questions = [basis, commonQ, only1, only2];

  const rows: RawExportResponseRow[] = [
    { id: 'r1', questionResponses: { Q2: 'opt1', A: 'x', B: 'y' }, groupValue: null, resid: null,
      platform: null, browser: null, status: 'completed', startedAt: new Date('2026-06-04T01:00:00Z'),
      completedAt: new Date('2026-06-04T01:05:00Z'), totalSeconds: 300 },
  ];

  it('시트 구성과 각 시트 변수 수가 planSplit과 일치한다', () => {
    const plan = planSplit(questions, 'Q2');
    const wb = buildSplitWorkbook(questions, rows, 'Q2', 'sequence');
    const names = wb.worksheets.map((w) => w.name);
    expect(names[0]).toBe('응답 내역');
    expect(names[1]).toBe('공통');
    expect(names[names.length - 1]).toBe('코딩북');
    // 옵션 시트는 plan.sheets 순서대로 그 사이에 위치
    expect(names.slice(2, names.length - 1)).toEqual(plan.sheets.map((s) => s.name));

    // 공통 시트 변수 수(헤더 1행 셀 수 - 식별자 1) == plan.common
    const commonWs = wb.getWorksheet('공통')!;
    expect(commonWs.getRow(1).cellCount - 1).toBe(plan.common);

    // 각 옵션 시트 변수 수 == plan.sheets[].vars
    for (const s of plan.sheets) {
      const ws = wb.getWorksheet(s.name)!;
      expect(ws.getRow(1).cellCount - 1).toBe(s.vars);
    }
  });
});
