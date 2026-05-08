'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  createMailTemplateAction,
  updateMailTemplateAction,
} from '@/actions/mail-template-actions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { MailTemplate } from '@/db/schema/mail';

import { MetaFields, type MetaFieldValues } from './meta-fields';

interface Props {
  surveyId: string;
  fromDomain: string;
  template?: MailTemplate;
}

export function TemplateEditForm({ surveyId, fromDomain, template }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [meta, setMeta] = useState<MetaFieldValues>({
    name: template?.name ?? '',
    subject: template?.subject ?? '',
    fromLocal: template?.fromLocal ?? '',
    fromName: template?.fromName ?? '',
    replyTo: template?.replyTo ?? '',
  });
  const [bodyHtml, setBodyHtml] = useState(template?.bodyHtml ?? '');

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const input = {
        ...meta,
        bodyHtml,
        attachments: template?.attachments ?? [],
      };

      const result = template
        ? await updateMailTemplateAction(surveyId, template.id, input)
        : await createMailTemplateAction(surveyId, input);

      if (!result.ok) {
        setError(result.error ?? '저장 실패');
        return;
      }
      router.push(`/admin/surveys/${surveyId}/operations/mail-templates`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <MetaFields values={meta} onChange={setMeta} fromDomain={fromDomain} />

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
        <Label className="text-sm">본문 (Phase B 에서 TipTap 으로 교체)</Label>
        <Textarea
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          placeholder="안녕하세요, {{수행기관}} 담당자님."
          className="min-h-[280px] font-mono text-sm"
        />
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          취소
        </Button>
        <Button type="button" onClick={onSave} disabled={pending}>
          {pending ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  );
}
