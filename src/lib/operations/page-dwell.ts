/**
 * 운영 현황 콘솔 — A6 페이지별 체류시간 분포 위젯을 위한 집계.
 *
 * 위젯 정의 (plan §5):
 *   x축 = 페이지(RenderStep) 라벨, snapshot 기반 캐노니컬 순서.
 *   y축 = 평균 체류시간(초). ErrorBar = ± SD.
 *   상하 2.5% 트리밍.
 *
 * 파일 구성:
 *   - 본 파일: 타입 정의 + 순수 변환 함수 (`trimmedStats`, `shapePageDwell`)
 *     서버 의존성 없음 → 단위 테스트 대상.
 *   - `page-dwell.server.ts`: DB 어댑터 `getPageDwell`.
 *
 * 정책 (plan §5, §10):
 *   - **stepId 컨벤션** (응답 페이지 `stepIdOf`와 일치):
 *     - table step: `'table:' + question.id`
 *     - group step: `'group:' + (rootGroupId ?? 'root')`
 *     ungrouped 영역(들)은 모두 'group:root' 하나로 합쳐진다.
 *   - **캐노니컬 순서**: snapshot의 최상위 그룹을 order 순으로 + ungrouped 마지막,
 *     테이블 질문은 단독 step으로 분리. `buildRenderSteps`와 동일한 알고리즘이지만
 *     `Question[]` 타입 변환 비용을 피하기 위해 본 파일 안에서 최소 형태로 재구현한다.
 *   - **체류시간 산출**: 각 PageVisit의 `(leftAt - enteredAt) / 1000`.
 *     - leftAt 미정의 / leftAt ≤ enteredAt → skip.
 *     - 비유한 값은 사전 필터.
 *   - **트리밍**: 양 끝에서 floor(n × trim) 개씩 제거 후 평균/SD 계산.
 *     n < 40 (trim=0.025 기준) 이면 floor=0이라 제거 없음.
 *   - **SD 정의**: 표본 SD (n-1 분모). n < 2 → SD = null.
 *   - **n=0 step**: snapshot 순서를 보존하기 위해 `pages`에 포함. 모든 통계 null.
 *   - 결과 정렬은 캐노니컬 순서 (mean 정렬 X) — 차트 x축 구조 보존.
 */

import type {
  PageVisit,
  QuestionData,
  QuestionGroupData,
  SurveyVersionSnapshot,
} from '@/db/schema/schema-types';

/** 한 페이지(RenderStep)의 체류시간 통계. */
export interface DwellPage {
  /** stepId — 'group:<rootGroupId | "root">' 또는 'table:<questionId>'. */
  stepId: string;
  /** 차트 라벨. group: '페이지 N: <name>' / table: '<questionCode>' or 'QN (table)'. */
  label: string;
  /** 캐노니컬 순서 내 1-based 위치. */
  position: number;
  /** 트리밍 적용 후 표본 수. */
  n: number;
  /** 평균 체류시간(초). n=0 → null. */
  meanSeconds: number | null;
  /** 표본 표준편차(초). n < 2 → null. */
  sdSeconds: number | null;
}

export interface DwellInput {
  /** 행마다 한 응답의 pageVisits. (status='completed'|'drop'만 받는 것을 권장) */
  responses: Array<{ pageVisits: PageVisit[] | null }>;
  /** 현재 published version snapshot — 캐노니컬 step 순서의 출처. */
  snapshot: SurveyVersionSnapshot;
  /** 트리밍 비율 (양쪽). 기본 0.025 (response-time과 동일). */
  trim?: number;
}

export interface DwellOutput {
  pages: DwellPage[];
}

/** 기본 트리밍 비율 — response-time.ts와 동일. */
const DEFAULT_TRIM = 0.025;

/** trimmed 평균 + SD를 한 번에 계산한다 (원본 배열 미변형). */
export function trimmedStats(
  values: number[],
  trim: number,
): { n: number; mean: number | null; sd: number | null } {
  // 비유한 값 제거.
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return { n: 0, mean: null, sd: null };

  const sorted = [...finite].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * trim);
  const sliced = sorted.slice(trimCount, sorted.length - trimCount);
  // 방어적: trim < 0.5 인 한 sliced.length > 0.
  if (sliced.length === 0) return { n: 0, mean: null, sd: null };

  const n = sliced.length;
  const sum = sliced.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;

  // 표본 SD (n-1 분모). n < 2면 정의 불가.
  if (n < 2) {
    return { n, mean, sd: null };
  }
  let sqSum = 0;
  for (const v of sliced) {
    const d = v - mean;
    sqSum += d * d;
  }
  const sd = Math.sqrt(sqSum / (n - 1));
  return { n, mean, sd };
}

