import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ContactDetailForm } from '@/components/operations/contacts/contact-detail-form';
import { extractSystemFieldKeys } from '@/lib/operations/contacts-shared';
import {
  getContactColumnScheme,
  getContactResultCodes,
} from '@/lib/operations/contacts.server';

export const metadata: Metadata = {
  title: '현황 - 컨택 추가',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactNewPage({ params }: PageProps) {
  const { id: surveyId } = await params;

  const [scheme, resultCodes] = await Promise.all([
    getContactColumnScheme(surveyId),
    getContactResultCodes(surveyId),
  ]);
  if (!scheme) notFound();

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">컨택 추가</h2>
        <p className="text-sm text-slate-500">새 컨택을 직접 추가합니다.</p>
      </div>

      <ContactDetailForm
        surveyId={surveyId}
        scheme={scheme}
        resultCodes={resultCodes}
        systemFieldKeys={extractSystemFieldKeys(scheme)}
      />
    </main>
  );
}
