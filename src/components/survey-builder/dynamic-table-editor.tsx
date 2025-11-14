"use client";

import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableCell, TableColumn, TableRow } from "@/types/survey";
import { Plus, Trash2, Image, Video, CheckSquare, Circle, Copy, Clipboard } from "lucide-react";
import { CellContentModal } from "./cell-content-modal";

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
  tableTitle = "",
  columns = [],
  rows = [],
  currentQuestionId = "",
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
          { id: "col-1", label: "열 1", width: 150, minWidth: 60 },
          { id: "col-2", label: "열 2", width: 150, minWidth: 60 },
        ],
  );
  const [currentRows, setCurrentRows] = useState<TableRow[]>(() => {
    const initialRows: TableRow[] =
      rows.length > 0
        ? rows
        : [
            {
              id: "row-1",
              label: "행 1",
              height: 60,
              minHeight: 40,
              cells: [
                { id: "cell-1-1", content: "", type: "text" as const },
                { id: "cell-1-2", content: "", type: "text" as const },
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
        index === columnIndex ? { ...col, width: Math.max(60, width) } : col,
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
      document.addEventListener("mousemove", handleRowResizeMove);
      document.addEventListener("mouseup", handleRowResizeEnd);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleRowResizeMove);
        document.removeEventListener("mouseup", handleRowResizeEnd);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [resizingRow, handleRowResizeMove, handleRowResizeEnd]);

  // 열 추가
  const addColumn = () => {
    const newColumn: TableColumn = {
      id: `col-${Date.now()}`,
      label: `열 ${currentColumns.length + 1}`,
      width: 150, // 기본 너비
      minWidth: 60, // 최소 너비
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
            content: "",
            type: "text" as const,
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
    const newRowIndex = currentRows.length;

    // 새 행의 각 셀이 기존 병합 셀의 rowspan 영역에 포함되는지 확인
    const cells = currentColumns.map((_col, colIndex) => {
      let shouldBeHidden = false;

      // 위쪽 행들을 확인하여 rowspan이 새 행까지 미치는지 체크
      for (let r = 0; r < currentRows.length; r++) {
        const cell = currentRows[r].cells[colIndex];
        if (!cell) continue;

        const rowspan = cell.rowspan || 1;
        const colspan = cell.colspan || 1;

        // 이 셀의 rowspan이 새 행까지 미치고, colspan이 현재 열을 포함하는지 확인
        if (r + rowspan > newRowIndex) {
          // colspan 확인
          const cellColIndex = currentRows[r].cells.findIndex((c) => c.id === cell.id);
          if (colIndex >= cellColIndex && colIndex < cellColIndex + colspan) {
            shouldBeHidden = true;
            break;
          }
        }
      }

      return {
        id: `cell-${Date.now()}-${colIndex}`,
        content: "",
        type: "text" as const,
        isHidden: shouldBeHidden,
      };
    });

    const newRow: TableRow = {
      id: `row-${Date.now()}`,
      label: `행 ${currentRows.length + 1}`,
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

    const updatedRows = currentRows.filter((_, index) => index !== rowIndex);
    setCurrentRows(updatedRows);
    notifyChange(currentTitle, currentColumns, updatedRows);
  };

  // 행 제목 업데이트
  const updateRowLabel = (rowIndex: number, label: string) => {
    const updatedRows = currentRows.map((row, index) =>
      index === rowIndex ? { ...row, label } : row,
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
        id: "", // ID는 붙여넣기 시 새로 생성
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

  // 셀 렌더링 함수
  const renderCellContent = (cell: TableCell) => {
    switch (cell.type) {
      case "checkbox":
        return cell.checkboxOptions && cell.checkboxOptions.length > 0 ? (
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-600 truncate">
              체크박스 ({cell.checkboxOptions.length}개)
            </span>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">체크박스 없음</span>
        );
      case "radio":
        return cell.radioOptions && cell.radioOptions.length > 0 ? (
          <div className="flex items-center gap-2">
            <Circle className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-gray-600 truncate">
              라디오 ({cell.radioOptions.length}개)
            </span>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">라디오 없음</span>
        );
      case "image":
        return cell.imageUrl ? (
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4 text-blue-500" aria-label="이미지 아이콘" />
            <span className="text-sm text-gray-600 truncate">이미지</span>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">이미지 없음</span>
        );
      case "video":
        return cell.videoUrl ? (
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-red-500" />
            <span className="text-sm text-gray-600 truncate">동영상</span>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">동영상 없음</span>
        );
      case "input":
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 truncate">
              {cell.placeholder ? `입력 필드: ${cell.placeholder}` : "단답형 입력"}
            </span>
          </div>
        );
      case "select":
        return cell.selectOptions && cell.selectOptions.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 truncate">
              선택 ({cell.selectOptions.length}개)
            </span>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">선택 옵션 없음</span>
        );
      default:
        return cell.content || <span className="text-gray-400 text-sm"></span>;
    }
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-blue-600 font-medium">전체 크기</div>
              <div className="text-blue-900 text-lg font-bold">
                {currentRows.length} × {currentColumns.length}
              </div>
              <div className="text-blue-600 text-xs">행 × 열</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-green-600 font-medium">총 셀 수</div>
              <div className="text-green-900 text-lg font-bold">
                {currentRows.length * currentColumns.length}
              </div>
              <div className="text-green-600 text-xs">개</div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-purple-600 font-medium">인터랙티브 셀</div>
              <div className="text-purple-900 text-lg font-bold">
                {currentRows.reduce(
                  (count, row) =>
                    count +
                    row.cells.filter(
                      (cell) =>
                        cell.type === "checkbox" ||
                        cell.type === "radio" ||
                        cell.type === "select" ||
                        cell.type === "input",
                    ).length,
                  0,
                )}
              </div>
              <div className="text-purple-600 text-xs">개</div>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <div className="text-orange-600 font-medium">미디어 셀</div>
              <div className="text-orange-900 text-lg font-bold">
                {currentRows.reduce(
                  (count, row) =>
                    count +
                    row.cells.filter((cell) => cell.type === "image" || cell.type === "video")
                      .length,
                  0,
                )}
              </div>
              <div className="text-orange-600 text-xs">개</div>
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
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                  <Clipboard className="w-4 h-4" />
                  <span>
                    셀 복사됨 (
                    {copiedCellPosition
                      ? `${copiedCellPosition.rowIndex + 1}, ${copiedCellPosition.cellIndex + 1}`
                      : ""}
                    )
                  </span>
                </div>
              )}
              <Button onClick={addColumn} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-1" />열 추가
              </Button>
              <Button onClick={addRow} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-1" />행 추가
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table
              ref={tableRef}
              className="w-full border-collapse border border-gray-300"
              style={{ tableLayout: "fixed" }}
            >
              {/* 열 너비 정의 */}
              <colgroup>
                {currentColumns.map((column, index) => (
                  <col key={`col-${index}`} style={{ width: `${column.width || 150}px` }} />
                ))}
              </colgroup>

              {/* 헤더 행 */}
              <thead>
                <tr>
                  {currentColumns.map((column, columnIndex) => (
                    <th
                      key={column.id}
                      className="border border-gray-300 p-2 bg-gray-50 relative"
                      style={{
                        width: column.width ? `${column.width}px` : "150px",
                        minWidth: column.minWidth ? `${column.minWidth}px` : "60px",
                      }}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={column.label}
                            onChange={(e) => updateColumnLabel(columnIndex, e.target.value)}
                            className="h-8 text-center border border-gray-200 bg-white text-sm"
                            placeholder="열 제목 (비워둘 수 있음)"
                          />
                          {currentColumns.length > 1 && (
                            <Button
                              onClick={() => deleteColumn(columnIndex)}
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>열 #{columnIndex + 1}</span>
                          {editingColumnWidth?.columnIndex === columnIndex ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={60}
                                value={editingColumnWidth.value}
                                onChange={(e) => {
                                  setEditingColumnWidth({
                                    columnIndex,
                                    value: e.target.value,
                                  });
                                }}
                                onBlur={() => {
                                  const width = parseInt(editingColumnWidth.value);
                                  if (!isNaN(width) && width >= 60) {
                                    handleColumnWidthChange(columnIndex, width);
                                  }
                                  setEditingColumnWidth(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const width = parseInt(editingColumnWidth.value);
                                    if (!isNaN(width) && width >= 60) {
                                      handleColumnWidthChange(columnIndex, width);
                                    }
                                    setEditingColumnWidth(null);
                                  } else if (e.key === "Escape") {
                                    setEditingColumnWidth(null);
                                  }
                                }}
                                className="w-14 h-5 px-1 text-xs"
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
                              {column.width ? `${column.width}px` : "150px"}
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
                  <tr key={row.id} style={{ height: row.height ? `${row.height}px` : "60px" }}>
                    {/* 셀들 */}
                    {row.cells.map((cell, cellIndex) => {
                      // 숨겨진 셀은 렌더링하지 않음
                      if (cell.isHidden) return null;

                      const column = currentColumns[cellIndex];
                      const rowspan = cell.rowspan || 1;
                      const colspan = cell.colspan || 1;
                      const isMerged = rowspan > 1 || colspan > 1;

                      return (
                        <td
                          key={cell.id}
                          className="border border-gray-300 p-2 relative"
                          style={{
                            width: column?.width ? `${column.width}px` : "150px",
                            maxWidth: column?.width ? `${column.width}px` : "150px",
                            height: row.height ? `${row.height}px` : "60px",
                          }}
                          rowSpan={rowspan}
                          colSpan={colspan}
                        >
                          <div
                            className="h-full group cursor-pointer hover:bg-gray-50 rounded p-2 transition-colors flex flex-col"
                            onClick={() => setSelectedCell({ rowId: row.id, cellId: cell.id })}
                            style={{
                              minHeight: row.minHeight ? `${row.minHeight - 16}px` : "40px",
                            }}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">{renderCellContent(cell)}</div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                                  <Copy className="w-3 h-3" />
                                </Button>
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
                                    <Clipboard className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-gray-400 mt-1 border-t border-gray-100 pt-1">
                              <div className="flex justify-between items-center">
                                <span>
                                  셀 ({rowIndex + 1}, {cellIndex + 1})
                                </span>
                                <span className="capitalize font-medium">{cell.type}</span>
                              </div>
                              {isMerged && (
                                <div className="mt-1 text-orange-600 font-medium">
                                  🔗 병합: {rowspan}행 × {colspan}열
                                </div>
                              )}
                              {cell.type === "checkbox" && cell.checkboxOptions && (
                                <div className="mt-1 text-green-600">
                                  체크박스 {cell.checkboxOptions.length}개
                                </div>
                              )}
                              {cell.type === "radio" && cell.radioOptions && (
                                <div className="mt-1 text-purple-600">
                                  라디오 {cell.radioOptions.length}개
                                </div>
                              )}
                              {cell.type === "select" && cell.selectOptions && (
                                <div className="mt-1 text-indigo-600">
                                  선택 {cell.selectOptions.length}개
                                </div>
                              )}
                              {cell.type === "input" && (
                                <div className="mt-1 text-teal-600">
                                  {cell.placeholder || "단답형 입력"}
                                </div>
                              )}
                              {cell.type === "image" && cell.imageUrl && (
                                <div className="mt-1 text-blue-600">이미지 설정됨</div>
                              )}
                              {cell.type === "video" && cell.videoUrl && (
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
              id: "",
              content: "",
              type: "text",
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
