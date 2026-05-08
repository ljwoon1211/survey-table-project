import Link from 'next/link';

import type { MailTemplate } from '@/db/schema/mail';

import { DeleteTemplateButton } from './delete-template-button';

interface Props {
  surveyId: string;
  templates: MailTemplate[];
}

export function MailTemplateList({ surveyId, templates }: Props) {
  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-white p-12 text-center text-gray-500">
        등록된 메일 템플릿이 없습니다.
        <div className="mt-2">
          <Link
            href={`/admin/surveys/${surveyId}/operations/mail-templates/new`}
            className="text-blue-600 hover:underline"
          >
            새 템플릿 만들기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr className="text-left text-sm text-gray-500">
            <th className="px-4 py-3">이름</th>
            <th className="px-4 py-3">제목</th>
            <th className="px-4 py-3">갱신</th>
            <th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id} className="border-t border-gray-100 text-sm hover:bg-gray-50">
              <td className="px-4 py-3 font-medium">
                <Link
                  href={`/admin/surveys/${surveyId}/operations/mail-templates/${t.id}/edit`}
                  className="text-blue-600 hover:underline"
                >
                  {t.name}
                </Link>
              </td>
              <td className="max-w-md truncate px-4 py-3 text-gray-700">{t.subject || '—'}</td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(t.updatedAt).toLocaleDateString('ko-KR')}
              </td>
              <td className="px-4 py-3 text-right">
                <DeleteTemplateButton
                  surveyId={surveyId}
                  templateId={t.id}
                  templateName={t.name}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
