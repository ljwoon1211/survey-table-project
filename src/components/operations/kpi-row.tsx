import type { StatusCounts } from '@/lib/operations/aggregate-status';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KpiRowProps {
  counts: StatusCounts;
}

interface KpiCellSpec {
  /** 셀 라벨 (목업 기준) — 한/영 혼용은 의도적임 (운영팀 관행) */
  label: string;
  /** counts에서 이 셀이 보여줄 값 키 */
  field: keyof Omit<StatusCounts, 'total' | 'inProgress'> | 'total';
  /**
   * 비율 텍스트(△n%)에 적용할 색상 — 'drop'은 의미상 부정적이므로 rose 톤.
   * total 셀은 '100%'를 보여주는 것이 어색하므로 숨김 처리.
   */
  deltaTone?: 'rose' | 'slate' | 'hidden';
}

const CELLS: KpiCellSpec[] = [
  { label: 'Total', field: 'total', deltaTone: 'hidden' },
  { label: 'Completed', field: 'completed', deltaTone: 'slate' },
  { label: 'Screened', field: 'screenedOut', deltaTone: 'slate' },
  { label: 'Quotaful', field: 'quotafulOut', deltaTone: 'slate' },
  { label: 'Bad Answer', field: 'bad', deltaTone: 'slate' },
  { label: 'Drop(ing..)', field: 'drop', deltaTone: 'rose' },
];

const numberFormatter = new Intl.NumberFormat('ko-KR');

function formatValue(value: number, isEmpty: boolean): string {
  if (isEmpty) return '—';
  return numberFormatter.format(value);
}

function formatDelta(
  value: number,
  total: number,
  tone: KpiCellSpec['deltaTone'],
  isEmpty: boolean,
): string {
  if (tone === 'hidden') return '';
  if (isEmpty || total === 0) return '—';
  const pct = (value / total) * 100;
  // 소수 첫째 자리 — 분석 페이지와 동일한 표기 정책
  return `${pct.toFixed(1)}%`;
}

interface KpiCellProps {
  label: string;
  value: string;
  delta: string;
  deltaTone: KpiCellSpec['deltaTone'];
}

function KpiCell({ label, value, delta, deltaTone }: KpiCellProps) {
  return (
    <Card>
      <CardContent className="px-4 py-3 pt-3">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        {deltaTone !== 'hidden' && (
          <p
            className={cn(
              'mt-0.5 text-xs',
              deltaTone === 'rose' ? 'text-rose-600' : 'text-slate-400',
            )}
          >
            {delta}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 운영 현황 콘솔 — A1 KPI Row.
 * 6개 셀(Total / Completed / Screened / Quotaful / Bad / Drop)을 가로로 나열한다.
 *
 * total === 0 (응답 없음)일 때:
 *   - 행 자체는 그대로 유지하고, 각 셀의 값/비율을 "—"로 표기한다.
 *   - 페이지 단위 EmptyState는 상위 컴포지션에서 처리한다 (plan §9).
 */
export function KpiRow({ counts }: KpiRowProps) {
  const isEmpty = counts.total === 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {CELLS.map((cell) => {
        const value = counts[cell.field];
        return (
          <KpiCell
            key={cell.field}
            label={cell.label}
            value={formatValue(value, isEmpty)}
            delta={formatDelta(value, counts.total, cell.deltaTone, isEmpty)}
            deltaTone={cell.deltaTone}
          />
        );
      })}
    </div>
  );
}
