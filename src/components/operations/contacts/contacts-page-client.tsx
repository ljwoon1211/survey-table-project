'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { ContactsTable } from '@/components/operations/contacts/contacts-table';
import type { ContactColumnScheme } from '@/db/schema/schema-types';
import type { ContactsSortDir, ContactsSortKey } from '@/lib/operations/contacts';
import type { ContactsRow } from '@/lib/operations/contacts.server';

interface ContactsPageClientProps {
  surveyId: string;
  scheme: ContactColumnScheme;
  rows: ContactsRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: ContactsSortKey;
  dir: ContactsSortDir;
}

export function ContactsPageClient({
  surveyId,
  scheme,
  rows,
  total,
  page,
  pageSize,
  sort,
  dir,
}: ContactsPageClientProps) {
  const router = useRouter();

  return (
    <>
      <div className="mb-3 flex items-center justify-end">
        <Button
          size="sm"
          onClick={() => router.push(`/admin/surveys/${surveyId}/operations/contacts/new`)}
        >
          + 컨택 추가
        </Button>
      </div>

      <ContactsTable
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        scheme={scheme}
        sort={sort}
        dir={dir}
        onRowClick={(row) =>
          router.push(`/admin/surveys/${surveyId}/operations/contacts/${row.id}`)
        }
      />
    </>
  );
}
