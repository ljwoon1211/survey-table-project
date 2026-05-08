'use client';

import { useTransition } from 'react';

import { Trash2 } from 'lucide-react';

import { deleteMailTemplateAction } from '@/actions/mail-template-actions';
import { Button } from '@/components/ui/button';

interface Props {
  surveyId: string;
  templateId: string;
  templateName: string;
}

export function DeleteTemplateButton({ surveyId, templateId, templateName }: Props) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm(`"${templateName}" 템플릿을 삭제하시겠습니까?`)) return;
    startTransition(async () => {
      const r = await deleteMailTemplateAction(surveyId, templateId);
      if (!r.ok) alert(r.error ?? '삭제 실패');
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={pending}
      className="text-red-600 hover:text-red-700"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