/** 캐노니컬 순서로 정렬된 step 식별자 + 라벨. */
interface CanonicalStep {
  stepId: string;
  label: string;
  position: number;
}

/**
 * snapshot에서 캐노니컬 RenderStep 순서를 추출한다.
 *
 * 알고리즘 (group-ordering.ts의 `buildRenderSteps`와 동일):
 *   1. 최상위 그룹(parentGroupId 없음)을 order 순으로 순회.
 *   2. 각 최상위 그룹의 직간접 자식 질문을 인터리브 평탄화.
 *      그룹 step은 stepId='group:'+rootId 단 하나, 테이블 질문은 단독 'table:'+qid step.
 *   3. ungrouped 질문(groupId 없음)도 동일하게 — stepId='group:root' 단 하나.
 *
 * 라벨 규칙:
 *   - group step: '페이지 N: <name>' (이름이 비어있으면 '페이지 N')
 *   - table step: questionCode (있으면) 그대로 + '(table)' / 없으면 'Q<position>(table)'
 *
 * Edge:
 *   - 그룹/질문 0건 → [] 반환.
 *   - 모든 질문이 ungrouped → 단일 'group:root' step + table들.
 *   - 어떤 그룹/하위그룹이 비어있어도 (자식이 모두 다른 곳에 있어도) group step은 만들지 않는다.
 */
function buildCanonicalSteps(snapshot: SurveyVersionSnapshot): CanonicalStep[] {
  const groups: QuestionGroupData[] = Array.isArray(snapshot.groups)
    ? snapshot.groups
    : [];
  const questions: QuestionData[] = Array.isArray(snapshot.questions)
    ? snapshot.questions
    : [];

  // 캐노니컬 순서의 표시 위치를 1부터 부여.
  const steps: CanonicalStep[] = [];
  let position = 0;

  /** snapshot 내에서 이 질문의 1-based 인덱스 (questionCode 폴백용). */
  const questionPosition = new Map<string, number>();
  questions.forEach((q, idx) => {
    questionPosition.set(q.id, idx + 1);
  });

  /**
   * 지정 그룹의 인터리브 자식 (질문 + 직속 하위그룹)을 order 순으로 반환.
   * `getInterleavedChildren`의 단순화 버전 — 본 함수는 질문/테이블만 모아주면 충분.
   *
   * 반환은 평탄화된 질문 배열 (하위그룹은 재귀로 풀어 같은 배열에 끼워넣음).
   */
  const flattenScope = (rootGroupId: string | null): QuestionData[] => {
    const out: QuestionData[] = [];

    const walk = (groupId: string | null) => {
      // 직속 질문 + 직속 하위그룹.
      const directQs = questions
        .filter((q) =>
          groupId === null ? !q.groupId : q.groupId === groupId,
        )
        .sort((a, b) => a.order - b.order);
      const directSGs =
        groupId === null
          ? []
          : groups
              .filter((g) => g.parentGroupId === groupId)
              .sort((a, b) => a.order - b.order);

      if (directSGs.length === 0) {
        out.push(...directQs);
        return;
      }

      // 인터리브: subgroup을 order 슬롯에 우선 배치, 나머지를 질문이 채움.
      const totalSize = directQs.length + directSGs.length;
      const slots: Array<{ kind: 'q'; data: QuestionData } | { kind: 'g'; data: QuestionGroupData } | null> = new Array(
        totalSize,
      ).fill(null);
      const used = new Set<number>();
      for (const sg of directSGs) {
        const pos = Math.max(0, Math.min(sg.order, totalSize - 1));
        let slot = pos;
        while (used.has(slot) && slot < totalSize) slot++;
        if (slot >= totalSize) {
          slot = 0;
          while (used.has(slot) && slot < totalSize) slot++;
        }
        if (slot < totalSize) {
          used.add(slot);
          slots[slot] = { kind: 'g', data: sg };
        }
      }
      let qIdx = 0;
      for (let i = 0; i < totalSize; i++) {
        if (slots[i] === null && qIdx < directQs.length) {
          slots[i] = { kind: 'q', data: directQs[qIdx] };
          qIdx++;
        }
      }

      for (const slot of slots) {
        if (!slot) continue;
        if (slot.kind === 'q') {
          out.push(slot.data);
        } else {
          walk(slot.data.id);
        }
      }
    };

    if (rootGroupId === null) {
      // ungrouped 영역: 그룹 없는 질문만 order 순.
      out.push(
        ...questions.filter((q) => !q.groupId).sort((a, b) => a.order - b.order),
      );
    } else {
      walk(rootGroupId);
    }
    return out;
  };

  /** flatten된 질문 목록을 group step + table step으로 분리해 push. */
  const splitByTable = (
    items: QuestionData[],
    rootGroupId: string | null,
    rootGroupName: string | null,
  ): void => {
    let nonTableBuffer: QuestionData[] = [];
    const flush = () => {
      if (nonTableBuffer.length === 0) return;
      position += 1;
      const stepId = `group:${rootGroupId ?? 'root'}`;
      const label = rootGroupName
        ? `페이지 ${position}: ${rootGroupName}`
        : `페이지 ${position}`;
      steps.push({ stepId, label, position });
      nonTableBuffer = [];
    };

    for (const q of items) {
      if (q.type === 'table') {
        flush();
        position += 1;
        const code = (q as { questionCode?: string | null }).questionCode;
        const baseLabel =
          typeof code === 'string' && code.length > 0
            ? code
            : `Q${questionPosition.get(q.id) ?? position}`;
        steps.push({
          stepId: `table:${q.id}`,
          label: `${baseLabel} (table)`,
          position,
        });
      } else {
        nonTableBuffer.push(q);
      }
    }
    flush();
  };

  // 1) 최상위 그룹 순회.
  const topLevel = groups
    .filter((g) => !g.parentGroupId)
    .sort((a, b) => a.order - b.order);
  for (const root of topLevel) {
    const items = flattenScope(root.id);
    if (items.length === 0) continue;
    splitByTable(items, root.id, root.name ?? null);
  }

  // 2) ungrouped 영역.
  const ungrouped = flattenScope(null);
  if (ungrouped.length > 0) {
    splitByTable(ungrouped, null, null);
  }

  return steps;
}

