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
  generateCellCodesForRow,
  regenerateCellCodeForPaste,
} from '@/utils/table-cell-code-generator';
import { buildDefaultHeaderGrid } from '@/utils/table-merge-helpers';

import { checkCanMerge, executeMerge, executeUnmerge } from '../utils/table-cell-merge';
import { useDragCopy } from './use-drag-copy';

// ── 타입 ──

interface UseTableEditorParams {
  tableTitle?: string;
  columns?: TableColumn[];
  rows?: TableRow[];
  tableHeaderGrid?: HeaderCell[][];
  currentQuestionId?: string;
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
    // 초기화 시 모든 셀에 코드 생성 (기존 데이터에 코드가 없는 셀 보완)
    const rowsWithCodes = generateAllCellCodes(
      questionCode,
      questionTitle,
      columns.length > 0 ? columns : [{ id: 'col-1', label: '열 1', width: 150 }, { id: 'col-2', label: '열 2', width: 150 }],
      initialRows,
    );
    return recalculateHiddenCells(rowsWithCodes);
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

  const tableRef = useRef<HTMLDivElement>(null);

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

  // 열 조건부 표시 모달
  const [columnConditionModalOpen, setColumnConditionModalOpen] = useState(false);
  const [editingColumnIndex, setEditingColumnIndex] = useState<number | null>(null);

  // ── Refs (stale closure 방지 + useCallback 안정화) ──

  const currentTitleRef = useRef(currentTitle);
  currentTitleRef.current = currentTitle;

  const currentColumnsRef = useRef(currentColumns);
  currentColumnsRef.current = currentColumns;

  const currentRowsRef = useRef(currentRows);
  currentRowsRef.current = currentRows;

  const headerGridRef = useRef(currentHeaderGrid);
  headerGridRef.current = currentHeaderGrid;

  const questionCodeRef = useRef(questionCode);
  questionCodeRef.current = questionCode;

  const questionTitleRef = useRef(questionTitle);
  questionTitleRef.current = questionTitle;

  const selectedCellRef = useRef(selectedCell);
  selectedCellRef.current = selectedCell;

  const copiedCellRef = useRef(copiedCell);
  copiedCellRef.current = copiedCell;

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

  // 셀 코드 재계산 전용 debounce (updateColumnCode / updateRowCode 용)
  const pendingCellCodeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // questionCode/questionTitle 변경 시 전체 재계산 debounce
  const pendingQuestionInfoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // 셀 코드 재계산 flush
      if (pendingCellCodeRef.current) {
        clearTimeout(pendingCellCodeRef.current);
        pendingCellCodeRef.current = null;
      }
      // questionCode/questionTitle 재계산 flush
      if (pendingQuestionInfoRef.current) {
        clearTimeout(pendingQuestionInfoRef.current);
        pendingQuestionInfoRef.current = null;
      }
      // 부모 알림 flush
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

  // ── questionCode/questionTitle 변경 감지 (debounced) ──

