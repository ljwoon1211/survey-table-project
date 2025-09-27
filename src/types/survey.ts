export type QuestionType =
  | 'text'
  | 'textarea'
  | 'radio'
  | 'checkbox'
  | 'select'
  | 'multiselect'
  | 'table';

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
  hasOther?: boolean;
}

export interface TableCell {
  id: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  type: 'text' | 'image' | 'video' | 'checkbox' | 'radio';
  // 체크박스/라디오 버튼 관련 속성
  checkboxOptions?: CheckboxOption[];
  radioOptions?: RadioOption[];
  radioGroupName?: string; // 라디오 버튼 그룹명
}

export interface CheckboxOption {
  id: string;
  label: string;
  value: string;
  checked?: boolean;
}

export interface RadioOption {
  id: string;
  label: string;
  value: string;
  selected?: boolean;
}

export interface TableRow {
  id: string;
  label: string;
  cells: TableCell[];
  height?: number; // 행 높이 (픽셀 단위)
  minHeight?: number; // 최소 높이
}

export interface TableColumn {
  id: string;
  label: string;
  width?: number; // 열 너비 (픽셀 단위)
  minWidth?: number; // 최소 너비
}

export interface SelectLevel {
  id: string;
  label: string;
  placeholder?: string;
  order: number;
  options: QuestionOption[];
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  options?: QuestionOption[];
  selectLevels?: SelectLevel[]; // 다단계 select용
  tableRows?: string[];
  tableCols?: string[];
  // 새로운 테이블 구조
  tableTitle?: string;
  tableRowHeaderTitle?: string; // 행 제목 헤더 (기본값: "항목")
  tableColumns?: TableColumn[];
  tableRowsData?: TableRow[];
  tableHeaderCell?: TableCell; // 첫 번째 셀(1x1) 편집 가능하게
  imageUrl?: string;
  videoUrl?: string;
  order: number;
}

export interface Survey {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  settings: SurveySettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface SurveySettings {
  isPublic: boolean;
  allowMultipleResponses: boolean;
  showProgressBar: boolean;
  shuffleQuestions: boolean;
  requireLogin: boolean;
  endDate?: Date;
  maxResponses?: number;
  thankYouMessage: string;
}

export interface QuestionTypeInfo {
  type: QuestionType;
  label: string;
  icon: string;
  description: string;
  color: string;
}