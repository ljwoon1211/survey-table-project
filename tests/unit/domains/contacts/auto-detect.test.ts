import { describe, expect, it } from 'vitest';
import { autoDetectSystemFields } from '@/lib/contacts/auto-detect';

describe('autoDetectSystemFields', () => {
  it('정확한 한국어 헤더 매칭', () => {
    const headers = ['연번', '전시회명(국문)', '기업명', '이메일', '사업자번호', '전화'];
    expect(autoDetectSystemFields(headers)).toEqual({
      group: 1,
      email: 3,
      biz: 4,
      phone: 5,
    });
  });

  it('"담당자 이메일" 같은 변형도 이메일로 인식', () => {
    const headers = ['연번', '전시회명', '담당자 이메일'];
    const r = autoDetectSystemFields(headers);
    expect(r.email).toBe(2);
  });

  it('"사업자등록번호" 도 사업자번호로 인식', () => {
    const headers = ['연번', '기업명', '사업자등록번호'];
    expect(autoDetectSystemFields(headers).biz).toBe(2);
  });

  it('헤더에 매칭 없으면 빈 객체', () => {
    const headers = ['col1', 'col2'];
    expect(autoDetectSystemFields(headers)).toEqual({});
  });

  it('휴대폰번호 도 phone 으로 인식', () => {
    const headers = ['이름', '담당자 휴대폰번호'];
    expect(autoDetectSystemFields(headers).phone).toBe(1);
  });

  it('group 자동 매칭은 "전시회명" 우선', () => {
    const headers = ['연번', '전시회명', '대륙', '기업명'];
    expect(autoDetectSystemFields(headers).group).toBe(1);
  });

  it('group 자동 매칭이 없으면 undefined 반환', () => {
    const headers = ['no', 'name', 'email'];
    expect(autoDetectSystemFields(headers).group).toBeUndefined();
  });
});
