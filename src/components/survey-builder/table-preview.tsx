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
      return tableHeaderGrid.flatMap((headerRow, rowIdx) =>
        headerRow.map((cell) => (
          <div
            key={cell.id}
            className="bg-gray-50 px-4 py-3 text-center font-medium"
            style={getGridSpanStyle(cell.colspan, cell.rowspan)}
            {...getGridCellAria('columnheader', cell.colspan, cell.rowspan)}
          >
            {cell.label || <span className="text-sm text-gray-400 italic" />}
          </div>
        )),
      );
    }

    // 단일 행 헤더 (폴백)
    return columns.map((column) => {
      if (column.isHeaderHidden) return null;
      const headerColspan = column.colspan || 1;
      return (
        <div
          key={column.id}
          className="bg-gray-50 px-4 py-3 text-center font-medium"
          style={getGridSpanStyle(headerColspan)}
          {...getGridCellAria('columnheader', headerColspan)}
        >
          {column.label || <span className="text-sm text-gray-400 italic" />}
        </div>
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
            className="overflow-hidden rounded-lg bg-gray-300"
            style={{
              display: 'grid',
              gridTemplateColumns: gridTemplateCols,
              gap: '1px',
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
                      'min-w-0 bg-white p-3',
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
