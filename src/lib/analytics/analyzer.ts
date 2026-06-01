// src/lib/analytics/analyzer.ts
import type { SurveyResponse } from '@/db/schema';
import type { Question, QuestionOption, QuestionType, RankingAnswer } from '@/types/survey';
import { resolveChoiceOptions } from '@/utils/choice-source';
import { resolveRankingOptions } from '@/utils/ranking-source';
import { computeNumericStats } from './numeric-stats';
import { RANKING_OTHER_VALUE } from '@/utils/ranking-shared';

import type {
  AnalyticsResult,
  CellAnalyticsRow,
  MultiSelectAnalytics,
  MultipleChoiceAnalytics,
  NoticeAnalytics,
  OptionDistribution,
  RankingAnalytics,
  RankingOptionDistribution,
  RowSummary,
  SingleChoiceAnalytics,
  SurveyAnalytics,
  SurveySummary,
  TableAnalytics,
  TextAnalytics,
  TimelineData,
} from './types';


// ========================
// 유틸리티 함수
// ========================

/**
 * 값을 문자열로 변환 (객체인 경우 내부 텍스트 추출)
 */
/**
 * 값을 문자열로 변환 (객체인 경우 내부 텍스트 추출)
 */
// =================================================================
// [수정 1] Other 포맷팅: 복잡한 기타 응답 객체를 예쁜 문자열로 변환
// =================================================================
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    return value.map(formatValue).join(', ');
  }

  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;

    // ✨ 핵심: '기타' 응답 객체 감지 및 포맷팅
    if (v.hasOther === true) {
      const selected = String(v.selectedValue || '');
      const input = String(v.otherValue || '').trim();
      // 입력값이 있으면 "값 (입력내용)", 없으면 그냥 "값" 반환
      return input ? `${selected} (${input})` : selected;
    }

    // 기존 로직 유지
    if (v.inputValue && typeof v.inputValue === 'string') return v.inputValue;
    if (v.text && typeof v.text === 'string') return v.text;
    if (v.label && typeof v.label === 'string') return v.label;
    if (v.value && (typeof v.value === 'string' || typeof v.value === 'number'))
      return String(v.value);

    // 최후의 수단
    const firstVal = Object.values(v)[0];
    if (firstVal && (typeof firstVal === 'string' || typeof firstVal === 'number'))
      return String(firstVal);

    return JSON.stringify(value);
  }

  return String(value);
}

// ========================
// 질문 타입별 분석 함수
// ========================

/**
 * 질문 타입에 따라 적절한 분석 수행
 */
export function analyzeQuestion(
  question: Question,
  responses: SurveyResponse[],
): AnalyticsResult {
  // 1. 노출된 응답만 필터링 (Impression Logging)
  const exposedResponses = responses.filter((r) => {
    const metadata = r.metadata as { exposedQuestionIds?: string[] } | undefined;
    // 메타데이터가 있고 노출 ID 목록이 있으면 포함 여부 확인
    if (metadata?.exposedQuestionIds) {
      return metadata.exposedQuestionIds.includes(question.id);
    }
    // 레거시 데이터거나 메타데이터가 없으면 노출된 것으로 간주
    return true;
  });

  const questionResponses = exposedResponses.map((r) => ({
    responseId: r.id,
    value: (r.questionResponses as Record<string, unknown>)[question.id],
    submittedAt: r.completedAt,
    metadata: r.metadata, // 테이블 분석 등을 위해 메타데이터 전달
  }));

  // 유효 분모 (노출된 사람 수)
  const totalExposed = exposedResponses.length;

  // 실제 응답 수 (값이 있는 경우)
  const answeredCount = questionResponses.filter(
    (r) => r.value !== undefined && r.value !== null && r.value !== '',
  ).length;

  // 응답률 = 응답 수 / 노출 수
  const responseRate = totalExposed > 0 ? (answeredCount / totalExposed) * 100 : 0;

  // 각 분석 함수에 totalExposed를 전달하여 정확한 퍼센트 계산
  const totalResponses = totalExposed;

  switch (question.type) {
    case 'radio':
    case 'select':
      return analyzeSingleChoice(question, questionResponses, totalResponses, responseRate);

    case 'checkbox':
      return analyzeMultipleChoice(question, questionResponses, totalResponses, responseRate);

    case 'text':
    case 'textarea':
      return analyzeText(question, questionResponses, totalResponses, responseRate);

    case 'table':
      return analyzeTable(question, questionResponses, totalResponses, responseRate);

    case 'multiselect':
      return analyzeMultiSelect(question, questionResponses, totalResponses, responseRate);

    case 'ranking':
      return analyzeRanking(question, questionResponses, totalResponses, responseRate);

    case 'notice':
      return analyzeNotice(question, questionResponses, totalResponses, responseRate);

    default:
      return analyzeText(question, questionResponses, totalResponses, responseRate);
  }
}

