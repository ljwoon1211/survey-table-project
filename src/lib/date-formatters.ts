// 날짜·시각 표시 공통 포매터. KST 기준 24시간제 — Server Component 와 Client Component 모두
// 동일하게 KST 로 표시되도록 `timeZone` 을 명시한다. timeZone 미명시 시 런타임 환경
// (Node 서버: 보통 UTC / 브라우저: 사용자 timezone) 에 따라 결과가 달라져 9시간 어긋난다.

const KST = 'Asia/Seoul';
const KO = 'ko-KR';

const DATETIME_FMT = new Intl.DateTimeFormat(KO, {
  timeZone: KST,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const DATE_FMT = new Intl.DateTimeFormat(KO, {
  timeZone: KST,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function toDate(d: Date | string | number): Date {
  return d instanceof Date ? d : new Date(d);
}

/** 'YYYY. MM. DD. HH:mm' (24h, KST). 등록일시·발송시각 등 풀 표시. */
export function formatDateTimeKst(d: Date | string | number | null | undefined): string {
  if (d === null || d === undefined) return '—';
  return DATETIME_FMT.format(toDate(d));
}

/** 'YYYY. MM. DD.' (KST). 날짜만 표시. */
export function formatDateKst(d: Date | string | number | null | undefined): string {
  if (d === null || d === undefined) return '—';
  return DATE_FMT.format(toDate(d));
}
