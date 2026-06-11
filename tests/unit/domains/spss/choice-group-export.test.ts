import { describe, expect, it } from 'vitest';

import { buildDataRows, generateSPSSColumns } from '@/lib/analytics/spss-excel-export';
import type { Question, SurveySubmission } from '@/types/survey';

// radio choiceGroups 가 있는 질문 픽스처
const grouped = {
  id: 'q1',
  type: 'radio',
  title: 'TV 질문',
  required: false,
  order: 1,
  questionCode: 'Q5',
  choiceGroups: [
    { id: 'g1', groupKey: 'rad1', type: 'radio', label: 'TV보유' },
    { id: 'g2', groupKey: 'rad2', type: 'radio', label: '구매의향' },
  ],
  tableRowsData: [
    {
      id: 'r1',
      label: '행1',
      cells: [
        { id: 'cellA', content: 'UHD', type: 'choice_opt', choiceGroupId: 'g1', spssNumericCode: 1 },
        { id: 'cellB', content: 'FHD', type: 'choice_opt', choiceGroupId: 'g1', spssNumericCode: 2 },
        { id: 'cellC', content: '있음', type: 'choice_opt', choiceGroupId: 'g2', spssNumericCode: 1 },
        { id: 'cellD', content: '기타', type: 'choice_opt' },
      ],
    },
  ],
} as unknown as Question;

function makeSubmission(questionResponses: Record<string, unknown>): SurveySubmission {
  return {
    id: 'sub-1',
    surveyId: 'sv-1',
    startedAt: new Date('2025-01-01T00:00:00Z'),
    completedAt: new Date('2025-01-01T00:01:00Z'),
    isCompleted: true,
    currentGroupOrder: 0,
    questionResponses,
    updatedAt: new Date('2025-01-01T00:01:00Z'),
  } as unknown as SurveySubmission;
}

describe('radio 옵션 그룹 export — generateSPSSColumns', () => {
  it('그룹별 1변수를 질문코드_groupKey로 생성하고 default 그룹은 질문코드 그대로다', () => {
    const cols = generateSPSSColumns([grouped]);
    const names = cols.map((c) => c.spssVarName);
    expect(names).toContain('Q5_rad1');
    expect(names).toContain('Q5_rad2');
    expect(names).toContain('Q5');
  });

  it('그룹 변수는 cellValueMap으로 멤버 셀 응답값을 매핑한다', () => {
    const cols = generateSPSSColumns([grouped]);
    const rad1 = cols.find((c) => c.spssVarName === 'Q5_rad1');
    expect(rad1?.type).toBe('choice-group');
    expect(rad1?.choiceGroupCellValueMap).toEqual({ cellA: 1, cellB: 2 });
  });

  it('value labels는 멤버 셀 라벨을 담는다', () => {
    const cols = generateSPSSColumns([grouped]);
    const rad1 = cols.find((c) => c.spssVarName === 'Q5_rad1');
    expect(rad1?.choiceGroupValueLabels).toEqual([
      { value: 1, label: 'UHD' },
      { value: 2, label: 'FHD' },
    ]);
  });

  it('그룹 라벨이 변수 라벨 후보(optionLabel)로 전달된다', () => {
    const cols = generateSPSSColumns([grouped]);
    const rad1 = cols.find((c) => c.spssVarName === 'Q5_rad1');
    expect(rad1?.optionLabel).toContain('TV보유');
  });

  it('choiceGroups 없는 radio 질문은 기존 single 1변수 그대로다 — 하위호환', () => {
    const plain = { ...grouped, choiceGroups: undefined, id: 'q2', questionCode: 'Q6' } as unknown as Question;
    const cols = generateSPSSColumns([plain]);
    expect(cols.filter((c) => c.questionId === 'q2').map((c) => c.type)).toEqual(['single']);
  });

});

