'use client';

import React from 'react';

import { ListOrdered, Settings } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Question, RankingConfig } from '@/types/survey';

const MIN_POSITIONS = 1;
const MAX_POSITIONS = 10;
const DEFAULT_POSITIONS = 3;

interface RankingConfigEditorProps {
  value: RankingConfig | undefined;
  onChange: (next: RankingConfig) => void;
  optionsCount?: number;
}

/**
 * 순위형(ranking) 설정 에디터 (일반화된 value/onChange 시그니처).
 * - positions: 매길 순위 개수 (1~10)
 * - allowDuplicateRanks: 중복 선택 허용
 * - requireAllPositions: 모든 순위 입력 필수
 * Case 1 질문 레벨 / Case 3 셀 레벨 모두 사용 가능.
 */
export function RankingConfigEditor({ value, onChange, optionsCount = 0 }: RankingConfigEditorProps) {
  const config: RankingConfig = value ?? { positions: DEFAULT_POSITIONS };
  const exceedsOptions = !config.allowDuplicateRanks && config.positions > optionsCount;

  const updateConfig = (patch: Partial<RankingConfig>) => {
    onChange({
      ...config,
      ...patch,
    });
  };

  const handlePositionsChange = (raw: string) => {
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(Math.max(parsed, MIN_POSITIONS), MAX_POSITIONS);
    updateConfig({ positions: clamped });
  };

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
      <Label className="flex items-center space-x-2">
        <ListOrdered className="h-4 w-4" />
        <span>순위형 설정</span>
      </Label>

      <div className="space-y-2">
        <Label htmlFor="ranking-positions" className="text-sm font-medium">
          매길 순위 개수
        </Label>
        <Input
          id="ranking-positions"
          type="number"
          min={MIN_POSITIONS}
          max={MAX_POSITIONS}
          value={config.positions}
          onChange={(e) => handlePositionsChange(e.target.value)}
          className="w-32"
        />
        <p className="text-xs text-gray-500">
          {MIN_POSITIONS}~{MAX_POSITIONS} 범위. 응답자는 1순위부터 {config.positions}순위까지 선택합니다.
        </p>
        {exceedsOptions && (
          <p className="text-sm text-amber-600">
            순위 개수({config.positions})가 선택지 개수({optionsCount})보다 많습니다. 중복 허용이
            꺼져 있으면 응답 시 자동으로 {optionsCount}순위까지만 표시됩니다.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Settings className="h-4 w-4" />
            중복 선택 허용
          </Label>
          <p className="text-xs text-gray-500">
            OFF: 같은 선택지를 여러 순위에 선택 불가 (일반적인 순위형 관행)
          </p>
        </div>
        <Switch
          checked={config.allowDuplicateRanks === true}
          onCheckedChange={(v) => updateConfig({ allowDuplicateRanks: v })}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">모든 순위 입력 필수</Label>
          <p className="text-xs text-gray-500">
            ON: 1~{config.positions}순위 전체를 선택해야 제출 가능. OFF: 1순위만 필수(필수 응답 체크
            시).
          </p>
        </div>
        <Switch
          checked={config.requireAllPositions === true}
          onCheckedChange={(v) => updateConfig({ requireAllPositions: v })}
        />
      </div>
    </div>
  );
}

interface RankingConfigEditorForQuestionProps {
  formData: Partial<Question>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Question>>>;
}

/** 질문(Case 1) 폼 상태 어댑터 — 기존 호출부 호환. */
export function RankingConfigEditorForQuestion({
  formData,
  setFormData,
}: RankingConfigEditorForQuestionProps) {
  return (
    <RankingConfigEditor
      value={formData.rankingConfig}
      onChange={(next) => setFormData((prev) => ({ ...prev, rankingConfig: next }))}
      optionsCount={formData.options?.length ?? 0}
    />
  );
}
