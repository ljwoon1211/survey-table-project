'use client';

import { useMemo } from 'react';

import { TablePreview } from '@/components/survey-builder/table-preview';
import { Question, RankingAnswer } from '@/types/survey';
import { getOptionsLayout } from '@/utils/options-layout';
import { resolveRankingOptions } from '@/utils/ranking-source';
import { parseRankingAnswers } from '@/utils/ranking-shared';

import { RankingDropdownStack } from './ranking-dropdown-stack';

interface RankingQuestionProps {
  question: Question;
  value: unknown;
  onChange: (value: RankingAnswer[]) => void;
}

/**
 * 순위형(ranking) 질문 응답 컴포넌트.
 * - optionsSource='manual': question.options 로부터 드롭다운
 * - optionsSource='table': 질문 자신의 tableRowsData 내 ranking_opt(rnk) 셀이 옵션 소스
 *   상단에 드롭다운 → 하단에 설명 테이블(TablePreview, 읽기 전용)
 */
export function RankingQuestion({ question, value, onChange }: RankingQuestionProps) {
  const config = question.rankingConfig;
  const isTableSource = config?.optionsSource === 'table';

  // 옵션 해결 (수동 또는 자체 tableRowsData 에서 ranking_opt 셀 수집)
  const rawOptions = useMemo(() => resolveRankingOptions(question), [question]);

  const requestedPositions = Math.max(1, config?.positions ?? 3);
  const positions = Math.min(requestedPositions, Math.max(rawOptions.length, 1));
  const allowDuplicates = config?.allowDuplicateRanks === true;
  const allowOther = question.allowOtherOption === true;

  const answers = useMemo(() => parseRankingAnswers(value), [value]);

  if (rawOptions.length === 0) {
    return (
      <div className="py-4 text-center text-gray-500">
        {isTableSource
          ? '설명 테이블에 "순위 옵션" 셀이 없습니다. 빌더에서 옵션으로 쓸 셀의 타입을 "순위 옵션"으로 설정하세요.'
          : '선택지가 없습니다.'}
      </div>
    );
  }

  const hasEmbeddedTable =
    isTableSource
    && question.tableColumns
    && question.tableColumns.length > 0
    && question.tableRowsData
    && question.tableRowsData.length > 0;

  return (
    <div className="space-y-4">
      <RankingDropdownStack
        answers={answers}
        options={rawOptions}
        positions={positions}
        allowDuplicates={allowDuplicates}
        allowOther={allowOther}
        onChange={onChange}
        columns={question.optionsColumns}
      />

      {positions < requestedPositions && (
        <p className="text-sm text-gray-500">
          선택지가 {rawOptions.length}개라 최대 {positions}순위까지 입력할 수 있습니다.
        </p>
      )}

      {/* 내장 테이블이 있으면 테이블이 옵션을 시각화 — 아니면 선택지 목록으로 표시 */}
      {hasEmbeddedTable ? (
        <TablePreview
          tableTitle={question.tableTitle}
          columns={question.tableColumns}
          rows={question.tableRowsData}
          tableHeaderGrid={question.tableHeaderGrid}
          hideColumnLabels={question.hideColumnLabels}
        />
      ) : (
        (() => {
          const layout = getOptionsLayout(question.optionsColumns);
          return (
            <div
              className={`rounded-md border border-gray-200 bg-gray-50/50 p-3 text-sm ${layout.className}`}
              style={layout.style}
            >
              {rawOptions.map((opt) => (
                <div
                  key={opt.id}
                  className="whitespace-pre-wrap text-gray-800 [overflow-wrap:anywhere]"
                >
                  {opt.label}
                </div>
              ))}
            </div>
          );
        })()
      )}
    </div>
  );
}
