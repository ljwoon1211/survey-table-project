'use client';

import { Input } from '@/components/ui/input';
import type { QuestionOption, RankingAnswer } from '@/types/survey';
import { getOptionsLayout } from '@/utils/options-layout';
import { RANKING_OTHER_VALUE } from '@/utils/ranking-shared';

export interface RankingDropdownStackProps {
  /** 현재 응답 (RankingAnswer[]). parseRankingAnswers 로 정규화된 값 권장. */
  answers: RankingAnswer[];
  /** 선택지 목록 (Case 1/2/3 공통). */
  options: QuestionOption[];
  /** 렌더할 순위 개수. options.length 초과하지 않도록 상위에서 clamp. */
  positions: number;
  /** 같은 옵션을 여러 순위에 선택 허용할지. false 면 이미 선택된 값은 disabled. */
  allowDuplicates: boolean;
  /** '기타 (직접 입력)' 옵션 허용 여부. */
  allowOther: boolean;
  /** 응답 변경 콜백 (rank 기준 오름차순 정렬된 RankingAnswer[]). */
  onChange: (next: RankingAnswer[]) => void;
  /** 셀 컨텍스트처럼 좁은 영역에 렌더할 때 compact 스타일 적용. */
  compact?: boolean;
  /** 순위 드롭다운 배치 (undefined/1=세로, 0=가로, N≥2=N열 그리드). compact 와 독립. */
  columns?: number;
}

/**
 * 순위형 응답의 드롭다운 스택.
 * ranking-question (Case 1/2) / cells/ranking-cell (Case 3) 가 공유.
 */
export function RankingDropdownStack({
  answers,
  options,
  positions,
  allowDuplicates,
  allowOther,
  onChange,
  compact = false,
  columns,
}: RankingDropdownStackProps) {
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

  // 스타일 프리셋 (compact: 테이블 셀 컨텍스트 / full: 질문 레벨)
  const rankLabelCls = compact
    ? 'w-10 shrink-0 text-xs font-medium text-gray-600'
    : 'w-16 shrink-0 text-base font-medium text-gray-700';
  const selectCls = compact
    ? 'w-full appearance-none truncate rounded border border-gray-300 bg-white py-2 pr-2 pl-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
    : 'w-full rounded-lg border border-gray-300 p-3 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500';
  const otherInputCls = compact ? 'h-8 text-xs' : 'w-full';
  const otherWrapperCls = compact ? '' : 'ml-[4.25rem]';
  const rowCls = compact ? 'space-y-1' : 'space-y-2';
  // 컨테이너 레이아웃은 columns prop 기반. compact 는 내부 select/label 크기만 영향.
  const layout = getOptionsLayout(columns);

  return (
    <div className={layout.className} style={layout.style}>
      {Array.from({ length: positions }, (_, i) => i + 1).map((rank) => {
        const currentValue = selectedValueAt(rank);
        const showOtherInput = currentValue === RANKING_OTHER_VALUE;
        return (
          <div key={rank} className={rowCls}>
            <div className="flex items-center gap-2">
              <span className={rankLabelCls}>{rank}순위</span>
              <select
                value={currentValue}
                onChange={(e) => handleSelect(rank, e.target.value)}
                className={selectCls}
              >
                <option value="">{compact ? '선택하세요' : '선택하세요...'}</option>
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
              <div className={otherWrapperCls}>
                <Input
                  placeholder="기타 내용 입력..."
                  value={otherTextAt(rank)}
                  onChange={(e) => handleOtherText(rank, e.target.value)}
                  className={otherInputCls}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
