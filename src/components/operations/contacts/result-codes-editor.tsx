'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { updateContactResultCodes } from '@/actions/contact-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DEFAULT_RESULT_CODES, type ContactResultCode } from '@/db/schema/schema-types';

interface ResultCodesEditorProps {
  surveyId: string;
  initialCodes: ContactResultCode[];
}

const TONE_OPTIONS: Array<NonNullable<ContactResultCode['tone']>> = [
  'green',
  'amber',
  'rose',
  'blue',
  'slate',
];

export function ResultCodesEditor({ surveyId, initialCodes }: ResultCodesEditorProps) {
  const router = useRouter();
  const [codes, setCodes] = useState<ContactResultCode[]>(initialCodes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(index: number, patch: Partial<ContactResultCode>) {
    setCodes((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function move(index: number, dir: -1 | 1) {
    const newCodes = [...codes];
    const target = index + dir;
    if (target < 0 || target >= newCodes.length) return;
    [newCodes[index], newCodes[target]] = [newCodes[target], newCodes[index]];
    newCodes.forEach((c, i) => {
      c.order = i + 1;
    });
    setCodes(newCodes);
  }

  function remove(index: number) {
    if (codes.length === 1) {
      setError('최소 1개의 결과코드가 필요합니다.');
      return;
    }
    setCodes((prev) =>
      prev.filter((_, i) => i !== index).map((c, i) => ({ ...c, order: i + 1 })),
    );
  }

  function add() {
    const nextOrder = codes.length + 1;
    setCodes((prev) => [
      ...prev,
      { code: `신규${nextOrder}`, label: `신규${nextOrder}`, order: nextOrder, tone: 'slate' },
    ]);
  }

  function reset() {
    if (!window.confirm('디폴트 13개로 복귀합니다. 진행할까요?')) return;
    setCodes(DEFAULT_RESULT_CODES.map((c) => ({ ...c })));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateContactResultCodes(surveyId, codes);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function clearOverride() {
    if (!window.confirm('사용자 정의를 해제하고 디폴트로 돌아갑니다.')) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateContactResultCodes(surveyId, null);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">순서</th>
              <th className="px-3 py-2 text-left">코드</th>
              <th className="px-3 py-2 text-left">라벨</th>
              <th className="px-3 py-2 text-left">색상</th>
              <th className="px-3 py-2 text-center">액션</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={i === codes.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      ↓
                    </Button>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={c.code}
                    onChange={(e) => update(i, { code: e.target.value })}
                    className="h-8 text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={c.label}
                    onChange={(e) => update(i, { label: e.target.value })}
                    className="h-8 text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={c.tone ?? 'slate'}
                    onValueChange={(v) => update(i, { tone: v as ContactResultCode['tone'] })}
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 text-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600"
                    onClick={() => remove(i)}
                  >
                    삭제
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={add} variant="outline">
          + 결과코드 추가
        </Button>
        <Button onClick={reset} variant="outline">
          디폴트 13개로 복귀
        </Button>
        <Button onClick={clearOverride} variant="outline" className="text-slate-600">
          사용자 정의 해제
        </Button>
        <span className="flex-1" />
        <Button onClick={save} disabled={isPending}>
          {isPending ? '저장 중…' : '저장'}
        </Button>
      </div>
    </div>
  );
}
