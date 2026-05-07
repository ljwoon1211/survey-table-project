'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateProgressColumns } from '@/actions/progress-actions';
import type {
  ContactColumnScheme,
  ProgressColumnDef,
  ProgressColumnScheme,
} from '@/db/schema/schema-types';

interface Props {
  surveyId: string;
  initialScheme: ProgressColumnScheme;
  /** contact_columns 의 attrs.<key> 풀 — "+ 컬럼 추가" 드롭다운 소스 */
  contactScheme: ContactColumnScheme | null;
}

const ATTRS_PREFIX = 'attrs.';

export function ProgressColumnEditor({ surveyId, initialScheme, contactScheme }: Props) {
  const router = useRouter();
  const [columns, setColumns] = useState<ProgressColumnDef[]>(initialScheme.columns);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // contact_columns 의 attrs.<key> 중 progress columns 에 미포함된 것
  const attrsPool: { key: string; label: string }[] = (contactScheme?.columns ?? [])
    .filter((c) => c.source.startsWith(ATTRS_PREFIX))
    .map((c) => ({ key: c.source.slice(ATTRS_PREFIX.length), label: c.label }));
  const usedKeys = new Set(columns.map((c) => c.key));
  const available = attrsPool.filter((p) => !usedKeys.has(p.key));

  const move = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= columns.length) return;
    const next = [...columns];
    [next[i], next[j]] = [next[j], next[i]];
    setColumns(next.map((c, idx) => ({ ...c, order: idx })));
  };

  const updateLabel = (i: number, label: string) => {
    const next = [...columns];
    next[i] = { ...next[i], label };
    setColumns(next);
  };

  const updateHidden = (i: number, hidden: boolean) => {
    const next = [...columns];
    next[i] = { ...next[i], hidden };
    setColumns(next);
  };

  const remove = (i: number) => {
    setColumns(columns.filter((_, idx) => idx !== i).map((c, idx) => ({ ...c, order: idx })));
  };

  const addColumn = (key: string, defaultLabel: string) => {
    setColumns([...columns, { key, label: defaultLabel, order: columns.length }]);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateProgressColumns(surveyId, { version: 1, columns });
      if (!result.ok) {
        setError(result.error ?? '저장에 실패했습니다.');
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="w-24 px-3 py-2 text-left font-medium">순서</th>
              <th className="px-3 py-2 text-left font-medium">라벨</th>
              <th className="px-3 py-2 text-left font-medium">소스</th>
              <th className="w-16 px-3 py-2 text-center font-medium">숨김</th>
              <th className="w-20 px-3 py-2 text-center font-medium" aria-label="삭제" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {columns.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  진척률 표에 표시할 컬럼이 없습니다. 아래에서 추가하세요.
                </td>
              </tr>
            )}
            {columns.map((c, i) => (
              <tr key={c.key} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로">
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => move(i, 1)}
                    disabled={i === columns.length - 1}
                    aria-label="아래로"
                  >
                    ↓
                  </Button>
                </td>
                <td className="px-3 py-2">
                  <Input value={c.label} onChange={(e) => updateLabel(i, e.target.value)} />
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">attrs.{c.key}</td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={c.hidden ?? false}
                    onChange={(e) => updateHidden(i, e.target.checked)}
                    aria-label={`${c.label} 숨김`}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <Button variant="ghost" size="sm" onClick={() => remove(i)}>
                    삭제
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        {available.length === 0 ? (
          <span className="text-sm text-slate-400">
            추가 가능한 attrs 컬럼이 없습니다 — 컨택리스트 컬럼 설정에서 먼저 등록하세요.
          </span>
        ) : (
          <>
            <span className="text-sm text-slate-600">+ 컬럼 추가:</span>
            {available.map((p) => (
              <Button key={p.key} variant="outline" size="sm" onClick={() => addColumn(p.key, p.label)}>
                {p.label}
              </Button>
            ))}
          </>
        )}
        <span className="ml-auto" />
        <Button onClick={save} disabled={pending} variant="default">
          {pending ? '저장 중…' : '💾 저장'}
        </Button>
      </div>
    </div>
  );
}
