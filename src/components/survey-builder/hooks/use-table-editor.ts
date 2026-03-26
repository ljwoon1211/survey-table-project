import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { generateId } from '@/lib/utils';
import {
  HeaderCell,
  Question,
  QuestionConditionGroup,
  TableCell,
  TableColumn,
  TableRow,
} from '@/types/survey';
import {
  generateAllCellCodes,
  generateCellCodesForColumn,
  generateCellCodesForRow,
  regenerateCellCodeForPaste,
} from '@/utils/table-cell-code-generator';
import { buildDefaultHeaderGrid } from '@/utils/table-merge-helpers';

import { checkCanMerge, executeMerge, executeUnmerge } from '../utils/table-cell-merge';

// ── 타입 ──

interface UseTableEditorParams {
  tableTitle?: string;
  columns?: TableColumn[];
  rows?: TableRow[];
  tableHeaderGrid?: HeaderCell[][];
  currentQuestionId?: string;
  allQuestions?: Question[];
  questionCode?: string;
  questionTitle?: string;
  onTableChange: (data: {
    tableTitle: string;
    tableColumns: TableColumn[];
    tableRowsData: TableRow[];
    tableHeaderGrid?: HeaderCell[][];
  }) => void;
}

// ── 헬퍼 함수 ──

/** isHidden 속성을 재계산 (O(nm) - 병합 셀 Set 기반) */
function recalculateHiddenCells(tableRows: TableRow[]): TableRow[] {
  const hiddenCoords = new Set<string>();
  for (let r = 0; r < tableRows.length; r++) {
    const cells = tableRows[r].cells;
    for (let c = 0; c < cells.length; c++) {
      const rowspan = cells[c].rowspan || 1;
      const colspan = cells[c].colspan || 1;
      if (rowspan <= 1 && colspan <= 1) continue;
      for (let dr = 0; dr < rowspan; dr++) {
        for (let dc = 0; dc < colspan; dc++) {
          if (dr === 0 && dc === 0) continue;
          hiddenCoords.add(`${r + dr},${c + dc}`);
        }
      }
    }
  }

  return tableRows.map((row, rIndex) => ({
    ...row,
    cells: row.cells.map((cell, cIndex) => ({
      ...cell,
      isHidden: hiddenCoords.has(`${rIndex},${cIndex}`),
    })),
  }));
}

/** 컬럼 헤더의 isHeaderHidden 재계산 */
function recalculateHiddenHeaders(cols: TableColumn[]): TableColumn[] {
  return cols.map((col, i) => {
    let shouldBeHidden = false;
    for (let j = 0; j < i; j++) {
      const checkCol = cols[j];
      const colspan = checkCol.colspan || 1;
      if (colspan > 1 && i >= j && i < j + colspan) {
        shouldBeHidden = true;
        break;
      }
    }
    return { ...col, isHeaderHidden: shouldBeHidden || undefined };
  });
}

// ── 메인 훅 ──