  const prevQuestionInfoRef = useRef({ questionCode, questionTitle });
  useEffect(() => {
    const prev = prevQuestionInfoRef.current;
    if (prev.questionCode === questionCode && prev.questionTitle === questionTitle) return;
    prevQuestionInfoRef.current = { questionCode, questionTitle };

    // 300ms debounce: 타이핑 중에는 재계산하지 않고, 멈추면 실행
    if (pendingQuestionInfoRef.current) clearTimeout(pendingQuestionInfoRef.current);
    pendingQuestionInfoRef.current = setTimeout(() => {
      const updatedRows = generateAllCellCodes(
        questionCodeRef.current,
        questionTitleRef.current,
        currentColumnsRef.current,
        currentRowsRef.current,
      );
      setCurrentRows(updatedRows);
      notifyChangeDebounced(
        currentTitleRef.current,
        currentColumnsRef.current,
        updatedRows,
      );
      pendingQuestionInfoRef.current = null;
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionCode, questionTitle]);

  // ── 헤더 병합 ──

  const mergeColumnHeaders = useCallback(
    (columnIndex: number) => {
      const cols = [...currentColumnsRef.current];
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
      notifyChange(currentTitleRef.current, updatedCols, currentRowsRef.current);
    },
    [notifyChange],
  );

  const unmergeColumnHeader = useCallback(
    (columnIndex: number) => {
      const cols = [...currentColumnsRef.current];
      cols[columnIndex] = { ...cols[columnIndex], colspan: undefined };

      const updatedCols = recalculateHiddenHeaders(cols);
      setCurrentColumns(updatedCols);
      notifyChange(currentTitleRef.current, updatedCols, currentRowsRef.current);
    },
    [notifyChange],
  );

  // ── 제목 ──

  const updateTitle = useCallback(
    (title: string) => {
      setCurrentTitle(title);
      notifyChangeDebounced(title, currentColumnsRef.current, currentRowsRef.current);
    },
    [notifyChangeDebounced],
  );

  // ── 열 너비 ──

  const handleColumnWidthChange = useCallback(
    (columnIndex: number, width: number) => {
      const updatedColumns = currentColumnsRef.current.map((col, index) =>
        index === columnIndex ? { ...col, width: Math.max(0, width) } : col,
      );
      setCurrentColumns(updatedColumns);
      notifyChange(currentTitleRef.current, updatedColumns, currentRowsRef.current);
    },
    [notifyChange],
  );

  // ── 열 코드 변경 ──

  /** 셀 코드 전체 재계산 debounce (열 코드/행 코드 변경 공통) */
  const scheduleCellCodeRecalc = useCallback(() => {
    if (pendingCellCodeRef.current) clearTimeout(pendingCellCodeRef.current);
    pendingCellCodeRef.current = setTimeout(() => {
      const updatedRows = generateAllCellCodes(
        questionCodeRef.current,
        questionTitleRef.current,
        currentColumnsRef.current,
        currentRowsRef.current,
      );
      setCurrentRows(updatedRows);
      notifyChangeDebounced(currentTitleRef.current, currentColumnsRef.current, updatedRows);
      pendingCellCodeRef.current = null;
    }, 300);
  }, [notifyChangeDebounced]);

  const updateColumnCode = useCallback(
    (columnIndex: number, newColumnCode: string) => {
      // 즉시: 컬럼 코드 문자열만 업데이트
      const updatedColumns = currentColumnsRef.current.map((col, idx) =>
        idx === columnIndex ? { ...col, columnCode: newColumnCode } : col,
      );
      setCurrentColumns(updatedColumns);
      notifyChangeDebounced(currentTitleRef.current, updatedColumns, currentRowsRef.current);
      // 지연: 셀 코드 전체 재계산
      scheduleCellCodeRecalc();
    },
    [notifyChangeDebounced, scheduleCellCodeRecalc],
  );

  // ── 열 CRUD ──

  const addColumn = useCallback(() => {
    const columns = currentColumnsRef.current;
    const rows = currentRowsRef.current;

    const newColumn: TableColumn = {
      id: generateId(),
      label: `열 ${columns.length + 1}`,
      columnCode: `c${columns.length + 1}`,
      width: 150,
    };

    const updatedColumns = [...columns, newColumn];
    const newColIndex = columns.length;

    const updatedRows = rows.map((row) => {
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
    notifyChange(currentTitleRef.current, updatedColumns, updatedRows);
  }, [notifyChange]);

  const deleteColumn = useCallback(
    (columnIndex: number) => {
      const columns = currentColumnsRef.current;
      const rows = currentRowsRef.current;

      if (columns.length <= 1) return;

      if (
        !window.confirm(
          '정말 이 열을 삭제하시겠습니까?\n포함된 데이터가 모두 삭제되며, 복구할 수 없습니다.',
        )
      ) {
        return;
      }

      const updatedColumns = columns.filter((_, index) => index !== columnIndex);

      const updatedRows = rows.map((row) => ({
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
      notifyChange(currentTitleRef.current, updatedColumns, finalRows);
    },
    [notifyChange],
  );

  const moveColumn = useCallback(
    (columnIndex: number, direction: 'left' | 'right') => {
      const columns = currentColumnsRef.current;
      const rows = currentRowsRef.current;

      if (direction === 'left' && columnIndex === 0) return;
      if (direction === 'right' && columnIndex === columns.length - 1) return;

      const targetIndex = direction === 'left' ? columnIndex - 1 : columnIndex + 1;

      const updatedColumns = [...columns];
      [updatedColumns[columnIndex], updatedColumns[targetIndex]] = [
        updatedColumns[targetIndex],
        updatedColumns[columnIndex],
      ];

      const updatedRows = rows.map((row) => {
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
      notifyChange(currentTitleRef.current, updatedColumns, finalRows);
    },
    [notifyChange],
  );

  const updateColumnLabel = useCallback(
    (columnIndex: number, label: string) => {
      const updatedColumns = currentColumnsRef.current.map((col, index) =>
        index === columnIndex ? { ...col, label } : col,
      );
      setCurrentColumns(updatedColumns);
      notifyChangeDebounced(currentTitleRef.current, updatedColumns, currentRowsRef.current);
    },
    [notifyChangeDebounced],
  );

  // ── 행 CRUD ──

  const addRow = useCallback(() => {
    const rows = currentRowsRef.current;
    const columns = currentColumnsRef.current;

    const existingNumbers = rows
      .map((row) => {
        const match = row.label.match(/행 (\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));

    const maxNumber = Math.max(0, ...existingNumbers);
    const nextNumber = maxNumber + 1;

    const newRowId = generateId();

    const cells = columns.map((col, colIndex) => {
      let shouldBeHidden = false;

      for (let r = 0; r < rows.length; r++) {
        const cell = rows[r].cells[colIndex];
        if (!cell) continue;

        const rowspan = cell.rowspan || 1;
        const colspan = cell.colspan || 1;

        if (r + rowspan > rows.length) {
          const cellColIndex = rows[r].cells.findIndex((c) => c.id === cell.id);
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
      rowCode: `r${rows.length + 1}`,
      height: 60,
      minHeight: 40,
      cells,
    };

    const newRowWithCodes = generateCellCodesForRow(
      questionCodeRef.current,
      questionTitleRef.current,
      columns,
      newRow,
    );

    const updatedRows = [...rows, newRowWithCodes];
    setCurrentRows(updatedRows);
    notifyChange(currentTitleRef.current, columns, updatedRows);
  }, [notifyChange]);

  const addBulkRows = useCallback(
    (
      rowDefs: Array<{
        label: string;
        rowCode: string;
        displayCondition?: QuestionConditionGroup;
        dynamicGroupId?: string;
      }>,
    ) => {
      const columns = currentColumnsRef.current;
      const existingRows = currentRowsRef.current;

      const newRows: TableRow[] = rowDefs.map((def) => {
        const newRowId = generateId();
        const cells = columns.map((col) => ({
          id: `cell-${newRowId}-${col.id}`,
          content: '',
          type: 'text' as const,
        }));

        const row: TableRow = {
          id: newRowId,
          label: def.label,
          rowCode: def.rowCode,
          height: 60,
          minHeight: 40,
          cells,
          displayCondition: def.displayCondition,
          dynamicGroupId: def.dynamicGroupId,
        };

        return generateCellCodesForRow(
          questionCodeRef.current,
          questionTitleRef.current,
          columns,
          row,
        );
      });

      const updatedRows = [...existingRows, ...newRows];
      const finalRows = recalculateHiddenCells(updatedRows);
      setCurrentRows(finalRows);
      notifyChange(currentTitleRef.current, columns, finalRows);
    },
    [notifyChange],
  );

  const duplicateRow = useCallback(
    (rowIndex: number) => {
      const rows = currentRowsRef.current;
      const columns = currentColumnsRef.current;
      const sourceRow = rows[rowIndex];
      if (!sourceRow) return;

      const newRowId = generateId();
      const newRow: TableRow = {
        ...sourceRow,
        id: newRowId,
        label: `${sourceRow.label} (복사)`,
        rowCode: sourceRow.rowCode ? `${sourceRow.rowCode}_copy` : undefined,
        cells: sourceRow.cells.map((cell, colIndex) => {
          const cloned = JSON.parse(JSON.stringify(cell));
          cloned.id = `cell-${newRowId}-${columns[colIndex]?.id ?? colIndex}`;
          cloned.rowspan = undefined;
          return cloned;
        }),
        displayCondition: sourceRow.displayCondition
          ? JSON.parse(JSON.stringify(sourceRow.displayCondition))
          : undefined,
      };

      const newRowWithCodes = generateCellCodesForRow(
        questionCodeRef.current,
        questionTitleRef.current,
        columns,
        newRow,
      );

      const updatedRows = [
        ...rows.slice(0, rowIndex + 1),
        newRowWithCodes,
        ...rows.slice(rowIndex + 1),
      ];
      const finalRows = recalculateHiddenCells(updatedRows);
      setCurrentRows(finalRows);
      notifyChange(currentTitleRef.current, columns, finalRows);
    },
    [notifyChange],
  );

  const deleteRow = useCallback(
    (rowIndex: number) => {
      const rows = currentRowsRef.current;

      if (rows.length <= 1) return;

      if (
        !window.confirm(
          '정말 이 행을 삭제하시겠습니까?\n포함된 데이터가 모두 삭제되며, 복구할 수 없습니다.',
        )
      ) {
        return;
      }

      const updatedRows = rows
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
      notifyChange(currentTitleRef.current, currentColumnsRef.current, finalRows);
    },
    [notifyChange],
  );

  const updateRowLabel = useCallback(
    (rowIndex: number, label: string) => {
      const updatedRows = currentRowsRef.current.map((row, index) =>
        index === rowIndex ? { ...row, label } : row,
      );
      setCurrentRows(updatedRows);
      notifyChangeDebounced(currentTitleRef.current, currentColumnsRef.current, updatedRows);
    },
    [notifyChangeDebounced],
  );

  const updateRowCode = useCallback(
    (rowIndex: number, rowCode: string) => {
      // 즉시: 행 코드 문자열만 업데이트
      const updatedRows = currentRowsRef.current.map((row, index) =>
        index === rowIndex ? { ...row, rowCode } : row,
      );
      setCurrentRows(updatedRows);
      notifyChangeDebounced(currentTitleRef.current, currentColumnsRef.current, updatedRows);
      // 지연: 셀 코드 전체 재계산
      scheduleCellCodeRecalc();
    },
    [notifyChangeDebounced, scheduleCellCodeRecalc],
  );

  // ── 행 조건부 표시 ──

  const openRowConditionModal = useCallback((rowIndex: number) => {
    setEditingRowIndex(rowIndex);
    setRowConditionModalOpen(true);
  }, []);

  const updateRowCondition = useCallback(
    (rowIndex: number, conditionGroup: QuestionConditionGroup | undefined) => {
      const updatedRows = currentRowsRef.current.map((row, index) =>
        index === rowIndex ? { ...row, displayCondition: conditionGroup } : row,
      );
      setCurrentRows(updatedRows);
      notifyChange(currentTitleRef.current, currentColumnsRef.current, updatedRows);
    },
    [notifyChange],
  );

  // ── 동적 행 설정 ──

  const setDynamicGroupId = useCallback(
    (rowId: string, groupId: string | undefined) => {
      const updatedRows = currentRowsRef.current.map((row) =>
        row.id === rowId
          ? { ...row, dynamicGroupId: groupId, showWhenDynamicGroupId: undefined }
          : row,
      );
      setCurrentRows(updatedRows);
      notifyChange(currentTitleRef.current, currentColumnsRef.current, updatedRows);
    },
    [notifyChange],
  );

  const setShowWhenDynamicGroupId = useCallback(
    (rowId: string, groupId: string | undefined) => {
      const updatedRows = currentRowsRef.current.map((row) =>
        row.id === rowId
          ? { ...row, showWhenDynamicGroupId: groupId, dynamicGroupId: undefined }
          : row,
      );
      setCurrentRows(updatedRows);
      notifyChange(currentTitleRef.current, currentColumnsRef.current, updatedRows);
    },
    [notifyChange],
  );

  // ── 열 조건부 표시 ──

  const openColumnConditionModal = useCallback((columnIndex: number) => {
    setEditingColumnIndex(columnIndex);
    setColumnConditionModalOpen(true);
  }, []);

  const updateColumnCondition = useCallback(
    (columnIndex: number, conditionGroup: QuestionConditionGroup | undefined) => {
      const updatedColumns = currentColumnsRef.current.map((col, index) =>
        index === columnIndex ? { ...col, displayCondition: conditionGroup } : col,
      );
      setCurrentColumns(updatedColumns);
      notifyChange(currentTitleRef.current, updatedColumns, currentRowsRef.current);
    },
    [notifyChange],
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

  // ── 드래그 복사 ──

  const dragCopy = useDragCopy({
    currentRowsRef,
    currentColumnsRef,
    questionCodeRef,
    questionTitleRef,
    setCurrentRows,
    notifyChange,
    currentTitleRef,
    recalculateHiddenCells,
    clearCopiedCell: () => {
      setCopiedCell(null);
      setCopiedCellPosition(null);
    },
  });

  // ── 셀 복사/붙여넣기 ──

  const copyCell = useCallback(
    (rowIndex: number, cellIndex: number) => {
      const cell = currentRowsRef.current[rowIndex]?.cells[cellIndex];
      if (!cell) return;
      const cellToCopy: TableCell = { ...cell, id: '' };
      setCopiedCell(cellToCopy);
      setCopiedCellPosition({ rowIndex, cellIndex });
      dragCopy.clearCopiedRegion(); // 상호 배타
    },
    [dragCopy.clearCopiedRegion],
  );

  const pasteCell = useCallback(
    (rowIndex: number, cellIndex: number) => {
      // 영역 복사가 있으면 영역 붙여넣기 우선
      if (dragCopy.copiedRegion) {
        const result = dragCopy.pasteRegion(rowIndex, cellIndex);
        if ('blocked' in result) {
          alert(result.message);
        }
        return;
      }

      const copied = copiedCellRef.current;
      if (!copied) return;

      const rows = currentRowsRef.current;
      const columns = currentColumnsRef.current;
      const targetCell = rows[rowIndex]?.cells[cellIndex];
      if (!targetCell) return;

      const targetRow = rows[rowIndex];
      const targetColumn = columns[cellIndex];
      const pastedCell: TableCell = regenerateCellCodeForPaste(
        { ...copied, id: targetCell.id },
        questionCodeRef.current,
        questionTitleRef.current,
        targetRow?.rowCode,
        targetRow?.label,
        targetColumn?.columnCode,
        targetColumn?.label,
      );

      let updatedRows = rows.map((row, rIndex) =>
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
      notifyChange(currentTitleRef.current, columns, finalRows);
    },
    [notifyChange, dragCopy.copiedRegion, dragCopy.pasteRegion],
  );

  // ── 셀 삭제/업데이트 ──

  const updateCell = useCallback(
    (rowIndex: number, cellIndex: number, cell: TableCell) => {
      const rows = currentRowsRef.current;
      let updatedRows = rows.map((row, rIndex) =>
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
      notifyChange(currentTitleRef.current, currentColumnsRef.current, finalRows);
      setSelectedCell(null);
    },
    [notifyChange],
  );

  const deleteCell = useCallback(
    (rowIndex: number, cellIndex: number) => {
      const cell = currentRowsRef.current[rowIndex]?.cells[cellIndex];
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
    [updateCell],
  );

  // ── 셀 병합/해제 ──

  const canMerge = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right'): boolean => {
      const selected = selectedCellRef.current;
      if (!selected) return false;

      const rows = currentRowsRef.current;
      const rowIndex = rows.findIndex((row) => row.id === selected.rowId);
      const cellIndex = rows[rowIndex]?.cells.findIndex(
        (cell) => cell.id === selected.cellId,
      );
      if (rowIndex === -1 || cellIndex === -1) return false;

      return checkCanMerge(direction, rowIndex, cellIndex, rows, currentColumnsRef.current);
    },
    [],
  );

  const handleMerge = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      const selected = selectedCellRef.current;
      if (!selected) return;

      const rows = currentRowsRef.current;
      const columns = currentColumnsRef.current;

      const rowIndex = rows.findIndex((row) => row.id === selected.rowId);
      const cellIndex = rows[rowIndex]?.cells.findIndex(
        (cell) => cell.id === selected.cellId,
      );
      if (rowIndex === -1 || cellIndex === -1) return;

      if (!checkCanMerge(direction, rowIndex, cellIndex, rows, columns)) return;

      if (
        !window.confirm(
          '병합되는 셀의 내용은 삭제됩니다. 계속하시겠습니까?\n(기준 셀의 내용만 유지됩니다)',
        )
      ) {
        return;
      }

      const { updatedRows, newSelectedCell } = executeMerge(direction, rowIndex, cellIndex, rows);

      if (newSelectedCell) {
        setSelectedCell(newSelectedCell);
      }

      const finalRows = recalculateHiddenCells(updatedRows);
      setCurrentRows(finalRows);
      notifyChange(currentTitleRef.current, columns, finalRows);
    },
    [notifyChange],
  );

  const handleUnmerge = useCallback(() => {
    const selected = selectedCellRef.current;
    if (!selected) return;

    const rows = currentRowsRef.current;
    const rowIndex = rows.findIndex((row) => row.id === selected.rowId);
    const cellIndex = rows[rowIndex]?.cells.findIndex(
      (cell) => cell.id === selected.cellId,
    );

    if (rowIndex === -1 || cellIndex === -1) return;

    const newRows = executeUnmerge(rowIndex, cellIndex, rows);
    if (newRows === rows) return;

    const finalRows = recalculateHiddenCells(newRows);
    setCurrentRows(finalRows);
    notifyChange(currentTitleRef.current, currentColumnsRef.current, finalRows);
  }, [notifyChange]);

  // ── 셀 선택 (안정된 콜백) ──

  const handleSelectCell = useCallback(
    (rowId: string, cellId: string) => {
      // 드래그 복사 중에는 셀 선택(모달 열림) 방지
      if (dragCopy.dragCopyState?.isDragging) return;
      setSelectedCell({ rowId, cellId });
    },
    [dragCopy.dragCopyState?.isDragging],
  );

  // ── 다단계 헤더 토글 ──

  const toggleMultiRowHeader = useCallback(
    (enabled: boolean) => {
      setUseMultiRowHeader(enabled);
      if (enabled && !headerGridRef.current) {
        const defaultGrid = buildDefaultHeaderGrid(currentColumnsRef.current);
        setCurrentHeaderGrid(defaultGrid);
        onTableChangeRef.current({
          tableTitle: currentTitleRef.current,
          tableColumns: currentColumnsRef.current,
          tableRowsData: currentRowsRef.current,
          tableHeaderGrid: defaultGrid,
        });
      } else if (!enabled) {
        setCurrentHeaderGrid(undefined);
        onTableChangeRef.current({
          tableTitle: currentTitleRef.current,
          tableColumns: currentColumnsRef.current,
          tableRowsData: currentRowsRef.current,
          tableHeaderGrid: undefined,
        });
      }
    },
    [],
  );

  const updateHeaderGrid = useCallback(
    (newGrid: HeaderCell[][]) => {
      setCurrentHeaderGrid(newGrid);
      onTableChangeRef.current({
        tableTitle: currentTitleRef.current,
        tableColumns: currentColumnsRef.current,
        tableRowsData: currentRowsRef.current,
        tableHeaderGrid: newGrid,
      });
    },
    [],
  );

  // ── columnWidths (EditorTableRow에 안정적 참조 전달용) ──

  const columnWidths = useMemo(
    () => currentColumns.map((col) => col.width || 150),
    // 라벨/코드 변경 시 재생성 방지: 너비만 추적
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentColumns.map((col) => col.width).join(',')],
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
      copiedRegion: dragCopy.copiedRegion,
      editingColumnWidth,
      columnWidths,
      useMultiRowHeader,
      currentHeaderGrid,
      rowConditionModalOpen,
      editingRowIndex,
      columnConditionModalOpen,
      editingColumnIndex,
      tableRef,
      selectedCellContext,
      currentQuestionAsQuestion,
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
      addBulkRows,
      duplicateRow,
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
      // 동적 행 설정
      setDynamicGroupId,
      setShowWhenDynamicGroupId,
      // 열 조건부 표시
      openColumnConditionModal,
      updateColumnCondition,
      setColumnConditionModalOpen,
      // 다단계 헤더
      toggleMultiRowHeader,
      updateHeaderGrid,
      // 드래그 복사
      ...dragCopy,
    },
  };
}
