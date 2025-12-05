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
// 질문 타입별 분석 함수
// ========================

/**
 * 질문 타입에 따라 적절한 분석 수행
 */
export function analyzeQuestion(
  question: Question,
  responses: SurveyResponse[]
): AnalyticsResult {
  const questionResponses = responses
    .map((r) => ({
      responseId: r.id,
      value: (r.questionResponses as Record<string, unknown>)[question.id],
      submittedAt: r.completedAt,
    }))
    .filter((r) => r.value !== undefined && r.value !== null && r.value !== '');

  const totalResponses = questionResponses.length;
  const responseRate =
    responses.length > 0 ? (totalResponses / responses.length) * 100 : 0;

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
    const value = String(r.value);
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
        const value = String(v);
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
    value: String(r.value),
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
function analyzeTable(
  question: Question,
  responses: { responseId: string; value: unknown }[],
  totalResponses: number,
  responseRate: number
): TableAnalytics {
  const rows = question.tableRowsData || [];
  const columns = question.tableColumns || [];

  // 셀별 분석 데이터
  const cellAnalytics: CellAnalyticsRow[] = rows
    .filter((row) => !row.cells.some((cell) => cell.isHidden))
    .map((row) => ({
      rowId: row.id,
      rowLabel: row.label,
      cells: row.cells
        .filter((cell) => !cell.isHidden)
        .map((cell, colIndex) => {
          const analytics: CellAnalyticsRow['cells'][0] = {
            cellId: cell.id,
            columnLabel: columns[colIndex]?.label || `열 ${colIndex + 1}`,
            cellType: cell.type as CellAnalyticsRow['cells'][0]['cellType'],
          };

          if (cell.type === 'checkbox') {
            let checkedCount = 0;
            responses.forEach((r) => {
              const tableValue = r.value as Record<string, unknown>;
              const cellValue = tableValue?.[cell.id];
              if (Array.isArray(cellValue) && cellValue.length > 0) {
                checkedCount++;
              }
            });
            analytics.checkedCount = checkedCount;
            analytics.checkedRate =
              totalResponses > 0 ? (checkedCount / totalResponses) * 100 : 0;
          } else if (cell.type === 'radio' && cell.radioOptions) {
            const optionCounts: Record<string, number> = {};
            responses.forEach((r) => {
              const tableValue = r.value as Record<string, unknown>;
              const cellValue = tableValue?.[cell.id];
              if (cellValue) {
                optionCounts[String(cellValue)] =
                  (optionCounts[String(cellValue)] || 0) + 1;
              }
            });
            analytics.optionDistribution = cell.radioOptions.map((opt) => ({
              label: opt.label,
              value: opt.value,
              count: optionCounts[opt.id] || optionCounts[opt.value] || 0,
              percentage:
                totalResponses > 0
                  ? ((optionCounts[opt.id] || optionCounts[opt.value] || 0) /
                    totalResponses) *
                  100
                  : 0,
            }));
          } else if (cell.type === 'select' && cell.selectOptions) {
            const optionCounts: Record<string, number> = {};
            responses.forEach((r) => {
              const tableValue = r.value as Record<string, unknown>;
              const cellValue = tableValue?.[cell.id];
              if (cellValue) {
                optionCounts[String(cellValue)] =
                  (optionCounts[String(cellValue)] || 0) + 1;
              }
            });
            analytics.optionDistribution = cell.selectOptions.map((opt) => ({
              label: opt.label,
              value: opt.value,
              count: optionCounts[opt.value] || 0,
              percentage:
                totalResponses > 0
                  ? ((optionCounts[opt.value] || 0) / totalResponses) * 100
                  : 0,
            }));
          } else if (cell.type === 'input') {
            const textValues: string[] = [];
            responses.forEach((r) => {
              const tableValue = r.value as Record<string, unknown>;
              const cellValue = tableValue?.[cell.id];
              if (cellValue && String(cellValue).trim()) {
                textValues.push(String(cellValue));
              }
            });
            analytics.textResponses = textValues;
          }

          return analytics;
        }),
    }));

  // 행별 요약 (상호작용률)
  const rowSummary: RowSummary[] = rows
    .filter((row) => !row.cells.some((cell) => cell.isHidden && cell.rowspan))
    .map((row) => {
      let interactions = 0;
      const details: Record<string, number> = {};

      responses.forEach((r) => {
        const tableValue = r.value as Record<string, unknown>;
        const hasInteraction = row.cells.some((cell) => {
          const cellValue = tableValue?.[cell.id];

          if (cell.type === 'checkbox') {
            const isChecked =
              Array.isArray(cellValue) && cellValue.length > 0;
            if (isChecked) {
              // 체크박스 체크됨
              return true;
            }
          } else if (cell.type === 'radio' && cellValue) {
            // 라디오 선택됨 - 상세 정보 기록
            const optionLabel =
              cell.radioOptions?.find(
                (o) => o.id === cellValue || o.value === cellValue
              )?.label || String(cellValue);
            details[optionLabel] = (details[optionLabel] || 0) + 1;
            return true;
          } else if (cell.type === 'select' && cellValue) {
            return true;
          } else if (cell.type === 'input' && cellValue) {
            return String(cellValue).trim().length > 0;
          }
          return false;
        });

        if (hasInteraction) interactions++;
      });

      return {
        rowId: row.id,
        rowLabel: row.label,
        totalInteractions: interactions,
        interactionRate:
          totalResponses > 0 ? (interactions / totalResponses) * 100 : 0,
        details: Object.keys(details).length > 0 ? details : undefined,
      };
    })
    .sort((a, b) => b.interactionRate - a.interactionRate);

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
