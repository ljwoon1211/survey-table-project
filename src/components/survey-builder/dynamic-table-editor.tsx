"use client";

import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableCell, TableColumn, TableRow } from "@/types/survey";
import {
  Plus,
  Trash2,
  Edit3,
  Image,
  Video,
  CheckSquare,
  Circle,
  LayoutGrid,
  Table2,
  GripVertical,
} from "lucide-react";
import { CellContentModal } from "./cell-content-modal";
import { FlexibleTableEditor } from "./flexible-table-editor";

interface DynamicTableEditorProps {
  tableTitle?: string;
  tableRowHeaderTitle?: string;
  tableHeaderCell?: TableCell;
  columns?: TableColumn[];
  rows?: TableRow[];
  onTableChange: (data: {
    tableTitle: string;
    tableRowHeaderTitle: string;
    tableHeaderCell?: TableCell;
    tableColumns: TableColumn[];
    tableRowsData: TableRow[];
  }) => void;
}

export function DynamicTableEditor({
  tableTitle = "",
  tableRowHeaderTitle = "항목",
  tableHeaderCell,
  columns = [],
  rows = [],
  onTableChange,
}: DynamicTableEditorProps) {
  const [currentTitle, setCurrentTitle] = useState(tableTitle);
  const [currentRowHeaderTitle, setCurrentRowHeaderTitle] = useState(tableRowHeaderTitle);
  const [currentHeaderCell, setCurrentHeaderCell] = useState<TableCell>(
    tableHeaderCell || { id: "header-cell-1", content: tableRowHeaderTitle, type: "text" },
  );
  const [currentColumns, setCurrentColumns] = useState<TableColumn[]>(
    columns.length > 0
      ? columns
      : [
          { id: "col-1", label: "열 1", width: 150, minWidth: 60 },
          { id: "col-2", label: "열 2", width: 150, minWidth: 60 },
        ],
  );
  const [currentRows, setCurrentRows] = useState<TableRow[]>(
    rows.length > 0
      ? rows
      : [
          {
            id: "row-1",
            label: "행 1",
            height: 60,
            minHeight: 40,
            cells: [
              { id: "cell-1-1", content: "", type: "text" },
              { id: "cell-1-2", content: "", type: "text" },
            ],
          },
        ],
  );

  const [selectedCell, setSelectedCell] = useState<{
    rowId: string;
    cellId: string;
  } | null>(null);

  const [editMode, setEditMode] = useState<"simple" | "flexible">("simple");

  // 드래그 리사이즈 관련 상태 (열)
  const [resizingColumn, setResizingColumn] = useState<{
    columnIndex: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  // 드래그 리사이즈 관련 상태 (행)
  const [resizingRow, setResizingRow] = useState<{
    rowIndex: number;
    startY: number;
    startHeight: number;
  } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // 변경 사항을 부모에게 전달
  const notifyChange = (
    title: string,
    rowHeaderTitle: string,
    headerCell: TableCell,
    cols: TableColumn[],
    rowsData: TableRow[],
  ) => {
    onTableChange({
      tableTitle: title,
      tableRowHeaderTitle: rowHeaderTitle,
      tableHeaderCell: headerCell,
      tableColumns: cols,
      tableRowsData: rowsData,
    });
  };

  // 제목 업데이트
  const updateTitle = (title: string) => {
    setCurrentTitle(title);
    notifyChange(title, currentRowHeaderTitle, currentHeaderCell, currentColumns, currentRows);
  };

  // 행 헤더 제목 업데이트
  const updateRowHeaderTitle = (rowHeaderTitle: string) => {
    setCurrentRowHeaderTitle(rowHeaderTitle);
    // 헤더셀 내용도 함께 업데이트
    const updatedHeaderCell = { ...currentHeaderCell, content: rowHeaderTitle };
    setCurrentHeaderCell(updatedHeaderCell);
    notifyChange(currentTitle, rowHeaderTitle, updatedHeaderCell, currentColumns, currentRows);
  };

  // 헤더 셀 업데이트
  const updateHeaderCell = (cell: TableCell) => {
    setCurrentHeaderCell(cell);
    notifyChange(currentTitle, currentRowHeaderTitle, cell, currentColumns, currentRows);
  };

  // 열 너비 리사이즈 관련 함수들
  const handleColumnResizeStart = useCallback(
    (e: React.MouseEvent, columnIndex: number) => {
      e.preventDefault();
      e.stopPropagation();

      const currentWidth = currentColumns[columnIndex].width || 150;
      setResizingColumn({
        columnIndex,
        startX: e.clientX,
        startWidth: currentWidth,
      });
    },
    [currentColumns],
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

  const handleColumnResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!resizingColumn) return;

      const deltaX = e.clientX - resizingColumn.startX;
      const newWidth = Math.max(60, resizingColumn.startWidth + deltaX); // 최소 너비 60px

      const updatedColumns = currentColumns.map((col, index) =>
        index === resizingColumn.columnIndex ? { ...col, width: newWidth } : col,
      );

      setCurrentColumns(updatedColumns);
    },
    [resizingColumn, currentColumns],
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

  const handleColumnResizeEnd = useCallback(() => {
    if (!resizingColumn) return;

    // 최종 상태를 부모에게 전달
    notifyChange(
      currentTitle,
      currentRowHeaderTitle,
      currentHeaderCell,
      currentColumns,
      currentRows,
    );
    setResizingColumn(null);
  }, [
    resizingColumn,
    currentTitle,
    currentRowHeaderTitle,
    currentHeaderCell,
    currentColumns,
    currentRows,
  ]);

  const handleRowResizeEnd = useCallback(() => {
    if (!resizingRow) return;

    // 최종 상태를 부모에게 전달
    notifyChange(
      currentTitle,
      currentRowHeaderTitle,
      currentHeaderCell,
      currentColumns,
      currentRows,
    );
    setResizingRow(null);
  }, [
    resizingRow,
    currentTitle,
    currentRowHeaderTitle,
    currentHeaderCell,
    currentColumns,
    currentRows,
  ]);

  // 마우스 이벤트 리스너 등록/해제 (열 리사이즈)
  React.useEffect(() => {
    if (resizingColumn) {
      document.addEventListener("mousemove", handleColumnResizeMove);
      document.addEventListener("mouseup", handleColumnResizeEnd);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleColumnResizeMove);
        document.removeEventListener("mouseup", handleColumnResizeEnd);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [resizingColumn, handleColumnResizeMove, handleColumnResizeEnd]);

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

    // 모든 행에 새 셀 추가
    const updatedRows = currentRows.map((row) => ({
      ...row,
      cells: [
        ...row.cells,
        {
          id: `cell-${row.id}-${newColumn.id}`,
          content: "",
          type: "text" as const,
        },
      ],
    }));

    setCurrentColumns(updatedColumns);
    setCurrentRows(updatedRows);
    notifyChange(
      currentTitle,
      currentRowHeaderTitle,
      currentHeaderCell,
      updatedColumns,
      updatedRows,
    );
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
    notifyChange(
      currentTitle,
      currentRowHeaderTitle,
      currentHeaderCell,
      updatedColumns,
      updatedRows,
    );
  };

  // 열 제목 업데이트
  const updateColumnLabel = (columnIndex: number, label: string) => {
    const updatedColumns = currentColumns.map((col, index) =>
      index === columnIndex ? { ...col, label } : col,
    );

    setCurrentColumns(updatedColumns);
    notifyChange(
      currentTitle,
      currentRowHeaderTitle,
      currentHeaderCell,
      updatedColumns,
      currentRows,
    );
  };

  // 행 추가
  const addRow = () => {
    const newRow: TableRow = {
      id: `row-${Date.now()}`,
      label: `행 ${currentRows.length + 1}`,
      height: 60, // 기본 행 높이
      minHeight: 40, // 최소 행 높이
      cells: currentColumns.map((col, index) => ({
        id: `cell-${Date.now()}-${index}`,
        content: "",
        type: "text" as const,
      })),
    };

    const updatedRows = [...currentRows, newRow];
    setCurrentRows(updatedRows);
    notifyChange(
      currentTitle,
      currentRowHeaderTitle,
      currentHeaderCell,
      currentColumns,
      updatedRows,
    );
  };

  // 행 삭제
  const deleteRow = (rowIndex: number) => {
    if (currentRows.length <= 1) return; // 최소 1개 행 유지

    const updatedRows = currentRows.filter((_, index) => index !== rowIndex);
    setCurrentRows(updatedRows);
    notifyChange(
      currentTitle,
      currentRowHeaderTitle,
      currentHeaderCell,
      currentColumns,
      updatedRows,
    );
  };

  // 행 제목 업데이트
  const updateRowLabel = (rowIndex: number, label: string) => {
    const updatedRows = currentRows.map((row, index) =>
      index === rowIndex ? { ...row, label } : row,
    );

    setCurrentRows(updatedRows);
    notifyChange(
      currentTitle,
      currentRowHeaderTitle,
      currentHeaderCell,
      currentColumns,
      updatedRows,
    );
  };

  // 셀 내용 업데이트
  const updateCell = (rowIndex: number, cellIndex: number, cell: TableCell) => {
    const updatedRows = currentRows.map((row, rIndex) =>
      rIndex === rowIndex
        ? {
            ...row,
            cells: row.cells.map((c, cIndex) => (cIndex === cellIndex ? cell : c)),
          }
        : row,
    );

    setCurrentRows(updatedRows);
    notifyChange(
      currentTitle,
      currentRowHeaderTitle,
      currentHeaderCell,
      currentColumns,
      updatedRows,
    );
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
            <Image className="w-4 h-4 text-blue-500" />
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
      default:
        return cell.content || <span className="text-gray-400 text-sm">내용 없음</span>;
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

      {/* 행 헤더 제목 */}
      <div className="space-y-2">
        <Label htmlFor="row-header-title">행 헤더 제목</Label>
        <Input
          id="row-header-title"
          value={currentRowHeaderTitle}
          onChange={(e) => updateRowHeaderTitle(e.target.value)}
          placeholder="행 헤더 제목을 입력하세요 (예: 항목, 질문, 구분 등)"
        />
      </div>

      {/* 편집 모드 선택 */}
      <Card>
        <CardHeader>
          <CardTitle>편집 모드</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                editMode === "simple"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              onClick={() => setEditMode("simple")}
            >
              <div className="flex items-center space-x-3 mb-2">
                <Table2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-medium">간단한 테이블</h3>
              </div>
              <p className="text-sm text-gray-600">정형화된 표 형태로 빠르게 설문 제작</p>
              <ul className="text-xs text-gray-500 mt-2 space-y-1">
                <li>• 체크박스, 라디오 버튼 지원</li>
                <li>• 이미지, 동영상 삽입</li>
                <li>• 빠른 편집</li>
              </ul>
            </div>

            <div
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                editMode === "flexible"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              onClick={() => setEditMode("flexible")}
            >
              <div className="flex items-center space-x-3 mb-2">
                <LayoutGrid className="w-5 h-5 text-green-600" />
                <h3 className="font-medium">유연한 테이블</h3>
                <span className="px-2 py-1 text-xs bg-orange-100 text-orange-600 rounded">NEW</span>
              </div>
              <p className="text-sm text-gray-600">워드/한글 문서처럼 자유로운 표 구조</p>
              <ul className="text-xs text-gray-500 mt-2 space-y-1">
                <li>• 셀 병합/분할 지원</li>
                <li>• 복잡한 레이아웃</li>
                <li>• 기존 설문지 재현</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 편집기 렌더링 */}
      {editMode === "simple" ? (
        <>
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
                          (cell) => cell.type === "checkbox" || cell.type === "radio",
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
                  {/* 헤더 행 */}
                  <thead>
                    <tr>
                      <th className="border border-gray-300 p-2 bg-gray-50 w-32 relative">
                        <div
                          className="min-h-[60px] group cursor-pointer hover:bg-gray-100 rounded p-2 transition-colors"
                          onClick={() =>
                            setSelectedCell({ rowId: "header", cellId: "header-cell-1" })
                          }
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">{renderCellContent(currentHeaderCell)}</div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="text-xs text-gray-400 mt-1 border-t border-gray-100 pt-1">
                            <div className="flex justify-between items-center">
                              <span>열 1</span>
                              <span className="capitalize font-medium">
                                {currentHeaderCell.type}
                              </span>
                            </div>
                          </div>
                        </div>
                      </th>
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
                              <span>{column.width ? `${column.width}px` : "150px"}</span>
                            </div>
                          </div>

                          {/* 열 너비 리사이즈 핸들 */}
                          {columnIndex < currentColumns.length - 1 && (
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-200 transition-colors group flex items-center justify-center"
                              onMouseDown={(e) => handleColumnResizeStart(e, columnIndex)}
                              title="드래그하여 열 너비 조절"
                            >
                              <GripVertical className="w-3 h-3 text-gray-400 group-hover:text-blue-600" />
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  {/* 데이터 행들 */}
                  <tbody>
                    {currentRows.map((row, rowIndex) => (
                      <tr key={row.id} style={{ height: row.height ? `${row.height}px` : "60px" }}>
                        {/* 행 제목 */}
                        <td className="border border-gray-300 p-2 bg-gray-50 relative">
                          <div
                            className="space-y-2"
                            style={{
                              minHeight: row.minHeight ? `${row.minHeight - 16}px` : "40px",
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <Input
                                value={row.label}
                                onChange={(e) => updateRowLabel(rowIndex, e.target.value)}
                                className="h-8 border border-gray-200 bg-white text-sm"
                                placeholder="행 제목 (비워둘 수 있음)"
                              />
                              {currentRows.length > 1 && (
                                <Button
                                  onClick={() => deleteRow(rowIndex)}
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              행 #{rowIndex + 1} • 높이 {row.height || 60}px • 셀 {row.cells.length}
                              개
                            </div>
                          </div>

                          {/* 행 높이 리사이즈 핸들 */}
                          {rowIndex < currentRows.length - 1 && (
                            <div
                              className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize hover:bg-green-200 transition-colors group flex items-center justify-center"
                              onMouseDown={(e) => handleRowResizeStart(e, rowIndex)}
                              title="드래그하여 행 높이 조절"
                            >
                              <div className="w-8 h-1 bg-gray-400 group-hover:bg-green-600 rounded"></div>
                            </div>
                          )}
                        </td>

                        {/* 셀들 */}
                        {row.cells.map((cell, cellIndex) => {
                          const column = currentColumns[cellIndex];
                          return (
                            <td
                              key={cell.id}
                              className="border border-gray-300 p-2 relative"
                              style={{
                                width: column?.width ? `${column.width}px` : "150px",
                                maxWidth: column?.width ? `${column.width}px` : "150px",
                                height: row.height ? `${row.height}px` : "60px",
                              }}
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
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </Button>
                                </div>
                                <div className="text-xs text-gray-400 mt-1 border-t border-gray-100 pt-1">
                                  <div className="flex justify-between items-center">
                                    <span>
                                      셀 ({rowIndex + 1}, {cellIndex + 1})
                                    </span>
                                    <span className="capitalize font-medium">{cell.type}</span>
                                  </div>
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
              cell={
                selectedCell.rowId === "header"
                  ? currentHeaderCell
                  : currentRows
                      .find((row) => row.id === selectedCell.rowId)
                      ?.cells.find((cell) => cell.id === selectedCell.cellId) || {
                      id: "",
                      content: "",
                      type: "text",
                    }
              }
              onSave={(cell) => {
                if (selectedCell.rowId === "header") {
                  // 헤더 셀 업데이트
                  updateHeaderCell(cell);
                } else {
                  // 일반 셀 업데이트
                  const rowIndex = currentRows.findIndex((row) => row.id === selectedCell.rowId);
                  const cellIndex = currentRows[rowIndex]?.cells.findIndex(
                    (c) => c.id === selectedCell.cellId,
                  );
                  if (rowIndex !== -1 && cellIndex !== -1) {
                    updateCell(rowIndex, cellIndex, cell);
                  }
                }
              }}
            />
          )}
        </>
      ) : (
        /* 유연한 테이블 편집기 */
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <LayoutGrid className="w-5 h-5 text-green-600" />
                <span>유연한 테이블 편집기</span>
                <span className="px-2 py-1 text-xs bg-orange-100 text-orange-600 rounded">
                  워드/한글 호환
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <LayoutGrid className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-800">
                      <strong>유연한 테이블 모드</strong>는 기존 워드/한글 설문지의 복잡한 표 구조를
                      재현할 수 있습니다.
                    </p>
                    <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside space-y-1">
                      <li>셀 병합/분할로 복잡한 레이아웃 구성</li>
                      <li>다중 셀 선택 및 일괄 편집</li>
                      <li>자유로운 표 구조로 기존 설문지 완벽 재현</li>
                    </ul>
                  </div>
                </div>
              </div>

              <FlexibleTableEditor
                onTableChange={(flexTable) => {
                  // 유연한 테이블을 기본 테이블 형식으로 변환
                  const convertedColumns: TableColumn[] = flexTable.columns.map((col) => ({
                    id: col.id,
                    label: col.label || "",
                  }));

                  const convertedRows: TableRow[] = flexTable.rows.map((row) => ({
                    id: row.id,
                    label: row.label || "",
                    cells: row.cells
                      .filter((cell) => !cell.isMerged)
                      .map((cell) => ({
                        id: cell.id,
                        content: cell.content,
                        type: cell.type as any,
                        imageUrl: cell.imageUrl,
                        videoUrl: cell.videoUrl,
                        checkboxOptions: cell.checkboxOptions,
                        radioOptions: cell.radioOptions,
                        radioGroupName: cell.radioGroupName,
                      })),
                  }));

                  notifyChange(
                    flexTable.title || "",
                    flexTable.rowHeaderTitle || "항목",
                    {
                      id: "header-cell-1",
                      content: flexTable.rowHeaderTitle || "항목",
                      type: "text",
                    },
                    convertedColumns,
                    convertedRows,
                  );
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
