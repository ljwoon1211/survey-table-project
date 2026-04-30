import { describe, expect, it } from 'vitest'
import { formatIpMask, formatTotalTime } from '@/lib/operations/profiles'

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

describe('formatTotalTime', () => {
  it('completed + 300초 → "5분"', () => {
    expect(formatTotalTime(300, 'completed')).toBe('5분')
  })

  it('completed + 0초 → "0분"', () => {
    expect(formatTotalTime(0, 'completed')).toBe('0분')
  })

  it('completed + 13080초 → "218분" (큰 값)', () => {
    expect(formatTotalTime(13080, 'completed')).toBe('218분')
  })

  it('completed + null → "—"', () => {
    expect(formatTotalTime(null, 'completed')).toBe('—')
  })

  it('in_progress + 임의 값 → "진행 중"', () => {
    expect(formatTotalTime(120, 'in_progress')).toBe('진행 중')
  })

  it('drop + null → "—"', () => {
    expect(formatTotalTime(null, 'drop')).toBe('—')
  })

  it('completed + 음수 (시계 역행) → "0분" 클램프', () => {
    expect(formatTotalTime(-5, 'completed')).toBe('0분')
  })
})
