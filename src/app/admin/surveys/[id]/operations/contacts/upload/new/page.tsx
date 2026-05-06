import type { Metadata } from 'next';

import { UploadWizard } from '@/components/operations/contacts/upload-wizard';

export const metadata: Metadata = {
  title: '현황 - 엑셀 업로드',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactsUploadNewPage({ params }: PageProps) {
  const { id: surveyId } = await params;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">엑셀 업로드</h2>
        <p className="text-sm text-slate-500">컨택 명단을 엑셀 .xlsx 로 적재합니다.</p>
      </div>
      <UploadWizard surveyId={surveyId} />
    </main>
  );
}
