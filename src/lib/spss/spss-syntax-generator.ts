import type { Question } from '@/types/survey';

/** SPSS 문자열 리터럴에서 작은따옴표를 이스케이프한다. */
function esc(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * VARIABLE LABELS 신택스를 생성한다.
 * - 단일선택/텍스트/다단계: 변수 1개
 * - 복수선택: 옵션별 하위 변수 (Q2M1, Q2M2...)
 */
export function generateVariableLabels(questions: Question[]): string {
  const lines: string[] = [];

  for (const q of questions) {
    // notice 중 requiresAcknowledgment가 있으면 동의 + 날짜 변수 생성
    if (q.type === 'notice') {
      if (q.requiresAcknowledgment && q.questionCode) {
        lines.push(`  ${q.questionCode} '${esc(q.title)} - 동의 여부'`);
        lines.push(`  ${q.questionCode}_DATE '${esc(q.title)} - 동의 일시'`);
      }
      continue;
    }
    if (!q.questionCode) continue;

    if (q.type === 'checkbox' && q.options) {
      for (let i = 0; i < q.options.length; i++) {
        const opt = q.options[i];
        lines.push(`  ${q.questionCode}M${i + 1} '${esc(q.title)} - ${i + 1}. ${esc(opt.label)}'`);
      }
      if (q.allowOtherOption) {
        lines.push(`  ${q.questionCode}_etc '${esc(q.title)} - 기타 입력'`);
      }
    } else {
      lines.push(`  ${q.questionCode} '${esc(q.title)}'`);
      if ((q.type === 'radio' || q.type === 'select') && q.allowOtherOption) {
        lines.push(`  ${q.questionCode}_etc '${esc(q.title)} - 기타 입력'`);
      }
    }
  }

  if (lines.length === 0) return '';
  return `* 변수 라벨 설정.\nVARIABLE LABELS\n${lines.join('\n')}.`;
}

/**
 * VALUE LABELS 신택스를 생성한다.
 * - 단일선택(radio, select): 모든 옵션의 숫자코드=라벨
 * - 복수선택(checkbox): 각 하위 변수에 "코드='선택'"
 */
export function generateValueLabels(questions: Question[]): string {
  const entries: string[] = [];

  for (const q of questions) {
    // notice 동의 변수 값 라벨
    if (q.type === 'notice' && q.requiresAcknowledgment && q.questionCode) {
      entries.push(`  ${q.questionCode} 1 '동의'`);
      continue;
    }

    if (!q.questionCode || !q.options || q.options.length === 0) continue;

    if (q.type === 'radio' || q.type === 'select') {
      const valuePairs = q.options
        .map((opt, idx) => {
          const code = opt.spssNumericCode ?? idx + 1;
          return `${code} '${esc(opt.label)}'`;
        })
        .join(' ');
      entries.push(`  ${q.questionCode} ${valuePairs}`);
    } else if (q.type === 'checkbox') {
      for (let i = 0; i < q.options.length; i++) {
        const code = q.options[i].spssNumericCode ?? i + 1;
        entries.push(`  ${q.questionCode}M${i + 1} ${code} '선택'`);
      }
    }
  }

  if (entries.length === 0) return '';
  return `* 값 라벨 설정.\nVALUE LABELS\n${entries.join(' /\n')}.`;
}

/**
 * VARIABLE LEVEL 신택스를 생성한다.
 * - radio, select, checkbox → NOMINAL
 * - text, textarea, multiselect → SCALE
 */
export function generateVariableLevel(questions: Question[]): string {
  const nominal: string[] = [];
  const scale: string[] = [];

  for (const q of questions) {
    // notice 동의 → NOMINAL, 날짜 → SCALE
    if (q.type === 'notice') {
      if (q.requiresAcknowledgment && q.questionCode) {
        nominal.push(q.questionCode);
        scale.push(`${q.questionCode}_DATE`);
      }
      continue;
    }
    if (!q.questionCode) continue;

    if (q.type === 'radio' || q.type === 'select') {
      nominal.push(q.questionCode);
      if (q.allowOtherOption) {
        scale.push(`${q.questionCode}_etc`);
      }
    } else if (q.type === 'checkbox' && q.options) {
      for (let i = 0; i < q.options.length; i++) {
        nominal.push(`${q.questionCode}M${i + 1}`);
      }
      if (q.allowOtherOption) {
        scale.push(`${q.questionCode}_etc`);
      }
    } else {
      scale.push(q.questionCode);
    }
  }

  const parts: string[] = [];
  if (nominal.length > 0) {
    parts.push(`  ${nominal.join(' ')} (NOMINAL)`);
  }
  if (scale.length > 0) {
    parts.push(`  ${scale.join(' ')} (SCALE)`);
  }

  if (parts.length === 0) return '';
  return `* 측정 수준 설정.\nVARIABLE LEVEL\n${parts.join(' /\n')}.`;
}

/**
 * MRSETS 신택스를 생성한다. (복수응답 세트)
 * - checkbox 질문만 해당
 */
export function generateMrsets(questions: Question[]): string {
  const sets: string[] = [];

  for (const q of questions) {
    if (q.type !== 'checkbox' || !q.questionCode || !q.options) continue;

    const vars = q.options.map((_, i) => `${q.questionCode}M${i + 1}`).join(' ');
    sets.push(`  /MCGROUP NAME=$${q.questionCode} LABEL='${esc(q.title)}' VARIABLES=${vars}`);
  }

  if (sets.length === 0) return '';
  return `* 복수응답 세트 정의.\nMRSETS\n${sets.join('\n')}.`;
}

/**
 * 전체 SPSS 신택스 파일(.sps) 내용을 생성한다.
 */
export function generateFullSyntax(questions: Question[]): string {
  const sections = [
    generateVariableLabels(questions),
    generateValueLabels(questions),
    generateVariableLevel(questions),
    generateMrsets(questions),
  ].filter((s) => s.length > 0);

  return sections.join('\n\n') + '\n';
}
