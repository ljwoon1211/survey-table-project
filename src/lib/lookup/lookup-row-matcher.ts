import type { SurveyLookup } from '@/types/survey';

export function findLookupRow(
  lookup: SurveyLookup,
  keys: Record<string, string | undefined>,
): Record<string, string | number> | null {
  for (const row of lookup.rows) {
    let matched = true;
    for (const lutKey of lookup.keyColumns) {
      const expected = String(row[lutKey] ?? '').trim();
      const actual = (keys[lutKey] ?? '').trim();
      if (expected !== actual || actual === '') {
        matched = false;
        break;
      }
    }
    if (matched) return row;
  }
  return null;
}
