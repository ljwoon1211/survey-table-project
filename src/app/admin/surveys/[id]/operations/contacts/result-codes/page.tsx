import type { Metadata } from 'next';

import { ResultCodesEditor } from '@/components/operations/contacts/result-codes-editor';
import { getContactResultCodes } from '@/lib/operations/contacts.server';

export const metadata: Metadata = {
  title: '현황 - 결과코드 설정',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactResultCodesPage({ params }: PageProps) {
  const { id: surveyId } = await params;
  const codes = await getContactResultCodes(surveyId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">결과코드 설정</h2>
        <p className="text-sm text-slate-500">컨택 회차의 결과코드 라디오를 사용자 정의합니다.</p>
      </div>
      <ResultCodesEditor surveyId={surveyId} initialCodes={codes} />
    </main>
  );
}
