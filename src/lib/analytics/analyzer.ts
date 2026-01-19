// src/lib/analytics/analyzer.ts
import type { Question, QuestionType } from '@/types/survey';
import type { SurveyResponse } from '@/db/schema';
import type {
  AnalyticsResult,
  SingleChoiceAnalytics,
  MultipleChoiceAnalytics,
  TextAnalytics,
  TableAnalytics,
  MultiSelectAnalytics,
  NoticeAnalytics,
  SurveyAnalytics,
  SurveySummary,
  TimelineData,
  OptionDistribution,
  CellAnalyticsRow,
  RowSummary,
} from './types';

// ========================
// 유틸리티 함수
// ========================

/**
 * 값을 문자열로 변환 (객체인 경우 내부 텍스트 추출)
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    return value.map(formatValue).join(', ');
  }

  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    // '기타' 옵션 입력값 등 구체적인 필드 우선 확인
    if (v.inputValue && typeof v.inputValue === 'string') return v.inputValue;
    if (v.text && typeof v.text === 'string') return v.text;
    if (v.label && typeof v.label === 'string') return v.label;
    if (v.value && (typeof v.value === 'string' || typeof v.value === 'number'))
      return String(v.value);

    // 마땅한 키가 없으면 첫 번째 값을 사용하거나 JSON 문자열로 변환
    const firstVal = Object.values(v)[0];
    if (
      firstVal &&
      (typeof firstVal === 'string' || typeof firstVal === 'number')
    )
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
  responses: SurveyResponse[]
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
    (r) => r.value !== undefined && r.value !== null && r.value !== ''
  ).length;

  // 응답률 = 응답 수 / 노출 수
  const responseRate =
    totalExposed > 0 ? (answeredCount / totalExposed) * 100 : 0;

  // 각 분석 함수에 totalExposed를 전달하여 정확한 퍼센트 계산
  const totalResponses = totalExposed;

  switch (question.type) {
    case 'radio':
    case 'select':
      return analyzeSingleChoice(
        question,
        questionResponses,
        totalResponses,
        responseRate
      );

    case 'checkbox':
      return analyzeMultipleChoice(
        question,
        questionResponses,
        totalResponses,
        responseRate
      );

    case 'text':
    case 'textarea':
      return analyzeText(
        question,
        questionResponses,
        totalResponses,
        responseRate
      );

    case 'table':
      return analyzeTable(
        question,
        questionResponses,
        totalResponses,
        responseRate
      );

    case 'multiselect':
      return analyzeMultiSelect(
        question,
        questionResponses,
        totalResponses,
        responseRate
      );

    case 'notice':
      return analyzeNotice(
        question,
        questionResponses,
        totalResponses,
        responseRate
      );

    default:
      return analyzeText(
        question,
        questionResponses,
        totalResponses,
        responseRate
      );
  }
}

/**
 * 단일 선택 분석 (radio, select)
 */
function analyzeSingleChoice(
  question: Question,
  responses: { value: unknown }[],
  totalResponses: number,
  responseRate: number
): SingleChoiceAnalytics {
  const counts: Record<string, number> = {};

  responses.forEach((r) => {
    const value = formatValue(r.value);
    counts[value] = (counts[value] || 0) + 1;
  });

  const distribution: OptionDistribution[] = (question.options || []).map(
    (opt) => ({
      label: opt.label,
      value: opt.value,
      count: counts[opt.value] || 0,
      percentage:
        totalResponses > 0
          ? ((counts[opt.value] || 0) / totalResponses) * 100
          : 0,
    })
  );

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
  responseRate: number
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

  const distribution: OptionDistribution[] = (question.options || []).map(
    (opt) => ({
      label: opt.label,
      value: opt.value,
      count: counts[opt.value] || 0,
      percentage:
        totalResponses > 0
          ? ((counts[opt.value] || 0) / totalResponses) * 100
          : 0,
    })
  );

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
    avgSelectionsPerResponse:
      totalResponses > 0 ? totalSelections / totalResponses : 0,
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
  responseRate: number
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
  };
}

/**
 * 테이블 분석
 */
