'use client';

import React, { useCallback, useRef, useState } from 'react';

import {
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  Circle,
  Clipboard,
  Copy,
  Image,
  Plus,
  Trash2,
  Video,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generateId } from '@/lib/utils';
import { TableCell, TableColumn, TableRow } from '@/types/survey';

import { CellContentModal } from './cell-content-modal';

interface DynamicTableEditorProps {
  tableTitle?: string;
  columns?: TableColumn[];
  rows?: TableRow[];
  currentQuestionId?: string;
  onTableChange: (data: {
    tableTitle: string;
    tableColumns: TableColumn[];
    tableRowsData: TableRow[];
  }) => void;
}

export function DynamicTableEditor({
  tableTitle = '',
  columns = [],
  rows = [],
  currentQuestionId = '',
  onTableChange,
}: DynamicTableEditorProps) {
  // isHidden 속성을 재계산하는 헬퍼 함수
  const recalculateHiddenCells = useCallback((tableRows: TableRow[]): TableRow[] => {
    return tableRows.map((row, rIndex) => ({
      ...row,
      cells: row.cells.map((c, cIndex) => {
        // 현재 셀이 병합으로 인해 숨겨져야 하는지 확인
        let shouldBeHidden = false;

        // 모든 행과 열을 순회하면서 병합된 셀이 현재 셀을 덮는지 확인
        for (let r = 0; r < tableRows.length; r++) {
          for (let col = 0; col < tableRows[r].cells.length; col++) {
            const checkCell = tableRows[r].cells[col];
            const rowspan = checkCell.rowspan || 1;
            const colspan = checkCell.colspan || 1;

            // 병합된 셀이 있고, 병합 영역이 1보다 큰 경우만 처리
            if (rowspan > 1 || colspan > 1) {
              const isInRowRange = rIndex >= r && rIndex < r + rowspan;
              const isInColRange = cIndex >= col && cIndex < col + colspan;

              // 병합 영역 내에 있고, 시작 셀이 아닌 경우
              if (isInRowRange && isInColRange && !(r === rIndex && col === cIndex)) {
                shouldBeHidden = true;
                break;
              }
            }
          }
          if (shouldBeHidden) break;
        }

        return {
          ...c,
          isHidden: shouldBeHidden,
        };
      }),
    }));
  }, []);

  const [currentTitle, setCurrentTitle] = useState(tableTitle);
  const [currentColumns, setCurrentColumns] = useState<TableColumn[]>(
    columns.length > 0
      ? columns
      : [
          { id: 'col-1', label: '열 1', width: 150 },
          { id: 'col-2', label: '열 2', width: 150 },
        ],
  );
  const [currentRows, setCurrentRows] = useState<TableRow[]>(() => {
    const initialRows: TableRow[] =
      rows.length > 0
        ? rows
        : [
            {
              id: 'row-1',
              label: '행 1',
              height: 60,
              minHeight: 40,
              cells: [
                { id: 'cell-1-1', content: '', type: 'text' as const },
                { id: 'cell-1-2', content: '', type: 'text' as const },
              ],
            },
          ];

    // 초기 로드 시 isHidden 재계산
    return recalculateHiddenCells(initialRows);
  });

  const [selectedCell, setSelectedCell] = useState<{
    rowId: string;
    cellId: string;
  } | null>(null);

  // 셀 복사/붙여넣기 관련 상태
  const [copiedCell, setCopiedCell] = useState<TableCell | null>(null);
  const [copiedCellPosition, setCopiedCellPosition] = useState<{
    rowIndex: number;
    cellIndex: number;
  } | null>(null);

  // 드래그 리사이즈 관련 상태 (행)
  const [resizingRow, setResizingRow] = useState<{
    rowIndex: number;
    startY: number;
    startHeight: number;
  } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // 열 너비 편집 상태
  const [editingColumnWidth, setEditingColumnWidth] = useState<{
    columnIndex: number;
    value: string;
  } | null>(null);

  // 변경 사항을 부모에게 전달
  const notifyChange = useCallback(
    (title: string, cols: TableColumn[], rowsData: TableRow[]) => {
      onTableChange({
        tableTitle: title,
        tableColumns: cols,
        tableRowsData: rowsData,
      });
    },
    [onTableChange],
  );

  // 제목 업데이트
  const updateTitle = (title: string) => {
    setCurrentTitle(title);
    notifyChange(title, currentColumns, currentRows);
  };

  // 열 너비 직접 입력 관련 함수들
  const handleColumnWidthChange = useCallback(
    (columnIndex: number, width: number) => {
      const updatedColumns = currentColumns.map((col, index) =>
        index === columnIndex ? { ...col, width: Math.max(0, width) } : col,
      );

      setCurrentColumns(updatedColumns);
      notifyChange(currentTitle, updatedColumns, currentRows);
    },
    [currentColumns, currentTitle, currentRows, notifyChange],
  );

  // 행 높이 리사이즈 관련 함수들
  const handleRowResizeStart = useCallback(
    (e: React.MouseEvent, rowIndex: number) => {
      e.preventDefault();
      e.stopPropagation();

      const currentHeight = currentRows[rowIndex].height || 60;
      setResizingRow({
        rowIndex,
        startY: e.clientY,
        startHeight: currentHeight,
      });
    },
    [currentRows],
  );

  const handleRowResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!resizingRow) return;

      const deltaY = e.clientY - resizingRow.startY;
      const newHeight = Math.max(40, resizingRow.startHeight + deltaY); // 최소 높이 40px

      const updatedRows = currentRows.map((row, index) =>
        index === resizingRow.rowIndex ? { ...row, height: newHeight } : row,
      );

      setCurrentRows(updatedRows);
    },
    [resizingRow, currentRows],
  );

  const handleRowResizeEnd = useCallback(() => {
    if (!resizingRow) return;

    // 최종 상태를 부모에게 전달
    notifyChange(currentTitle, currentColumns, currentRows);
    setResizingRow(null);
  }, [resizingRow, currentTitle, currentColumns, currentRows, notifyChange]);

  // 마우스 이벤트 리스너 등록/해제 (행 리사이즈)
  React.useEffect(() => {
    if (resizingRow) {
      document.addEventListener('mousemove', handleRowResizeMove);
      document.addEventListener('mouseup', handleRowResizeEnd);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleRowResizeMove);
        document.removeEventListener('mouseup', handleRowResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [resizingRow, handleRowResizeMove, handleRowResizeEnd]);

  // 열 추가
  const addColumn = () => {
    const newColumn: TableColumn = {
      id: generateId(),
      label: `열 ${currentColumns.length + 1}`,
      width: 150, // 기본 너비
    };

    const updatedColumns = [...currentColumns, newColumn];
    const newColIndex = currentColumns.length;

    // 모든 행에 새 셀 추가
    const updatedRows = currentRows.map((row, rowIndex) => {
      // 새 열 위치가 기존 병합 셀의 colspan 영역에 포함되는지 확인
      let shouldBeHidden = false;
      for (let col = 0; col < row.cells.length; col++) {
        const cell = row.cells[col];
        const colspan = cell.colspan || 1;
        if (col < newColIndex && col + colspan > newColIndex) {
          shouldBeHidden = true;
          break;
        }
      }

      return {
        ...row,
        cells: [
          ...row.cells,
          {
            id: `cell-${row.id}-${newColumn.id}`,
            content: '',
            type: 'text' as const,
            isHidden: shouldBeHidden,
          },
        ],
      };
    });

    setCurrentColumns(updatedColumns);
    setCurrentRows(updatedRows);
    notifyChange(currentTitle, updatedColumns, updatedRows);
  };

  // 열 삭제
  const deleteColumn = (columnIndex: number) => {
    if (currentColumns.length <= 1) return; // 최소 1개 열 유지

    if (
      !window.confirm(
        '정말 이 열을 삭제하시겠습니까?\n포함된 데이터가 모두 삭제되며, 복구할 수 없습니다.',
      )
    ) {
      return;
    }

    const updatedColumns = currentColumns.filter((_, index) => index !== columnIndex);

    // 모든 행에서 해당 셀 삭제
    const updatedRows = currentRows.map((row) => ({
      ...row,
      cells: row.cells.filter((_, index) => index !== columnIndex),
    }));

    setCurrentColumns(updatedColumns);
    setCurrentRows(updatedRows);
    notifyChange(currentTitle, updatedColumns, updatedRows);
  };

  // 열 이동
  const moveColumn = (columnIndex: number, direction: 'left' | 'right') => {
    if (direction === 'left' && columnIndex === 0) return;
    if (direction === 'right' && columnIndex === currentColumns.length - 1) return;

    const targetIndex = direction === 'left' ? columnIndex - 1 : columnIndex + 1;

    // 열 순서 변경
    const updatedColumns = [...currentColumns];
    [updatedColumns[columnIndex], updatedColumns[targetIndex]] = [
      updatedColumns[targetIndex],
      updatedColumns[columnIndex],
    ];

    // 행 데이터 내 셀 순서 변경
    const updatedRows = currentRows.map((row) => {
      const newCells = [...row.cells];
      [newCells[columnIndex], newCells[targetIndex]] = [
        newCells[targetIndex],
        newCells[columnIndex],
      ];
      return { ...row, cells: newCells };
    });

    // 병합된 셀 재계산 (이동 시 병합이 깨질 수 있으므로)
    const finalRows = recalculateHiddenCells(updatedRows);

    setCurrentColumns(updatedColumns);
    setCurrentRows(finalRows);
    notifyChange(currentTitle, updatedColumns, finalRows);
  };

  // 열 제목 업데이트
  const updateColumnLabel = (columnIndex: number, label: string) => {
    const updatedColumns = currentColumns.map((col, index) =>
      index === columnIndex ? { ...col, label } : col,
    );

    setCurrentColumns(updatedColumns);
    notifyChange(currentTitle, updatedColumns, currentRows);
  };

  // 행 추가
  const addRow = () => {
    // 현재 존재하는 행들의 라벨에서 숫자만 추출하여 가장 큰 수를 찾음
    const existingNumbers = currentRows
      .map((row) => {
        const match = row.label.match(/행 (\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));

    const maxNumber = Math.max(0, ...existingNumbers);
    const nextNumber = maxNumber + 1;

    const newRowId = generateId();

    // 새 행의 각 셀이 기존 병합 셀의 rowspan 영역에 포함되는지 확인
    const cells = currentColumns.map((col, colIndex) => {
      let shouldBeHidden = false;

      // 위쪽 행들을 확인하여 rowspan이 새 행까지 미치는지 체크
      for (let r = 0; r < currentRows.length; r++) {
        const cell = currentRows[r].cells[colIndex];
        if (!cell) continue;

        const rowspan = cell.rowspan || 1;
        const colspan = cell.colspan || 1;

        // 이 셀의 rowspan이 새 행까지 미치고, colspan이 현재 열을 포함하는지 확인
        if (r + rowspan > currentRows.length) {
          // rowspan이 범위를 넘어가는 경우 (새 행이 추가되면서 포함됨)
          // 사실 여기서는 기존 rowspan을 늘려주는 로직이 필요한게 아니라
          // 그냥 새 셀이 숨겨져야 하는지만 체크하면 됨.
          // 하지만 rowspan이 설정된 셀 아래에 새 행을 추가할 때
          // 자동으로 rowspan을 늘려주지는 않음 (사용자가 직접 늘려야 함)
          // 따라서 새 행의 셀은 기본적으로 보임.

          // 단, 이미 rowspan이 길게 설정되어 있어서 새 행 위치를 덮고 있다면 숨겨야 함.
          // 하지만 현재 로직상 addRow는 항상 맨 끝에 추가하므로,
          // 기존 행의 rowspan이 전체 row length보다 크지 않다면 겹칠 일은 없음.
          // 만약 중간 삽입이 아니라 맨 끝 추가라면 크게 신경 쓸 필요 없음.

          // 여기서는 기존 로직 유지하되, 맨 끝 추가이므로 shouldBeHidden은 false일 가능성이 높음.
          // 다만, 특정 셀의 rowspan이 매우 크게 설정되어 있었다면?
          if (r + rowspan > currentRows.length) {
            // currentRows.length는 추가 전 인덱스 (=새 행의 인덱스)
            // ... logic checks ...
            const cellColIndex = currentRows[r].cells.findIndex((c) => c.id === cell.id);
            if (colIndex >= cellColIndex && colIndex < cellColIndex + colspan) {
              shouldBeHidden = true;
              break;
            }
          }
        }
      }

      return {
        id: `cell-${newRowId}-${col.id}`,
        content: '',
        type: 'text' as const,
        isHidden: shouldBeHidden,
      };
    });

    const newRow: TableRow = {
      id: newRowId,
      label: `행 ${nextNumber}`, // 중복 방지된 라벨 사용
      height: 60, // 기본 행 높이
      minHeight: 40, // 최소 행 높이
      cells,
    };

    const updatedRows = [...currentRows, newRow];
    setCurrentRows(updatedRows);
    notifyChange(currentTitle, currentColumns, updatedRows);
  };

  // 행 삭제
  const deleteRow = (rowIndex: number) => {
    if (currentRows.length <= 1) return; // 최소 1개 행 유지

    if (
      !window.confirm(
        '정말 이 행을 삭제하시겠습니까?\n포함된 데이터가 모두 삭제되며, 복구할 수 없습니다.',
      )
    ) {
      return;
    }

    // 행 삭제 전에, 삭제되는 행에 병합된 셀이 있는지 확인하고 rowspan 조정
    const updatedRows = currentRows
      .map((row, rIndex) => {
        // 삭제되는 행 위쪽의 행들에서 rowspan 조정
        if (rIndex < rowIndex) {
          return {
            ...row,
            cells: row.cells.map((cell) => {
              const rowspan = cell.rowspan || 1;
              // rowspan이 삭제되는 행까지 미치는 경우 조정
              if (rIndex + rowspan > rowIndex) {
                const newRowspan = Math.max(1, rowspan - 1);
                return {
                  ...cell,
                  rowspan: newRowspan > 1 ? newRowspan : undefined,
                };
              }
              return cell;
            }),
          };
        }
        return row;
      })
      .filter((_, index) => index !== rowIndex); // 삭제되는 행 제거

    // 병합된 셀로 인해 숨겨져야 하는 셀들을 재계산
    const finalRows = recalculateHiddenCells(updatedRows);
    setCurrentRows(finalRows);
    notifyChange(currentTitle, currentColumns, finalRows);
  };

  // 행 이동
  const moveRow = (rowIndex: number, direction: 'up' | 'down') => {
    if (direction === 'up' && rowIndex === 0) return;
    if (direction === 'down' && rowIndex === currentRows.length - 1) return;

    const targetIndex = direction === 'up' ? rowIndex - 1 : rowIndex + 1;
    const updatedRows = [...currentRows];

    // 행 순서 교환
    [updatedRows[rowIndex], updatedRows[targetIndex]] = [
      updatedRows[targetIndex],
      updatedRows[rowIndex],
    ];

    // 병합된 셀 재계산
    const finalRows = recalculateHiddenCells(updatedRows);

    setCurrentRows(finalRows);
    notifyChange(currentTitle, currentColumns, finalRows);
  };

  // 행 제목 업데이트
  const updateRowLabel = (rowIndex: number, label: string) => {
    const updatedRows = currentRows.map((row, index) =>
      index === rowIndex ? { ...row, label } : row,
    );

    setCurrentRows(updatedRows);
    notifyChange(currentTitle, currentColumns, updatedRows);
  };

  // 행 코드 업데이트 (엑셀 내보내기용)
  const updateRowCode = (rowIndex: number, rowCode: string) => {
    const updatedRows = currentRows.map((row, index) =>
      index === rowIndex ? { ...row, rowCode } : row,
    );

    setCurrentRows(updatedRows);
    notifyChange(currentTitle, currentColumns, updatedRows);
  };

  // 셀 복사
  const copyCell = useCallback(
    (rowIndex: number, cellIndex: number) => {
      const cell = currentRows[rowIndex]?.cells[cellIndex];
      if (!cell) return;

      // ID를 제외한 모든 설정 복사
      const cellToCopy: TableCell = {
        ...cell,
        id: '', // ID는 붙여넣기 시 새로 생성
      };

      setCopiedCell(cellToCopy);
      setCopiedCellPosition({ rowIndex, cellIndex });
    },
    [currentRows],
  );

  // 셀 붙여넣기
  const pasteCell = useCallback(
    (rowIndex: number, cellIndex: number) => {
      if (!copiedCell) return;

      const targetCell = currentRows[rowIndex]?.cells[cellIndex];
      if (!targetCell) return;

      // 복사한 셀의 내용을 붙여넣되, ID는 대상 셀의 것을 유지
      const pastedCell: TableCell = {
        ...copiedCell,
        id: targetCell.id,
      };

      // 먼저 해당 셀을 업데이트
      let updatedRows = currentRows.map((row, rIndex) =>
        rIndex === rowIndex
          ? {
              ...row,
              cells: row.cells.map((c, cIndex) => (cIndex === cellIndex ? pastedCell : c)),
            }
          : row,
      );

      // 병합된 셀인 경우, 병합 영역 내의 모든 셀에 동일한 내용 복사
      const rowspan = pastedCell.rowspan || 1;
      const colspan = pastedCell.colspan || 1;

      if (rowspan > 1 || colspan > 1) {
        updatedRows = updatedRows.map((row, rIndex) => ({
          ...row,
          cells: row.cells.map((c, cIndex) => {
            // 병합 영역 내에 있는지 확인
            const isInRowRange = rIndex >= rowIndex && rIndex < rowIndex + rowspan;
            const isInColRange = cIndex >= cellIndex && cIndex < cellIndex + colspan;

            // 병합 영역 내에 있고, 시작 셀이 아닌 경우
            if (isInRowRange && isInColRange && !(rIndex === rowIndex && cIndex === cellIndex)) {
              // 시작 셀의 내용과 속성을 복사 (rowspan, colspan 제외)
              return {
                ...pastedCell,
                id: c.id, // 원래 셀의 ID는 유지
                rowspan: undefined, // 병합된 셀들은 rowspan/colspan을 가지지 않음
                colspan: undefined,
              };
            }

            return c;
          }),
        }));
      }

      // 병합된 셀로 인해 숨겨져야 하는 셀들을 재계산
      const finalRows = recalculateHiddenCells(updatedRows);

      setCurrentRows(finalRows);
      notifyChange(currentTitle, currentColumns, finalRows);
    },
    [copiedCell, currentRows, recalculateHiddenCells, currentTitle, currentColumns, notifyChange],
  );

  // 셀 삭제 (내용 초기화)
  const deleteCell = (rowIndex: number, cellIndex: number) => {
    const cell = currentRows[rowIndex]?.cells[cellIndex];
    if (!cell) return;

    const emptyCell: TableCell = {
      id: cell.id,
      content: '',
      type: 'text',
      rowspan: cell.rowspan,
      colspan: cell.colspan,
      horizontalAlign: cell.horizontalAlign,
      verticalAlign: cell.verticalAlign,
    };

    updateCell(rowIndex, cellIndex, emptyCell);
  };

  // 셀 내용 업데이트
  const updateCell = (rowIndex: number, cellIndex: number, cell: TableCell) => {
    // 먼저 해당 셀을 업데이트
    let updatedRows = currentRows.map((row, rIndex) =>
      rIndex === rowIndex
        ? {
            ...row,
            cells: row.cells.map((c, cIndex) => (cIndex === cellIndex ? cell : c)),
          }
        : row,
    );

    // 병합된 셀인 경우, 병합 영역 내의 모든 셀에 동일한 내용 복사
    const rowspan = cell.rowspan || 1;
    const colspan = cell.colspan || 1;

    if (rowspan > 1 || colspan > 1) {
      updatedRows = updatedRows.map((row, rIndex) => ({
        ...row,
        cells: row.cells.map((c, cIndex) => {
          // 병합 영역 내에 있는지 확인
          const isInRowRange = rIndex >= rowIndex && rIndex < rowIndex + rowspan;
          const isInColRange = cIndex >= cellIndex && cIndex < cellIndex + colspan;

          // 병합 영역 내에 있고, 시작 셀이 아닌 경우
          if (isInRowRange && isInColRange && !(rIndex === rowIndex && cIndex === cellIndex)) {
            // 시작 셀의 내용과 속성을 복사 (rowspan, colspan 제외)
            return {
              ...cell,
              id: c.id, // 원래 셀의 ID는 유지
              rowspan: undefined, // 병합된 셀들은 rowspan/colspan을 가지지 않음
              colspan: undefined,
            };
          }

          return c;
        }),
      }));
    }

    // 병합된 셀로 인해 숨겨져야 하는 셀들을 재계산
    const finalRows = recalculateHiddenCells(updatedRows);

    setCurrentRows(finalRows);
    notifyChange(currentTitle, currentColumns, finalRows);
    setSelectedCell(null);
  };

  // 병합 가능 여부 확인
  const canMerge = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right'): boolean => {
      if (!selectedCell) return false;

      const rowIndex = currentRows.findIndex((row) => row.id === selectedCell.rowId);
      const cellIndex = currentRows[rowIndex]?.cells.findIndex(
        (cell) => cell.id === selectedCell.cellId,
      );

      if (rowIndex === -1 || cellIndex === -1) return false;

      const cell = currentRows[rowIndex].cells[cellIndex];
      const rowspan = cell.rowspan || 1;
      const colspan = cell.colspan || 1;

      // 병합 대상 셀 찾기 및 유효성 검사
      if (direction === 'down') {
        // 아래쪽 끝이면 불가
        if (rowIndex + rowspan >= currentRows.length) return false;

        const targetRowIndex = rowIndex + rowspan;
        const targetCell = currentRows[targetRowIndex].cells[cellIndex];

        // 대상 셀이 이미 병합되어 숨겨진 상태라면, 그 숨김의 원인이 현재 셀이 아니면 불가
        // (단, 현재 로직상 바로 아래 셀은 현재 셀 병합 영역 바로 다음이므로 다른 병합에 속해있을 수 있음)
        if (targetCell.isHidden) return false;

        // 직사각형 유지 조건: 너비(colspan)가 같아야 함
        const targetColspan = targetCell.colspan || 1;
        if (colspan !== targetColspan) return false;

        return true;
      } else if (direction === 'right') {
        // 오른쪽 끝이면 불가
        if (cellIndex + colspan >= currentColumns.length) return false;

        const targetCellIndex = cellIndex + colspan;
        const targetCell = currentRows[rowIndex].cells[targetCellIndex];

        if (targetCell.isHidden) return false;

        // 직사각형 유지 조건: 높이(rowspan)가 같아야 함
        const targetRowspan = targetCell.rowspan || 1;
        if (rowspan !== targetRowspan) return false;

        return true;
      } else if (direction === 'up') {
        // 위쪽 끝이면 불가
        if (rowIndex === 0) return false;

        // 바로 위 셀 찾기
        // 주의: 바로 위 행의 같은 열 인덱스에 있는 셀이 병합되어 있을 수 있음
        // 따라서 위쪽 행을 순회하며 현재 셀 바로 위에 걸쳐있는 셀을 찾아야 함
        // 간단하게는 [rowIndex-1][cellIndex]를 확인하되, 그 셀이 isHidden일 수 있음

        // 위쪽으로 병합하려면 "위쪽 셀"이 기준이 되어야 함.
        // 즉, 위쪽 셀의 colspan이 현재 셀의 colspan과 같아야 함.
        // 또한 위쪽 셀이 이미 다른 셀과 병합되어 있을 수 있음 (rowspan > 1)

        // 현재 셀 바로 위의 셀을 찾기 위해 역추적 필요할 수 있으나,
        // 간단한 구현을 위해 [rowIndex-1]의 셀을 확인.
        // 만약 [rowIndex-1][cellIndex]가 hidden이라면, 그건 더 위의 셀에 병합된 것이므로
        // 그 "더 위의 셀"과 병합해야 함. 이건 복잡하므로
        // "바로 위 시각적 셀"과의 병합만 허용하거나,
        // 혹은 [rowIndex-1] 행의 해당 열 셀이 hidden이 아니어야만(즉 병합의 시작점이어야만) 허용.

        // 여기서는 "직관적"인 병합을 위해, 바로 위 행의 해당 셀이 병합의 시작점일 때만 허용
        const targetRowIndex = rowIndex - 1;
        const targetCell = currentRows[targetRowIndex]?.cells[cellIndex];

        if (!targetCell || targetCell.isHidden) return false;

        // 너비 일치 확인
        const targetColspan = targetCell.colspan || 1;
        if (colspan !== targetColspan) return false;

        return true;
      } else if (direction === 'left') {
        // 왼쪽 끝이면 불가
        if (cellIndex === 0) return false;

        const targetCellIndex = cellIndex - 1;
        const targetCell = currentRows[rowIndex]?.cells[targetCellIndex];

        if (!targetCell || targetCell.isHidden) return false;

        // 높이 일치 확인
        const targetRowspan = targetCell.rowspan || 1;
        if (rowspan !== targetRowspan) return false;

        return true;
      }

      return false;
    },
    [currentRows, currentColumns, selectedCell],
  );

  // 병합 실행
  const handleMerge = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!selectedCell || !canMerge(direction)) return;

      if (
        !window.confirm(
          '병합되는 셀의 내용은 삭제됩니다. 계속하시겠습니까?\n(기준 셀의 내용만 유지됩니다)',
        )
      ) {
        return;
      }

      const rowIndex = currentRows.findIndex((row) => row.id === selectedCell.rowId);
      const cellIndex = currentRows[rowIndex]?.cells.findIndex(
        (cell) => cell.id === selectedCell.cellId,
      );

      // 깊은 복사
      const newRows = structuredClone(currentRows);

      // 기준 셀과 병합 대상 셀 결정
      let baseRowIndex = rowIndex;
      let baseCellIndex = cellIndex;
      let targetRowIndex = -1;
      let targetCellIndex = -1;

      if (direction === 'down') {
        // 기준: 현재 셀, 대상: 아래 셀
        const cell = newRows[rowIndex].cells[cellIndex];
        const currentRowspan = cell.rowspan || 1;

        targetRowIndex = rowIndex + currentRowspan; // 병합될 다음 행
        targetCellIndex = cellIndex;

        // 기준 셀의 rowspan 증가
        const targetCell = newRows[targetRowIndex].cells[cellIndex];
        const targetRowspan = targetCell.rowspan || 1;
        cell.rowspan = currentRowspan + targetRowspan;

        // 병합 대상 셀들의 데이터 삭제 및 초기화는 recalculateHiddenCells에서 처리되지 않으므로
        // 여기서 명시적으로 처리해야 함.
        // 병합 영역 내의 모든 셀을 찾아 데이터를 초기화 (기준 셀 제외)
        // 하지만 아래의 recalculateHiddenCells가 isHidden을 처리하고,
        // 데이터 삭제 정책에 따라 여기서 targetCell의 데이터를 지워야 함.

        // 대상 셀 초기화 (나중에 병합 풀었을 때 빈 셀이 되도록)
        newRows[targetRowIndex].cells[cellIndex] = {
          ...targetCell,
          content: '',
          type: 'text',
          checkboxOptions: undefined,
          radioOptions: undefined,
          selectOptions: undefined,
          imageUrl: undefined,
          videoUrl: undefined,
          rowspan: undefined, // 병합되었으므로 속성 제거
          colspan: undefined,
        };
      } else if (direction === 'right') {
        // 기준: 현재 셀, 대상: 오른쪽 셀
        const cell = newRows[rowIndex].cells[cellIndex];
        const currentColspan = cell.colspan || 1;

        targetRowIndex = rowIndex;
        targetCellIndex = cellIndex + currentColspan;

        // 기준 셀의 colspan 증가
        const targetCell = newRows[rowIndex].cells[targetCellIndex];
        const targetColspan = targetCell.colspan || 1;
        cell.colspan = currentColspan + targetColspan;

        // 대상 셀 초기화
        newRows[targetRowIndex].cells[targetCellIndex] = {
          ...targetCell,
          content: '',
          type: 'text',
          checkboxOptions: undefined,
          radioOptions: undefined,
          selectOptions: undefined,
          imageUrl: undefined,
          videoUrl: undefined,
          rowspan: undefined,
          colspan: undefined,
        };
      } else if (direction === 'up') {
        // 기준: 위쪽 셀, 대상: 현재 셀
        // 위쪽 셀 찾기 (canMerge에서 검증됨)
        baseRowIndex = rowIndex - 1;
        baseCellIndex = cellIndex;

        const baseCell = newRows[baseRowIndex].cells[baseCellIndex];
        const targetCell = newRows[rowIndex].cells[cellIndex]; // 현재 셀이 병합당함

        // 기준 셀(위쪽)의 rowspan 증가
        const baseRowspan = baseCell.rowspan || 1;
        const targetRowspan = targetCell.rowspan || 1;
        baseCell.rowspan = baseRowspan + targetRowspan;

        // 대상 셀(현재 셀) 초기화
        newRows[rowIndex].cells[cellIndex] = {
          ...targetCell,
          content: '',
          type: 'text',
          checkboxOptions: undefined,
          radioOptions: undefined,
          selectOptions: undefined,
          imageUrl: undefined,
          videoUrl: undefined,
          rowspan: undefined,
          colspan: undefined,
        };

        // 선택된 셀 변경 (기준 셀로 이동)
        setSelectedCell({
          rowId: newRows[baseRowIndex].id,
          cellId: baseCell.id,
        });
      } else if (direction === 'left') {
        // 기준: 왼쪽 셀, 대상: 현재 셀
        baseRowIndex = rowIndex;
        baseCellIndex = cellIndex - 1;

        const baseCell = newRows[baseRowIndex].cells[baseCellIndex];
        const targetCell = newRows[rowIndex].cells[cellIndex]; // 현재 셀이 병합당함

        // 기준 셀(왼쪽)의 colspan 증가
        const baseColspan = baseCell.colspan || 1;
        const targetColspan = targetCell.colspan || 1;
        baseCell.colspan = baseColspan + targetColspan;

        // 대상 셀(현재 셀) 초기화
        newRows[rowIndex].cells[cellIndex] = {
          ...targetCell,
          content: '',
          type: 'text',
          checkboxOptions: undefined,
          radioOptions: undefined,
          selectOptions: undefined,
          imageUrl: undefined,
          videoUrl: undefined,
          rowspan: undefined,
          colspan: undefined,
        };

        // 선택된 셀 변경 (기준 셀로 이동)
        setSelectedCell({
          rowId: newRows[baseRowIndex].id,
          cellId: baseCell.id,
        });
      }

      // 병합된 영역 내의 숨겨진 셀들도 모두 초기화가 필요할 수 있음
      // (예: 2x2 병합 시, 대각선 아래 셀 등)
      // 현재 로직은 '인접한 두 덩어리'를 합치는 것이므로,
      // 각 덩어리의 '대표 셀(좌상단)'만 처리하면 recalculateHiddenCells가 나머지를 처리함.
      // 단, "병합당하는 덩어리"의 숨겨진 셀들은 데이터를 지워야 함.
      // 이는 recalculateHiddenCells가 isHidden을 재설정할 때 데이터까지 건드리지 않으므로,
      // 엄밀히는 순회하며 지워야 하지만, UI상 안 보이고 통계에도 안 잡히므로(isHidden)
      // 일단 대표 셀만 비우는 것으로 처리.
      // (나중에 병합 풀 때 대표 셀이 비어있으면 그 하위 셀들도 비어있는 것으로 간주됨)

      const finalRows = recalculateHiddenCells(newRows);
      setCurrentRows(finalRows);
      notifyChange(currentTitle, currentColumns, finalRows);
    },
    [
      selectedCell,
      currentRows,
      currentColumns,
      canMerge,
      recalculateHiddenCells,
      currentTitle,
      notifyChange,
    ],
  );

  // 병합 해제
  const handleUnmerge = useCallback(() => {
    if (!selectedCell) return;

    const rowIndex = currentRows.findIndex((row) => row.id === selectedCell.rowId);
    const cellIndex = currentRows[rowIndex]?.cells.findIndex(
      (cell) => cell.id === selectedCell.cellId,
    );

    if (rowIndex === -1 || cellIndex === -1) return;

    const cell = currentRows[rowIndex].cells[cellIndex];
    const rowspan = cell.rowspan || 1;
    const colspan = cell.colspan || 1;

    // 병합된 상태가 아니면 리턴
    if (rowspan <= 1 && colspan <= 1) return;

    // 깊은 복사
    const newRows = JSON.parse(JSON.stringify(currentRows)) as TableRow[];
    const targetCell = newRows[rowIndex].cells[cellIndex];

    // 병합 속성 초기화
    targetCell.rowspan = 1;
    targetCell.colspan = 1;

    // recalculateHiddenCells가 호출되면
    // 이 셀에 의해 숨겨졌던 셀들이 다시 나타남 (isHidden = false).
    // 이때 그 셀들은 이미 위에서 merge할 때 데이터가 지워졌으므로 빈 셀로 나타남.
    // 이는 의도된 동작("데이터 삭제 정책").

    const finalRows = recalculateHiddenCells(newRows);
    setCurrentRows(finalRows);
    notifyChange(currentTitle, currentColumns, finalRows);
  }, [
    selectedCell,
    currentRows,
    recalculateHiddenCells,
    currentTitle,
    currentColumns,
    notifyChange,
  ]);

  // 셀 렌더링 함수
  const renderCellContent = (cell: TableCell) => {
    const hasText = cell.content && cell.content.trim().length > 0;

    // 텍스트 콘텐츠가 있으면 상단에 렌더링 (모든 타입 공통)
    const textContent = hasText ? (
      <div
        className={`mb-2 w-full text-sm break-words whitespace-pre-wrap ${cell.type === 'text' ? '' : 'font-medium text-gray-700'}`}
      >
        {cell.content}
      </div>
    ) : null;

    // 타입별 콘텐츠 렌더링
    let typeContent = null;

    switch (cell.type) {
      case 'checkbox':
        typeContent =
          cell.checkboxOptions && cell.checkboxOptions.length > 0 ? (
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-green-500" />
              <span className="truncate text-sm text-gray-600">
                체크박스 ({cell.checkboxOptions.length}개)
              </span>
            </div>
          ) : (
            <span className="text-sm text-gray-400">체크박스 없음</span>
          );
        break;
      case 'radio':
        typeContent =
          cell.radioOptions && cell.radioOptions.length > 0 ? (
            <div className="flex items-center justify-center gap-2">
              <Circle className="h-4 w-4 text-purple-500" />
              <span className="truncate text-sm text-gray-600">
                라디오 ({cell.radioOptions.length}개)
              </span>
            </div>
          ) : (
            <span className="text-sm text-gray-400">라디오 없음</span>
          );
        break;
      case 'image':
        typeContent = cell.imageUrl ? (
          <div className="flex items-center gap-2">
            <Image className="h-4 w-4 text-blue-500" aria-label="이미지 아이콘" />
            <span className="truncate text-sm text-gray-600">이미지</span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">이미지 없음</span>
        );
        break;
      case 'video':
        typeContent = cell.videoUrl ? (
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-red-500" />
            <span className="truncate text-sm text-gray-600">동영상</span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">동영상 없음</span>
        );
        break;
      case 'input':
        typeContent = (
          <div className="flex items-center gap-2">
            <span className="truncate text-sm text-gray-600">
              {cell.placeholder ? `입력 필드: ${cell.placeholder}` : '단답형 입력'}
            </span>
          </div>
        );
        break;
      case 'select':
        typeContent =
          cell.selectOptions && cell.selectOptions.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="truncate text-sm text-gray-600">
                선택 ({cell.selectOptions.length}개)
              </span>
            </div>
          ) : (
            <span className="text-sm text-gray-400">선택 옵션 없음</span>
          );
        break;
      case 'text':
        // 텍스트 타입은 이미 위에서 처리했으므로 null 반환 (중복 방지)
        typeContent = null;
        break;
      default:
        typeContent = <span className="text-sm text-gray-400"></span>;
    }

    return (
      <div className="w-full">
        {textContent}
        {typeContent}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 테이블 제목 */}
      <div className="space-y-2">
        <Label htmlFor="table-title">테이블 제목</Label>
        <Input
          id="table-title"
          value={currentTitle}
          onChange={(e) => updateTitle(e.target.value)}
          placeholder="테이블 제목을 입력하세요"
        />
      </div>

      {/* 테이블 정보 요약 */}
      <Card>
        <CardHeader>
          <CardTitle>테이블 요약</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="font-medium text-blue-600">전체 크기</div>
              <div className="text-lg font-bold text-blue-900">
                {currentRows.length} × {currentColumns.length}
              </div>
              <div className="text-xs text-blue-600">행 × 열</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3">
              <div className="font-medium text-green-600">총 셀 수</div>
              <div className="text-lg font-bold text-green-900">
                {currentRows.length * currentColumns.length}
              </div>
              <div className="text-xs text-green-600">개</div>
            </div>
            <div className="rounded-lg bg-purple-50 p-3">
              <div className="font-medium text-purple-600">인터랙티브 셀</div>
              <div className="text-lg font-bold text-purple-900">
                {currentRows.reduce(
                  (count, row) =>
                    count +
                    row.cells.filter(
                      (cell) =>
                        cell.type === 'checkbox' ||
                        cell.type === 'radio' ||
                        cell.type === 'select' ||
                        cell.type === 'input',
                    ).length,
                  0,
                )}
              </div>
              <div className="text-xs text-purple-600">개</div>
            </div>
            <div className="rounded-lg bg-orange-50 p-3">
              <div className="font-medium text-orange-600">미디어 셀</div>
              <div className="text-lg font-bold text-orange-900">
                {currentRows.reduce(
                  (count, row) =>
                    count +
                    row.cells.filter((cell) => cell.type === 'image' || cell.type === 'video')
                      .length,
                  0,
                )}
              </div>
              <div className="text-xs text-orange-600">개</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 테이블 편집 영역 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>테이블 구조 편집</span>
            <div className="flex gap-2">
              {copiedCell && (
                <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-700">
                  <Clipboard className="h-4 w-4" />
                  <span>
                    셀 복사됨 (
                    {copiedCellPosition
                      ? `${copiedCellPosition.rowIndex + 1}, ${copiedCellPosition.cellIndex + 1}`
                      : ''}
                    )
                  </span>
                </div>
              )}
              <Button onClick={addColumn} size="sm" variant="outline">
                <Plus className="mr-1 h-4 w-4" />열 추가
              </Button>
              <Button onClick={addRow} size="sm" variant="outline">
                <Plus className="mr-1 h-4 w-4" />행 추가
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table
              ref={tableRef}
              className="w-full border-collapse border border-gray-300"
              style={{ tableLayout: 'fixed' }}
            >
              {/* 열 너비 정의 */}
              <colgroup>
                {/* 행 이름(라벨) 열 너비 */}
                <col style={{ width: '70px' }} />
                {currentColumns.map((column, index) => (
                  <col key={`col-${index}`} style={{ width: `${column.width || 150}px` }} />
                ))}
              </colgroup>

              {/* 헤더 행 */}
              <thead>
                <tr>
                  {/* 행 이름(라벨) 헤더 */}
                  <th className="sticky left-0 z-10 w-[70px] min-w-[70px] border border-gray-300 bg-gray-100 p-2">
                    <div
                      className="truncate text-center text-xs font-semibold text-gray-600"
                      title="행 라벨/코드"
                    >
                      행
                    </div>
                  </th>

                  {currentColumns.map((column, columnIndex) => (
                    <th
                      key={column.id}
                      className="relative border border-gray-300 bg-gray-50 p-2"
                      style={{
                        width: column.width ? `${column.width}px` : '150px',
                      }}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={column.label}
                            onChange={(e) => updateColumnLabel(columnIndex, e.target.value)}
                            className="h-8 border border-gray-200 bg-white text-center text-sm"
                            placeholder="열 제목 (비워둘 수 있음)"
                          />
                          <div className="flex items-center">
                            <Button
                              onClick={() => moveColumn(columnIndex, 'left')}
                              disabled={columnIndex === 0}
                              size="sm"
                              variant="ghost"
                              className="h-6 w-5 p-0 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                              title="왼쪽으로 이동"
                            >
                              <ArrowLeft className="h-3 w-3" />
                            </Button>
                            <Button
                              onClick={() => moveColumn(columnIndex, 'right')}
                              disabled={columnIndex === currentColumns.length - 1}
                              size="sm"
                              variant="ghost"
                              className="h-6 w-5 p-0 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                              title="오른쪽으로 이동"
                            >
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                            {currentColumns.length > 1 && (
                              <Button
                                onClick={() => deleteColumn(columnIndex)}
                                size="sm"
                                variant="ghost"
                                className="ml-1 h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>열 #{columnIndex + 1}</span>
                          {editingColumnWidth?.columnIndex === columnIndex ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                value={editingColumnWidth.value}
                                onChange={(e) => {
                                  setEditingColumnWidth({
                                    columnIndex,
                                    value: e.target.value,
                                  });
                                }}
                                onBlur={() => {
                                  const width = parseInt(editingColumnWidth.value);
                                  if (!isNaN(width) && width >= 0) {
                                    handleColumnWidthChange(columnIndex, width);
                                  }
                                  setEditingColumnWidth(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const width = parseInt(editingColumnWidth.value);
                                    if (!isNaN(width) && width >= 0) {
                                      handleColumnWidthChange(columnIndex, width);
                                    }
                                    setEditingColumnWidth(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingColumnWidth(null);
                                  }
                                }}
                                className="h-5 w-14 px-1 text-xs"
                                autoFocus
                              />
                              <span>px</span>
                            </div>
                          ) : (
                            <span
                              className="cursor-pointer hover:text-blue-600 hover:underline"
                              onClick={() => {
                                setEditingColumnWidth({
                                  columnIndex,
                                  value: String(column.width || 150),
                                });
                              }}
                              title="클릭하여 너비 변경"
                            >
                              {column.width ? `${column.width}px` : '150px'}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* 데이터 행들 */}
              <tbody>
                {currentRows.map((row, rowIndex) => (
                  <tr
                    key={row.id}
                    style={{ height: row.height ? `${row.height}px` : '60px' }}
                    className="group/row"
                  >
                    {/* 행 이름(라벨) 입력칸 */}
                    <td className="sticky left-0 z-10 w-[70px] min-w-[70px] border border-gray-300 bg-gray-50 p-1">
                      <div className="space-y-1">
                        <Input
                          value={row.label}
                          onChange={(e) => updateRowLabel(rowIndex, e.target.value)}
                          className="h-6 bg-white px-1 text-center text-xs"
                          placeholder="라벨"
                          title={`행 라벨: ${row.label}`}
                        />
                        <Input
                          value={row.rowCode || ''}
                          onChange={(e) => updateRowCode(rowIndex, e.target.value)}
                          className="h-5 bg-gray-100 px-1 text-center text-[10px] text-gray-600"
                          placeholder="코드"
                          title={`엑셀 코드: ${row.rowCode || '(자동)'}`}
                        />
                      </div>
                    </td>

                    {/* 셀들 */}
                    {row.cells.map((cell, cellIndex) => {
                      // 숨겨진 셀은 렌더링하지 않음
                      if (cell.isHidden) return null;

                      const column = currentColumns[cellIndex];
                      const rowspan = cell.rowspan || 1;
                      const colspan = cell.colspan || 1;
                      const isMerged = rowspan > 1 || colspan > 1;

                      // 정렬 클래스 계산 (세로 정렬만 td에 적용)
                      const verticalAlignClass =
                        cell.verticalAlign === 'middle'
                          ? 'align-middle'
                          : cell.verticalAlign === 'bottom'
                            ? 'align-bottom'
                            : 'align-top';

                      return (
                        <td
                          key={cell.id}
                          className={`relative border border-gray-300 p-2 ${verticalAlignClass}`}
                          style={{
                            width: column?.width ? `${column.width}px` : '150px',
                            maxWidth: column?.width ? `${column.width}px` : '150px',
                            height: row.height ? `${row.height}px` : '60px',
                          }}
                          rowSpan={rowspan}
                          colSpan={colspan}
                        >
                          <div
                            className={`group relative flex h-full cursor-pointer flex-col rounded p-2 transition-colors hover:bg-gray-50 ${
                              cell.verticalAlign === 'top'
                                ? 'justify-start'
                                : cell.verticalAlign === 'middle'
                                  ? 'justify-center'
                                  : 'justify-end'
                            }`}
                            onClick={() => setSelectedCell({ rowId: row.id, cellId: cell.id })}
                            style={{
                              minHeight: row.minHeight ? `${row.minHeight - 16}px` : '40px',
                            }}
                          >
                            <div
                              className={`mb-2 flex items-start justify-between ${
                                cell.type === 'radio' ? 'w-full justify-center' : ''
                              }`}
                            >
                              <div
                                className={`${cell.type === 'radio' ? '' : 'w-full flex-1'} ${
                                  cell.horizontalAlign === 'left'
                                    ? 'flex items-start justify-start'
                                    : cell.horizontalAlign === 'center'
                                      ? 'flex items-center justify-center'
                                      : 'flex items-end justify-end'
                                }`}
                              >
                                {renderCellContent(cell)}
                              </div>
                              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                {/* 횡순서변경 (열 이동) */}
                                <div className="mr-1 flex items-center border-r border-gray-200 pr-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-5 p-0 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveColumn(cellIndex, 'left');
                                    }}
                                    disabled={cellIndex === 0}
                                    title="열 왼쪽으로 이동"
                                  >
                                    <ArrowLeft className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-5 p-0 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveColumn(cellIndex, 'right');
                                    }}
                                    disabled={cellIndex === currentColumns.length - 1}
                                    title="열 오른쪽으로 이동"
                                  >
                                    <ArrowRight className="h-3 w-3" />
                                  </Button>
                                </div>
                                {/* 삭제 */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteCell(rowIndex, cellIndex);
                                  }}
                                  title="셀 삭제"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                                {/* 복사 */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyCell(rowIndex, cellIndex);
                                  }}
                                  title="셀 복사"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                {/* 붙여넣기 */}
                                {copiedCell && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      pasteCell(rowIndex, cellIndex);
                                    }}
                                    title="셀 붙여넣기"
                                  >
                                    <Clipboard className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="mt-1 border-t border-gray-100 pt-1 text-xs text-gray-400">
                              <div className="flex items-center justify-between">
                                <span>
                                  셀 ({rowIndex + 1}, {cellIndex + 1})
                                </span>
                                <span className="font-medium capitalize">{cell.type}</span>
                              </div>
                              {isMerged && (
                                <div className="mt-1 font-medium text-orange-600">
                                  🔗 병합: {rowspan}행 × {colspan}열
                                </div>
                              )}
                              {cell.type === 'checkbox' && cell.checkboxOptions && (
                                <div className="mt-1 text-green-600">
                                  체크박스 {cell.checkboxOptions.length}개
                                </div>
                              )}
                              {cell.type === 'radio' && cell.radioOptions && (
                                <div className="mt-1 text-purple-600">
                                  라디오 {cell.radioOptions.length}개
                                </div>
                              )}
                              {cell.type === 'select' && cell.selectOptions && (
                                <div className="mt-1 text-indigo-600">
                                  선택 {cell.selectOptions.length}개
                                </div>
                              )}
                              {cell.type === 'input' && (
                                <div className="mt-1 text-teal-600">
                                  {cell.placeholder || '단답형 입력'}
                                </div>
                              )}
                              {cell.type === 'image' && cell.imageUrl && (
                                <div className="mt-1 text-blue-600">이미지 설정됨</div>
                              )}
                              {cell.type === 'video' && cell.videoUrl && (
                                <div className="mt-1 text-red-600">비디오 설정됨</div>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 셀 내용 편집 모달 */}
      {selectedCell && (
        <CellContentModal
          isOpen={!!selectedCell}
          onClose={() => setSelectedCell(null)}
          currentQuestionId={currentQuestionId}
          cell={
            currentRows
              .find((row) => row.id === selectedCell.rowId)
              ?.cells.find((cell) => cell.id === selectedCell.cellId) || {
              id: '',
              content: '',
              type: 'text',
            }
          }
          onSave={(cell) => {
            // 일반 셀 업데이트
            const rowIndex = currentRows.findIndex((row) => row.id === selectedCell.rowId);
            const cellIndex = currentRows[rowIndex]?.cells.findIndex(
              (c) => c.id === selectedCell.cellId,
            );
            if (rowIndex !== -1 && cellIndex !== -1) {
              updateCell(rowIndex, cellIndex, cell);
            }
          }}
        />
      )}
    </div>
  );
}
