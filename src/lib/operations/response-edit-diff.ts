import type { ResponseEditChange, SurveyVersionSnapshot } from '@/db/schema/schema-types';

/**
 * 키 순서 무관 안정 직렬화 — deep-equal 비교용.
 * JSON.stringify 의 키 순서 의존으로 거짓 변경이 잡히는 것을 막는다.
 */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/**
 * 이전/이후 questionResponses 를 비교해 값이 바뀐 questionId 목록을 반환.
 * 추가·삭제·변경 모두 포함. 변경 없으면 빈 배열.
 */
export function diffQuestionResponses(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): string[] {
  const ids = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const changed: string[] = [];
  for (const id of ids) {
    if (stableStringify(prev[id]) !== stableStringify(next[id])) changed.push(id);
  }
  return changed;
}

/**
 * 바뀐 questionId 를 버전 스냅샷 기준 { questionId, code, title } 로 매핑.
 * 스냅샷에 없으면 code=null, title=questionId 폴백.
 */
export function buildChangedQuestions(
  changedIds: string[],
  snapshot: SurveyVersionSnapshot | null,
): ResponseEditChange[] {
  const map = new Map<string, { code: string | null; title: string }>();
  for (const q of snapshot?.questions ?? []) {
    // questionCode 는 schema-types.QuestionData 타입에 없으므로 안전 단언.
    const code = (q as { questionCode?: string }).questionCode ?? null;
    map.set(q.id, { code, title: q.title });
  }
  return changedIds.map((id) => {
    const meta = map.get(id);
    return { questionId: id, code: meta?.code ?? null, title: meta?.title ?? id };
  });
}