/**
 * 응답들의 pageVisits를 받아 페이지별 체류시간 분포를 계산한다.
 *
 * 절차:
 *   1. snapshot에서 캐노니컬 step 순서 빌드.
 *   2. 각 응답의 pageVisits를 순회하며 stepId별 체류시간(초) 집계.
 *      - leftAt 누락 / 잘못된 순서 / 비유한 값 → skip.
 *   3. 캐노니컬 순서대로 각 step에 대해 trimmedStats로 통계 산출.
 *      - n=0 step도 출력에 포함 (모든 stat null).
 */
export function shapePageDwell(input: DwellInput): DwellOutput {
  const trim = input.trim ?? DEFAULT_TRIM;
  const steps = buildCanonicalSteps(input.snapshot);
  if (steps.length === 0) return { pages: [] };

  // stepId → 체류시간(초) 배열.
  const buckets = new Map<string, number[]>();
  for (const step of steps) {
    buckets.set(step.stepId, []);
  }

  for (const resp of input.responses) {
    const visits = resp.pageVisits;
    if (!Array.isArray(visits) || visits.length === 0) continue;
    for (const visit of visits) {
      if (!visit || typeof visit.stepId !== 'string') continue;
      // snapshot에 없는 step은 무시 (legacy/version mismatch).
      const bucket = buckets.get(visit.stepId);
      if (!bucket) continue;
      // leftAt 누락 → 미완료 visit, skip.
      if (typeof visit.leftAt !== 'string' || !visit.leftAt) continue;
      const enteredMs = Date.parse(visit.enteredAt);
      const leftMs = Date.parse(visit.leftAt);
      if (!Number.isFinite(enteredMs) || !Number.isFinite(leftMs)) continue;
      // 방어적: leftAt이 enteredAt보다 빠르면 skip.
      if (leftMs <= enteredMs) continue;
      bucket.push((leftMs - enteredMs) / 1000);
    }
  }

  const pages: DwellPage[] = steps.map((step) => {
    const values = buckets.get(step.stepId) ?? [];
    const stats = trimmedStats(values, trim);
    return {
      stepId: step.stepId,
      label: step.label,
      position: step.position,
      n: stats.n,
      meanSeconds: stats.mean,
      sdSeconds: stats.sd,
    };
  });

  return { pages };
}
