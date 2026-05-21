/**
 * 숫자만 받는 input 셀(`TableCell.inputType === 'number'`) 과
 * 분기 조건 우변 입력 양쪽에서 공용으로 쓰는 검증/파싱 헬퍼.
 *
 * 응답자 입력과 빌더 입력 모두 동일한 정규식·파서를 거치도록 모았다.
 */

/**
 * 진행 중인 키 입력까지 허용하는 정규식.
 * - 매칭: `''`, `'-'`, `'.'`, `'-.'`, `'1'`, `'-1.5'`, `'.5'`, `'1.'`, `'0'` 등
 * - 비매칭: `'a'`, `'1a'`, `'1,000'`, `'--1'`, `'1.2.3'`
 */
export const NUMERIC_INPUT_PATTERN = /^-?\d*\.?\d*$/;

/**
 * 사용자가 타이핑 중인 raw 값이 숫자 입력으로 유효한 진행 상태인지 확인.
 * 부분 상태(`-`, `.`, `-.`, ``)도 true 를 반환한다.
 */
export function isPartialNumericInput(value: string): boolean {
  return NUMERIC_INPUT_PATTERN.test(value);
}

/**
 * raw 문자열을 finite number 로 파싱. 실패 시 `null`.
 * - 빈 문자열 / 부분 입력(`-`, `.`, `-.`) / 비숫자 → `null`
 * - 정상 숫자 → number
 */
export function parseNumericInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}
