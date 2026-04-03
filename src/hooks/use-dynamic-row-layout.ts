import { useMemo } from 'react';

import type { DynamicRowGroupConfig, TableCell, TableRow } from '@/types/survey';

interface UseDynamicRowLayoutParams {
  rows: TableRow[];
  visibleRows: TableRow[];
  groupConfigMap: Map<string, DynamicRowGroupConfig>;
  selectedRowIds: string[];
  hasDynamicRows: boolean;
  headerRowCount: number;
}

interface UseDynamicRowLayoutReturn {
  displayRows: TableRow[];
  selectorAnchors: Map<string, string>;
  rowGridMap: Map<string, number>;
  selectorGridMap: Map<string, number>;
  groupSelectedCountMap: Map<string, number>;
}

export function useDynamicRowLayout({
  rows,
  visibleRows,
  groupConfigMap,
  selectedRowIds,
  hasDynamicRows,
  headerRowCount,
}: UseDynamicRowLayoutParams): UseDynamicRowLayoutReturn {
  // 그룹별 셀렉터 앵커 위치 (그룹 순서 인식)
  const selectorAnchors = useMemo(() => {
    if (!hasDynamicRows) return new Map<string, string>();
    const anchors = new Map<string, string>();

    const lastNonDynamicIdx = visibleRows.findLastIndex(
      (r) => !r.dynamicGroupId && !r.showWhenDynamicGroupId,
    );
    let prevGroupLastIdx = lastNonDynamicIdx;

    for (const [groupId, config] of groupConfigMap) {
      if (config.insertAfterRowId && visibleRows.some((r) => r.id === config.insertAfterRowId)) {
        const explicitIdx = visibleRows.findIndex((r) => r.id === config.insertAfterRowId);
        const resolvedIdx = Math.max(explicitIdx, prevGroupLastIdx);
        anchors.set(groupId, visibleRows[resolvedIdx].id);
      } else {
        const groupRows = visibleRows.filter(
          (r) => r.dynamicGroupId === groupId || r.showWhenDynamicGroupId === groupId,
        );
        if (groupRows.length > 0) {
          const firstIdx = visibleRows.indexOf(groupRows[0]);
          const anchorIdx = firstIdx > 0
            ? Math.max(firstIdx - 1, prevGroupLastIdx)
            : prevGroupLastIdx;
          if (anchorIdx >= 0 && anchorIdx < visibleRows.length) {
            anchors.set(groupId, visibleRows[anchorIdx].id);
          }
        } else if (config.insertAfterRowId) {
          const origIdx = rows.findIndex((r) => r.id === config.insertAfterRowId);
          if (origIdx !== -1) {
            for (let i = origIdx; i >= 0; i--) {
              const found = visibleRows.find((vr) => vr.id === rows[i].id);
              if (found) {
                const foundIdx = visibleRows.indexOf(found);
                const resolvedIdx = Math.max(foundIdx, prevGroupLastIdx);
                anchors.set(groupId, visibleRows[resolvedIdx].id);
                break;
              }
            }
          }
        }

        if (!anchors.has(groupId) && prevGroupLastIdx >= 0 && prevGroupLastIdx < visibleRows.length) {
          anchors.set(groupId, visibleRows[prevGroupLastIdx].id);
        }
      }

      const lastGroupRowIdx = visibleRows.findLastIndex(
        (r) => r.dynamicGroupId === groupId || r.showWhenDynamicGroupId === groupId,
      );
      if (lastGroupRowIdx !== -1 && lastGroupRowIdx > prevGroupLastIdx) {
        prevGroupLastIdx = lastGroupRowIdx;
      }
    }
    return anchors;
  }, [hasDynamicRows, groupConfigMap, visibleRows, rows]);

  // 여러 셀렉터 행 삽입 시 앵커 인덱스별 셀렉터 수
  const selectorCountByAnchorIdx = useMemo(() => {
    const countMap = new Map<number, number>();
    for (const [, anchorId] of selectorAnchors) {
      const idx = visibleRows.findIndex((r) => r.id === anchorId);
      if (idx !== -1) countMap.set(idx, (countMap.get(idx) || 0) + 1);
    }
    return countMap;
  }, [selectorAnchors, visibleRows]);

  // 셀렉터 경계에서 병합 셀을 분리하여 겹침 방지
  const displayRows = useMemo(() => {
    if (selectorCountByAnchorIdx.size === 0) return visibleRows;

    const anchorIndices = [...selectorCountByAnchorIdx.keys()].sort((a, b) => a - b);

    // 셀 단위 오버라이드 맵: Map<rowIdx, Map<colIdx, Partial<TableCell>>>
    const overrides = new Map<number, Map<number, Partial<TableCell>>>();

    const setOvr = (rIdx: number, cIdx: number, ovr: Partial<TableCell>) => {
      let rowOvr = overrides.get(rIdx);
      if (!rowOvr) {
        rowOvr = new Map();
        overrides.set(rIdx, rowOvr);
      }
      rowOvr.set(cIdx, { ...rowOvr.get(cIdx), ...ovr });
    };

    for (let rowIdx = 0; rowIdx < visibleRows.length; rowIdx++) {
      const row = visibleRows[rowIdx];
      for (let colIdx = 0; colIdx < row.cells.length; colIdx++) {
        const cell = row.cells[colIdx];
        if (cell.isHidden || (cell.rowspan || 1) <= 1) continue;

        const span = cell.rowspan!;
        const spanEnd = rowIdx + span;

        // 이 병합 범위와 겹치는 앵커 찾기
        const intersecting = anchorIndices.filter(
          (ai) => ai >= rowIdx && ai < spanEnd - 1,
        );
        if (intersecting.length === 0) continue;

        // 첫 번째 세그먼트: 원래 시작 ~ 첫 앵커까지
        const seg1Span = intersecting[0] - rowIdx + 1;
        setOvr(rowIdx, colIdx, {
          rowspan: seg1Span > 1 ? seg1Span : undefined,
        });

        // 후속 세그먼트들: 각 앵커 바로 다음 행에서 시작
        for (let i = 0; i < intersecting.length; i++) {
          const nextStart = intersecting[i] + 1;
          if (nextStart >= spanEnd) break;

          const nextEnd =
            i + 1 < intersecting.length ? intersecting[i + 1] + 1 : spanEnd;
          const segSpan = nextEnd - nextStart;
          const isInteractive = ['checkbox', 'radio', 'select', 'input'].includes(cell.type);

          setOvr(nextStart, colIdx, {
            isHidden: false,
            type: isInteractive ? 'text' : cell.type,
            content: isInteractive ? '' : cell.content,
            colspan: cell.colspan,
            horizontalAlign: cell.horizontalAlign,
            verticalAlign: cell.verticalAlign,
            rowspan: segSpan > 1 ? segSpan : undefined,
            _isContinuation: true,
          });
        }
      }
    }

    // 오버라이드 적용
    if (overrides.size === 0) return visibleRows;
    return visibleRows.map((row, rowIdx) => {
      const rowOvr = overrides.get(rowIdx);
      if (!rowOvr) return row;
      return {
        ...row,
        cells: row.cells.map((cell, colIdx) => {
          const cellOvr = rowOvr.get(colIdx);
          if (!cellOvr) return cell;
          return { ...cell, ...cellOvr };
        }),
      };
    });
  }, [visibleRows, selectorCountByAnchorIdx]);

  // 그룹별 선택 카운트 맵
  const groupSelectedCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const [groupId] of groupConfigMap) {
      const count = selectedRowIds.filter((id) =>
        rows.find((r) => r.id === id)?.dynamicGroupId === groupId,
      ).length;
      map.set(groupId, count);
    }
    return map;
  }, [groupConfigMap, selectedRowIds, rows]);

  // 명시적 grid-row 위치 계산 (셀렉터 행 포함)
  const { rowGridMap, selectorGridMap } = useMemo(() => {
    const rowMap = new Map<string, number>();
    const selMap = new Map<string, number>();

    let gridRow = headerRowCount + 1;
    for (const row of displayRows) {
      rowMap.set(row.id, gridRow);
      gridRow++;

      for (const [groupId, anchorId] of selectorAnchors) {
        if (anchorId === row.id) {
          selMap.set(groupId, gridRow);
          gridRow++;
        }
      }
    }
    return { rowGridMap: rowMap, selectorGridMap: selMap };
  }, [displayRows, selectorAnchors, headerRowCount]);

  return {
    displayRows,
    selectorAnchors,
    rowGridMap,
    selectorGridMap,
    groupSelectedCountMap,
  };
}
