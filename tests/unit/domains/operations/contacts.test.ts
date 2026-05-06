import { describe, expect, it } from 'vitest';
import {
  CONTACTS_SORT_KEYS,
  CONTACTS_QFIELDS,
  CONTACTS_PAGE_SIZE,
  normalizeContactListArgs,
  maskEmail,
  maskPhone,
  maskBizNumber,
  hasActiveContactFilters,
  attrsKeyOf,
} from '@/lib/operations/contacts';

describe('normalizeContactListArgs', () => {
  it('빈 입력 → 디폴트', () => {
    const r = normalizeContactListArgs({});
    expect(r).toEqual({
      page: 1,
      q: '',
      qfield: 'all',
      resultCode: 'all',
      sort: 'resid',
      dir: 'asc',
    });
  });

  it('잘못된 sort → 디폴트로 폴백', () => {
    const r = normalizeContactListArgs({ sort: 'malicious' });
    expect(r.sort).toBe('resid');
  });

  it('잘못된 qfield → all', () => {
    const r = normalizeContactListArgs({ qfield: 'xx' });
    expect(r.qfield).toBe('all');
  });

  it('q 200자 초과 → 자름', () => {
    const long = 'x'.repeat(300);
    expect(normalizeContactListArgs({ q: long }).q.length).toBe(200);
  });

  it('page 음수/0 → 1 클램프', () => {
    expect(normalizeContactListArgs({ page: '-3' }).page).toBe(1);
    expect(normalizeContactListArgs({ page: '0' }).page).toBe(1);
  });

  it('dir asc 만 명시적 허용', () => {
    expect(normalizeContactListArgs({ dir: 'asc' }).dir).toBe('asc');
    expect(normalizeContactListArgs({ dir: 'desc' }).dir).toBe('desc');
    expect(normalizeContactListArgs({ dir: 'XX' }).dir).toBe('asc');
  });
});

describe('maskEmail', () => {
  it('일반 이메일', () => {
    expect(maskEmail('hong.gildong@example.com')).toBe('ho***@***.com');
  });
  it('한 글자 로컬', () => {
    expect(maskEmail('a@example.com')).toBe('a***@***.com');
  });
  it('null/빈 문자 → "—"', () => {
    expect(maskEmail(null)).toBe('—');
    expect(maskEmail('')).toBe('—');
  });
  it('@ 없는 잘못된 입력 → "—"', () => {
    expect(maskEmail('not-an-email')).toBe('—');
  });
});

describe('maskPhone', () => {
  it('010 11자리', () => {
    expect(maskPhone('01012345678')).toBe('010-****-5678');
  });
  it('010 하이픈 포함', () => {
    expect(maskPhone('010-1234-5678')).toBe('010-****-5678');
  });
  it('숫자 4자 미만 → "—"', () => {
    expect(maskPhone('123')).toBe('—');
  });
  it('null → "—"', () => {
    expect(maskPhone(null)).toBe('—');
  });
});

describe('maskBizNumber', () => {
  it('10자리 사업자번호', () => {
    expect(maskBizNumber('1234567890')).toBe('123-**-*7890');
  });
  it('하이픈 포함 정규화', () => {
    expect(maskBizNumber('123-45-67890')).toBe('123-**-*7890');
  });
  it('자리수 부족 → "—"', () => {
    expect(maskBizNumber('123')).toBe('—');
  });
});

describe('hasActiveContactFilters', () => {
  it('빈 입력 → false', () => {
    expect(hasActiveContactFilters({})).toBe(false);
  });
  it('q 만 있어도 true', () => {
    expect(hasActiveContactFilters({ q: '인포플라' })).toBe(true);
  });
  it('resultCode 가 all 이면 false', () => {
    expect(hasActiveContactFilters({ resultCode: 'all' })).toBe(false);
  });
  it('resultCode 가 1.조사완료 면 true', () => {
    expect(hasActiveContactFilters({ resultCode: '1.조사완료' })).toBe(true);
  });
});

describe('whitelist exports', () => {
  it('CONTACTS_SORT_KEYS contains resid + respondedAt', () => {
    expect(CONTACTS_SORT_KEYS).toContain('resid');
    expect(CONTACTS_SORT_KEYS).toContain('respondedAt');
  });
  it('CONTACTS_PAGE_SIZE = 20', () => {
    expect(CONTACTS_PAGE_SIZE).toBe(20);
  });
  it('CONTACTS_QFIELDS contains all/resid/email/group', () => {
    expect(CONTACTS_QFIELDS).toEqual(expect.arrayContaining(['all', 'resid', 'email', 'group']));
  });
});

describe('attrsKeyOf', () => {
  it("'attrs.전시회명' → '전시회명'", () => {
    expect(attrsKeyOf('attrs.전시회명')).toBe('전시회명');
  });
  it("'system.resid' → null", () => {
    expect(attrsKeyOf('system.resid')).toBeNull();
  });
  it("빈 문자열 → null", () => {
    expect(attrsKeyOf('')).toBeNull();
  });
});
