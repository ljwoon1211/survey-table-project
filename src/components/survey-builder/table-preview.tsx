'use client';

import React, { useMemo } from 'react';

import { FileText } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { HeaderCell, TableColumn, TableRow } from '@/types/survey';
import {
  buildGridTemplateCols,
  calcTotalWidth,
  getAlignmentClasses,
  getGridCellAria,
  getGridSpanStyle,
} from '@/utils/table-grid-utils';

import { PreviewCell } from './cells';

const HEADER_CELL_CLASS =
  'flex items-center justify-center border-r border-b border-gray-300 bg-gray-50 px-4 py-3 text-center font-medium';

const EMPTY_LABEL = <span className="text-sm text-gray-400 italic" />;

interface HeaderCellViewProps {
  label?: string;
  colspan?: number;
  rowspan?: number;
}

function HeaderCellView({ label, colspan = 1, rowspan = 1 }: HeaderCellViewProps) {
  return (
    <div
      className={HEADER_CELL_CLASS}
      style={getGridSpanStyle(colspan, rowspan)}
      {...getGridCellAria('columnheader', colspan, rowspan)}
    >
      {label || EMPTY_LABEL}
    </div>
  );
}

interface TablePreviewProps {
  tableTitle?: string;
  columns?: TableColumn[];
  rows?: TableRow[];
  tableHeaderGrid?: HeaderCell[][];
  className?: string;
  hideColumnLabels?: boolean;
}

export const TablePreview = React.memo(function TablePreview({
  tableTitle,
  columns = [],
  rows = [],
  tableHeaderGrid,
  className,
  hideColumnLabels = false,
}: TablePreviewProps) {
  const totalWidth = useMemo(() => calcTotalWidth(columns), [columns]);
  const gridTemplateCols = useMemo(() => buildGridTemplateCols(columns), [columns]);

  if (columns.length === 0 || rows.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <div className="text-center text-gray-500">
            <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <p>테이블을 구성해주세요</p>
            <p className="text-sm">열과 행을 추가하여 테이블을 만들어보세요</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 헤더 셀 렌더링 (다단계 or 단일)
  const renderHeaderCells = () => {
    if (hideColumnLabels) return null;

    if (tableHeaderGrid && tableHeaderGrid.length > 0) {
      return tableHeaderGrid.flatMap((headerRow) =>
        headerRow.map((cell) => (
          <HeaderCellView
            key={cell.id}
            label={cell.label}
            colspan={cell.colspan}
            rowspan={cell.rowspan}
          />
        )),
      );
    }

    // 단일 행 헤더 (폴백)
    return columns.map((column) => {
      if (column.isHeaderHidden) return null;
      return (
        <HeaderCellView key={column.id} label={column.label} colspan={column.colspan} />
      );
    });
  };

  return (
    <Card className={className}>
      {tableTitle && (
        <CardHeader>
          <CardTitle>{tableTitle}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="overflow-x-auto">
          <div
            role="grid"
            className="mx-auto overflow-hidden rounded-md border-t border-l border-r border-gray-300 bg-white"
            style={{
              display: 'grid',
              gridTemplateColumns: gridTemplateCols,
              width: `${totalWidth}px`,
            }}
          >
            {/* 헤더 */}
            {renderHeaderCells()}

            {/* 바디 */}
            {rows.map((row) =>
              row.cells.map((cell) => {
                if (cell.isHidden) return null;

                return (
                  <div
                    key={cell.id}
                    className={cn(
                      'min-w-0 border-r border-b border-gray-300 bg-white p-3',
                      getAlignmentClasses(cell.horizontalAlign, cell.verticalAlign),
                    )}
                    style={getGridSpanStyle(cell.colspan, cell.rowspan)}
                    data-row-id={row.id}
                    {...getGridCellAria('gridcell', cell.colspan, cell.rowspan)}
                  >
                    <PreviewCell cell={cell} />
                  </div>
                );
              }),
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
