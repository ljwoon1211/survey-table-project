import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { TableColumn, TableRow } from '@/types/survey';
import { MobileRowCard } from '@/components/survey-builder/mobile-row-card';

const columns: TableColumn[] = [
  { id: 'c0', label: '항목', width: 100 },
  { id: 'c1', label: '설명', width: 200 },
  { id: 'c2', label: '점수', width: 100 },
];

function row(mobileDisplay?: 'hidden' | 'inline' | 'collapsed'): TableRow {
  return {
    id: 'r1',
    label: '가격',
    cells: [
      { id: 'r1c0', type: 'radio', radioOptions: [{ id: 'o', label: '가격', value: 'v' }] } as never,
      { id: 'r1c1', type: 'text', content: '가격 설명', mobileDisplay } as never,
      { id: 'r1c2', type: 'input' } as never,
    ],
  } as TableRow;
}

function renderCard(r: TableRow) {
  return render(
    <MobileRowCard
      row={r}
      visibleColumns={columns}
      columnSectionMap={null}
      completed={false}
      hideColumnLabels={false}
      questionId="q1"
      isTestMode={false}
    />,
  );
}

describe('MobileRowCard 표시 셀', () => {
  it('미지정(기본 hidden) text 셀은 카드에 노출되지 않는다 (회귀)', () => {
    renderCard(row(undefined));
    expect(screen.queryByText('가격 설명')).not.toBeInTheDocument();
  });

  it('inline 지정 text 셀은 카드에 노출된다', () => {
    renderCard(row('inline'));
    expect(screen.getByText('가격 설명')).toBeInTheDocument();
  });

  it('collapsed 지정 text 셀은 "자세히" 토글 뒤 노출된다', () => {
    renderCard(row('collapsed'));
    expect(screen.queryByText('가격 설명')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /자세히/ })).toBeInTheDocument();
  });
});
