import type { TableCell } from '@/types/survey';

/** 인터랙티브 셀 컴포넌트 공통 props */
export interface InteractiveCellProps {
  cell: TableCell;
  cellResponse: unknown;
  onUpdateValue: (value: string | string[] | object) => void;
}

/** 미리보기(읽기 전용) 셀 컴포넌트 공통 props */
export interface PreviewCellProps {
  cell: TableCell;
}
