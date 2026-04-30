import { describe, expect, it } from 'vitest'
import { formatIpMask } from '@/lib/operations/profiles'

describe('formatIpMask', () => {
  it('IPv4 → 끝 옥텟 마스킹', () => {
    expect(formatIpMask('123.45.67.89')).toBe('123.45.67.xx')
  })

  it('IPv4 (작은 수) → 마스킹', () => {
    expect(formatIpMask('1.2.3.4')).toBe('1.2.3.xx')
  })

  it('IPv6 → 마지막 64bit (4 그룹) 마스킹', () => {
    expect(formatIpMask('2001:db8:cafe:1234:5678:9abc:def0:1111')).toBe('2001:db8:cafe:1234:xxxx:xxxx:xxxx:xxxx')
  })

  it('IPv6 축약형 (::1) → "—" (불완전 입력)', () => {
    expect(formatIpMask('::1')).toBe('—')
  })

  it('null → "—"', () => {
    expect(formatIpMask(null)).toBe('—')
  })

  it('빈 문자열 → "—"', () => {
    expect(formatIpMask('')).toBe('—')
  })

  it('비정상 문자열 → "—"', () => {
    expect(formatIpMask('not-an-ip')).toBe('—')
  })
})
