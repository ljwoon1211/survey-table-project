import 'server-only';

import {
  parseConditionFromUrl,
  type ColumnCandidate,
  type FilterCondition,
} from './progress-filters.server';
import { parseIdListInput, type NumRange } from './range-list';

/**
 * 응답 내역 필터 조건. 진척률 FilterCondition(resid/attrs/pii) + 응답 자체 컬럼 2종.
 *  - idx: survey_responses row_number (응답 순번). 범위/리스트 매치.
 *  - browser: survey_responses.browser. ilike 부분일치.
 */
export type ProfilesCondition =
  | { source: 'idx'; mode: 'idx'; ranges: NumRange[] }
  | { source: 'browser'; mode: 'text'; value: string }
  | FilterCondition;

/** 응답 전용 추가 컬럼 후보 — 명단 후보 앞에 노출. */
export const PROFILES_EXTRA_CANDIDATES: ColumnCandidate[] = [
  { source: 'idx', label: '순번' },
  { source: 'browser', label: '브라우저' },
];

/**
 * col/q → ProfilesCondition. idx/browser 는 응답 전용 분기, 그 외는 진척률 파서 위임.
 *
 * idx 비숫자/빈 입력은 ranges=[] 으로 반환한다. SQL 변환에서 FALSE 가 되어
 * 0건 — "순번으로 검색했으나 숫자가 아님 → 결과 없음" 의미를 명시적으로 표현(전체 노출 방지).
 */
export function parseProfilesCondition(
  col: string | null,
  q: string | null,
  candidates: ColumnCandidate[],
): ProfilesCondition | null {
  if (!col) return null;
  const trimmed = (q ?? '').trim();

  if (col === 'idx') {
    return { source: 'idx', mode: 'idx', ranges: parseIdListInput(trimmed) ?? [] };
  }

  if (trimmed.length === 0) return null;

  if (col === 'browser') {
    return { source: 'browser', mode: 'text', value: trimmed };
  }

  return parseConditionFromUrl(col, q, candidates);
}
