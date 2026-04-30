/**
 * 운영 현황 콘솔 — A5 Drop funnel 위젯을 위한 집계.
 *
 * 위젯 정의 (mockup p1 일치):
 *   x축 = 질문 위치 (라벨 멀티라인: 라벨 / page N / 진행률%)
 *   y축 = 해당 질문에서 이탈한 drop 세션 수
 *   정렬 = 질문 위치 ASC (snapshot 순서대로 funnel 형태)
 *   진행률 = (position / totalQuestions) × 100 — "그 질문이 전체 흐름 중 몇 % 위치"
 *
 * 파일 구성:
 *   - 본 파일: 타입 정의 + 순수 변환 함수 `shapeDropFunnel` (서버 의존성 없음 → 단위 테스트 대상)
 *   - `drop-funnel.server.ts`: DB 어댑터 `getDropFunnel`
 *
 * 정책 (plan §5, §9, §10):
 *   - **drop 사례 귀속**: drop 세션의 `response_answers` 중 `created_at` 최댓값의 question_id가
 *     "마지막으로 답한 질문". 이 위치에서 이탈했다고 본다.
 *   - **버전 섞인 집계 (§9)**: 라벨 매핑은 *현재 published version snapshot* 기준.
 *     snapshot.questions 에 없는 question_id (다른 version·삭제된 질문)는 `'(legacy)'` 그룹으로 묶는다.
 *   - **답이 0건인 drop (lastQuestionId=null)**: 귀속할 위치 없음 → `'(legacy)'` 그룹.
 *     (T5에서 첫 응답 시점 INSERT 보장이 들어왔지만 과거 행 대비 방어적으로 처리한다.)
 *   - **exposedQuestionIds 검증 (§10 C-10)**: drop 세션이 `metadata.exposedQuestionIds`를 가지고
 *     있으나 거기에 lastQuestionId가 없다면, 분기 경로상 노출되지 않은 질문에 답이 남아있는 빌더 버그.
 *     해당 drop은 깔때기에서 *완전히 제외* — 어떤 버킷에도 들어가지 않는다.
 *     `exposedQuestionIds`가 null/undefined면 노출 정보가 없는 것이므로 판단 보류 → 정상 귀속.
 *   - **막대 후보 (topN 재정의)**: `dropCount > 0` 인 질문만 후보. ranking 아닌 sequential funnel
 *     이라 dropCount 내림차순 top-N 의미 없음. 대신 "drop이 발생한 모든 위치"를 노출하되,
 *     상위 N개 질문(dropCount 큰 순)을 단독 막대로, 잔여는 `'기타'` 한 막대로 합쳐 폭주 방지.
 *     단독 막대들은 출력 시 position ASC 로 재정렬되어 funnel 모양을 유지.
 *   - **진행률**: `cumulativeProgressPct = (position / totalQuestions) × 100`.
 *     `'기타'`/`'(legacy)'` 막대는 단일 위치가 아니므로 null.
 *
 * Bus factor:
 *   dropCount는 "이 질문에서 이탈한 사람 수"이며, "도달했지만 통과하지 못한 사람 수" 같은
 *   파생 계산을 쓰지 않는다. drops 입력만이 dropCount를 결정한다.
 */

/** 현재 published snapshot의 질문 — 깔때기 라벨 매핑에 사용. */
export interface FunnelQuestion {
  /** question UUID. */
  id: string;
  /** snapshot.questions 배열 내 1-based 인덱스. */
  position: number;
  /** mockup 라벨 (예: 'Q3', 'SQ', 'Q5_1'). question_code → 없으면 `Q{position}` 폴백. */
  label: string;
  /**
   * 그 질문이 속한 최상위 group의 1-based 페이지 번호.
   * - 질문이 속한 group이 없거나(top-level group 미존재) ungrouped면 undefined.
   * - 멀티 페이지 라벨 표시용 ('page 6').
   */
  page?: number;
}

/** 깔때기 한 막대의 결과. */
export interface DropFunnelBar {
  /** 위치 식별자 — 정상이면 question UUID, 아니면 sentinel. */
  questionId: string | 'others' | 'legacy';
  /** 표시용 라벨. */
  label: string;
  /** snapshot 내 1-based 위치. 'others' / 'legacy'는 null. */
  position: number | null;
  /**
   * 1-based 페이지 번호 (top-level group order + 1).
   * - 질문이 ungrouped 이거나 'others'/'legacy' 막대면 null.
   */
  page: number | null;
  /** 이 위치에서 이탈한 drop 세션 수. */
  dropCount: number;
  /**
   * 이 질문이 전체 흐름 중 차지하는 위치(%).
   * - 정상 위치: `(position / totalQuestions) × 100`
   * - questions.length=0: null (이론상 발생 불가, totalDrops=0이면 bars=[])
   * - 'others' / 'legacy': null (단일 위치가 아니므로 정의 불가)
   */
  cumulativeProgressPct: number | null;
}

export interface DropFunnelInput {
  /** snapshot 순서대로 정렬된 질문 목록. */
  questions: FunnelQuestion[];
  /**
   * drop 세션 단위 입력.
   * - lastQuestionId: 마지막으로 답한 질문 (없으면 null).
   * - exposedQuestionIds: metadata에 기록된 노출 질문 목록.
   *   null이면 노출 정보 미상 (필터 미적용), 정의되어 있고 lastQuestionId가 거기 없으면 해당 drop을 *제외*.
   */
  drops: Array<{
    responseId: string;
    lastQuestionId: string | null;
    exposedQuestionIds: string[] | null;
  }>;
  /** 단독 막대로 표시할 상위 N개 (dropCount DESC). 잔여는 '기타' 1개 막대로 합산. 기본 10. */
  topN?: number;
}

