// 기존 설문지의 복잡한 구조를 지원하는 유연한 테이블 타입

export interface FlexibleTableCell {
  id: string;
  content: string;
  type: 'text' | 'checkbox' | 'radio' | 'image' | 'video' | 'merged' | 'empty';

  // 셀 병합 지원
  colspan?: number;  // 열 병합
  rowspan?: number;  // 행 병합
  isMerged?: boolean; // 병합된 셀인지 여부
  mergedWith?: string; // 어떤 셀과 병합되었는지

  // 기존 속성들
  imageUrl?: string;
  videoUrl?: string;
  checkboxOptions?: Array<{
    id: string;
    label: string;
    value: string;
    checked?: boolean;
  }>;
  radioOptions?: Array<{
    id: string;
    label: string;
    value: string;
    selected?: boolean;
  }>;
  radioGroupName?: string;

  // 스타일링 지원
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  fontWeight?: 'normal' | 'bold';
  fontSize?: 'small' | 'normal' | 'large';
  borderStyle?: 'solid' | 'dashed' | 'none';
}

export interface FlexibleTableRow {
  id: string;
  label?: string;
  height?: number; // 행 높이
  cells: FlexibleTableCell[];

  // 행 스타일
  isHeader?: boolean;
  backgroundColor?: string;
}

export interface FlexibleTableColumn {
  id: string;
  label?: string;
  width?: number; // 열 너비 (픽셀 또는 퍼센트)
  minWidth?: number;

  // 열 스타일
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export interface FlexibleTable {
  id: string;
  title?: string;
  description?: string;
  rowHeaderTitle?: string; // 행 제목 헤더 (기본값: "항목")

  // 테이블 구조
  rows: FlexibleTableRow[];
  columns: FlexibleTableColumn[];

  // 테이블 전체 스타일
  borderCollapse?: boolean;
  borderColor?: string;
  borderWidth?: number;

  // 메타데이터
  originalFormat?: 'word' | 'hwp' | 'excel' | 'manual';
  notes?: string; // 변환 시 특이사항
}