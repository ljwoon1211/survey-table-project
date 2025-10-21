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
  type: 'text' | 'image' | 'video' | 'checkbox' | 'radio' | 'select';
  // 체크박스/라디오 버튼 관련 속성
  checkboxOptions?: CheckboxOption[];
  radioOptions?: RadioOption[];
  radioGroupName?: string; // 라디오 버튼 그룹명
  // select 관련 속성
  selectOptions?: QuestionOption[];
  allowOtherOption?: boolean; // 기타 옵션 허용 여부
  // 셀 병합 관련 속성
  rowspan?: number; // 행 병합 (세로)
  colspan?: number; // 열 병합 (가로)
  isHidden?: boolean; // rowspan/colspan으로 인해 숨겨진 셀인지 여부
}

export interface CheckboxOption {
  id: string;
  label: string;
  value: string;
  checked?: boolean;
  hasOther?: boolean;
}

export interface RadioOption {
  id: string;
  label: string;
  value: string;
  selected?: boolean;
  hasOther?: boolean;
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
  tableColumns?: TableColumn[];
  tableRowsData?: TableRow[];
  imageUrl?: string;
  videoUrl?: string;
  order: number;
  allowOtherOption?: boolean; // 기타 옵션 허용 여부 (radio, checkbox, select용)
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

// 기타 옵션 입력값 처리를 위한 타입
export interface OtherInputValue {
  optionId: string;
  inputValue: string;
}

// 설문 응답데이터 타입
export interface SurveyResponse {
  questionId: string;
  value: string | string[] | { [key: string]: string | string[] | object };
  otherInputs?: OtherInputValue[]; // 기타 옵션 입력값들
}

export interface QuestionTypeInfo {
  type: QuestionType;
  label: string;
  icon: string;
  description: string;
  color: string;
}