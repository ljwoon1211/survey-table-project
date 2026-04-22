/**
 * SPSS 변수명 규격에 맞게 정리한다.
 * - 영문/숫자/언더스코어/일부 특수문자(@$.#)만 허용
 * - 숫자로 시작하면 V 접두사 추가
 * - 빈 문자열 방지
 * - 최대 64자
 *
 * Idempotent: 이미 정리된 이름에 다시 적용해도 결과 동일.
 */
export function sanitizeSpssVarName(name: string): string {
  // 비 ASCII 문자(한국어 등)를 제거하고, 허용되지 않는 문자를 언더스코어로 대체
  let sanitized = name.replace(/[^a-zA-Z0-9_@$.#]/g, '_');
  // 연속 언더스코어 정리
  sanitized = sanitized.replace(/_+/g, '_').replace(/^_|_$/g, '');
  // 숫자로 시작하면 V 접두사 추가
  if (/^[0-9]/.test(sanitized)) {
    sanitized = `V${sanitized}`;
  }
  // 빈 문자열 방지
  if (!sanitized) {
    sanitized = 'VAR';
  }
  return sanitized.slice(0, 64);
}
