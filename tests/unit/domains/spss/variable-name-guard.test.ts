import { describe, expect, it } from 'vitest';

import type { SPSSExportColumn } from '@/lib/analytics/spss-excel-export';
import { assertValidSpssVarNames, SpssVarNameError } from '@/lib/spss/variable-name-guard';

function makeCol(spssVarName: string, questionText = '질문'): SPSSExportColumn {
  return { spssVarName, questionText, optionLabel: '', questionId: 'q1', type: 'single' };
}

describe('assertValidSpssVarNames', () => {
  it('전부 유효하면 통과한다', () => {
    expect(() =>
      assertValidSpssVarNames([makeCol('Q1'), makeCol('I1_r3_c2'), makeCol('Q2_opt4_text')]),
    ).not.toThrow();
  });

  it('한글 변수명은 SpssVarNameError를 던진다', () => {
    expect(() => assertValidSpssVarNames([makeCol('문항1')])).toThrow(SpssVarNameError);
  });

  it('대시 변수명을 거부한다 — sanitize 미스매치로 컬럼 전손되던 케이스', () => {
    try {
      assertValidSpssVarNames([makeCol('Q-1', '성별')]);
      expect.unreachable('던져야 한다');
    } catch (e) {
      const err = e as SpssVarNameError;
      expect(err.issues).toHaveLength(1);
      expect(err.issues[0]!.varName).toBe('Q-1');
      expect(err.issues[0]!.questionText).toBe('성별');
      expect(err.issues[0]!.reason).toContain('허용되지 않는 문자');
    }
  });

  it('대소문자 무시 중복을 거부한다', () => {
    try {
      assertValidSpssVarNames([makeCol('Q1'), makeCol('q1')]);
      expect.unreachable('던져야 한다');
    } catch (e) {
      const err = e as SpssVarNameError;
      expect(err.issues).toHaveLength(1);
      expect(err.issues[0]!.reason).toContain('중복');
    }
  });

  it('에러 메시지는 최대 5건 나열 후 외 N건으로 줄인다', () => {
    const cols = Array.from({ length: 7 }, (_, i) => makeCol(`문${i + 1}`));
    try {
      assertValidSpssVarNames(cols);
      expect.unreachable('던져야 한다');
    } catch (e) {
      const err = e as SpssVarNameError;
      expect(err.issues).toHaveLength(7);
      expect(err.message).toContain('외 2건');
    }
  });
});
