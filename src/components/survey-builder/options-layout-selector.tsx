'use client';

import { Label } from '@/components/ui/label';

interface OptionsLayoutSelectorProps {
  /** 현재 값. undefined/1 = 세로, 0 = 가로, N ≥ 2 = N열 그리드. */
  value: number | undefined;
  onChange: (next: number) => void;
  /** 라벨 텍스트 커스터마이즈 (기본 "옵션 배치:"). */
  label?: string;
}

/**
 * 라디오/체크박스/순위형 옵션의 응답 페이지 배치 선택기.
 * 질문 편집 UI 의 여러 탭에서 재사용하기 위해 분리.
 */
export function OptionsLayoutSelector({
  value,
  onChange,
  label = '옵션 배치:',
}: OptionsLayoutSelectorProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Label className="text-gray-600">{label}</Label>
      <select
        value={value ?? 1}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="rounded border border-gray-300 bg-white px-2 py-1"
      >
        <option value={1}>세로 (1열)</option>
        <option value={0}>가로 (한 줄, 자동 줄바꿈)</option>
        <option value={2}>2열 그리드</option>
        <option value={3}>3열 그리드</option>
        <option value={4}>4열 그리드</option>
        <option value={5}>5열 그리드</option>
        <option value={6}>6열 그리드</option>
      </select>
    </div>
  );
}