export function useTableEditor({
  tableTitle = '',
  columns = [],
  rows = [],
  tableHeaderGrid: initialHeaderGrid,
  currentQuestionId = '',
  allQuestions = [],
  questionCode,
  questionTitle,
  onTableChange,
}: UseTableEditorParams) {
  // ── 상태 ──

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
    return recalculateHiddenCells(initialRows);
  });

  const [selectedCell, setSelectedCell] = useState<{
    rowId: string;
    cellId: string;
  } | null>(null);

  const [copiedCell, setCopiedCell] = useState<TableCell | null>(null);
  const [copiedCellPosition, setCopiedCellPosition] = useState<{
    rowIndex: number;
    cellIndex: number;
  } | null>(null);

  const tableRef = useRef<HTMLTableElement>(null);

  const [editingColumnWidth, setEditingColumnWidth] = useState<{
    columnIndex: number;
    value: string;
  } | null>(null);

  const [useMultiRowHeader, setUseMultiRowHeader] = useState(!!initialHeaderGrid);
  const [currentHeaderGrid, setCurrentHeaderGrid] = useState<HeaderCell[][] | undefined>(
    initialHeaderGrid,
  );

  // 행 조건부 표시 모달
  const [rowConditionModalOpen, setRowConditionModalOpen] = useState(false);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);

  // ── Refs (stale closure 방지) ──

  const headerGridRef = useRef(currentHeaderGrid);
  headerGridRef.current = currentHeaderGrid;

  const onTableChangeRef = useRef(onTableChange);
  onTableChangeRef.current = onTableChange;

  // ── 변경 알림 ──

  const notifyChange = useCallback(
    (title: string, cols: TableColumn[], rowsData: TableRow[]) => {
      onTableChangeRef.current({
        tableTitle: title,
        tableColumns: cols,
        tableRowsData: rowsData,
        tableHeaderGrid: headerGridRef.current,
      });
    },
    [],
  );

  const pendingChangeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<{ title: string; cols: TableColumn[]; rowsData: TableRow[] } | null>(null);

  const notifyChangeDebounced = useCallback(
    (title: string, cols: TableColumn[], rowsData: TableRow[]) => {
      if (pendingChangeRef.current) clearTimeout(pendingChangeRef.current);
      pendingArgsRef.current = { title, cols, rowsData };
      pendingChangeRef.current = setTimeout(() => {
        onTableChangeRef.current({
          tableTitle: title,
          tableColumns: cols,
          tableRowsData: rowsData,
          tableHeaderGrid: headerGridRef.current,
        });
        pendingChangeRef.current = null;
        pendingArgsRef.current = null;
      }, 300);
    },
    [],
  );

  // 언마운트 시 pending change flush (데이터 손실 방지)
  useEffect(() => {
    return () => {
      if (pendingChangeRef.current) {
        clearTimeout(pendingChangeRef.current);
        if (pendingArgsRef.current) {
          const { title, cols, rowsData } = pendingArgsRef.current;
          onTableChangeRef.current({
            tableTitle: title,
            tableColumns: cols,
            tableRowsData: rowsData,
            tableHeaderGrid: headerGridRef.current,
          });
        }
      }
    };
  }, []);

  // ── questionCode/questionTitle 변경 감지 ──

  const prevQuestionInfoRef = useRef({ questionCode, questionTitle });
  useEffect(() => {
    const prev = prevQuestionInfoRef.current;
    if (prev.questionCode === questionCode && prev.questionTitle === questionTitle) return;
    prevQuestionInfoRef.current = { questionCode, questionTitle };

    const updatedRows = generateAllCellCodes(questionCode, questionTitle, currentColumns, currentRows);
    setCurrentRows(updatedRows);
    notifyChange(currentTitle, currentColumns, updatedRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionCode, questionTitle]);

  // ── 헤더 병합 ──

  const mergeColumnHeaders = useCallback(
    (columnIndex: number) => {
      const cols = [...currentColumns];
      const currentCol = cols[columnIndex];
      const currentColspan = currentCol.colspan || 1;
      const nextVisibleIndex = columnIndex + currentColspan;

      if (nextVisibleIndex >= cols.length) return;

      const targetCol = cols[nextVisibleIndex];
      const targetColspan = targetCol.colspan || 1;

      cols[columnIndex] = { ...currentCol, colspan: currentColspan + targetColspan };
      cols[nextVisibleIndex] = { ...targetCol, colspan: undefined };

      const updatedCols = recalculateHiddenHeaders(cols);
      setCurrentColumns(updatedCols);
      notifyChange(currentTitle, updatedCols, currentRows);
    },
    [currentColumns, currentTitle, currentRows, notifyChange],
  );

  const unmergeColumnHeader = useCallback(
    (columnIndex: number) => {
      const cols = [...currentColumns];
      cols[columnIndex] = { ...cols[columnIndex], colspan: undefined };

      const updatedCols = recalculateHiddenHeaders(cols);
      setCurrentColumns(updatedCols);
      notifyChange(currentTitle, updatedCols, currentRows);
    },
    [currentColumns, currentTitle, currentRows, notifyChange],
  );

  // ── 제목 ──

  const updateTitle = useCallback(
    (title: string) => {
      setCurrentTitle(title);
      notifyChangeDebounced(title, currentColumns, currentRows);
    },
    [currentColumns, currentRows, notifyChangeDebounced],
  );

  // ── 열 너비 ──

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

  // ── 열 코드 변경 (인라인 핸들러 → 추출) ──

  const updateColumnCode = useCallback(
    (columnIndex: number, newColumnCode: string) => {
      const column = currentColumns[columnIndex];
      const updatedColumns = currentColumns.map((col, idx) =>
        idx === columnIndex ? { ...col, columnCode: newColumnCode } : col,
      );
      const updatedCol = { ...column, columnCode: newColumnCode };
      const updatedRows = generateCellCodesForColumn(
        questionCode,
        questionTitle,
        updatedCol,
        columnIndex,
        currentRows,
      );
      setCurrentColumns(updatedColumns);
      setCurrentRows(updatedRows);
      notifyChangeDebounced(currentTitle, updatedColumns, updatedRows);
    },
    [currentColumns, currentRows, currentTitle, questionCode, questionTitle, notifyChangeDebounced],
  );

  // ── 열 CRUD ──

  const addColumn = useCallback(() => {
    const newColumn: TableColumn = {
      id: generateId(),
      label: `열 ${currentColumns.length + 1}`,
      columnCode: `c${currentColumns.length + 1}`,
      width: 150,
    };

    const updatedColumns = [...currentColumns, newColumn];
    const newColIndex = currentColumns.length;

    const updatedRows = currentRows.map((row) => {
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
  }, [currentColumns, currentRows, currentTitle, notifyChange]);

  const deleteColumn = useCallback(
    (columnIndex: number) => {
      if (currentColumns.length <= 1) return;

      if (
        !window.confirm(
          '정말 이 열을 삭제하시겠습니까?\n포함된 데이터가 모두 삭제되며, 복구할 수 없습니다.',
        )
      ) {
        return;
      }

      const updatedColumns = currentColumns.filter((_, index) => index !== columnIndex);

      const updatedRows = currentRows.map((row) => ({
        ...row,
        cells: row.cells
          .map((cell, cIndex) => {
            if (cIndex < columnIndex) {
              const colspan = cell.colspan || 1;
              if (cIndex + colspan > columnIndex) {
                const newColspan = Math.max(1, colspan - 1);
                return { ...cell, colspan: newColspan > 1 ? newColspan : undefined };
              }
            }
            return cell;
          })
          .filter((_, index) => index !== columnIndex),
      }));

      const finalRows = recalculateHiddenCells(updatedRows);
      setCurrentColumns(updatedColumns);
      setCurrentRows(finalRows);
      notifyChange(currentTitle, updatedColumns, finalRows);
    },
    [currentColumns, currentRows, currentTitle, notifyChange],
  );

  const moveColumn = useCallback(
    (columnIndex: number, direction: 'left' | 'right') => {
      if (direction === 'left' && columnIndex === 0) return;
      if (direction === 'right' && columnIndex === currentColumns.length - 1) return;

      const targetIndex = direction === 'left' ? columnIndex - 1 : columnIndex + 1;

      const updatedColumns = [...currentColumns];
      [updatedColumns[columnIndex], updatedColumns[targetIndex]] = [
        updatedColumns[targetIndex],
        updatedColumns[columnIndex],
      ];

      const updatedRows = currentRows.map((row) => {
        const newCells = [...row.cells];
        [newCells[columnIndex], newCells[targetIndex]] = [
          newCells[targetIndex],
          newCells[columnIndex],
        ];
        return { ...row, cells: newCells };
      });

      const finalRows = recalculateHiddenCells(updatedRows);
      setCurrentColumns(updatedColumns);
      setCurrentRows(finalRows);
      notifyChange(currentTitle, updatedColumns, finalRows);
    },
    [currentColumns, currentRows, currentTitle, notifyChange],
  );

  const updateColumnLabel = useCallback(
    (columnIndex: number, label: string) => {
      const updatedColumns = currentColumns.map((col, index) =>
        index === columnIndex ? { ...col, label } : col,
      );
      setCurrentColumns(updatedColumns);
      notifyChangeDebounced(currentTitle, updatedColumns, currentRows);
    },
    [currentColumns, currentTitle, currentRows, notifyChangeDebounced],
  );

  // ── 행 CRUD ──

  const addRow = useCallback(() => {
    const existingNumbers = currentRows
      .map((row) => {
        const match = row.label.match(/행 (\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));

    const maxNumber = Math.max(0, ...existingNumbers);
    const nextNumber = maxNumber + 1;

    const newRowId = generateId();

    const cells = currentColumns.map((col, colIndex) => {
      let shouldBeHidden = false;

      for (let r = 0; r < currentRows.length; r++) {
        const cell = currentRows[r].cells[colIndex];
        if (!cell) continue;

        const rowspan = cell.rowspan || 1;
        const colspan = cell.colspan || 1;

        if (r + rowspan > currentRows.length) {
          const cellColIndex = currentRows[r].cells.findIndex((c) => c.id === cell.id);
          if (colIndex >= cellColIndex && colIndex < cellColIndex + colspan) {
            shouldBeHidden = true;
            break;
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
      label: `행 ${nextNumber}`,
      rowCode: `r${currentRows.length + 1}`,
      height: 60,
      minHeight: 40,
      cells,
    };

    const newRowWithCodes = generateCellCodesForRow(
      questionCode,
      questionTitle,
      currentColumns,
      newRow,
    );

    const updatedRows = [...currentRows, newRowWithCodes];
    setCurrentRows(updatedRows);
    notifyChange(currentTitle, currentColumns, updatedRows);
  }, [currentRows, currentColumns, currentTitle, questionCode, questionTitle, notifyChange]);

  const deleteRow = useCallback(
    (rowIndex: number) => {
      if (currentRows.length <= 1) return;

      if (
        !window.confirm(
          '정말 이 행을 삭제하시겠습니까?\n포함된 데이터가 모두 삭제되며, 복구할 수 없습니다.',
        )
      ) {
        return;
      }

      const updatedRows = currentRows
        .map((row, rIndex) => {
          if (rIndex < rowIndex) {
            return {
              ...row,
              cells: row.cells.map((cell) => {
                const rowspan = cell.rowspan || 1;
                if (rIndex + rowspan > rowIndex) {
                  const newRowspan = Math.max(1, rowspan - 1);
                  return { ...cell, rowspan: newRowspan > 1 ? newRowspan : undefined };
                }
                return cell;
              }),
            };
          }
          return row;
        })
        .filter((_, index) => index !== rowIndex);

      const finalRows = recalculateHiddenCells(updatedRows);
      setCurrentRows(finalRows);
      notifyChange(currentTitle, currentColumns, finalRows);
    },
    [currentRows, currentTitle, currentColumns, notifyChange],
  );

  const updateRowLabel = useCallback(
    (rowIndex: number, label: string) => {
      const updatedRows = currentRows.map((row, index) =>
        index === rowIndex ? { ...row, label } : row,
      );
      setCurrentRows(updatedRows);
      notifyChangeDebounced(currentTitle, currentColumns, updatedRows);
    },
    [currentRows, currentTitle, currentColumns, notifyChangeDebounced],
  );

  const updateRowCode = useCallback(
    (rowIndex: number, rowCode: string) => {
      const updatedRows = currentRows.map((row, index) => {
        if (index !== rowIndex) return row;
        const updatedRow = { ...row, rowCode };
        return generateCellCodesForRow(questionCode, questionTitle, currentColumns, updatedRow);
      });
      setCurrentRows(updatedRows);
      notifyChangeDebounced(currentTitle, currentColumns, updatedRows);
    },
    [currentRows, currentTitle, currentColumns, questionCode, questionTitle, notifyChangeDebounced],
  );

  // ── 행 조건부 표시 ──

  const openRowConditionModal = useCallback((rowIndex: number) => {
    setEditingRowIndex(rowIndex);
    setRowConditionModalOpen(true);
  }, []);

  const updateRowCondition = useCallback(
    (rowIndex: number, conditionGroup: QuestionConditionGroup | undefined) => {
      const updatedRows = currentRows.map((row, index) =>
        index === rowIndex ? { ...row, displayCondition: conditionGroup } : row,
      );
      setCurrentRows(updatedRows);
      notifyChange(currentTitle, currentColumns, updatedRows);
    },
    [currentRows, currentTitle, currentColumns, notifyChange],
  );

  const currentQuestionAsQuestion: Question = useMemo(
    () => ({
      id: currentQuestionId,
      type: 'table' as const,
      title: currentTitle,
      order: 0,
      required: false,
      tableColumns: currentColumns,
      tableRowsData: currentRows,
    }),
    [currentQuestionId, currentTitle, currentColumns, currentRows],
  );

  // ── 셀 복사/붙여넣기 ──

  const copyCell = useCallback(
    (rowIndex: number, cellIndex: number) => {
      const cell = currentRows[rowIndex]?.cells[cellIndex];
      if (!cell) return;
      const cellToCopy: TableCell = { ...cell, id: '' };
      setCopiedCell(cellToCopy);
      setCopiedCellPosition({ rowIndex, cellIndex });
    },
    [currentRows],
  );

  const pasteCell = useCallback(
    (rowIndex: number, cellIndex: number) => {
      if (!copiedCell) return;

      const targetCell = currentRows[rowIndex]?.cells[cellIndex];
      if (!targetCell) return;

      const targetRow = currentRows[rowIndex];
      const targetColumn = currentColumns[cellIndex];
      const pastedCell: TableCell = regenerateCellCodeForPaste(
        { ...copiedCell, id: targetCell.id },
        questionCode,
        questionTitle,
        targetRow?.rowCode,
        targetRow?.label,
        targetColumn?.columnCode,
        targetColumn?.label,
      );

      let updatedRows = currentRows.map((row, rIndex) =>
        rIndex === rowIndex
          ? { ...row, cells: row.cells.map((c, cIndex) => (cIndex === cellIndex ? pastedCell : c)) }
          : row,
      );

      const rowspan = pastedCell.rowspan || 1;
      const colspan = pastedCell.colspan || 1;

      if (rowspan > 1 || colspan > 1) {
        updatedRows = updatedRows.map((row, rIndex) => ({
          ...row,
          cells: row.cells.map((c, cIndex) => {
            const isInRowRange = rIndex >= rowIndex && rIndex < rowIndex + rowspan;
            const isInColRange = cIndex >= cellIndex && cIndex < cellIndex + colspan;
            if (isInRowRange && isInColRange && !(rIndex === rowIndex && cIndex === cellIndex)) {
              return { ...pastedCell, id: c.id, rowspan: undefined, colspan: undefined };
            }
            return c;
          }),
        }));
      }

      const finalRows = recalculateHiddenCells(updatedRows);
      setCurrentRows(finalRows);
      notifyChange(currentTitle, currentColumns, finalRows);
    },
    [copiedCell, currentRows, currentColumns, currentTitle, questionCode, questionTitle, notifyChange],
  );

  // ── 셀 삭제/업데이트 ──

  const updateCell = useCallback(
    (rowIndex: number, cellIndex: number, cell: TableCell) => {
      let updatedRows = currentRows.map((row, rIndex) =>
        rIndex === rowIndex
          ? { ...row, cells: row.cells.map((c, cIndex) => (cIndex === cellIndex ? cell : c)) }
          : row,
      );

      const rowspan = cell.rowspan || 1;
      const colspan = cell.colspan || 1;

      if (rowspan > 1 || colspan > 1) {
        updatedRows = updatedRows.map((row, rIndex) => ({
          ...row,
          cells: row.cells.map((c, cIndex) => {
            const isInRowRange = rIndex >= rowIndex && rIndex < rowIndex + rowspan;
            const isInColRange = cIndex >= cellIndex && cIndex < cellIndex + colspan;
            if (isInRowRange && isInColRange && !(rIndex === rowIndex && cIndex === cellIndex)) {
              return { ...cell, id: c.id, rowspan: undefined, colspan: undefined };
            }
            return c;
          }),
        }));
      }

      const finalRows = recalculateHiddenCells(updatedRows);
      setCurrentRows(finalRows);
      notifyChange(currentTitle, currentColumns, finalRows);
      setSelectedCell(null);
    },
    [currentRows, currentTitle, currentColumns, notifyChange],
  );

  const deleteCell = useCallback(
    (rowIndex: number, cellIndex: number) => {
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
    },
    [currentRows, updateCell],
  );

  // ── 셀 병합/해제 ──

  const canMerge = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right'): boolean => {
      if (!selectedCell) return false;

      const rowIndex = currentRows.findIndex((row) => row.id === selectedCell.rowId);
      const cellIndex = currentRows[rowIndex]?.cells.findIndex(
        (cell) => cell.id === selectedCell.cellId,
      );
      if (rowIndex === -1 || cellIndex === -1) return false;

      return checkCanMerge(direction, rowIndex, cellIndex, currentRows, currentColumns);
    },
    [currentRows, currentColumns, selectedCell],
  );

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

      const { updatedRows, newSelectedCell } = executeMerge(direction, rowIndex, cellIndex, currentRows);

      if (newSelectedCell) {
        setSelectedCell(newSelectedCell);
      }

      const finalRows = recalculateHiddenCells(updatedRows);
      setCurrentRows(finalRows);
      notifyChange(currentTitle, currentColumns, finalRows);
    },
    [selectedCell, currentRows, currentColumns, canMerge, currentTitle, notifyChange],
  );

  const handleUnmerge = useCallback(() => {
    if (!selectedCell) return;

    const rowIndex = currentRows.findIndex((row) => row.id === selectedCell.rowId);
    const cellIndex = currentRows[rowIndex]?.cells.findIndex(
      (cell) => cell.id === selectedCell.cellId,
    );

    if (rowIndex === -1 || cellIndex === -1) return;

    const newRows = executeUnmerge(rowIndex, cellIndex, currentRows);
    if (newRows === currentRows) return; // 변경 없음

    const finalRows = recalculateHiddenCells(newRows);
    setCurrentRows(finalRows);
    notifyChange(currentTitle, currentColumns, finalRows);
  }, [selectedCell, currentRows, currentTitle, currentColumns, notifyChange]);

  // ── 셀 선택 (안정된 콜백) ──

  const handleSelectCell = useCallback(
    (rowId: string, cellId: string) => setSelectedCell({ rowId, cellId }),
    [],
  );

  // ── 다단계 헤더 토글 ──

  const toggleMultiRowHeader = useCallback(
    (enabled: boolean) => {
      setUseMultiRowHeader(enabled);
      if (enabled && !currentHeaderGrid) {
        const defaultGrid = buildDefaultHeaderGrid(currentColumns);
        setCurrentHeaderGrid(defaultGrid);
        onTableChangeRef.current({
          tableTitle: currentTitle,
          tableColumns: currentColumns,
          tableRowsData: currentRows,
          tableHeaderGrid: defaultGrid,
        });
      } else if (!enabled) {
        setCurrentHeaderGrid(undefined);
        onTableChangeRef.current({
          tableTitle: currentTitle,
          tableColumns: currentColumns,
          tableRowsData: currentRows,
          tableHeaderGrid: undefined,
        });
      }
    },
    [currentHeaderGrid, currentColumns, currentTitle, currentRows],
  );

  const updateHeaderGrid = useCallback(
    (newGrid: HeaderCell[][]) => {
      setCurrentHeaderGrid(newGrid);
      onTableChangeRef.current({
        tableTitle: currentTitle,
        tableColumns: currentColumns,
        tableRowsData: currentRows,
        tableHeaderGrid: newGrid,
      });
    },
    [currentTitle, currentColumns, currentRows],
  );

  // ── selectedCellContext (CellContentModal용 useMemo) ──

  const selectedCellContext = useMemo(() => {
    if (!selectedCell) return null;

    const rowIndex = currentRows.findIndex((row) => row.id === selectedCell.rowId);
    const selectedRow = rowIndex >= 0 ? currentRows[rowIndex] : undefined;
    const cellIndex = selectedRow?.cells.findIndex((c) => c.id === selectedCell.cellId) ?? -1;
    const selectedColumn = cellIndex >= 0 ? currentColumns[cellIndex] : undefined;
    const cell = cellIndex >= 0 ? selectedRow?.cells[cellIndex] : undefined;

    return {
      rowIndex,
      cellIndex,
      rowCode: selectedRow?.rowCode,
      rowLabel: selectedRow?.label,
      columnCode: selectedColumn?.columnCode,
      columnLabel: selectedColumn?.label,
      cell: cell || { id: '', content: '', type: 'text' as const },
    };
  }, [selectedCell, currentRows, currentColumns]);

  // ── 반환 ──

  return {
    // 상태
    state: {
      currentTitle,
      currentColumns,
      currentRows,
      selectedCell,
      copiedCell,
      copiedCellPosition,
      editingColumnWidth,
      useMultiRowHeader,
      currentHeaderGrid,
      rowConditionModalOpen,
      editingRowIndex,
      tableRef,
      selectedCellContext,
      currentQuestionAsQuestion,
      allQuestions,
      currentQuestionId,
      questionCode,
      questionTitle,
    },
    // 액션
    actions: {
      // 제목
      updateTitle,
      // 열
      addColumn,
      deleteColumn,
      moveColumn,
      updateColumnLabel,
      updateColumnCode,
      handleColumnWidthChange,
      setEditingColumnWidth,
      mergeColumnHeaders,
      unmergeColumnHeader,
      // 행
      addRow,
      deleteRow,
      updateRowLabel,
      updateRowCode,
      // 셀
      handleSelectCell,
      setSelectedCell,
      updateCell,
      deleteCell,
      copyCell,
      pasteCell,
      // 병합
      canMerge,
      handleMerge,
      handleUnmerge,
      // 행 조건부 표시
      openRowConditionModal,
      updateRowCondition,
      setRowConditionModalOpen,
      // 다단계 헤더
      toggleMultiRowHeader,
      updateHeaderGrid,
    },
  };
}
