import { notFound } from 'next/navigation';

import { TemplateEditForm } from '@/components/operations/mail-template/template-edit-form';
import { getMailTemplate } from '@/data/mail-templates';

interface Props {
  params: Promise<{ id: string; mid: string }>;
}

export default async function EditMailTemplatePage({ params }: Props) {
  const { id: surveyId, mid: templateId } = await params;
  const template = await getMailTemplate(surveyId, templateId);
  if (!template) notFound();

  const fromDomain = process.env.RESEND_FROM_DOMAIN ?? '';

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-xl font-semibold">메일 템플릿 편집</h1>
      <TemplateEditForm surveyId={surveyId} fromDomain={fromDomain} template={template} />
    </main>
  );
}