/**
 * 단일 선택 분석 (radio, select)
 */
function analyzeSingleChoice(
  question: Question,
  responses: { value: unknown }[],
  totalResponses: number,
  responseRate: number,
): SingleChoiceAnalytics {
  const counts: Record<string, number> = {};

  responses.forEach((r) => {
    const value = formatValue(r.value);
    counts[value] = (counts[value] || 0) + 1;
  });

  const resolvedOptions = resolveChoiceOptions(question);
  const distribution: OptionDistribution[] = resolvedOptions.map((opt) => ({
    label: opt.label,
    value: opt.value,
    count: counts[opt.value] || 0,
    percentage: totalResponses > 0 ? ((counts[opt.value] || 0) / totalResponses) * 100 : 0,
  }));

  // 옵션에 없는 값 (기타 등) 추가
  Object.keys(counts).forEach((value) => {
    if (!distribution.find((d) => d.value === value)) {
      distribution.push({
        label: value,
        value,
        count: counts[value],
        percentage: (counts[value] / totalResponses) * 100,
      });
    }
  });

  return {
    type: 'single',
    questionId: question.id,
    questionTitle: question.title,
    questionType: question.type,
    totalResponses,
    responseRate,
    distribution: distribution.sort((a, b) => b.count - a.count),
  };
}

/**
 * 다중 선택 분석 (checkbox)
 */
function analyzeMultipleChoice(
  question: Question,
  responses: { value: unknown }[],
  totalResponses: number,
  responseRate: number,
): MultipleChoiceAnalytics {
  const counts: Record<string, number> = {};
  let totalSelections = 0;

  responses.forEach((r) => {
    const values = Array.isArray(r.value) ? r.value : [r.value];
    values.forEach((v) => {
      if (v) {
        const value = formatValue(v);
        counts[value] = (counts[value] || 0) + 1;
        totalSelections++;
      }
    });
  });

  const resolvedOptions = resolveChoiceOptions(question);
  const distribution: OptionDistribution[] = resolvedOptions.map((opt) => ({
    label: opt.label,
    value: opt.value,
    count: counts[opt.value] || 0,
    percentage: totalResponses > 0 ? ((counts[opt.value] || 0) / totalResponses) * 100 : 0,
  }));

  // 옵션에 없는 값 추가
  Object.keys(counts).forEach((value) => {
    if (!distribution.find((d) => d.value === value)) {
      distribution.push({
        label: value,
        value,
        count: counts[value],
        percentage: (counts[value] / totalResponses) * 100,
      });
    }
  });

  return {
    type: 'multiple',
    questionId: question.id,
    questionTitle: question.title,
    questionType: question.type,
    totalResponses,
    responseRate,
    avgSelectionsPerResponse: totalResponses > 0 ? totalSelections / totalResponses : 0,
    distribution: distribution.sort((a, b) => b.count - a.count),
  };
}

/**
 * 텍스트 분석 (text, textarea)
 */
