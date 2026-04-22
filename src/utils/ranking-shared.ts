import type { RankingAnswer } from '@/types/survey';

/** 순위형 응답에서 '기타(직접 입력)' 옵션을 나타내는 sentinel 값. */
export const RANKING_OTHER_VALUE = '__other__';

/** 값이 올바른 RankingAnswer shape 인지 판별. */
export function isRankingAnswer(v: unknown): v is RankingAnswer {
  if (!v || typeof v !== 'object') return false;
  const rec = v as Record<string, unknown>;
  return typeof rec.rank === 'number' && typeof rec.optionValue === 'string';
}

/** 임의 값(unknown) → RankingAnswer[] 로 안전하게 정규화. 배열이 아니거나 shape 불일치는 제거. */
export function parseRankingAnswers(value: unknown): RankingAnswer[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRankingAnswer);
}
