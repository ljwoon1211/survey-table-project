/**
 * 엑셀 헤더 (정규화된 한국어) → 시스템 필드 자동 매칭.
 * 우선순위: 정확 매칭 > 부분 포함.
 *
 * 단위 테스트: tests/unit/domains/contacts/auto-detect.test.ts.
 */

const PATTERNS = {
  email: ['이메일', '메일', 'email', 'e-mail'],
  biz: ['사업자등록번호', '사업자번호', '사업자', 'biz'],
  phone: ['휴대폰번호', '핸드폰', '휴대폰', '전화번호', '전화', 'phone', 'mobile'],
  group: ['전시회명', '전시회', '캠페인'],
} as const;

export interface AutoDetected {
  email?: number;
  biz?: number;
  phone?: number;
  group?: number;
}

function findHeader(headers: string[], patterns: readonly string[]): number | undefined {
  for (const p of patterns) {
    const i = headers.findIndex((h) => h === p);
    if (i >= 0) return i;
  }
  for (const p of patterns) {
    const i = headers.findIndex((h) => h.includes(p));
    if (i >= 0) return i;
  }
  return undefined;
}

export function autoDetectSystemFields(headers: string[]): AutoDetected {
  const result: AutoDetected = {};
  const email = findHeader(headers, PATTERNS.email);
  if (email != null) result.email = email;
  const biz = findHeader(headers, PATTERNS.biz);
  if (biz != null) result.biz = biz;
  const phone = findHeader(headers, PATTERNS.phone);
  if (phone != null) result.phone = phone;
  const group = findHeader(headers, PATTERNS.group);
  if (group != null) result.group = group;
  return result;
}
