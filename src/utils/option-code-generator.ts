import type { CheckboxOption, QuestionOption, RadioOption } from '@/types/survey';

/** optionCode/spssNumericCode/isCustomOptionCode를 가진 옵션 공통 인터페이스 */
type CodeableOption = (QuestionOption | CheckboxOption | RadioOption) & {
  isCustomOptionCode?: boolean;
};

// ── 코드 생성 ──

/** 제로패딩된 optionCode 생성. totalCount에 따라 자릿수 자동 결정 */
export function generateOptionCode(index: number, totalCount: number): string {
  const digits = totalCount >= 100 ? 3 : totalCount >= 10 ? 2 : 1;
  return String(index + 1).padStart(digits, '0');
}

/** 옵션 배열에서 최대 spssNumericCode를 구한�� */
export function getMaxSpssCode(options?: { spssNumericCode?: number }[]): number {
  if (!options || options.length === 0) return 0;
  return options.reduce(
    (max, o) => (o.spssNumericCode != null && o.spssNumericCode > max ? o.spssNumericCode : max), 0,
  );
}

/** 기타 옵션의 코드를 구한다 (other-option의 spssNumericCode, 없으면 max + 1 fallback) */
export function getOtherOptionCode(options?: { id?: string; spssNumericCode?: number }[]): string {
  const otherOpt = options?.find((o) => o.id === 'other-option');
  if (otherOpt?.spssNumericCode != null) return String(otherOpt.spssNumericCode);
  return String(getMaxSpssCode(options) + 1);
}

// ── 커스텀 판별 ──

/** 기존 optionCode가 있고 isCustomOptionCode가 undefined이면 커스텀으로 간주 (기존 데이터 보호) */
function isEffectivelyCustom(option: CodeableOption): boolean {
  if (option.isCustomOptionCode === true) return true;
  if (option.isCustomOptionCode === undefined && option.optionCode) return true;
  return false;
}

// ── 일괄 생성 ──

/** 옵션 배열에 optionCode + spssNumericCode 일괄 할당. 변경 없으면 원본 참조 반환. */
export function generateAllOptionCodes<T extends CodeableOption>(options: T[]): T[] {
  const totalCount = options.length;
  let nextSpssCode = getMaxSpssCode(options) + 1;

  return options.map((opt, index) => {
    if (isEffectivelyCustom(opt)) {
      // 커스텀 코드는 건드리지 않되, spssNumericCode만 없으면 할당
      if (opt.spssNumericCode == null) {
        return { ...opt, spssNumericCode: nextSpssCode++ };
      }
      return opt;
    }

    const newOptionCode = generateOptionCode(index, totalCount);
    // spssNumericCode가 이미 있으면 유지 (삭제 후에도 번호 보존)
    const newSpssCode = opt.spssNumericCode ?? nextSpssCode++;

    if (
      opt.optionCode === newOptionCode &&
      opt.isCustomOptionCode === false &&
      opt.spssNumericCode === newSpssCode
    ) {
      return opt; // 변경 없으면 원본 참조 유지
    }

    return {
      ...opt,
      optionCode: newOptionCode,
      isCustomOptionCode: false,
      spssNumericCode: newSpssCode,
    };
  });
}

// ── DB 저장 최적화 ──

/** DB 저장 전 자동생성 필드를 제거한다. 로드 시 generateAllOptionCodes()로 복원. */
export function stripOptionCodes<T extends CodeableOption>(options: T[]): T[] {
  return options.map((opt) => {
    if (opt.isCustomOptionCode !== false) return opt;

    const stripped = { ...opt };
    delete stripped.optionCode;
    delete stripped.isCustomOptionCode;
    // spssNumericCode는 삭제 시 번호 유지가 필요하므로 보존
    return stripped;
  });
}
