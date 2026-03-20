'use client';

import { RefreshCw, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Question } from '@/types/survey';
import type { ValidationError } from '@/lib/spss/variable-validator';

interface SpssVariableManagerProps {
  questions: Question[];
  onRegenerate: () => void;
  onValidate: () => void;
  validationErrors?: ValidationError[];
}

function getSubVarLabel(q: Question): string {
  if (q.type === 'notice' && q.requiresAcknowledgment && q.questionCode) {
    return `${q.questionCode}, ${q.questionCode}_DATE`;
  }

  const parts: string[] = [];

  if (q.type === 'checkbox' && q.options && q.options.length > 0) {
    parts.push(`${q.questionCode}M1~${q.questionCode}M${q.options.length}`);
  }

  if (q.allowOtherOption && q.questionCode) {
    parts.push(`${q.questionCode}_etc`);
  }

  return parts.join(', ');
}

export function SpssVariableManager({
  questions,
  onRegenerate,
  onValidate,
  validationErrors,
}: SpssVariableManagerProps) {
  const filtered = questions.filter((q) => q.type !== 'notice' || q.requiresAcknowledgment);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">SPSS 변수명 관리</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRegenerate}>
            <RefreshCw className="mr-1 h-4 w-4" />
            자동 재할당
          </Button>
          <Button variant="outline" size="sm" onClick={onValidate}>
            <ShieldCheck className="mr-1 h-4 w-4" />
            검증
          </Button>
        </div>
      </div>

      {validationErrors && validationErrors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          {validationErrors.map((err, i) => (
            <p key={i} className="text-sm text-red-600">{err.message}</p>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">순번</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">변수명</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">질문 제목</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">타입</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">하위 변수</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((q, idx) => (
              <tr key={q.id} className="border-t border-gray-100">
                <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                <td className="px-3 py-2 font-mono font-semibold text-blue-600">
                  {q.questionCode ?? '—'}
                </td>
                <td className="px-3 py-2 text-gray-800">{q.title}</td>
                <td className="px-3 py-2 text-gray-500">{q.type}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">
                  {getSubVarLabel(q)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
