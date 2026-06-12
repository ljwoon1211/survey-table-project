import { isQuestionTypeValue } from '@/types/question-types';

import { QuestionVariantSchema } from './schema';
import type { QuestionVariant } from './variants';

/**
 * 질문 읽기 경계 정규화 — 모든 비신뢰 질문 ingestion 의 단일 통로.
 *
 * 대상 경계: DB 행 역직렬화, survey_versions 스냅샷(세대별 키셋 상이 + cross-type
 * 오염 실재 — 2026-06-12 실DB 키셋 audit), saved_questions 보관함, 라이브러리 JSON
 * import, 백업 복원. 기존에 'as unknown as Question' 단언 8곳으로 산재하던 경계
 * 캐스트의 수렴 목적지다.
 *
 * 두 모드 (비파괴 전환 규율):
 * - preserve(기본): 판별자(type)만 검증하고 형태는 그대로 통과시킨다. 기존 단언과
 *   런타임 거동이 동일하며(절대 throw 하지 않음), 알 수 없는 형태만 관측 로그를 남긴다.
 *   strip 활성화 전 관측 기간의 운영 모드.
 * - strict: zod discriminatedUnion parse — cross-type 오염 키를 소거하고 variant
 *   형태를 보증한다. 실패 시 throw. 골든 픽스처 테스트와 후속 strip 전환의 목적지.
 *
 * 주의: preserve 모드 출력을 다시 영속하는 것은 안전하지만(무변형), strict 모드
 * 출력의 재영속은 키 소거가 데이터 손실로 전화될 수 있다 — 전환기에 union 값을
 * 영속 채널에 직접 넣지 않는다(영속은 flat 세계 직행 원칙).
 */

export type NormalizeMode = 'preserve' | 'strict';

export function normalizeQuestion(raw: unknown, mode: NormalizeMode = 'preserve'): QuestionVariant {
  if (mode === 'strict') {
    return QuestionVariantSchema.parse(raw) as QuestionVariant;
  }

  if (!isWellFormedCandidate(raw)) {
    // 거동 보존: 기존 'as unknown as Question' 단언도 이런 데이터를 통과시켰다.
    // 관측만 남기고 그대로 흘린다 — strip 활성화 결정의 입력 데이터.
    console.warn(
      '[question/normalize] 알 수 없는 질문 형태 passthrough:',
      raw && typeof raw === 'object' ? `type=${String((raw as { type?: unknown }).type)}` : typeof raw,
    );
  }

  // 경계 캐스트의 단일 거처 — 이 파일 밖에서 질문 역직렬화 단언을 새로 만들지 않는다.
  return raw as QuestionVariant;
}

export function normalizeQuestions(raw: unknown[], mode: NormalizeMode = 'preserve'): QuestionVariant[] {
  return raw.map((q) => normalizeQuestion(q, mode));
}

function isWellFormedCandidate(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const candidate = raw as { type?: unknown; id?: unknown };
  return (
    typeof candidate.id === 'string'
    && typeof candidate.type === 'string'
    && isQuestionTypeValue(candidate.type)
  );
}
