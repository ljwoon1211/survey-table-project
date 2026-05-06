/**
 * 컨택 도메인의 클라/서버 공용 helper.
 *
 * - 컬럼 스킴 → 시스템 필드 attrs key 추출 (page.tsx 3곳에서 동일하게 쓰던 휴리스틱)
 * - 결과코드 tone → CSS class 매핑 (회차 이력 표시용)
 * - 공유 DateTimeFormat 인스턴스 (불필요한 중복 인스턴스화 방지)
 *
 * pure module — DB / 'server-only' import 없음.
 */

import { attrsKeyOf } from './contacts';
import type { ContactColumnScheme, ContactResultCode } from '@/db/schema/schema-types';

// ─────────────────────────────────────────────────────────────────────────────
// 시스템 필드 추출
// ─────────────────────────────────────────────────────────────────────────────

export interface SystemFieldKeys {
  group?: string;
  email?: string;
  biz?: string;
}

/**
 * 컬럼 스킴에서 시스템 필드 (group/email/biz) 의 attrs key 추출.
 * 휴리스틱: key 가 한국어 표준 명칭이면 그것으로 매핑.
 *
 * 정확한 매핑은 contact_uploads.mapping.systemFields 인덱스 별도 조회 필요하지만
 * 본 슬라이스는 단순 휴리스틱으로 충분 (한국어 헤더 자동 감지와 동일 룰).
 */
export function extractSystemFieldKeys(scheme: ContactColumnScheme): SystemFieldKeys {
  const result: SystemFieldKeys = {};
  for (const c of scheme.columns) {
    const k = attrsKeyOf(c.source);
    if (!k) continue;
    if (!result.group && (k.includes('전시회') || k.includes('캠페인'))) result.group = k;
    if (
      !result.email &&
      (k === '이메일' || k.includes('이메일') || k.toLowerCase().includes('email'))
    ) {
      result.email = k;
    }
    if (!result.biz && k.includes('사업자')) result.biz = k;
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과코드 tone → CSS
// ─────────────────────────────────────────────────────────────────────────────

export const RESULT_CODE_TONE_CLASS: Record<NonNullable<ContactResultCode['tone']>, string> = {
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  rose: 'bg-rose-100 text-rose-700',
  blue: 'bg-blue-100 text-blue-700',
  slate: 'bg-slate-100 text-slate-700',
};

/** tone 이 화이트리스트 외 값이면 slate fallback. */
export function resultCodeToneClass(tone: ContactResultCode['tone']): string {
  return RESULT_CODE_TONE_CLASS[tone ?? 'slate'] ?? RESULT_CODE_TONE_CLASS.slate;
}

// ─────────────────────────────────────────────────────────────────────────────
// 공유 DateTimeFormat 인스턴스 — 컴포넌트마다 new 하지 않음
// ─────────────────────────────────────────────────────────────────────────────

/** 'MM-DD HH:mm' (월일 + 시각). 컨택리스트 표 / 회차 이력 등 짧은 표시. */
export const SHORT_DATE_FMT = new Intl.DateTimeFormat('ko-KR', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** 'YYYY-MM-DD HH:mm' (연도 포함). 업로드 이력 / 응답 시각 등. */
export const FULL_DATE_FMT = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
