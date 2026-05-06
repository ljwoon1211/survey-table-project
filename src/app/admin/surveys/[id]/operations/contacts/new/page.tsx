import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ContactDetailForm } from '@/components/operations/contacts/contact-detail-form';
import type { ContactColumnScheme } from '@/db/schema/schema-types';
import { attrsKeyOf } from '@/lib/operations/contacts';
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

function extractSystemFieldKeys(scheme: ContactColumnScheme) {
  const result: { group?: string; email?: string; biz?: string } = {};
  for (const c of scheme.columns) {
    const k = attrsKeyOf(c.source);
    if (!k) continue;
    if (!result.group && (k.includes('전시회') || k.includes('캠페인'))) result.group = k;
    if (
      !result.email &&
      (k === '이메일' || k.includes('이메일') || k.toLowerCase().includes('email'))
    )
      result.email = k;
    if (!result.biz && k.includes('사업자')) result.biz = k;
  }
  return result;
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
