'use client';

import { useMemo } from 'react';

import { Input } from '@/components/ui/input';
import { Question, RankingAnswer } from '@/types/survey';

const RANKING_OTHER_VALUE = '__other__';

interface RankingQuestionProps {
  question: Question;
  value: unknown;
  onChange: (value: RankingAnswer[]) => void;
}

/**
 * 순위형(ranking) 질문 응답 컴포넌트.
 * - positions 만큼 세로 드롭다운 렌더
 * - allowDuplicateRanks=false 일 때 다른 순위에 이미 선택된 값은 disabled
 * - allowOtherOption=true 일 때 '기타' 옵션 + 해당 순위 아래 텍스트 입력 노출
 */
export function RankingQuestion({ question, value, onChange }: RankingQuestionProps) {
  const config = question.rankingConfig;
  const rawOptions = question.options ?? [];
  const requestedPositions = Math.max(1, config?.positions ?? 3);
  const positions = Math.min(requestedPositions, Math.max(rawOptions.length, 1));
  const allowDuplicates = config?.allowDuplicateRanks === true;
  const allowOther = question.allowOtherOption === true;

  const answers = useMemo<RankingAnswer[]>(
    () => (Array.isArray(value) ? (value as RankingAnswer[]).filter(isRankingAnswer) : []),
    [value],
  );

  const answerAt = (rank: number) => answers.find((a) => a.rank === rank);
  const selectedValueAt = (rank: number) => answerAt(rank)?.optionValue ?? '';
  const otherTextAt = (rank: number) => answerAt(rank)?.otherText ?? '';

  const commit = (next: RankingAnswer[]) => {
    onChange(next.sort((a, b) => a.rank - b.rank));
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

  if (rawOptions.length === 0) {
    return <div className="py-4 text-center text-gray-500">선택지가 없습니다.</div>;
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: positions }, (_, i) => i + 1).map((rank) => {
        const currentValue = selectedValueAt(rank);
        const showOtherInput = currentValue === RANKING_OTHER_VALUE;
        return (
          <div key={rank} className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-base font-medium text-gray-700">
                {rank}순위
              </span>
              <select
                value={currentValue}
                onChange={(e) => handleSelect(rank, e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-3 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">선택하세요...</option>
                {rawOptions.map((opt) => (
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
              <div className="ml-[4.25rem]">
                <Input
                  placeholder="기타 내용을 입력하세요..."
                  value={otherTextAt(rank)}
                  onChange={(e) => handleOtherText(rank, e.target.value)}
                  className="w-full"
                />
              </div>
            )}
          </div>
        );
      })}
      {positions < requestedPositions && (
        <p className="text-sm text-gray-500">
          선택지가 {rawOptions.length}개라 최대 {positions}순위까지 입력할 수 있습니다.
        </p>
      )}
    </div>
  );
}

function isRankingAnswer(v: unknown): v is RankingAnswer {
  if (!v || typeof v !== 'object') return false;
  const rec = v as Record<string, unknown>;
  return typeof rec.rank === 'number' && typeof rec.optionValue === 'string';
}
