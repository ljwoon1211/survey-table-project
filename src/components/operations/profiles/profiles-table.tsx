'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { useMemo } from 'react';

import { useSearchParamsMutator } from '@/hooks/use-search-params-mutator';
import { cn } from '@/lib/utils';
import { formatPlatformKo, type Platform } from '@/lib/operations/parse-ua';
import {
  formatTotalTime,
  mapStatusPill,
  parseQuestionNumberFromTitle,
  type StatusPillResult,
} from '@/lib/operations/profiles';
import type { ProfilesRow, SortDir, SortKey } from '@/lib/operations/profiles.server';

import { EmptyState } from '../empty-state';
import { StatusPill } from './status-pill';

interface QuestionMeta {
  id: string;
  order: number;
  title: string;
}

interface Props {
  rows: ProfilesRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: SortKey;
  dir: SortDir;
  /** 진척률 N/M·Qx 표기에 사용. surveyId 의 questions 메타 (id → order, title) */
  questions: ReadonlyArray<QuestionMeta>;
}

const DATETIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatDateTime(d: Date | null): string {
  if (!d) return '—';
  // ko-KR 'YYYY. MM. DD. HH:mm' → 'YYYY-MM-DD HH:mm'
  const parts = DATETIME_FORMATTER.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

interface DisplayRow {
  id: string;
  idx: number;
  ipMasked: string;
  platformKo: string;
  browser: string;
  pill: StatusPillResult;
  startedAtText: string;
  completedAtText: string;
  totalTimeText: string;
}

/**
 * 응답자 목록 테이블.
 *
 * - 9 컬럼: 순번/컨택그룹/접속IP/접속 단말/브라우저/상태/시작일시/종료일시/소요시간
 * - 정렬 키 클릭 → URL state(`sort`, `dir`) 갱신, 페이지 리셋(`page=1`)
 * - 빈 상태: 검색결과 0건 vs 응답 0건 두 종류는 page.tsx 에서 분기 (이 컴포넌트는 단일 EmptyState)
 * - 페이지네이션: prev/next 만 노출 (slice 1 daily-stats-table 패턴)
 */
export function ProfilesTable({ rows, total, page, pageSize, sort, dir, questions }: Props) {
  const pushParams = useSearchParamsMutator();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const questionsById = useMemo(() => {
    const map = new Map<string, QuestionMeta>();
    for (const q of questions) map.set(q.id, q);
    return map;
  }, [questions]);

  const totalSteps = questions.length;

  const display = useMemo<DisplayRow[]>(
    () =>
      rows.map((r) => {
        const q = r.currentStepId ? (questionsById.get(r.currentStepId) ?? null) : null;
        const qNumber = q ? parseQuestionNumberFromTitle(q.title) : null;
        const pill = mapStatusPill({
          status: r.status,
          currentStepOrder: q?.order ?? null,
          totalSteps,
          qNumber,
        });
        // defensive: completed 인데 completed_at 이 null
        if (r.status === 'completed' && r.completedAt === null) {
          // eslint-disable-next-line no-console
          console.warn(
            '[profiles-table] inconsistent row: completed status with null completed_at',
            { id: r.id },
          );
        }
        return {
          id: r.id,
          idx: r.idx,
          ipMasked: r.ipMasked,
          platformKo: formatPlatformKo(r.platform as Platform | null),
          browser: r.browser ?? 'Other',
          pill,
          startedAtText: formatDateTime(r.startedAt),
          completedAtText:
            r.status === 'in_progress' ? '진행 중' : formatDateTime(r.completedAt),
          totalTimeText: formatTotalTime(r.totalSeconds, r.status),
        };
      }),
    [rows, questionsById, totalSteps],
  );

  const columns = useMemo<ColumnDef<DisplayRow>[]>(
    () => [
      {
        id: 'idx',
        accessorKey: 'idx',
        header: '순번',
        meta: { align: 'right' as const, sortable: true },
      },
      {
        id: 'group',
        accessorFn: () => '공개링크',
        header: '컨택그룹',
        meta: { align: 'left' as const, sortable: false },
      },
      {
        id: 'ip',
        accessorKey: 'ipMasked',
        header: '접속IP',
        meta: { align: 'left' as const, sortable: true },
      },
      {
        id: 'platform',
        accessorKey: 'platformKo',
        header: '접속 단말',
        meta: { align: 'left' as const, sortable: true },
      },
      {
        id: 'browser',
        accessorKey: 'browser',
        header: '브라우저',
        meta: { align: 'left' as const, sortable: true },
      },
      {
        id: 'status',
        accessorKey: 'pill',
        header: '상태',
        cell: ({ row }) => <StatusPill pill={row.original.pill} />,
        meta: { align: 'center' as const, sortable: false },
      },
      {
        id: 'startedAt',
        accessorKey: 'startedAtText',
        header: '시작일시',
        meta: { align: 'left' as const, sortable: true },
      },
      {
        id: 'completedAt',
        accessorKey: 'completedAtText',
        header: '종료일시',
        meta: { align: 'left' as const, sortable: true },
      },
      {
        id: 'totalSeconds',
        accessorKey: 'totalTimeText',
        header: '소요시간',
        meta: { align: 'right' as const, sortable: true },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: display,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleSortClick = (columnId: string) => {
    const newSort = columnId as SortKey;
    const newDir: SortDir = sort === newSort && dir === 'desc' ? 'asc' : 'desc';
    pushParams((p) => {
      p.set('sort', newSort);
      p.set('dir', newDir);
      p.delete('page');
    });
  };

  const handlePageChange = (newPage: number) => {
    pushParams((p) => {
      if (newPage <= 1) p.delete('page');
      else p.set('page', String(newPage));
    });
  };

  if (rows.length === 0) {
    return (
      <EmptyState
        message="검색 결과가 없습니다"
        description="필터를 초기화하거나 검색어를 바꿔 보세요"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="bg-slate-50">
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta as
                  | { align?: 'left' | 'right' | 'center'; sortable?: boolean }
                  | undefined;
                const align = meta?.align ?? 'left';
                const sortable = meta?.sortable ?? false;
                const isActive = sortable && sort === (header.column.id as SortKey);
                const ariaSort = isActive
                  ? dir === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none';
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={ariaSort}
                    className={cn(
                      'px-3 py-2 text-xs font-medium uppercase tracking-wider text-slate-600',
                      align === 'right'
                        ? 'text-right'
                        : align === 'center'
                          ? 'text-center'
                          : 'text-left',
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSortClick(header.column.id)}
                        className={cn(
                          'inline-flex items-center gap-1 select-none rounded hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                          align === 'right' ? 'flex-row-reverse' : '',
                        )}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span
                          aria-hidden="true"
                          className={
                            isActive ? 'text-slate-400' : 'inline-block w-2 text-transparent'
                          }
                        >
                          {isActive ? (dir === 'asc' ? '▲' : '▼') : '▲'}
                        </span>
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta as
                  | { align?: 'left' | 'right' | 'center' }
                  | undefined;
                const align = meta?.align ?? 'left';
                return (
                  <td
                    key={cell.id}
                    className={cn(
                      'px-3 py-2 text-slate-700 tabular-nums',
                      align === 'right'
                        ? 'text-right'
                        : align === 'center'
                          ? 'text-center'
                          : 'text-left',
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between gap-2 px-1 text-xs text-slate-600">
          <span>
            총 {total.toLocaleString('ko-KR')}건 · {page} / {totalPages} 페이지
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹ 이전
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              다음 ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
