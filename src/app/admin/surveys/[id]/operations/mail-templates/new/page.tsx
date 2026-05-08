import { TemplateEditForm } from '@/components/operations/mail-template/template-edit-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NewMailTemplatePage({ params }: Props) {
  const { id: surveyId } = await params;
  const fromDomain = process.env.RESEND_FROM_DOMAIN ?? '';

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-xl font-semibold">새 메일 템플릿</h1>
      <TemplateEditForm surveyId={surveyId} fromDomain={fromDomain} />
    </main>
  );
}
