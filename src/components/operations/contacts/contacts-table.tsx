'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { TablePagerFooter } from '@/components/operations/table-primitives';
import type { ContactColumnDef, ContactColumnScheme } from '@/db/schema/schema-types';
import { useSearchParamsMutator } from '@/hooks/use-search-params-mutator';
import { attrsKeyOf } from '@/lib/operations/contacts';
import type { ContactsRow } from '@/lib/operations/contacts.server';

interface ContactsTableProps {
  rows: ContactsRow[];
  total: number;
  page: number;
  pageSize: number;
  scheme: ContactColumnScheme;
  surveyId: string;
}

const dateShort = new Intl.DateTimeFormat('ko-KR', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * 컨택리스트 표.
 *
 * 컬럼 스킴(ContactColumnScheme) 기반 동적 헤더/셀 렌더 + 응답 완료 행 강조.
 * - attrs.* source: row.attrs[키] 표시 (이메일/사업자번호는 마스킹)
 * - system.resid/contact_result/web: 시스템 필드
 * - system.email_count/contact_owner: 다음 슬라이스 (메일발송/면접원) 까지 placeholder
 *
 * 페이지네이션은 TablePagerFooter (totalPages/onPrev/onNext) 패턴을 그대로 사용.
 */
export function ContactsTable({
  rows,
  total,
  page,
  pageSize,
  scheme,
  surveyId,
}: ContactsTableProps) {
  const pushParams = useSearchParamsMutator();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const visibleColumns = scheme.columns
    .filter((c) => !c.hidden)
    .sort((a, b) => a.order - b.order);

  function renderCell(col: ContactColumnDef, row: ContactsRow): React.ReactNode {
    const attrsKey = attrsKeyOf(col.source);
    if (attrsKey) {
      // 매핑된 시스템 필드는 마스킹 적용
      if (attrsKey === '이메일') return row.emailMasked;
      if (attrsKey === '사업자번호') return row.bizMasked;
      const v = row.attrs[attrsKey];
      return v && v !== '' ? v : '—';
    }
    switch (col.source) {
      case 'system.resid':
        return <span className="tabular-nums">{row.resid}</span>;
      case 'system.contact_result':
        return row.latestResultCode ? (
          <span className="text-xs">
            [{row.latestAttemptNo}] {row.latestResultCode}
          </span>
        ) : (
          '—'
        );
      case 'system.email_count':
        return '—'; // 다음 슬라이스 메일발송
      case 'system.web':
        return row.respondedAt ? (
          <span
            className="inline-block h-2 w-2 rounded-full bg-blue-500"
            title={`응답 ${dateShort.format(row.respondedAt)}`}
          />
        ) : (
          <span className="inline-block h-2 w-2 rounded-full bg-slate-200" />
        );
      case 'system.contact_owner':
        return '—'; // 다음 슬라이스 면접원
      default:
        return '—';
    }
  }

  function copyInviteLink(row: ContactsRow) {
    const url = `${window.location.origin}/survey/${surveyId}?invite=${row.inviteToken}`;
    navigator.clipboard.writeText(url);
    setCopiedId(row.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const handlePageChange = (newPage: number) => {
    pushParams((p) => {
      if (newPage <= 1) p.delete('page');
      else p.set('page', String(newPage));
    });
  };

  return (
    <div>
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className="border-b px-3 py-2 text-left whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
              <th className="border-b px-3 py-2 text-right">초대링크</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const responded = row.respondedAt != null;
              return (
                <tr key={row.id} className={responded ? 'bg-blue-50' : 'border-t'}>
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2 ${responded ? 'border-t border-blue-100' : ''}`}
                    >
                      {renderCell(col, row)}
                    </td>
                  ))}
                  <td
                    className={`px-3 py-2 text-right ${responded ? 'border-t border-blue-100' : ''}`}
                  >
                    <Button size="sm" variant="ghost" onClick={() => copyInviteLink(row)}>
                      {copiedId === row.id ? '복사됨!' : '복사'}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <TablePagerFooter
          total={total}
          page={page}
          totalPages={totalPages}
          onPrev={() => handlePageChange(page - 1)}
          onNext={() => handlePageChange(page + 1)}
        />
      )}
    </div>
  );
}
