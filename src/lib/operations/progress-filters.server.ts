import 'server-only';

import { blindIndex } from '@/lib/crypto/blind';
import type { PiiFieldType } from '@/lib/crypto/pii-fields';
import { parseIdListInput, type NumRange } from './range-list';

export type { NumRange } from './range-list';
export { parseIdListInput } from './range-list';

export type FilterCondition =
  | { source: 'system.resid'; mode: 'idlist'; ranges: NumRange[] }
  | { source: 'system.resid'; mode: 'text'; value: string }
  | { source: `attrs.${string}`; mode: 'text'; value: string }
  | { source: `pii.${string}`; mode: 'exact'; value: string; blindIndex: string };

export interface ColumnCandidate {
  source: string;
  label: string;
  piiType?: PiiFieldType;
}

export function placeholderFor(source: string | null): string {
  if (!source) return '검색어';
  if (source === 'system.resid') return '예: 1-30, 45';
  if (source.startsWith('pii.')) return '정확한 값 입력 (부분 검색 불가)';
  return '부분일치';
}

export function parseConditionFromUrl(
  col: string | null,
  q: string | null,
  candidates: ColumnCandidate[],
): FilterCondition | null {
  if (!col) return null;
  const trimmed = (q ?? '').trim();
  if (trimmed.length === 0) return null;

  const candidate = candidates.find((c) => c.source === col);
  if (!candidate) return null;

  if (col === 'system.resid') {
    const ranges = parseIdListInput(trimmed);
    if (ranges !== null) {
      return { source: 'system.resid', mode: 'idlist', ranges };
    }
    return { source: 'system.resid', mode: 'text', value: trimmed };
  }

  if (col.startsWith('attrs.')) {
    return { source: col as `attrs.${string}`, mode: 'text', value: trimmed };
  }

  if (col.startsWith('pii.')) {
    if (!candidate.piiType) return null;
    const bi = blindIndex(candidate.piiType, trimmed);
    if (!bi) return null;
    return {
      source: col as `pii.${string}`,
      mode: 'exact',
      value: trimmed,
      blindIndex: bi,
    };
  }

  return null;
}
