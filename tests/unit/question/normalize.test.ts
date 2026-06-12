import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizeQuestion, normalizeQuestions } from '@/lib/question';

/**
 * 읽기 경계 정규화 characterization.
 *
 * 골든 픽스처는 2026-06-12 실DB survey_versions 95개 스냅샷의 jsonb 키셋 audit 에서
 * 관측된 세대별 형태를 합성 복제한 것이다 (실데이터 값은 사용하지 않음).
 * 관측된 사실: 모든 세대의 스냅샷 질문이 cross-type 키를 보유한다 — snapshot-builder
 * 가 유형 무관 전 필드를 기입해 왔기 때문. preserve 모드는 이를 무변형 통과시켜야
 * 하고(기존 'as unknown as Question' 단언과 거동 동일), strict 모드는 variant 밖
 * 키를 소거해야 한다.
 */

// 최고(最古) 세대 radio — groupId/noticeContent/placeholder/questionCode/hideColumnLabels 부재
const GEN_OLDEST_RADIO = {
  id: 'q-radio-old',
  type: 'radio',
  title: '성별',
  required: true,
  order: 1,
  allowOtherOption: false,
  displayCondition: { conditions: [], logicType: 'AND' },
  options: [{ id: 'opt-1', label: '남성', value: '1' }],
  requiresAcknowledgment: false,
  selectLevels: [],
  tableColumns: [],
  tableHeaderGrid: [],
  tableRowsData: [],
  tableValidationRules: [],
};

// 중간 세대 text — hideColumnLabels/questionCode 등장, dynamicRowConfigs 이전
const GEN_MID_TEXT = {
  id: 'q-text-mid',
  type: 'text',
  title: '이름',
  required: false,
  order: 2,
  groupId: 'grp-1',
  questionCode: 'Q2',
  placeholder: '홍길동',
  allowOtherOption: false,
  hideColumnLabels: false,
  noticeContent: '',
  displayCondition: { conditions: [], logicType: 'AND' },
  options: [],
  requiresAcknowledgment: false,
  selectLevels: [],
  tableColumns: [],
  tableHeaderGrid: [],
  tableRowsData: [],
  tableValidationRules: [],
};

// 최신 세대 checkbox — inputType/optionsColumns/rankingConfig/dynamicRowConfigs 까지 오염
const GEN_NEW_CHECKBOX = {
  id: 'q-checkbox-new',
  type: 'checkbox',
  title: '보유 매체',
  required: true,
  order: 3,
  groupId: 'grp-1',
  questionCode: 'Q3',
  allowOtherOption: true,
  optionsColumns: 2,
  inputType: 'text',
  placeholder: '',
  noticeContent: '',
  rankingConfig: { positions: 3 },
  dynamicRowConfigs: [],
  hideColumnLabels: false,
  displayCondition: { conditions: [], logicType: 'AND' },
  options: [{ id: 'opt-1', label: 'TV', value: '1' }],
  requiresAcknowledgment: false,
  selectLevels: [],
  tableColumns: [],
  tableHeaderGrid: [],
  tableRowsData: [],
  tableValidationRules: [],
};

// 최신 세대 table — tableTitle 보유 + rankingConfig/options 오염
const GEN_NEW_TABLE = {
  id: 'q-table-new',
  type: 'table',
  title: '가구 현황',
  required: true,
  order: 4,
  groupId: 'grp-2',
  questionCode: 'Q4',
  tableTitle: '가구별 보유 현황',
  tableColumns: [{ id: 'col-1', label: '항목' }],
  tableRowsData: [{ id: 'row-1', label: '행', cells: [{ id: 'c1', content: '', type: 'checkbox' }] }],
  tableHeaderGrid: [],
  tableValidationRules: [],
  dynamicRowConfigs: [],
  hideColumnLabels: false,
  allowOtherOption: false,
  rankingConfig: { positions: 3 },
  noticeContent: '',
  placeholder: '',
  displayCondition: { conditions: [], logicType: 'AND' },
  options: [],
  requiresAcknowledgment: false,
  selectLevels: [],
};

// notice 세대 — questionCode 부재 + options/tableColumns 오염
const GEN_NOTICE = {
  id: 'q-notice',
  type: 'notice',
  title: '안내',
  required: false,
  order: 5,
  groupId: 'grp-1',
  noticeContent: '<p>응답 전 안내사항</p>',
  requiresAcknowledgment: true,
  allowOtherOption: false,
  hideColumnLabels: false,
  rankingConfig: { positions: 3 },
  dynamicRowConfigs: [],
  placeholder: '',
  displayCondition: { conditions: [], logicType: 'AND' },
  options: [],
  selectLevels: [],
  tableColumns: [],
  tableHeaderGrid: [],
  tableRowsData: [],
  tableValidationRules: [],
};

