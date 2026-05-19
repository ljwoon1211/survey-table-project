import 'server-only';

import { blindIndex } from '@/lib/crypto/blind';
import type { PiiFieldType } from '@/lib/crypto/pii-fields';
import type { ContactResultCode } from '@/db/schema/schema-types';
import { parseIdListInput, type NumRange } from './range-list';

export type CombineOp = 'AND' | 'OR';
export type ConditionMode = 'idlist' | 'text' | 'exact' | 'enum' | 'boolean';

export interface FilterCondition {
  source: string;
  mode: ConditionMode;
  value: string;
  ranges?: NumRange[];
  /** mode === 'exact' (pii.*) 일 때만 populated. 그 외는 undefined. 소비자는 null-check 필수. */
  blindIndex?: string;
}

export interface FilterClause {
  condition: FilterCondition;
  op: CombineOp | null;
}

export interface ColumnCandidate {
  source: string;
  label: string;
  piiType?: PiiFieldType;
}

export function placeholderFor(source: string): string {
  if (source === 'system.resid') return '예: 1-30, 45';
  if (source.startsWith('pii.')) return '정확한 값 입력 (부분 검색 불가)';
  return '검색어';
}

function toArray(v: string[] | string | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export function parseClausesFromUrl(
  cols: string[] | string | undefined,
  qs: string[] | string | undefined,
  ops: string[] | string | undefined,
  candidates: ColumnCandidate[],
  resultCodes: ContactResultCode[],
): FilterClause[] {
  const colsArr = toArray(cols);
  const qsArr = toArray(qs);
  const opsArr = toArray(ops);
  const len = Math.min(colsArr.length, qsArr.length);
  if (len === 0) return [];
  const clauses: FilterClause[] = [];
  for (let i = 0; i < len; i++) {
    const clause = buildClause(colsArr[i], qsArr[i], opsArr[i] ?? '', candidates, resultCodes);
    if (!clause) continue;
    // 출력 첫 절은 항상 op=null (URL 첫 절이 drop 되어도 invariant 보장).
    clauses.push({
      condition: clause.condition,
      op: clauses.length === 0 ? null : clause.op,
    });
  }
  return clauses;
}

function buildClause(
  col: string,
  q: string,
  opRaw: string,
  candidates: ColumnCandidate[],
  resultCodes: ContactResultCode[],
): FilterClause | null {
  const trimmed = q.trim();
  if (trimmed.length === 0) return null;
  const candidate = candidates.find((c) => c.source === col);
  if (!candidate) return null;
  // op 는 우선 AND/OR 만 결정. 출력 첫 절 → null 강제는 호출자가 담당
  // (URL 인덱스가 아닌 통과한 절 순서 기준이라야 invariant 가 유지된다).
  const op: CombineOp = opRaw === 'OR' ? 'OR' : 'AND';

  if (col === 'system.resid') {
    const ranges = parseIdListInput(trimmed);
    if (ranges !== null) {
      return { op, condition: { source: 'system.resid', mode: 'idlist', value: trimmed, ranges } };
    }
    // 비숫자 입력 → text 폴백. resid 가 정수 컬럼이라 buildClauseSql 에서 FALSE 로 평가되어
    // 0건 표시. placeholder 가 형식("예: 1-30, 45") 을 안내하므로 silent 0건은 의도된 동작.
    return { op, condition: { source: 'system.resid', mode: 'text', value: trimmed } };
  }

  if (col === 'system.contact_result') {
    const code = resultCodes.find((rc) => rc.code === trimmed);
    if (!code) return null;
    return { op, condition: { source: 'system.contact_result', mode: 'enum', value: trimmed } };
  }

  if (col === 'system.web') {
    if (trimmed !== 'true' && trimmed !== 'false') return null;
    return { op, condition: { source: 'system.web', mode: 'boolean', value: trimmed } };
  }

  if (col.startsWith('attrs.')) {
    return { op, condition: { source: col, mode: 'text', value: trimmed } };
  }

  if (col.startsWith('pii.')) {
    if (!candidate.piiType) return null;
    // blindIndex 내부에서 normalizePii 호출 — 정규화 실패는 빈 문자열 반환으로 감지.
    const bi = blindIndex(candidate.piiType, trimmed);
    if (!bi) return null;
    return { op, condition: { source: col, mode: 'exact', value: trimmed, blindIndex: bi } };
  }

  return null;
}
