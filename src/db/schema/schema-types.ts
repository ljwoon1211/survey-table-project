// JSONB 컬럼에 사용되는 내부 타입 정의
// 테이블 정의의 $type<>() 제네릭에서 참조됨

// 버전 스냅샷 타입
export interface SurveyVersionSnapshot {
  title: string;
  description?: string;
  questions: QuestionData[];
  groups: QuestionGroupData[];
  settings: {
    isPublic: boolean;
    allowMultipleResponses: boolean;
    showProgressBar: boolean;
    shuffleQuestions: boolean;
    requireLogin: boolean;
    endDate?: string;
    maxResponses?: number;
    thankYouMessage: string;
  };
}

export interface QuestionGroupData {
  id: string;
  surveyId: string;
  name: string;
  description?: string;
  order: number;
  parentGroupId?: string;
  color?: string;
  collapsed?: boolean;
  displayCondition?: QuestionConditionGroup;
}

// 분기 규칙
export interface BranchRule {
  id: string;
  value: string;
  action: 'goto' | 'end';
  targetQuestionId?: string;
}

// 질문 옵션
export interface QuestionOption {
  id: string;
  label: string;
  value: string;
  hasOther?: boolean;
  branchRule?: BranchRule;
}

// 다단계 select 레벨
export interface SelectLevel {
  id: string;
  label: string;
  placeholder?: string;
  order: number;
  options: QuestionOption[];
}

// 체크박스 옵션
export interface CheckboxOption {
  id: string;
  label: string;
  value: string;
  checked?: boolean;
  hasOther?: boolean;
  branchRule?: BranchRule;
}

// 라디오 옵션
export interface RadioOption {
  id: string;
  label: string;
  value: string;
  selected?: boolean;
  hasOther?: boolean;
  branchRule?: BranchRule;
}

// 테이블 셀
export interface TableCell {
  id: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  type: 'text' | 'image' | 'video' | 'checkbox' | 'radio' | 'select' | 'input';
  checkboxOptions?: CheckboxOption[];
  radioOptions?: RadioOption[];
  radioGroupName?: string;
  selectOptions?: QuestionOption[];
  allowOtherOption?: boolean;
  placeholder?: string;
  inputMaxLength?: number;
  minSelections?: number;
  maxSelections?: number;
  rowspan?: number;
  colspan?: number;
  isHidden?: boolean;
  horizontalAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
}

// 테이블 행
export interface TableRow {
  id: string;
  label: string;
  cells: TableCell[];
  height?: number;
  minHeight?: number;
}

// 테이블 열
export interface TableColumn {
  id: string;
  label: string;
  width?: number;
  minWidth?: number;
}

// 테이블 검증 규칙
export interface TableValidationRule {
  id: string;
  type: 'exclusive-check' | 'required-combination' | 'any-of' | 'all-of' | 'none-of';
  description?: string;
  conditions: {
    checkType: 'checkbox' | 'radio' | 'select' | 'input';
    rowIds: string[];
    cellColumnIndex?: number;
    expectedValues?: string[];
  };
  additionalConditions?: {
    cellColumnIndex: number;
    checkType: 'checkbox' | 'radio' | 'select' | 'input';
    rowIds?: string[];
    expectedValues?: string[];
  };
  action: 'goto' | 'end';
  targetQuestionId?: string;
  targetQuestionMap?: Record<string, string>;
  errorMessage?: string;
}

// 질문 표시 조건
export interface QuestionCondition {
  id: string;
  name?: string;
  sourceQuestionId: string;
  conditionType: 'value-match' | 'table-cell-check' | 'custom';
  requiredValues?: string[];
  tableConditions?: {
    rowIds: string[];
    cellColumnIndex?: number;
    checkType: 'any' | 'all' | 'none';
    expectedValues?: string[];
  };
  additionalConditions?: {
    cellColumnIndex: number;
    checkType: 'checkbox' | 'radio' | 'select' | 'input';
    rowIds?: string[];
    expectedValues?: string[];
  };
  logicType: 'AND' | 'OR' | 'NOT';
  enabled?: boolean;
}

export interface QuestionConditionGroup {
  conditions: QuestionCondition[];
  logicType: 'AND' | 'OR' | 'NOT';
}

// 보관함용 질문 데이터
export interface QuestionData {
  id: string;
  type: string;
  title: string;
  description?: string;
  required: boolean;
  groupId?: string;
  options?: QuestionOption[];
  selectLevels?: SelectLevel[];
  tableTitle?: string;
  tableColumns?: TableColumn[];
  tableRowsData?: TableRow[];
  imageUrl?: string;
  videoUrl?: string;
  order: number;
  allowOtherOption?: boolean;
  minSelections?: number;
  maxSelections?: number;
  noticeContent?: string;
  requiresAcknowledgment?: boolean;
  placeholder?: string;
  tableValidationRules?: TableValidationRule[];
  displayCondition?: QuestionConditionGroup;
}
