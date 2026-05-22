'use client';

import { useSurveyBuilderStore } from '@/stores/survey-store';
import type { RightOperand } from '@/types/survey';

import { LookupKeyMappingEditor } from './lookup-key-mapping-editor';
import { LookupSelector } from './lookup-selector';

type LookupOperand = Extract<RightOperand, { kind: 'lookup' }>;

interface Props {
  value: LookupOperand;
  onChange: (next: LookupOperand) => void;
}

/**
 * 분기 조건 우변에서 "LUT 룩업" 를 선택했을 때 노출되는 에디터.
 *
 * 구성:
 *  1. LookupSelector — 비교 대상 LUT 를 선택 (현재 설문에 등록된 사본 목록).
 *  2. LookupKeyMappingEditor — 선택한 LUT 의 keyColumns 를 컨택 attrs 키와 매핑.
 *  3. valueColumn 표시 — 비교에 쓰일 값 컬럼 이름 (참조용, 편집 불가).
 */
export function LookupComparandEditor({ value, onChange }: Props) {
  const lookups = useSurveyBuilderStore((s) => s.currentSurvey.lookups ?? []);
  const selected = lookups.find((l) => l.id === value.surveyLookupId);

  return (
    <div className="space-y-3 rounded border bg-gray-50/50 p-3">
      <div className="text-sm font-medium">외부 데이터 룩업</div>

      <LookupSelector
        value={value.surveyLookupId}
        onChange={(id, lookup) =>
          onChange({
            ...value,
            surveyLookupId: id,
            // LUT 가 바뀌면 키 매핑도 새 keyColumns 기준으로 초기화.
            keyMapping: lookup.keyColumns.map((k) => ({
              lutKey: k,
              attrsKey: '',
            })),
          })
        }
      />

      {selected && (
        <>
          <LookupKeyMappingEditor
            lutKeys={selected.keyColumns}
            value={value.keyMapping}
            onChange={(km) => onChange({ ...value, keyMapping: km })}
          />
          <div className="text-xs text-gray-600">
            비교 대상: 「{selected.valueColumn}」
          </div>
        </>
      )}
    </div>
  );
}