/**
 * 테이블 분석 (수정된 버전)
 * - 해결 1: 인덱스 밀림 방지 (filter 제거 및 null 매핑)
 * - 해결 2: 병합된 셀(rowspan)의 통계 데이터를 하위 행으로 상속 (낙수 효과 적용)
 */
function analyzeTable(
  question: Question,
  responses: { responseId: string; value: unknown; metadata?: unknown }[],
  totalResponses: number,
  responseRate: number
): TableAnalytics {
  const rows = question.tableRowsData || [];
  const columns = question.tableColumns || [];

  // =================================================================================
  // [해결 2]를 위한 준비: 각 열(Column)별로 현재 진행 중인 병합(rowspan) 상태를 추적하는 배열
  // =================================================================================
  // interactionInherited: 현재 병합된 부모 셀이 '상호작용(체크 등)' 상태인지 여부
  // rowsLeft: 앞으로 몇 개의 행이 더 병합되어 있는지
  // details: 선택된 옵션 값 (Radio/Select 등 상세 분석용)
  const columnMergeState = new Array(columns.length).fill(null).map(() => ({
    interactionInherited: false,
    rowsLeft: 0,
    details: {} as Record<string, number>,
  }));

  // 1. 행별 요약 (히트맵용) - 상속 로직 적용
  const rowSummary: RowSummary[] = rows.map((row) => {
    let interactions = 0;
    const details: Record<string, number> = {};

    // 각 셀(열)을 순회하며 통계 계산
    row.cells.forEach((cell, colIndex) => {
      // A. 현재 이 열이 상위 행에서 병합되어 내려오는 중인가?
      if (columnMergeState[colIndex].rowsLeft > 0) {
        // [핵심 로직] 병합된 상태라면, 부모의 상호작용 여부를 그대로 물려받음
        if (columnMergeState[colIndex].interactionInherited) {
          interactions++; // 나도 체크된 것으로 간주!

          // 상세 정보(옵션값)도 합침
          const inheritedDetails = columnMergeState[colIndex].details;
          Object.entries(inheritedDetails).forEach(([key, val]) => {
            details[key] = (details[key] || 0) + val;
          });
        }
        // 남은 병합 카운트 감소
        columnMergeState[colIndex].rowsLeft--;
        return; // 이 셀 처리는 끝 (아래 로직 건너뜀)
      }

      // B. 일반 셀(병합 시작점 포함) 처리
      let hasInteraction = false;
      const currentCellDetails: Record<string, number> = {};

      responses.forEach((r) => {
        const tableValue = r.value as Record<string, unknown>;
        const cellValue = tableValue?.[cell.id];

        if (cell.type === 'checkbox') {
          if (Array.isArray(cellValue) && cellValue.length > 0) {
            hasInteraction = true;
          }
        } else if ((cell.type === 'radio' || cell.type === 'select') && cellValue) {
          hasInteraction = true;
          // 옵션 라벨 찾기
          let optionLabel = String(cellValue);
          const options = cell.radioOptions || cell.selectOptions;
          if (options) {
            const found = options.find(o => o.id === cellValue || o.value === cellValue);
            if (found) optionLabel = found.label;
          }
          currentCellDetails[optionLabel] = (currentCellDetails[optionLabel] || 0) + 1;
        } else if (cell.type === 'input' && cellValue && String(cellValue).trim().length > 0) {
          hasInteraction = true;
        }
      });

      if (hasInteraction) {
        interactions++;
        Object.entries(currentCellDetails).forEach(([key, val]) => {
          details[key] = (details[key] || 0) + val;
        });
      }

      // C. 새로운 병합(rowspan > 1)이 시작되는지 확인하여 상태 저장
      if ((cell.rowspan || 1) > 1) {
        columnMergeState[colIndex].rowsLeft = (cell.rowspan || 1) - 1;
        columnMergeState[colIndex].interactionInherited = hasInteraction;
        columnMergeState[colIndex].details = currentCellDetails;
      }
    });

    // [Impression Logging] 이 행이 노출된 응답 수 계산
    const rowExposedCount = responses.filter((r) => {
      const meta = r.metadata as { exposedRowIds?: string[] } | undefined;
      // 노출 행 ID 목록이 있으면 확인, 없으면(레거시) 전체 노출로 간주
      if (meta?.exposedRowIds) {
        return meta.exposedRowIds.includes(row.id);
      }
      return true;
    }).length;

    return {
      rowId: row.id,
      rowLabel: row.label,
      totalInteractions: interactions,
      interactionRate:
        rowExposedCount > 0 ? (interactions / rowExposedCount) * 100 : 0,
      details: Object.keys(details).length > 0 ? details : undefined,
    };
  }).sort((a, b) => b.interactionRate - a.interactionRate);


  // 2. 셀별 상세 분석 - [해결 1] 인덱스 밀림 방지 + [해결 3] 가로/세로 2D 병합 완벽 지원
  // [1] 세로 병합 상태 추적 배열 (셀 분석용 별도 상태)
  const cellMergeState = new Array(columns.length).fill(null).map(() => ({
    rowsLeft: 0,
    inheritedAnalytics: null as any, // 상속받을 데이터
  }));

  const cellAnalytics: CellAnalyticsRow[] = rows.map((row) => {
    // [2] 가로 병합 상태 추적 변수 (행마다 초기화)
    let activeHorizontalAnalytics: any = null;
    let activeHorizontalMergesLeft = 0;

    return {
      rowId: row.id,
      rowLabel: row.label,
      cells: row.cells.map((cell, colIndex) => {
        let currentAnalytics: any = null;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        let isInherited = false;

        // ---------------------------------------------------------
        // CASE A: 가로 병합(Colspan) 중인가? (가장 우선순위 높음)
        // ---------------------------------------------------------
        if (activeHorizontalMergesLeft > 0) {
          activeHorizontalMergesLeft--;

          // 왼쪽 부모의 데이터를 그대로 복사
          currentAnalytics = {
            ...activeHorizontalAnalytics,
            cellId: cell.id,
            columnLabel: columns[colIndex]?.label || `열 ${colIndex + 1}`,
            cellType: 'merged-horizontal', // 가로 병합됨 표시
          };
          isInherited = true;
        }

        // ---------------------------------------------------------
        // CASE B: 세로 병합(Rowspan) 중인가? 
        // ---------------------------------------------------------
        else if (cellMergeState[colIndex].rowsLeft > 0) {
          cellMergeState[colIndex].rowsLeft--;

          // 위쪽 부모의 데이터를 그대로 복사
          currentAnalytics = {
            ...cellMergeState[colIndex].inheritedAnalytics,
            cellId: cell.id,
            columnLabel: columns[colIndex]?.label || `열 ${colIndex + 1}`,
            cellType: 'merged-vertical', // 세로 병합됨 표시
          };
          isInherited = true;
        }

        // ---------------------------------------------------------
        // CASE C: 일반 셀 (데이터 원본)
        // ---------------------------------------------------------
        else {
          // 숨겨진 셀인데 상속받은 것도 없다면 -> 진짜 숨겨진 셀 (혹은 로직 에러 방어)
          if (cell.isHidden) {
            return {
              cellId: cell.id,
              columnLabel: columns[colIndex]?.label || `열 ${colIndex + 1}`,
              cellType: 'merged-hidden',
            } as any;
          }

          // --- 데이터 계산 로직 ---
          const analytics: any = {
            cellId: cell.id,
            columnLabel: columns[colIndex]?.label || `열 ${colIndex + 1}`,
            cellType: cell.type,
          };

          if (cell.type === 'checkbox') {
            let checkedCount = 0;
            responses.forEach((r) => {
              const tableValue = r.value as Record<string, unknown>;
              const cellValue = tableValue?.[cell.id];
              if (Array.isArray(cellValue) && cellValue.length > 0) checkedCount++;
            });
            // [Impression Logging] 이 행의 노출 기준 적용
            const rowExposedCount = responses.filter((r) => {
              const meta = r.metadata as { exposedRowIds?: string[] } | undefined;
              if (meta?.exposedRowIds) {
                return meta.exposedRowIds.includes(row.id);
              }
              return true;
            }).length;

            analytics.checkedCount = checkedCount;
            analytics.checkedRate =
              rowExposedCount > 0 ? (checkedCount / rowExposedCount) * 100 : 0;
          } else if (cell.type === 'radio' || cell.type === 'select') {
            const counts: Record<string, number> = {};
            responses.forEach((r) => {
              const tableValue = r.value as Record<string, unknown>;
              const cellValue = tableValue?.[cell.id];
              if (cellValue) {
                const valStr = String(cellValue);
                counts[valStr] = (counts[valStr] || 0) + 1;
              }
            });
            analytics.valueCounts = counts;
          } else if (cell.type === 'input') {
            const textValues: string[] = [];
            responses.forEach((r) => {
              const tableValue = r.value as Record<string, unknown>;
              const cellValue = tableValue?.[cell.id];
              if (cellValue && String(cellValue).trim()) textValues.push(String(cellValue));
            });
            analytics.textResponses = textValues;
          }

          currentAnalytics = analytics;
        }

        // ---------------------------------------------------------
        // [상태 업데이트] 다음 셀/행을 위해 병합 정보 등록
        // ---------------------------------------------------------

        // 1. 가로 병합 시작 등록 (Colspan > 1)
        // 주의: 상속받은 데이터(isInherited)도 또다시 가로로 퍼뜨릴 수 있음 (2x2 병합의 경우)
        // 따라서 currentAnalytics가 존재하면 무조건 체크
        if (currentAnalytics && (cell.colspan || 1) > 1) {
          // 현재 셀이 가로 병합의 '시작점'이 됨
          activeHorizontalMergesLeft = (cell.colspan || 1) - 1;
          // 복사할 원본 데이터 저장
          activeHorizontalAnalytics = currentAnalytics;
        }

        // 2. 세로 병합 시작 등록 (Rowspan > 1)
        if (currentAnalytics && (cell.rowspan || 1) > 1) {
          // 현재 셀이 세로 병합의 '시작점'이 됨
          // 주의: 가로 병합 중인 셀도 세로 병합을 시작할 수 있음 (Rowspan은 모든 열에 적용됨)
          // 하지만 여기서는 '현재 열(colIndex)'에 대한 세로 병합만 설정하면 됨.
          // (가로로 퍼진 셀들은 각자의 colIndex 루프에서 이 블록을 만나 설정됨)
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
  responseRate: number
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
      percentage:
        totalResponses > 0
          ? ((counts[opt.value] || 0) / totalResponses) * 100
          : 0,
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
 * 공지사항 분석 (notice)
 */
function analyzeNotice(
  question: Question,
  responses: { value: unknown }[],
  totalResponses: number,
  responseRate: number
): NoticeAnalytics {
  const acknowledgedCount = responses.filter(
    (r) => r.value === true || r.value === 'true' || r.value === 1
  ).length;

  return {
    type: 'notice',
    questionId: question.id,
    questionTitle: question.title,
    questionType: question.type,
    totalResponses,
    responseRate,
    acknowledgedCount,
    acknowledgeRate:
      totalResponses > 0 ? (acknowledgedCount / totalResponses) * 100 : 0,
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
  responses: SurveyResponse[]
): SurveyAnalytics {
  const completedResponses = responses.filter((r) => r.isCompleted);

  // 타임라인 계산
  const timelineMap: Record<string, { responses: number; completed: number }> =
    {};

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
    (r) => r.completedAt && new Date(r.completedAt) >= todayStart
  ).length;

  const weekResponses = completedResponses.filter(
    (r) => r.completedAt && new Date(r.completedAt) >= weekStart
  ).length;

  // 요약
  const summary: SurveySummary = {
    totalResponses: responses.length,
    completedResponses: completedResponses.length,
    completionRate:
      responses.length > 0
        ? (completedResponses.length / responses.length) * 100
        : 0,
    avgCompletionTime,
    lastResponseAt: completedResponses[0]?.completedAt || undefined,
    todayResponses,
    weekResponses,
  };

  // 질문별 분석 (notice 제외, 단 requiresAcknowledgment인 경우 포함)
  const questions = survey.questions
    .filter((q) => q.type !== 'notice' || q.requiresAcknowledgment)
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
