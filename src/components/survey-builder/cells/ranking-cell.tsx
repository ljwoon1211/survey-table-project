'use client';

import React, { useMemo } from 'react';

import { Input } from '@/components/ui/input';
import type { RankingAnswer } from '@/types/survey';

import type { InteractiveCellProps } from './types';

const RANKING_OTHER_VALUE = '__other__';

function isRankingAnswer(v: unknown): v is RankingAnswer {
  if (!v || typeof v !== 'object') return false;
  const rec = v as Record<string, unknown>;
  return typeof rec.rank === 'number' && typeof rec.optionValue === 'string';
}

function parseRankingResponse(value: unknown): RankingAnswer[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRankingAnswer);
}

/** 순위형 셀 (인터랙티브) — Case 3: 테이블 셀 내부 랭킹 */
export const RankingCell = React.memo(function RankingCell({
  cell,
  cellResponse,
  onUpdateValue,
}: InteractiveCellProps) {
  const config = cell.rankingConfig;
  const options = cell.rankingOptions ?? [];
  const requestedPositions = Math.max(1, config?.positions ?? 3);
  const positions = Math.min(requestedPositions, Math.max(options.length, 1));
  const allowDuplicates = config?.allowDuplicateRanks === true;
  const allowOther = cell.allowOtherOption === true;

  const answers = useMemo<RankingAnswer[]>(
    () => parseRankingResponse(cellResponse),
    [cellResponse],
  );

  const answerAt = (rank: number) => answers.find((a) => a.rank === rank);
  const selectedValueAt = (rank: number) => answerAt(rank)?.optionValue ?? '';
  const otherTextAt = (rank: number) => answerAt(rank)?.otherText ?? '';

  const commit = (next: RankingAnswer[]) => {
    onUpdateValue(next.sort((a, b) => a.rank - b.rank));
  };

  const handleSelect = (rank: number, newValue: string) => {
    const filtered = answers.filter((a) => a.rank !== rank);
    if (!newValue) {
      commit(filtered);
      return;
    }
    const entry: RankingAnswer = { rank, optionValue: newValue };
    if (newValue === RANKING_OTHER_VALUE) {
      entry.otherText = otherTextAt(rank);
    }
    commit([...filtered, entry]);
  };

  const handleOtherText = (rank: number, text: string) => {
    const current = answerAt(rank);
    if (!current) return;
    const filtered = answers.filter((a) => a.rank !== rank);
    commit([...filtered, { ...current, otherText: text }]);
  };

  const isTakenElsewhere = (rank: number, optionValue: string) => {
    if (allowDuplicates) return false;
    return answers.some((a) => a.rank !== rank && a.optionValue === optionValue);
  };

  if (options.length === 0) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <span className="text-xs">순위 옵션 없음</span>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col space-y-2">
      {cell.content && cell.content.trim() && (
        <div className="mb-1 text-sm font-medium whitespace-pre-wrap [overflow-wrap:anywhere] text-gray-700">
          {cell.content}
        </div>
      )}
      {Array.from({ length: positions }, (_, i) => i + 1).map((rank) => {
        const currentValue = selectedValueAt(rank);
        const showOtherInput = currentValue === RANKING_OTHER_VALUE;
        return (
          <div key={rank} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-xs font-medium text-gray-600">
                {rank}순위
              </span>
              <select
                value={currentValue}
                onChange={(e) => handleSelect(rank, e.target.value)}
                className="w-full appearance-none truncate rounded border border-gray-300 bg-white py-2 pr-2 pl-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">선택하세요</option>
                {options.map((opt) => (
                  <option
                    key={opt.id}
                    value={opt.value}
                    disabled={isTakenElsewhere(rank, opt.value)}
                  >
                    {opt.label}
                  </option>
                ))}
                {allowOther && <option value={RANKING_OTHER_VALUE}>기타 (직접 입력)</option>}
              </select>
            </div>
            {showOtherInput && (
              <Input
                placeholder="기타 내용 입력..."
                value={otherTextAt(rank)}
                onChange={(e) => handleOtherText(rank, e.target.value)}
                className="h-8 text-xs"
              />
            )}
          </div>
        );
      })}
      {positions < requestedPositions && (
        <p className="text-xs text-gray-500">
          선택지 {options.length}개 → 최대 {positions}순위
        </p>
      )}
    </div>
  );
});
