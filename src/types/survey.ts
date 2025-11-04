export type QuestionType =
  | 'text'
  | 'textarea'
  | 'radio'
  | 'checkbox'
  | 'select'
  | 'multiselect'
  | 'table'
  | 'notice';

// 분기 동작 타입
export type BranchAction = 'goto' | 'end';

// 분기 규칙
export interface BranchRule {
  id: string;
  value: string; // 응답 값 (radio value, checkbox value, select value, table cell value 등)
  action: BranchAction;
  targetQuestionId?: string; // action이 'goto'일 때 이동할 질문 ID
}

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
  hasOther?: boolean;
  // 조건부 분기
  branchRule?: BranchRule;
}

export interface TableCell {
  id: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  type: 'text' | 'image' | 'video' | 'checkbox' | 'radio' | 'select' | 'input';
  // 체크박스/라디오 버튼 관련 속성
  checkboxOptions?: CheckboxOption[];
  radioOptions?: RadioOption[];
  radioGroupName?: string; // 라디오 버튼 그룹명
  // select 관련 속성
  selectOptions?: QuestionOption[];
  allowOtherOption?: boolean; // 기타 옵션 허용 여부
  // input 관련 속성
  placeholder?: string; // 단문형 입력 필드 placeholder
  inputMaxLength?: number; // 단문형 입력 필드 최대 길이
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
  // 조건부 분기
  branchRule?: BranchRule;
}

export interface RadioOption {
  id: string;
  label: string;
  value: string;
  selected?: boolean;
  hasOther?: boolean;
  // 조건부 분기
  branchRule?: BranchRule;
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
  // 공지사항(notice) 타입용
  noticeContent?: string; // TipTap HTML 콘텐츠
  requiresAcknowledgment?: boolean; // 이해했다는 체크 필요 여부
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