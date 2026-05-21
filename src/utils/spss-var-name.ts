/**
 * allowTextInput 옵션의 SPSS 사이드카 텍스트 변수명을 생성한다.
 * 규칙: {baseVar}_{varNumber}_text
 *
 * @param baseVar - 질문 코드 또는 셀 변수명
 * @param varNumber - 옵션 코드 (optionCode) 또는 1-based 인덱스 문자열
 */
export function buildOptionTextVarName(baseVar: string, varNumber: string): string {
  return `${baseVar}_${varNumber}_text`;
}

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