const GOLDEN_FIXTURES = [GEN_OLDEST_RADIO, GEN_MID_TEXT, GEN_NEW_CHECKBOX, GEN_NEW_TABLE, GEN_NOTICE];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizeQuestion - preserve 모드 (기본)', () => {
  it('모든 세대 골든 픽스처를 동일 참조로 무변형 통과시킨다', () => {
    for (const fixture of GOLDEN_FIXTURES) {
      const snapshot = structuredClone(fixture);
      const result = normalizeQuestion(fixture);
      expect(result).toBe(fixture); // 참조 동일 — 복사/변형 일절 없음
      expect(fixture).toEqual(snapshot); // 입력 객체 자체도 비변이
    }
  });

  it('알 수 없는 type 도 throw 없이 통과시키고 관측 로그만 남긴다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unknown = { id: 'q-x', type: 'file-upload', title: '미래 유형', required: false, order: 1 };
    const result = normalizeQuestion(unknown);
    expect(result).toBe(unknown);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('형태가 아예 아닌 값도 throw 하지 않는다 (기존 단언과 거동 동일)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => normalizeQuestion(null)).not.toThrow();
    expect(() => normalizeQuestion('garbage')).not.toThrow();
    expect(() => normalizeQuestion({ id: 1, type: 42 })).not.toThrow();
  });

  it('정상 형태에서는 관측 로그를 남기지 않는다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    normalizeQuestions(GOLDEN_FIXTURES);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('normalizeQuestion - strict 모드 (strip 활성화 목적지)', () => {
  it('모든 세대 골든 픽스처를 거부 없이 수용한다', () => {
    for (const fixture of GOLDEN_FIXTURES) {
      expect(() => normalizeQuestion(fixture, 'strict')).not.toThrow();
    }
  });

  it('radio 픽스처에서 cross-type 키를 소거하고 자기 키는 값 그대로 보존한다', () => {
    const parsed = normalizeQuestion(GEN_OLDEST_RADIO, 'strict') as unknown as Record<string, unknown>;
    // 소거: radio variant 밖 키
    expect(parsed).not.toHaveProperty('requiresAcknowledgment');
    expect(parsed).not.toHaveProperty('selectLevels');
    expect(parsed).not.toHaveProperty('tableValidationRules');
    // 보존: 자기 키 (내장 테이블 capability 포함)
    expect(parsed['options']).toEqual(GEN_OLDEST_RADIO.options);
    expect(parsed['tableRowsData']).toEqual(GEN_OLDEST_RADIO.tableRowsData);
    expect(parsed['displayCondition']).toEqual(GEN_OLDEST_RADIO.displayCondition);
  });

  it('checkbox 픽스처에서 rankingConfig/inputType/noticeContent 오염을 소거한다', () => {
    const parsed = normalizeQuestion(GEN_NEW_CHECKBOX, 'strict') as unknown as Record<string, unknown>;
    expect(parsed).not.toHaveProperty('rankingConfig');
    expect(parsed).not.toHaveProperty('inputType');
    expect(parsed).not.toHaveProperty('noticeContent');
    expect(parsed).not.toHaveProperty('placeholder');
    expect(parsed['optionsColumns']).toBe(2);
    expect(parsed['allowOtherOption']).toBe(true);
  });

  it('table 픽스처에서 options/rankingConfig 오염을 소거하고 테이블 필드를 보존한다', () => {
    const parsed = normalizeQuestion(GEN_NEW_TABLE, 'strict') as unknown as Record<string, unknown>;
    expect(parsed).not.toHaveProperty('options');
    expect(parsed).not.toHaveProperty('rankingConfig');
    expect(parsed).not.toHaveProperty('allowOtherOption');
    expect(parsed['tableTitle']).toBe(GEN_NEW_TABLE.tableTitle);
    expect(parsed['tableValidationRules']).toEqual([]);
    expect(parsed['dynamicRowConfigs']).toEqual([]);
  });

  it('notice 픽스처에서 테이블/옵션 오염을 소거하고 공지 필드를 보존한다', () => {
    const parsed = normalizeQuestion(GEN_NOTICE, 'strict') as unknown as Record<string, unknown>;
    expect(parsed).not.toHaveProperty('tableColumns');
    expect(parsed).not.toHaveProperty('options');
    expect(parsed).not.toHaveProperty('hideColumnLabels');
    expect(parsed['noticeContent']).toBe(GEN_NOTICE.noticeContent);
    expect(parsed['requiresAcknowledgment']).toBe(true);
  });

  it('알 수 없는 type 은 거부한다 (preserve 와 의도적으로 다른 거동)', () => {
    expect(() =>
      normalizeQuestion({ id: 'q-x', type: 'file-upload', title: 't', required: false, order: 1 }, 'strict'),
    ).toThrow();
  });
});
