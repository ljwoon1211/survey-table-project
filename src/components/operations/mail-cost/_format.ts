/**
 * mail-cost 컴포넌트 공용 포매터.
 *
 * 한국어 통화/숫자/날짜시간 표시 일관성을 위해 한 곳에 모음. 다른 도메인에서 동일 포맷이
 * 필요해지면 더 일반적인 위치(src/lib)로 승격 검토.
 */

export function formatKrw(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

export function formatInt(n: number): string {
  return n.toLocaleString('ko-KR');
}

export function formatMonthDayTime(date: Date | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
