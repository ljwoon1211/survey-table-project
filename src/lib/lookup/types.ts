import type { SurveyLookup } from '@/types/survey';

export type ContactAttrs = Record<string, string | undefined>;

export type LookupEvalCtx = {
  // 응답 데이터: questionId → cellId → string value
  responses: Record<string, Record<string, string | undefined>>;
  // 현재 응답자 컨택 attrs (없으면 빈 객체)
  contactAttrs: ContactAttrs;
  // snapshot 의 LUT 목록 (id 로 조회)
  lookups: SurveyLookup[];
};

// fail-safe 사유는 빌더 테스트 모드에서만 사용
export type FailReason =
  | 'attrs-key-missing'         // attrs 에 매핑된 키가 없음
  | 'lookup-not-found'          // surveyLookupId 가 lookups 에 없음
  | 'lookup-row-not-matched'    // keys 로 행을 못 찾음
  | 'lookup-value-missing'      // 매칭된 행에 valueColumn 키 없음
  | 'cell-value-missing'        // 좌변 셀 응답 없음
  | 'cell-value-not-number'     // 좌변 셀 응답이 숫자 파싱 실패
  | 'divide-by-zero';           // binop 우측 0 (op==='/')

export type EvalResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: FailReason };