describe('radio 옵션 그룹 export — allowTextInput 사이드카 텍스트 변수', () => {
  // allowTextInput 이 있는 셀을 포함하는 픽스처
  const groupedWithText = {
    id: 'q_txt',
    type: 'radio',
    title: 'TV 텍스트 질문',
    required: false,
    order: 1,
    questionCode: 'QT',
    choiceGroups: [
      { id: 'g1', groupKey: 'rad1', type: 'radio', label: 'TV보유' },
    ],
    tableRowsData: [
      {
        id: 'r1',
        label: '행1',
        cells: [
          { id: 'cellA', content: 'UHD', type: 'choice_opt', choiceGroupId: 'g1', spssNumericCode: 1, allowTextInput: true },
          { id: 'cellB', content: 'FHD', type: 'choice_opt', choiceGroupId: 'g1', spssNumericCode: 2 },
        ],
      },
    ],
  } as unknown as Question;

  it('allowTextInput 멤버 셀마다 option-text 사이드카 변수를 생성한다', () => {
    const cols = generateSPSSColumns([groupedWithText]);
    const names = cols.map((c) => c.spssVarName);
    // 그룹 주변수
    expect(names).toContain('QT_rad1');
    // cellA 에 allowTextInput=true → 사이드카 변수
    expect(names).toContain('QT_rad1_1_text');
    // cellB 는 allowTextInput 없음 → 사이드카 없음
    expect(names).not.toContain('QT_rad1_2_text');
  });

  it('사이드카 컬럼은 type=option-text 이고 optionId=cell.id 이다', () => {
    const cols = generateSPSSColumns([groupedWithText]);
    const sidecar = cols.find((c) => c.spssVarName === 'QT_rad1_1_text');
    expect(sidecar?.type).toBe('option-text');
    expect(sidecar?.optionId).toBe('cellA');
  });

  it('buildDataRows 에서 사이드카 옵션텍스트를 __optTexts__ 경로로 추출한다', () => {
    const cols = generateSPSSColumns([groupedWithText]);
    const sub = makeSubmission({
      q_txt: { rad1: 'cellA' },
      __optTexts__: { q_txt: { cellA: '직접입력' } },
    });
    const rows = buildDataRows(cols, [groupedWithText], [sub]);
    const row = rows[0];
    if (row == null) throw new Error('row 없음');
    const sidecarIdx = cols.findIndex((c) => c.spssVarName === 'QT_rad1_1_text');
    expect(row[sidecarIdx]).toBe('직접입력');
  });

  it('멤버 0인 phantom 그룹에 대한 choice-group 변수는 생성되지 않는다', () => {
    // rad2 그룹은 선언됐지만 소속 셀이 없는 phantom
    const withPhantom = {
      ...grouped,
      id: 'q_phantom',
      questionCode: 'QP',
      choiceGroups: [
        { id: 'g1', groupKey: 'rad1', type: 'radio', label: 'TV보유' },
        { id: 'g_phantom', groupKey: 'rad2', type: 'radio', label: '팬텀' },
      ],
      tableRowsData: [
        {
          id: 'r1',
          label: '행1',
          cells: [
            // cellA/cellB 는 g1 소속, g_phantom 에는 아무 셀도 없음
            { id: 'cellA', content: 'UHD', type: 'choice_opt', choiceGroupId: 'g1', spssNumericCode: 1 },
            { id: 'cellB', content: 'FHD', type: 'choice_opt', choiceGroupId: 'g1', spssNumericCode: 2 },
          ],
        },
      ],
    } as unknown as Question;
    const cols = generateSPSSColumns([withPhantom]);
    const names = cols.filter((c) => c.questionId === 'q_phantom').map((c) => c.spssVarName);
    // rad1 변수만 생성. rad2(phantom)는 없어야 한다.
    expect(names).toContain('QP_rad1');
    expect(names).not.toContain('QP_rad2');
  });
});

describe('radio 옵션 그룹 export — buildDataRows 응답값 변환', () => {
  it('그룹별 응답 맵에서 각 그룹 변수 값을 정확히 추출한다', () => {
    const cols = generateSPSSColumns([grouped]);
    // rad1=cellA(1), rad2 미선택, default=cellD
    const sub = makeSubmission({ q1: { rad1: 'cellA', default: 'cellD' } });
    const rows = buildDataRows(cols, [grouped], [sub]);
    const row = rows[0];
    if (row == null) throw new Error('row 없음');
    const rad1Col = cols.findIndex((c) => c.spssVarName === 'Q5_rad1');
    const rad2Col = cols.findIndex((c) => c.spssVarName === 'Q5_rad2');
    const defCol = cols.findIndex((c) => c.spssVarName === 'Q5');

    expect(row[rad1Col]).toBe(1);    // cellA → spssNumericCode 1
    expect(row[rad2Col]).toBeNull(); // 미선택
    // default 그룹 내 cellD는 spssNumericCode 없음 → 그룹 내 1-based 순서(1)
    expect(row[defCol]).toBe(1);
  });

  it('응답 없음(null) → null 반환', () => {
    const cols = generateSPSSColumns([grouped]);
    const sub = makeSubmission({ q1: null });
    const rows = buildDataRows(cols, [grouped], [sub]);
    const row = rows[0];
    if (row == null) throw new Error('row 없음');
    const rad1Col = cols.findIndex((c) => c.spssVarName === 'Q5_rad1');
    expect(row[rad1Col]).toBeNull();
  });

  it('레거시 문자열 응답(그룹 맵 아님) → null 안전 처리', () => {
    const cols = generateSPSSColumns([grouped]);
    const sub = makeSubmission({ q1: 'cellA' }); // 문자열은 그룹 응답 맵이 아님
    const rows = buildDataRows(cols, [grouped], [sub]);
    const row = rows[0];
    if (row == null) throw new Error('row 없음');
    const rad1Col = cols.findIndex((c) => c.spssVarName === 'Q5_rad1');
    expect(row[rad1Col]).toBeNull();
  });
});
