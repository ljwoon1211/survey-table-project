"use client";

import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FlexibleTable,
  FlexibleTableRow,
  FlexibleTableColumn,
  FlexibleTableCell,
} from "@/types/flexible-table";
import {
  Plus,
  Trash2,
  Edit3,
  Merge,
  Split,
  RotateCcw,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Type,
  Palette,
  GripVertical,
} from "lucide-react";

interface FlexibleTableEditorProps {
  table?: FlexibleTable;
  onTableChange: (table: FlexibleTable) => void;
}

export function FlexibleTableEditor({ table, onTableChange }: FlexibleTableEditorProps) {
  const [currentTable, setCurrentTable] = useState<FlexibleTable>(
    table || {
      id: `table-${Date.now()}`,
      title: "",
      description: "",
      rowHeaderTitle: "항목",
      rows: [
        {
          id: "row-1",
          label: "행 1",
          cells: [
            { id: "cell-1-1", content: "", type: "text" },
            { id: "cell-1-2", content: "", type: "text" },
          ],
        },
      ],
      columns: [
        { id: "col-1", label: "열 1", width: 150, minWidth: 60 },
        { id: "col-2", label: "열 2", width: 150, minWidth: 60 },
      ],
      borderCollapse: true,
      borderColor: "#d1d5db",
      borderWidth: 1,
    },
  );

  const [selectedCells, setSelectedCells] = useState<string[]>([]);
  const [editingCell, setEditingCell] = useState<string | null>(null);

  // 드래그 리사이즈 관련 상태
  const [resizing, setResizing] = useState<{
    columnIndex: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // 테이블 변경 알림
  const notifyChange = (newTable: FlexibleTable) => {
    setCurrentTable(newTable);
    onTableChange(newTable);
  };

  // 셀 선택/해제
  const toggleCellSelection = (cellId: string) => {
    setSelectedCells((prev) =>
      prev.includes(cellId) ? prev.filter((id) => id !== cellId) : [...prev, cellId],
    );
  };

  // 모든 선택 해제
  const clearSelection = () => {
    setSelectedCells([]);
  };

  // 행 추가
  const addRow = () => {
    const newRowId = `row-${Date.now()}`;
    const newCells = currentTable.columns.map((col, index) => ({
      id: `cell-${newRowId}-${index}`,
      content: "",
      type: "text" as const,
    }));

    const newRow: FlexibleTableRow = {
      id: newRowId,
      label: `행 ${currentTable.rows.length + 1}`,
      cells: newCells,
    };

    notifyChange({
      ...currentTable,
      rows: [...currentTable.rows, newRow],
    });
  };

  // 열 추가
  const addColumn = () => {
    const newColId = `col-${Date.now()}`;
    const newColumn: FlexibleTableColumn = {
      id: newColId,
      label: `열 ${currentTable.columns.length + 1}`,
      width: 150, // 기본 너비
      minWidth: 60, // 최소 너비
    };

    const updatedRows = currentTable.rows.map((row) => ({
      ...row,
      cells: [
        ...row.cells,
        {
          id: `cell-${row.id}-${newColId}`,
          content: "",
          type: "text" as const,
        },
      ],
    }));

    notifyChange({
      ...currentTable,
      columns: [...currentTable.columns, newColumn],
      rows: updatedRows,
    });
  };

  // 셀 병합
  const mergeCells = () => {
    if (selectedCells.length < 2) {
      alert("병합하려면 최소 2개의 셀을 선택해주세요.");
      return;
    }

    // 선택된 셀들의 위치 정보 계산
    const cellPositions = selectedCells.map((cellId) => {
      const [rowIndex, cellIndex] = findCellPosition(cellId);
      return { cellId, rowIndex, cellIndex };
    });

    // 병합 영역 계산
    const minRow = Math.min(...cellPositions.map((p) => p.rowIndex));
    const maxRow = Math.max(...cellPositions.map((p) => p.rowIndex));
    const minCol = Math.min(...cellPositions.map((p) => p.cellIndex));
    const maxCol = Math.max(...cellPositions.map((p) => p.cellIndex));

    const rowspan = maxRow - minRow + 1;
    const colspan = maxCol - minCol + 1;

    // 병합된 셀의 내용 결합
    const mergedContent = selectedCells
      .map((cellId) => findCell(cellId)?.content)
      .filter((content) => content && content.trim())
      .join(" ");

    const updatedRows = currentTable.rows.map((row, rowIndex) => ({
      ...row,
      cells: row.cells.map((cell, cellIndex) => {
        if (rowIndex === minRow && cellIndex === minCol) {
          // 기준 셀 (왼쪽 위)
          return {
            ...cell,
            content: mergedContent,
            colspan,
            rowspan,
            isMerged: false,
          };
        } else if (
          rowIndex >= minRow &&
          rowIndex <= maxRow &&
          cellIndex >= minCol &&
          cellIndex <= maxCol &&
          !(rowIndex === minRow && cellIndex === minCol)
        ) {
          // 병합되는 다른 셀들
          return {
            ...cell,
            content: "",
            isMerged: true,
            mergedWith: currentTable.rows[minRow].cells[minCol].id,
          };
        }
        return cell;
      }),
    }));

    notifyChange({
      ...currentTable,
      rows: updatedRows,
    });

    clearSelection();
  };

  // 셀 병합 해제
  const splitCells = () => {
    if (selectedCells.length !== 1) {
      alert("병합 해제하려면 하나의 병합된 셀을 선택해주세요.");
      return;
    }

    const cell = findCell(selectedCells[0]);
    if (!cell || (!cell.colspan && !cell.rowspan)) {
      alert("병합된 셀이 아닙니다.");
      return;
    }

    const updatedRows = currentTable.rows.map((row) => ({
      ...row,
      cells: row.cells.map((c) => {
        if (c.id === cell.id) {
          // 병합된 셀 해제
          const { colspan, rowspan, ...restCell } = c;
          return { ...restCell, isMerged: false };
        } else if (c.mergedWith === cell.id) {
          // 병합되었던 셀들 복원
          return { ...c, isMerged: false, mergedWith: undefined };
        }
        return c;
      }),
    }));

    notifyChange({
      ...currentTable,
      rows: updatedRows,
    });

    clearSelection();
  };

  // 셀 찾기 헬퍼
  const findCell = (cellId: string): FlexibleTableCell | undefined => {
    for (const row of currentTable.rows) {
      const cell = row.cells.find((c) => c.id === cellId);
      if (cell) return cell;
    }
    return undefined;
  };

  // 셀 위치 찾기 헬퍼
  const findCellPosition = (cellId: string): [number, number] => {
    for (let rowIndex = 0; rowIndex < currentTable.rows.length; rowIndex++) {
      const cellIndex = currentTable.rows[rowIndex].cells.findIndex((c) => c.id === cellId);
      if (cellIndex !== -1) {
        return [rowIndex, cellIndex];
      }
    }
    return [-1, -1];
  };

  // 열 너비 리사이즈 관련 함수들
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, columnIndex: number) => {
      e.preventDefault();
      e.stopPropagation();

      const currentWidth = currentTable.columns[columnIndex].width || 150;
      setResizing({
        columnIndex,
        startX: e.clientX,
        startWidth: currentWidth,
      });
    },
    [currentTable.columns],
  );

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!resizing) return;

      const deltaX = e.clientX - resizing.startX;
      const newWidth = Math.max(60, resizing.startWidth + deltaX); // 최소 너비 60px

      const updatedColumns = currentTable.columns.map((col, index) =>
        index === resizing.columnIndex ? { ...col, width: newWidth } : col,
      );

      // 실시간으로 테이블 업데이트 (성능상 throttling 없이)
      const updatedTable = {
        ...currentTable,
        columns: updatedColumns,
      };

      setCurrentTable(updatedTable);
    },
    [resizing, currentTable],
  );

  const handleResizeEnd = useCallback(() => {
    if (!resizing) return;

    // 최종 상태를 부모에게 전달
    onTableChange(currentTable);
    setResizing(null);
  }, [resizing, currentTable, onTableChange]);

  // 마우스 이벤트 리스너 등록/해제
  React.useEffect(() => {
    if (resizing) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleResizeMove);
        document.removeEventListener("mouseup", handleResizeEnd);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [resizing, handleResizeMove, handleResizeEnd]);

  // 셀 내용 업데이트
  const updateCellContent = (cellId: string, content: string) => {
    const updatedRows = currentTable.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => (cell.id === cellId ? { ...cell, content } : cell)),
    }));

    notifyChange({
      ...currentTable,
      rows: updatedRows,
    });
  };

  // 셀 렌더링
  const renderCell = (cell: FlexibleTableCell, rowIndex: number, cellIndex: number) => {
    if (cell.isMerged) {
      return null; // 병합된 셀은 렌더링하지 않음
    }

    const isSelected = selectedCells.includes(cell.id);
    const isEditing = editingCell === cell.id;
    const column = currentTable.columns[cellIndex];

    return (
      <td
        key={cell.id}
        colSpan={cell.colspan || 1}
        rowSpan={cell.rowspan || 1}
        className={`border border-gray-300 p-2 min-h-[60px] relative ${
          isSelected ? "bg-blue-100 border-blue-500" : "hover:bg-gray-50"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          if (e.ctrlKey || e.metaKey) {
            toggleCellSelection(cell.id);
          } else {
            setSelectedCells([cell.id]);
          }
        }}
        style={{
          backgroundColor: cell.backgroundColor,
          textAlign: cell.textAlign || "left",
          fontWeight: cell.fontWeight || "normal",
          fontSize:
            cell.fontSize === "small" ? "12px" : cell.fontSize === "large" ? "16px" : "14px",
          width: column?.width ? `${column.width}px` : "150px",
          maxWidth: column?.width ? `${column.width}px` : "150px",
        }}
      >
        {isEditing ? (
          <Input
            value={cell.content}
            onChange={(e) => updateCellContent(cell.id, e.target.value)}
            onBlur={() => setEditingCell(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setEditingCell(null);
              }
            }}
            className="h-8 border-0 bg-transparent"
            autoFocus
          />
        ) : (
          <div
            className="min-h-[40px] cursor-pointer"
            onDoubleClick={() => setEditingCell(cell.id)}
          >
            {cell.content || (
              <span className="text-gray-400 text-sm">클릭하여 편집 (더블클릭으로 빠른 편집)</span>
            )}

            {/* 셀 정보 표시 */}
            <div className="absolute top-1 right-1 text-xs text-gray-400">
              {cell.colspan && cell.colspan > 1 && (
                <span className="bg-blue-200 px-1 rounded mr-1">C:{cell.colspan}</span>
              )}
              {cell.rowspan && cell.rowspan > 1 && (
                <span className="bg-green-200 px-1 rounded">R:{cell.rowspan}</span>
              )}
            </div>
          </div>
        )}
      </td>
    );
  };

  return (
    <div className="space-y-6">
      {/* 제목 입력 */}
      <div className="space-y-2">
        <Label htmlFor="table-title">테이블 제목</Label>
        <Input
          id="table-title"
          value={currentTable.title || ""}
          onChange={(e) => notifyChange({ ...currentTable, title: e.target.value })}
          placeholder="복잡한 설문지 테이블"
        />
      </div>

      {/* 행 헤더 제목 */}
      <div className="space-y-2">
        <Label htmlFor="row-header-title">행 헤더 제목</Label>
        <Input
          id="row-header-title"
          value={currentTable.rowHeaderTitle || "항목"}
          onChange={(e) => notifyChange({ ...currentTable, rowHeaderTitle: e.target.value })}
          placeholder="행 헤더 제목을 입력하세요 (예: 항목, 질문, 구분 등)"
        />
      </div>

      {/* 도구 모음 */}
      <Card>
        <CardHeader>
          <CardTitle>편집 도구</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button onClick={addRow} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />행 추가
            </Button>
            <Button onClick={addColumn} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />열 추가
            </Button>

            <div className="h-6 w-px bg-gray-300 mx-2" />

            <Button
              onClick={mergeCells}
              size="sm"
              variant="outline"
              disabled={selectedCells.length < 2}
            >
              <Merge className="w-4 h-4 mr-1" />셀 병합
            </Button>
            <Button
              onClick={splitCells}
              size="sm"
              variant="outline"
              disabled={selectedCells.length !== 1}
            >
              <Split className="w-4 h-4 mr-1" />
              병합 해제
            </Button>

            <div className="h-6 w-px bg-gray-300 mx-2" />

            <Button onClick={clearSelection} size="sm" variant="outline">
              <RotateCcw className="w-4 h-4 mr-1" />
              선택 해제
            </Button>
          </div>

          {selectedCells.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                {selectedCells.length}개 셀 선택됨
                <span className="text-xs ml-2">(Ctrl/Cmd + 클릭으로 다중 선택)</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 테이블 편집 영역 */}
      <Card>
        <CardHeader>
          <CardTitle>테이블 편집</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto" onClick={clearSelection}>
            <table
              ref={tableRef}
              className="w-full border-collapse border border-gray-300"
              style={{ tableLayout: "fixed" }}
            >
              {/* 열 헤더 */}
              <thead>
                <tr>
                  {currentTable.columns.map((column, columnIndex) => (
                    <th
                      key={column.id}
                      className="border border-gray-300 p-2 bg-gray-50 font-medium text-center relative"
                      style={{
                        width: column.width ? `${column.width}px` : "150px",
                        minWidth: column.minWidth ? `${column.minWidth}px` : "60px",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm truncate">
                          {column.label || `열 ${columnIndex + 1}`}
                        </span>
                        <div className="text-xs text-gray-400">
                          {column.width ? `${column.width}px` : "150px"}
                        </div>
                      </div>

                      {/* 리사이즈 핸들 */}
                      {columnIndex < currentTable.columns.length - 1 && (
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-200 transition-colors group flex items-center justify-center"
                          onMouseDown={(e) => handleResizeStart(e, columnIndex)}
                          title="드래그하여 열 너비 조절"
                        >
                          <GripVertical className="w-3 h-3 text-gray-400 group-hover:text-blue-600" />
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {currentTable.rows.map((row, rowIndex) => (
                  <tr key={row.id}>
                    {row.cells.map((cell, cellIndex) => renderCell(cell, rowIndex, cellIndex))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 사용법 안내 */}
      <Card>
        <CardHeader>
          <CardTitle>사용법</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              • <strong>셀 선택:</strong> 클릭하여 단일 선택, Ctrl/Cmd + 클릭으로 다중 선택
            </p>
            <p>
              • <strong>셀 편집:</strong> 더블클릭으로 빠른 편집, 단일 클릭 후 내용 입력
            </p>
            <p>
              • <strong>셀 병합:</strong> 여러 셀 선택 후 "셀 병합" 버튼 클릭
            </p>
            <p>
              • <strong>병합 해제:</strong> 병합된 셀 선택 후 "병합 해제" 버튼 클릭
            </p>
            <p>
              • <strong>열 너비 조절:</strong> 열 헤더 우측의 핸들을 드래그하여 너비 조절
            </p>
            <p>
              • <strong>워드/한글 호환:</strong> 복잡한 표 구조도 자유롭게 구성 가능
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