export interface DropFunnelOutput {
  /**
   * 막대 배열. 다음 순서로 정렬:
   *   1. 정상 위치 막대 — position ASC (snapshot 순서, sequential funnel 형태).
   *      단독 후보는 dropCount DESC 상위 topN개 + 'others'(잔여 합산).
   *   2. (잔여가 있으면) '기타' 막대 1개 (정상 막대들 뒤).
   *   3. (legacy 매핑된 drop이 있으면) '(legacy)' 막대 1개 (가장 끝).
   */
  bars: DropFunnelBar[];
  /** 깔때기에 반영된 drop 총수 (exposedQuestionIds로 제외된 drop은 제외). */
  totalDrops: number;
}

const DEFAULT_TOP_N = 10;
const OTHERS_LABEL = '기타';
const LEGACY_LABEL = '(legacy)';

/**
 * 입력을 받아 깔때기 막대 배열을 생성한다.
 *
 * 처리 순서:
 *   1. snapshot 질문 id Set 구성 (라벨/페이지/위치 lookup용 Map과 함께).
 *   2. 각 drop을 순회하며 귀속 위치 결정:
 *      a. exposedQuestionIds가 정의되어 있고 lastQuestionId 미포함 → 제외 (continue).
 *      b. lastQuestionId가 null이거나 snapshot에 없으면 legacy 버킷.
 *      c. 그 외에는 dropCounts[lastQuestionId] += 1.
 *   3. 정상 위치 막대 후보 → dropCount DESC 정렬 → 상위 topN개 채택, 잔여는 '기타' 합산.
 *   4. 단독 막대들을 position ASC 로 재정렬 (sequential funnel 형태).
 *   5. position-based 진행률 계산.
 *   6. [정상 막대들(position ASC), 기타?, legacy?] 순으로 출력.
 */
export function shapeDropFunnel(input: DropFunnelInput): DropFunnelOutput {
  const { questions, drops } = input;
  const topN = input.topN ?? DEFAULT_TOP_N;
  const totalQuestions = questions.length;

  // 1) 라벨/페이지/위치 lookup. snapshot 순서를 그대로 보존하기 위해 Map 사용.
  const questionMap = new Map<string, FunnelQuestion>();
  for (const q of questions) {
    questionMap.set(q.id, q);
  }

  // 2) 위치별 dropCount 누적 + legacy/excluded 분류.
  const dropCounts = new Map<string, number>();
  let legacyCount = 0;
  let totalDrops = 0;

  for (const drop of drops) {
    // 2-a) exposure 필터: 정의되어 있고 last가 거기 없으면 *완전히* 제외.
    //      (정의되지 않았다면 노출 정보 미상 → 판단 보류 → 정상 진행)
    if (
      drop.exposedQuestionIds !== null &&
      drop.lastQuestionId !== null &&
      !drop.exposedQuestionIds.includes(drop.lastQuestionId)
    ) {
      continue;
    }

    // 2-b) null 또는 snapshot에 없는 id → legacy.
    if (drop.lastQuestionId === null || !questionMap.has(drop.lastQuestionId)) {
      legacyCount += 1;
      totalDrops += 1;
      continue;
    }

    // 2-c) 정상 귀속.
    dropCounts.set(
      drop.lastQuestionId,
      (dropCounts.get(drop.lastQuestionId) ?? 0) + 1,
    );
    totalDrops += 1;
  }

  // 3) 정상 막대 후보 생성. dropCount > 0 인 질문만 (Map.entries는 그 조건 자동 충족).
  //    단독 막대 후보 선정은 dropCount DESC 기준 상위 topN.
  const candidates = Array.from(dropCounts.entries()).map(([id, count]) => {
    const q = questionMap.get(id);
    // questionMap.has 검증을 통과했으므로 q는 항상 정의됨 — 방어적 폴백.
    if (!q) {
      return { id, count, position: null, label: id, page: null as number | null };
    }
    return {
      id,
      count,
      position: q.position,
      label: q.label,
      page: q.page ?? null,
    };
  });

  // 단독 채택 vs 기타 합산: dropCount DESC 로 잘라낸다.
  const sortedByCount = [...candidates].sort((a, b) => b.count - a.count);
  const topCandidates = sortedByCount.slice(0, topN);
  const restCandidates = sortedByCount.slice(topN);

  // 4) 단독 막대들을 position ASC 로 재정렬 (sequential funnel 형태).
  const topSorted = [...topCandidates].sort((a, b) => {
    const ap = a.position ?? Number.POSITIVE_INFINITY;
    const bp = b.position ?? Number.POSITIVE_INFINITY;
    return ap - bp;
  });

  // 5) position-based 진행률 계산 헬퍼.
  const calcProgress = (position: number | null): number | null => {
    if (position === null) return null;
    if (totalQuestions === 0) return null;
    return (position / totalQuestions) * 100;
  };

  // 6) 출력 구성.
  const bars: DropFunnelBar[] = topSorted.map((c) => ({
    questionId: c.id,
    label: c.label,
    position: c.position,
    page: c.page,
    dropCount: c.count,
    cumulativeProgressPct: calcProgress(c.position),
  }));

  if (restCandidates.length > 0) {
    const othersCount = restCandidates.reduce((acc, c) => acc + c.count, 0);
    bars.push({
      questionId: 'others',
      label: OTHERS_LABEL,
      position: null,
      page: null,
      dropCount: othersCount,
      cumulativeProgressPct: null,
    });
  }

  if (legacyCount > 0) {
    bars.push({
      questionId: 'legacy',
      label: LEGACY_LABEL,
      position: null,
      page: null,
      dropCount: legacyCount,
      cumulativeProgressPct: null,
    });
  }

  return { bars, totalDrops };
}