function analyzeText(
  question: Question,
  responses: { responseId: string; value: unknown; submittedAt?: Date | null }[],
  totalResponses: number,
  responseRate: number,
): TextAnalytics {
  const textResponses = responses.map((r) => ({
    id: r.responseId,
    value: formatValue(r.value),
    submittedAt: r.submittedAt || undefined,
  }));

  const totalLength = textResponses.reduce((sum, r) => sum + r.value.length, 0);
  const avgLength = totalResponses > 0 ? totalLength / totalResponses : 0;

  // 간단한 단어 빈도 분석 (한글/영문 단어 추출)
  const wordCounts: Record<string, number> = {};
  textResponses.forEach((r) => {
    const words = r.value
      .toLowerCase()
      .split(/[\s,.\-!?;:'"()[\]{}]+/)
      .filter((w) => w.length > 1);

    words.forEach((word) => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
  });

  const wordFrequency = Object.entries(wordCounts)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const numericStats =
    question.inputType === 'number'
      ? computeNumericStats(textResponses.map((r) => r.value))
      : null;

  return {
    type: 'text',
    questionId: question.id,
    questionTitle: question.title,
    questionType: question.type,
    totalResponses,
    responseRate,
    avgLength,
    responses: textResponses,
    wordFrequency,
    numericStats: numericStats ?? undefined,
  };
}

/**
 * 테이블 분석
 */
/**
 * 테이블 분석 (수정된 버전)
 * - 해결 1: 인덱스 밀림 방지 (filter 제거 및 null 매핑)
 * - 해결 2: 분자(Interaction) 산출 시 Ghost Data(숨겨진 행의 잔존 데이터) 무시
 * - 해결 3: 응답자 단위 중복 카운팅 방지 (Cell Loop -> User Loop)
 */
function analyzeTable(
  question: Question,
  responses: { responseId: string; value: unknown; metadata?: unknown }[],
  totalResponses: number,
  responseRate: number,
): TableAnalytics {
  const rows = question.tableRowsData || [];
  const columns = question.tableColumns || [];

  // =================================================================================
  // [준비] 각 열(Column)별로 현재 진행 중인 병합(rowspan) 상태를 추적하는 배열
  // =================================================================================
  // interactionInherited: 현재 병합된 부모 셀이 '상호작용(체크 등)' 상태인지 여부
  // rowsLeft: 앞으로 몇 개의 행이 더 병합되어 있는지
  // details: 선택된 옵션 값 (Radio/Select 등 상세 분석용)
  const columnMergeState = new Array(columns.length).fill(null).map(() => ({
    interactionInherited: false,
    rowsLeft: 0,
    details: {} as Record<string, number>,
  }));

  // =================================================================================
  // 1. 행별 요약 (히트맵용) - 순수 사용자 응답 여부 집계 (병합/상속 로직 포함)
  // =================================================================================
  const rowSummary: RowSummary[] = rows
    .map((row) => {
      // 1-1. 유효 분모 (이 행이 노출된 사람)
      const validRespondents = responses.filter((r) => {
        const meta = r.metadata as { exposedRowIds?: string[] } | undefined;
        // 노출 ID가 있으면 확인, 없으면(구 데이터) 노출된 것으로 간주
        if (meta?.exposedRowIds) {
          return meta.exposedRowIds.includes(row.id);
        }
        return true;
      });

      const validDenominator = validRespondents.length;
      let interactionCount = 0;
      const details: Record<string, number> = {};

      // 1-2. 분자 (유효 분모 중에서, 실제로 값을 입력한 사람 - ROW 단위 유니크)
      // [Ghost Data 제거] 전체 responses가 아니라 validRespondents만 사용
      validRespondents.forEach((r) => {
        const tableValue = r.value as Record<string, unknown>;
        if (!tableValue) return;

        // 이 행의 셀 중 하나라도 유효한 값이 있는지 검사
        let userHasInteraction = false;

        row.cells.forEach((cell) => {
          const val = tableValue[cell.id];
          if (!val) return;

          // 값 유효성 정밀 체크
          if (cell.type === 'checkbox') {
            if (Array.isArray(val) && val.length > 0) userHasInteraction = true;
          } else if (cell.type === 'input') {
            if (String(val).trim().length > 0) userHasInteraction = true;
          } else {
            // radio, select 등
            userHasInteraction = true;

            // 상세 분포 집계 시 포맷팅 적용
            if (cell.type === 'radio' || cell.type === 'select') {
              const label = formatValue(val);
              details[label] = (details[label] || 0) + 1;
            }
          }
        });

        if (userHasInteraction) {
          interactionCount++;
        }
      });

      // 1-3. 병합(Merge) 상속 처리 (낙수 효과)
      row.cells.forEach((cell, colIndex) => {
        if (columnMergeState[colIndex].rowsLeft > 0) {
          if (columnMergeState[colIndex].interactionInherited) {
            // 상속받은 데이터도 details에 합산
            const inherited = columnMergeState[colIndex].details;
            Object.entries(inherited).forEach(([k, v]) => {
              details[k] = (details[k] || 0) + v;
            });
            // 상속받았으면 시각적으로 Interacted 된 것으로 처리될 수 있으나,
            // 논리적 비율 100% 초과 방지를 위해 단순 가산은 주의 필요
          }
          columnMergeState[colIndex].rowsLeft--;
        }

        // 다음 행을 위해 상태 갱신
        if ((cell.rowspan || 1) > 1) {
          columnMergeState[colIndex].rowsLeft = (cell.rowspan || 1) - 1;
          columnMergeState[colIndex].details = details; // (약식: 현재 행 전체 details를 상속 - 셀 단위가 더 정확하나 summary용으로 충분)
          columnMergeState[colIndex].interactionInherited = interactionCount > 0;
        }
      });

      return {
        rowId: row.id,
        rowLabel: row.label,
        totalInteractions: interactionCount,
        // 분모가 0이면 0%, 아니면 100% 넘지 않도록 Cap
        interactionRate:
          validDenominator > 0 ? Math.min((interactionCount / validDenominator) * 100, 100) : 0,
        details: Object.keys(details).length > 0 ? details : undefined,
      };
    })
    .sort((a, b) => b.interactionRate - a.interactionRate);

  // 2. 셀별 상세 분석 - 가로/세로 2D 병합 지원 및 Ghost Data 방지
  // [1] 세로 병합 상태 추적 배열 (셀 분석용)
  const cellMergeState = new Array(columns.length).fill(null).map(() => ({
    rowsLeft: 0,
    inheritedAnalytics: null as any, // 상속받을 데이터
  }));

  const cellAnalytics: CellAnalyticsRow[] = rows.map((row) => {
    // [Ghost Data 방지] 이 행이 노출된 응답자들만 대상으로 셀 통계를 구해야 함
    const validRespondents = responses.filter((r) => {
      const meta = r.metadata as { exposedRowIds?: string[] } | undefined;
      return meta?.exposedRowIds ? meta.exposedRowIds.includes(row.id) : true;
    });
    const rowExposedCount = validRespondents.length;

    // [2] 가로 병합 상태 추적 변수 (행마다 초기화)
    let activeHorizontalAnalytics: any = null;
    let activeHorizontalMergesLeft = 0;

    return {
      rowId: row.id,
      rowLabel: row.label,
      cells: row.cells.map((cell, colIndex) => {
        let currentAnalytics: any = null;
         
        let isInherited = false;

        // ---------------------------------------------------------
        // CASE A: 가로 병합(Colspan) 중인가?
        // ---------------------------------------------------------
        if (activeHorizontalMergesLeft > 0) {
          activeHorizontalMergesLeft--;
          currentAnalytics = {
            ...activeHorizontalAnalytics,
            cellId: cell.id,
            columnLabel: columns[colIndex]?.label || `열 ${colIndex + 1}`,
            cellType: 'merged-horizontal',
          };
          isInherited = true;
        }
        // ---------------------------------------------------------
        // CASE B: 세로 병합(Rowspan) 중인가?
        // ---------------------------------------------------------
        else if (cellMergeState[colIndex].rowsLeft > 0) {
          cellMergeState[colIndex].rowsLeft--;
          currentAnalytics = {
            ...cellMergeState[colIndex].inheritedAnalytics,
            cellId: cell.id,
            columnLabel: columns[colIndex]?.label || `열 ${colIndex + 1}`,
            cellType: 'merged-vertical',
          };
          isInherited = true;
        }
        // ---------------------------------------------------------
        // CASE C: 일반 셀 (데이터 원본)
        // ---------------------------------------------------------
        else {
          if (cell.isHidden) {
            return {
              cellId: cell.id,
              columnLabel: columns[colIndex]?.label || `열 ${colIndex + 1}`,
              cellType: 'merged-hidden',
            } as any;
          }

          // --- 데이터 계산 로직 (validRespondents만 사용) ---
          const analytics: any = {
            cellId: cell.id,
            columnLabel: columns[colIndex]?.label || `열 ${colIndex + 1}`,
            cellType: cell.type,
          };

          if (cell.type === 'checkbox') {
            let checkedCount = 0;
            validRespondents.forEach((r) => {
              const tableValue = r.value as Record<string, unknown>;
              const cellValue = tableValue?.[cell.id];
              if (Array.isArray(cellValue) && cellValue.length > 0) checkedCount++;
            });

            analytics.checkedCount = checkedCount;
            analytics.checkedRate =
              rowExposedCount > 0 ? (checkedCount / rowExposedCount) * 100 : 0;
          } else if (cell.type === 'radio' || cell.type === 'select') {
            const counts: Record<string, number> = {};
            validRespondents.forEach((r) => {
              const tableValue = r.value as Record<string, unknown>;
              const cellValue = tableValue?.[cell.id];
              if (cellValue) {
                const valStr = formatValue(cellValue);
                counts[valStr] = (counts[valStr] || 0) + 1;
              }
            });
            analytics.valueCounts = counts;
          } else if (cell.type === 'input') {
            const textValues: string[] = [];
            validRespondents.forEach((r) => {
              const tableValue = r.value as Record<string, unknown>;
              const cellValue = tableValue?.[cell.id];
              if (cellValue && String(cellValue).trim()) textValues.push(String(cellValue));
            });
            analytics.textResponses = textValues;
          } else if (cell.type === 'ranking') {
            const positions = Math.max(1, cell.rankingConfig?.positions ?? 3);
            const cellValues: unknown[] = validRespondents.map((r) => {
              const tableValue = r.value as Record<string, unknown>;
              return tableValue?.[cell.id];
            });
            const { distribution, maxPossibleScore } = computeRankingDistribution(
              cellValues,
              cell.rankingOptions ?? [],
              positions,
            );
            analytics.rankingPositions = positions;
            analytics.rankingDistribution = distribution;
            analytics.rankingMaxPossibleScore = maxPossibleScore;
          }

          currentAnalytics = analytics;
        }

        // ---------------------------------------------------------
        // [상태 업데이트] 병합 정보 등록
        // ---------------------------------------------------------
        if (currentAnalytics && (cell.colspan || 1) > 1) {
          activeHorizontalMergesLeft = (cell.colspan || 1) - 1;
          activeHorizontalAnalytics = currentAnalytics;
        }
        if (currentAnalytics && (cell.rowspan || 1) > 1) {
          cellMergeState[colIndex].rowsLeft = (cell.rowspan || 1) - 1;
          cellMergeState[colIndex].inheritedAnalytics = currentAnalytics;
        }

        return currentAnalytics;
      }),
    };
  });

  return {
    type: 'table',
    questionId: question.id,
    questionTitle: question.title,
    questionType: question.type,
    totalResponses,
    responseRate,
    cellAnalytics,
    rowSummary,
  };
}

/**
 * 다단계 선택 분석 (multiselect)
 */
function analyzeMultiSelect(
  question: Question,
  responses: { value: unknown }[],
  totalResponses: number,
  responseRate: number,
): MultiSelectAnalytics {
  const levels = question.selectLevels || [];

  const levelAnalytics = levels.map((level) => {
    const counts: Record<string, number> = {};

    responses.forEach((r) => {
      const values = r.value as Record<string, string>;
      const levelValue = values?.[level.id];
      if (levelValue) {
        counts[levelValue] = (counts[levelValue] || 0) + 1;
      }
    });

    const distribution: OptionDistribution[] = level.options.map((opt) => ({
      label: opt.label,
      value: opt.value,
      count: counts[opt.value] || 0,
      percentage: totalResponses > 0 ? ((counts[opt.value] || 0) / totalResponses) * 100 : 0,
    }));

    return {
      levelId: level.id,
      levelLabel: level.label,
      distribution: distribution.sort((a, b) => b.count - a.count),
    };
  });

  return {
    type: 'multiselect',
    questionId: question.id,
    questionTitle: question.title,
    questionType: question.type,
    totalResponses,
    responseRate,
    levelAnalytics,
  };
}

/**
 * 순위형 분석 (ranking)
 * - 가중치 점수: k 순위 = (positions - k + 1) 점
 * - positions=3 이면 1위=3점, 2위=2점, 3위=1점
 * - positions 축소 후 orphan rank(N 초과)는 무시
 * - 삭제된 옵션 value 는 "(삭제된 옵션)" 폴백 라벨
 */
/**
 * ranking 응답 배열(각 응답자 1개 value)을 집계해 순위 분포를 계산한다.
 * Case 1(질문 레벨) / Case 3(테이블 셀) 공통 사용.
 */
export function computeRankingDistribution(
  values: unknown[],
  options: QuestionOption[],
  positions: number,
): {
  distribution: RankingOptionDistribution[];
  answeredCount: number;
  maxPossibleScore: number;
} {
  const N = Math.max(1, positions);
  const totalScores: Record<string, number> = {};
  const rankCounts: Record<string, number[]> = {};
  const rankSums: Record<string, { sum: number; n: number }> = {};
  let answeredCount = 0;

  for (const value of values) {
    if (!Array.isArray(value)) continue;
    let hasValid = false;
    for (const raw of value as unknown[]) {
      if (!raw || typeof raw !== 'object') continue;
      const a = raw as RankingAnswer;
      if (typeof a.rank !== 'number' || typeof a.optionValue !== 'string') continue;
      if (a.rank < 1 || a.rank > N) continue; // positions 축소 후 orphan 무시
      hasValid = true;

      const key = a.optionValue === RANKING_OTHER_VALUE
        ? `${RANKING_OTHER_VALUE}:${(a.otherText ?? '').trim()}`
        : a.optionValue;

      totalScores[key] = (totalScores[key] ?? 0) + (N - a.rank + 1);
      if (!rankCounts[key]) rankCounts[key] = new Array(N).fill(0);
      rankCounts[key][a.rank - 1] += 1;
      const prev = rankSums[key] ?? { sum: 0, n: 0 };
      rankSums[key] = { sum: prev.sum + a.rank, n: prev.n + 1 };
    }
    if (hasValid) answeredCount++;
  }

  const optionMeta = new Map(options.map((o) => [o.value, o.label]));

  const distribution: RankingOptionDistribution[] = Object.keys(totalScores)
    .map((key) => {
      let label: string;
      if (key.startsWith(`${RANKING_OTHER_VALUE}:`)) {
        const text = key.slice(RANKING_OTHER_VALUE.length + 1);
        label = text ? `기타: ${text}` : '기타';
      } else {
        label = optionMeta.get(key) ?? `(삭제된 옵션) ${key}`;
      }
      const sums = rankSums[key];
      return {
        value: key,
        label,
        totalScore: totalScores[key],
        avgRank: sums && sums.n > 0 ? sums.sum / sums.n : undefined,
        rankCounts: rankCounts[key],
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  return {
    distribution,
    answeredCount,
    maxPossibleScore: N * answeredCount,
  };
}

function analyzeRanking(
  question: Question,
  responses: { value: unknown }[],
  totalResponses: number,
  responseRate: number,
): RankingAnalytics {
  const positions = Math.max(1, question.rankingConfig?.positions ?? 3);
  // 수동 옵션 / 자체 tableRowsData 의 ranking_opt 셀을 통합 해결
  const options = resolveRankingOptions(question);
  const { distribution, maxPossibleScore } = computeRankingDistribution(
    responses.map((r) => r.value),
    options,
    positions,
  );

  return {
    type: 'ranking',
    questionId: question.id,
    questionTitle: question.title,
    questionType: question.type,
    totalResponses,
    responseRate,
    positions,
    maxPossibleScore,
    distribution,
  };
}

/**
 * 공지사항 분석 (notice)
 */
function analyzeNotice(
  question: Question,
  responses: { value: unknown }[],
  totalResponses: number,
  responseRate: number,
): NoticeAnalytics {
  const acknowledgedCount = responses.filter(
    (r) => r.value === true || r.value === 'true' || r.value === 1,
  ).length;

  return {
    type: 'notice',
    questionId: question.id,
    questionTitle: question.title,
    questionType: question.type,
    totalResponses,
    responseRate,
    acknowledgedCount,
    acknowledgeRate: totalResponses > 0 ? (acknowledgedCount / totalResponses) * 100 : 0,
  };
}

// ========================
// 전체 설문 분석
// ========================

/**
 * 전체 설문 분석
 */
export function analyzeSurvey(
  survey: { id: string; title: string; questions: Question[] },
  responses: SurveyResponse[],
): SurveyAnalytics {
  const completedResponses = responses.filter((r) => r.isCompleted);

  // 타임라인 계산
  const timelineMap: Record<string, { responses: number; completed: number }> = {};

  responses.forEach((r) => {
    const date = new Date(r.startedAt).toISOString().split('T')[0];
    if (!timelineMap[date]) {
      timelineMap[date] = { responses: 0, completed: 0 };
    }
    timelineMap[date].responses++;
    if (r.isCompleted) {
      timelineMap[date].completed++;
    }
  });

  const timeline: TimelineData[] = Object.entries(timelineMap)
    .map(([date, data]) => ({
      date,
      responses: data.responses,
      completed: data.completed,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 평균 완료 시간
  const completionTimes = completedResponses
    .filter((r) => r.completedAt)
    .map((r) => {
      const start = new Date(r.startedAt).getTime();
      const end = new Date(r.completedAt!).getTime();
      return (end - start) / (1000 * 60);
    });

  const avgCompletionTime =
    completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 0;

  // 오늘/이번 주 응답 수
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const todayResponses = completedResponses.filter(
    (r) => r.completedAt && new Date(r.completedAt) >= todayStart,
  ).length;

  const weekResponses = completedResponses.filter(
    (r) => r.completedAt && new Date(r.completedAt) >= weekStart,
  ).length;

  // 요약
  const summary: SurveySummary = {
    totalResponses: responses.length,
    completedResponses: completedResponses.length,
    completionRate: responses.length > 0 ? (completedResponses.length / responses.length) * 100 : 0,
    avgCompletionTime,
    lastResponseAt: completedResponses[0]?.completedAt || undefined,
    todayResponses,
    weekResponses,
  };

  // 질문별 분석 (notice 제외)
  const questions = survey.questions
    .filter((q) => q.type !== 'notice')
    .map((q) => analyzeQuestion(q, completedResponses));

  return {
    surveyId: survey.id,
    surveyTitle: survey.title,
    summary,
    timeline,
    questions,
  };
}

// ========================
// 유틸리티 함수
// ========================

/**
 * 차트용 색상 배열
 */
export const CHART_COLORS = [
  'blue',
  'cyan',
  'indigo',
  'violet',
  'fuchsia',
  'rose',
  'amber',
  'emerald',
  'teal',
  'sky',
] as const;

/**
 * 퍼센트 포맷터
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * 숫자 포맷터 (천 단위 콤마)
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value);
}

/**
 * 시간 포맷터 (분)
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 1) {
    return `${Math.round(minutes * 60)}초`;
  }
  if (minutes < 60) {
    return `${minutes.toFixed(1)}분`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}시간 ${mins}분`;
}
