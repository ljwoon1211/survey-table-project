'use client';

import { Clipboard, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HeaderCell, Question, TableColumn, TableRow } from '@/types/survey';

import { CellContentModal } from './cell-content-modal';
import { EditorTableRow } from './editor-table-row';
import { HeaderGridEditor } from './header-grid-editor';
import { useTableEditor } from './hooks/use-table-editor';
import { RowConditionModal } from './row-condition-modal';
import { TableHeaderSection } from './table-header-section';
import { TableSummaryCard } from './table-summary-card';

// ── Props ──

interface DynamicTableEditorProps {
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

// ── 컴포넌트 ──

export function DynamicTableEditor(props: DynamicTableEditorProps) {
  const { state, actions } = useTableEditor(props);

  const {
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
  } = state;

  const {
    updateTitle,
    addColumn,
    deleteColumn,
    moveColumn,
    updateColumnLabel,
    updateColumnCode,
    handleColumnWidthChange,
    setEditingColumnWidth,
    mergeColumnHeaders,
    unmergeColumnHeader,
    addRow,
    deleteRow,
    updateRowLabel,
    updateRowCode,
    handleSelectCell,
    setSelectedCell,
    updateCell,
    deleteCell,
    copyCell,
    pasteCell,
    canMerge,
    handleMerge,
    handleUnmerge,
    openRowConditionModal,
    updateRowCondition,
    setRowConditionModalOpen,
    toggleMultiRowHeader,
    updateHeaderGrid,
  } = actions;

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

      {/* 다단계 헤더 설정 */}
      <div className="space-y-3 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">다단계 헤더</Label>
            <p className="text-xs text-gray-500">
              여러 행으로 구성된 계층적 헤더 (종사자 수 → 사무직/생산직 → 남/여 등)
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={useMultiRowHeader}
              onChange={(e) => toggleMultiRowHeader(e.target.checked)}
              className="peer sr-only"
            />
            <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
          </label>
        </div>

        {useMultiRowHeader && currentHeaderGrid && (
          <HeaderGridEditor
            headerGrid={currentHeaderGrid}
            columnCount={currentColumns.length}
            onChange={updateHeaderGrid}
          />
        )}
      </div>

      {/* 테이블 정보 요약 */}
      <TableSummaryCard rows={currentRows} columns={currentColumns} />

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
                <col style={{ width: '70px' }} />
                {currentColumns.map((column, index) => (
                  <col key={`col-${index}`} style={{ width: `${column.width || 150}px` }} />
                ))}
              </colgroup>

              {/* 헤더 행 */}
              <TableHeaderSection
                columns={currentColumns}
                editingColumnWidth={editingColumnWidth}
                onUpdateColumnLabel={updateColumnLabel}
                onUpdateColumnCode={updateColumnCode}
                onMoveColumn={moveColumn}
                onDeleteColumn={deleteColumn}
                onMergeColumnHeaders={mergeColumnHeaders}
                onUnmergeColumnHeader={unmergeColumnHeader}
                onSetEditingColumnWidth={setEditingColumnWidth}
                onColumnWidthChange={handleColumnWidthChange}
              />

              {/* 데이터 행들 */}
              <tbody>
                {currentRows.map((row, rowIndex) => (
                  <EditorTableRow
                    key={row.id}
                    row={row}
                    rowIndex={rowIndex}
                    columns={currentColumns}
                    totalRowCount={currentRows.length}
                    hasQuestions={(allQuestions ?? []).length > 0}
                    hasCopiedCell={!!copiedCell}
                    onUpdateRowLabel={updateRowLabel}
                    onUpdateRowCode={updateRowCode}
                    onOpenRowConditionModal={openRowConditionModal}
                    onDeleteRow={deleteRow}
                    onSelectCell={handleSelectCell}
                    onMoveColumn={moveColumn}
                    onDeleteCell={deleteCell}
                    onCopyCell={copyCell}
                    onPasteCell={pasteCell}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 셀 병합/해제 버튼 (선택된 셀이 있을 때) */}
      {selectedCell && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700">셀 병합:</span>
              {(['up', 'down', 'left', 'right'] as const).map((dir) => (
                <Button
                  key={dir}
                  size="sm"
                  variant="outline"
                  disabled={!canMerge(dir)}
                  onClick={() => handleMerge(dir)}
                >
                  {dir === 'up' ? '↑ 위' : dir === 'down' ? '↓ 아래' : dir === 'left' ? '← 왼쪽' : '→ 오른쪽'}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={handleUnmerge}
              >
                병합 해제
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 셀 내용 편집 모달 */}
      {selectedCellContext && (
        <CellContentModal
          isOpen={!!selectedCell}
          onClose={() => setSelectedCell(null)}
          currentQuestionId={currentQuestionId}
          questionCode={questionCode}
          questionTitle={questionTitle}
          rowCode={selectedCellContext.rowCode}
          rowLabel={selectedCellContext.rowLabel}
          columnCode={selectedCellContext.columnCode}
          columnLabel={selectedCellContext.columnLabel}
          cell={selectedCellContext.cell}
          onSave={(cell) => {
            if (selectedCellContext.rowIndex !== -1 && selectedCellContext.cellIndex !== -1) {
              updateCell(selectedCellContext.rowIndex, selectedCellContext.cellIndex, cell);
            }
          }}
        />
      )}

      {/* 행 조건부 표시 설정 모달 */}
      <RowConditionModal
        open={rowConditionModalOpen}
        onOpenChange={setRowConditionModalOpen}
        editingRowIndex={editingRowIndex}
        rows={currentRows}
        currentQuestion={currentQuestionAsQuestion}
        allQuestions={allQuestions ?? []}
        onUpdateCondition={updateRowCondition}
      />
    </div>
  );
}
