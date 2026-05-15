import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { UploadHistoryTable } from '@/components/operations/contacts/upload-history-table';
import { listContactUploads } from '@/lib/operations/contacts.server';

export const metadata: Metadata = {
  title: '현황 - 조사 대상 업로드',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactsUploadPage({ params }: PageProps) {
  const { id: surveyId } = await params;
  const rows = await listContactUploads(surveyId);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">조사 대상 업로드</h2>
          <p className="text-sm text-slate-500">
            엑셀 파일 업로드 이력 — 총 {rows.length.toLocaleString('ko-KR')}건
          </p>
        </div>
        <Button asChild>
          <Link href={`/admin/surveys/${surveyId}/operations/contacts/upload/new`}>
            새 업로드
          </Link>
        </Button>
      </div>

      <UploadHistoryTable surveyId={surveyId} rows={rows} />
    </main>
  );
}
