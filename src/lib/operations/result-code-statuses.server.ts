import 'server-only';
import { cache } from 'react';
import { sql, type SQL } from 'drizzle-orm';

import { getContactResultCodes } from '@/lib/operations/contacts.server';

import {
  extractResultCodeStatuses,
  type ResultCodeStatuses,
} from '@/lib/operations/result-code-statuses';

/**
 * `surveys.contact_result_codes` 조회 → extractResultCodeStatuses 적용.
 *
 * 내부적으로 `getContactResultCodes` 위임 — 같은 RSC pass 안에서 두 함수가
 * 모두 호출돼도 cache dedupe 로 DB query 1회.
 */
export const getResultCodeStatuses = cache(
  async (surveyId: string): Promise<ResultCodeStatuses> => {
    const codes = await getContactResultCodes(surveyId);
    return extractResultCodeStatuses(codes);
  },
);

/**
 * negative result code EXISTS subquery fragment.
 *
 * 호출자가 contact_target id 의 SQL expression 을 전달. 빈 배열이면 FALSE 반환 (안전).
 *
 * 예시:
 *   buildNegativeCodeExists(negativeCodes, sql`ct.id`)
 *   buildNegativeCodeExists(negativeCodes, sql`"contact_targets"."id"`)
 *   buildNegativeCodeExists(negativeCodes, sql`${surveyResponses.contactTargetId}`)
 *
 * NOT 결합 / unsubscribed_at OR 결합은 호출자가 결정 (컨텍스트별 polarity 다름).
 */
export function buildNegativeCodeExists(
  negativeCodes: string[],
  contactTargetIdExpr: SQL,
): SQL {
  if (negativeCodes.length === 0) return sql`FALSE`;
  return sql`EXISTS (
    SELECT 1 FROM contact_attempts ca
    WHERE ca.contact_target_id = ${contactTargetIdExpr}
      AND ca.result_code = ANY(${negativeCodes})
  )`;
}
