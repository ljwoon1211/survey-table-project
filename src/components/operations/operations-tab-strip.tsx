'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

interface OperationsTabStripProps {
  surveyId: string;
}

/**
 * 현황 콘솔 상단 3-탭 스트립.
 *
 * - `/admin/surveys/[id]/operations/*` 경로에서만 노출한다.
 * - 현재 슬라이스에서는 "Field work" 탭만 활성화되며,
 *   "Report" / "Contact" 는 시각적으로만 비활성 표시한다.
 *
 * 탭 스타일은 mockup-pages.html `.tab` / `.tab.active` 규칙에 맞춰
 * - 비활성: text-slate-500, border-b-2 transparent
 * - 활성:   text-blue-600, font-semibold, border-b-blue-600
 * - 비활성(disabled): text-slate-400, cursor-not-allowed
 * 패딩은 `px-4 py-3` 으로 컴팩트하게 잡는다.
 */
export function OperationsTabStrip({ surveyId }: OperationsTabStripProps) {
  const pathname = usePathname();
  const operationsBase = `/admin/surveys/${surveyId}/operations`;
  const isOperations = pathname?.startsWith(operationsBase) ?? false;

  if (!isOperations) {
    return null;
  }

  return (
    <div className="border-b border-gray-200 bg-white">
      <nav
        aria-label="현황 콘솔 메뉴"
        className="mx-auto flex max-w-7xl gap-1 px-6"
      >
        <TabLink
          href={`${operationsBase}/overview`}
          active={pathname?.startsWith(`${operationsBase}/overview`) ?? false}
        >
          Field work
        </TabLink>
        <TabDisabled>Report</TabDisabled>
        <TabDisabled>Contact</TabDisabled>
      </nav>
    </div>
  );
}

interface TabLinkProps {
  href: string;
  active: boolean;
  children: React.ReactNode;
}

function TabLink({ href, active, children }: TabLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-1 border-b-2 px-4 py-3 text-sm transition-colors',
        active
          ? 'border-blue-600 font-semibold text-blue-600'
          : 'border-transparent text-slate-500 hover:text-slate-900',
      )}
    >
      {children}
    </Link>
  );
}

interface TabDisabledProps {
  children: React.ReactNode;
}

function TabDisabled({ children }: TabDisabledProps) {
  return (
    <span
      aria-disabled="true"
      className="flex cursor-not-allowed items-center gap-1 border-b-2 border-transparent px-4 py-3 text-sm text-slate-400"
    >
      {children}
    </span>
  );
}
