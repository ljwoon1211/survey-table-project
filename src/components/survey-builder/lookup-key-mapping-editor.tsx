'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSurveyBuilderStore } from '@/stores/survey-store';

const CUSTOM_SENTINEL = '__custom__';

interface Props {
  /** LUT 의 keyColumns (LUT 행을 식별할 키 컬럼 이름들) */
  lutKeys: string[];
  /** 각 LUT 키 → 컨택 attrs 키 매핑 */
  value: Array<{ lutKey: string; attrsKey: string }>;
  onChange: (next: Array<{ lutKey: string; attrsKey: string }>) => void;
}

/**
 * LUT 의 각 키 컬럼을 컨택 attrs 의 어떤 키와 매칭할지 정의하는 에디터.
 *
 * - 셀렉터: 현재 설문의 contactColumns.columns (attrs.* 또는 system.*) 을 옵션으로 노출.
 * - "직접 입력" 모드: 컬럼 스킴에 등록되지 않은 attrs 키도 허용 (엑셀 업로드 직후 등),
 *   단 fail-safe SHOW 경고를 함께 노출해서 운영자가 인지하도록 함.
 */
export function LookupKeyMappingEditor({ lutKeys, value, onChange }: Props) {
  const contactColumns = useSurveyBuilderStore(
    (s) => s.currentSurvey.contactColumns?.columns ?? [],
  );

  // value 를 lutKeys 와 동기화 — LUT 의 키가 바뀌면 기존 매핑은 lutKey 가 일치하는 것만 유지.
  const normalized = lutKeys.map(
    (k) => value.find((v) => v.lutKey === k) ?? { lutKey: k, attrsKey: '' },
  );

  const setRow = (lutKey: string, attrsKey: string) => {
    const next = normalized.map((r) =>
      r.lutKey === lutKey ? { ...r, attrsKey } : r,
    );
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">키 매핑</div>
      {normalized.map((row) => {
        const isInColumns = contactColumns.some((c) => c.key === row.attrsKey);
        const selectorValue = row.attrsKey && isInColumns ? row.attrsKey : CUSTOM_SENTINEL;
        return (
          <div
            key={row.lutKey}
            className="grid grid-cols-[120px_1fr] items-center gap-2"
          >
            <div className="text-sm">LUT 키 「{row.lutKey}」</div>
            <div className="flex items-center gap-2">
              <Select
                value={selectorValue}
                onValueChange={(v) =>
                  setRow(row.lutKey, v === CUSTOM_SENTINEL ? '' : v)
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="컨택 속성 선택" />
                </SelectTrigger>
                <SelectContent>
                  {contactColumns.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label ?? c.key}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_SENTINEL}>직접 입력…</SelectItem>
                </SelectContent>
              </Select>
              {!isInColumns && (
                <Input
                  value={row.attrsKey}
                  placeholder="attrs 키 직접 입력"
                  onChange={(e) => setRow(row.lutKey, e.target.value)}
                  className="w-40"
                />
              )}
              {row.attrsKey && !isInColumns && (
                <span className="text-xs text-amber-600">
                  컨택 컬럼에 없는 키입니다. 응답 시 attrs 에 이 키가 없으면 fail-safe SHOW 됩니다.
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
