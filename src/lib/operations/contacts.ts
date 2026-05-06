/**
 * 운영 콘솔 컨택리스트 페이지의 표시용 pure helper + 클라/서버 공용 타입.
 *
 * 'server-only' marker 는 contacts.server.ts 에만 둔다. 본 모듈은 DB/server-only
 * 의존을 일체 갖지 않아 client component 가 import 해도 안전하다.
 *
 * 단위 테스트: tests/unit/domains/operations/contacts.test.ts.
 */

export const CONTACTS_SORT_KEYS = [
  'resid',
  'respondedAt',
  'createdAt',
  'email',
  'group',
] as const;
export type ContactsSortKey = (typeof CONTACTS_SORT_KEYS)[number];

export type ContactsSortDir = 'asc' | 'desc';

export const CONTACTS_QFIELDS = ['all', 'resid', 'email', 'group', 'biz'] as const;
export type ContactsQField = (typeof CONTACTS_QFIELDS)[number];

/** 결과코드 enum 은 후속 슬라이스에서 정의. 본 슬라이스는 자유 텍스트. */
export type ContactsResultCodeFilter = 'all' | string;

export const CONTACTS_PAGE_SIZE = 20;

export interface NormalizedContactListArgs {
  page: number;
  q: string;
  qfield: ContactsQField;
  resultCode: ContactsResultCodeFilter;
  sort: ContactsSortKey;
  dir: ContactsSortDir;
}

function pickFromWhitelist<T extends string>(
  value: string | undefined,
  whitelist: readonly T[],
  fallback: T,
): T {
  return (whitelist as readonly string[]).includes(value ?? '') ? (value as T) : fallback;
}

export function normalizeContactListArgs(input: {
  page?: string;
  q?: string;
  qfield?: string;
  resultCode?: string;
  sort?: string;
  dir?: string;
}): NormalizedContactListArgs {
  return {
    page: Math.max(1, parseInt(input.page ?? '1', 10) || 1),
    q: (input.q ?? '').slice(0, 200),
    qfield: pickFromWhitelist(input.qfield, CONTACTS_QFIELDS, 'all'),
    resultCode: input.resultCode && input.resultCode !== '' ? input.resultCode : 'all',
    sort: pickFromWhitelist(input.sort, CONTACTS_SORT_KEYS, 'resid'),
    // 컨택리스트는 resid 오름차순이 기본 (profiles 의 desc 와 의도적으로 다름)
    dir: input.dir === 'desc' ? 'desc' : 'asc',
  };
}

export function hasActiveContactFilters(input: {
  q?: string;
  qfield?: string;
  resultCode?: string;
}): boolean {
  const q = (input.q ?? '').trim();
  const rc = input.resultCode ?? 'all';
  return q.length > 0 || (rc !== 'all' && rc !== '');
}

// ─────────── 마스킹 (PII) ───────────

const DASH = '—';

export function maskEmail(value: string | null | undefined): string {
  if (!value) return DASH;
  const at = value.indexOf('@');
  if (at <= 0) return DASH;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const tld = dot > 0 ? domain.slice(dot) : '';
  const localShown = local.slice(0, Math.min(2, local.length));
  return `${localShown}***@***${tld}`;
}

export function maskPhone(value: string | null | undefined): string {
  if (!value) return DASH;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return DASH;
  const tail = digits.slice(-4);
  if (digits.length === 11 && digits.startsWith('010')) {
    return `010-****-${tail}`;
  }
  if (digits.length >= 10) {
    const head = digits.slice(0, 3);
    return `${head}-****-${tail}`;
  }
  return `****-${tail}`;
}

export function maskBizNumber(value: string | null | undefined): string {
  if (!value) return DASH;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10) return DASH;
  const head = digits.slice(0, 3);
  const tail4 = digits.slice(-4);
  return `${head}-**-*${tail4}`;
}

// ─────────── attrs 표시 helper ───────────

/**
 * ContactColumnDef.source 에서 attrs key 추출. 'attrs.전시회명' → '전시회명'.
 * system.* 는 null 반환.
 */
export function attrsKeyOf(source: string): string | null {
  if (source.startsWith('attrs.')) return source.slice('attrs.'.length);
  return null;
}
