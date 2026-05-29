import type { PageVisit } from '@/db/schema/schema-types';

/**
 * pageVisits의 활성 체류시간 합(초)을 계산한다.
 *
 * - 각 visit의 `(leftAt - enteredAt) / 1000`을 합산한다.
 * - leftAt 누락 / 비유효 timestamp / leftAt <= enteredAt 인 visit은 제외한다.
 * - 유효 segment가 하나도 없으면 null을 반환한다(호출자가 벽시계 폴백).
 *
 * Page Visibility 세그먼트로 한 페이지가 hide/show로 쪼개진 경우에도
 * 숨겨져 있던 idle 구간은 어떤 visit에도 안 들어가므로 자동 제외된다.
 */
export function sumActiveSeconds(
  pageVisits: PageVisit[] | null | undefined,
): number | null {
  if (!Array.isArray(pageVisits) || pageVisits.length === 0) return null;

  let total = 0;
  let counted = 0;
  for (const visit of pageVisits) {
    if (!visit || typeof visit.leftAt !== 'string' || !visit.leftAt) continue;
    const enteredMs = Date.parse(visit.enteredAt);
    const leftMs = Date.parse(visit.leftAt);
    if (!Number.isFinite(enteredMs) || !Number.isFinite(leftMs)) continue;
    if (leftMs <= enteredMs) continue;
    total += (leftMs - enteredMs) / 1000;
    counted += 1;
  }

  if (counted === 0) return null;
  return Math.round(total);
}
