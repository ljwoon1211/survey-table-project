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

// 테이블 검증 규칙 타입
export type TableValidationType =
  | 'exclusive-check'      // 특정 행만 체크된 경우 (예: "~만 있는 경우")
  | 'required-combination' // 특정 조합이 체크된 경우
  | 'any-of'              // 여러 행 중 하나라도 체크된 경우
  | 'all-of'              // 특정 행들이 모두 체크된 경우
  | 'none-of';            // 특정 행들이 모두 체크 안된 경우

// 테이블 검증 규칙
export interface TableValidationRule {
  id: string;
  type: TableValidationType;
  description?: string; // 규칙 설명
  conditions: {
    checkType: 'checkbox' | 'radio' | 'select' | 'input'; // 체크할 셀 타입
    rowIds: string[]; // 체크할 행 ID들
    cellColumnIndex?: number; // 체크할 열 인덱스 (선택사항, 없으면 모든 열 확인)
    expectedValues?: string[]; // 기대하는 값들 (select, radio, input용)
  };
  action: BranchAction;
  targetQuestionId?: string;
  errorMessage?: string; // 조건 미충족 시 표시할 메시지
}

// 질문 표시 조건 논리 타입
export type ConditionLogicType = 'AND' | 'OR' | 'NOT';

// 질문 표시 조건
export interface QuestionCondition {
  id: string;
  sourceQuestionId: string; // 조건을 확인할 질문 ID
  conditionType: 'value-match' | 'table-cell-check' | 'custom'; // 조건 타입
  // value-match: 특정 값과 일치하는지 확인 (radio, select 등)
  requiredValues?: string[]; // 필요한 값들
  // table-cell-check: 테이블의 특정 셀이 체크되었는지 확인
  tableConditions?: {
    rowIds: string[]; // 체크 확인할 행 ID들
    cellColumnIndex?: number; // 체크할 열 인덱스
    checkType: 'any' | 'all' | 'none'; // any: 하나라도, all: 모두, none: 모두 아님
  };
  logicType: ConditionLogicType; // 여러 조건 결합 시
}

// 질문 표시 조건 그룹 (여러 조건 조합)
export interface QuestionConditionGroup {
  conditions: QuestionCondition[];
  logicType: ConditionLogicType; // 조건들을 AND/OR로 결합
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

// 질문 그룹 (2단계 계층 구조 지원)
export interface QuestionGroup {
  id: string;
  surveyId: string; // 소속 설문 ID
  name: string; // 그룹 이름 (예: "공통", "응답자 정보", "1번", "III. 지상파 직접 수신")
  description?: string; // 그룹 설명
  order: number; // 그룹 순서
  parentGroupId?: string; // 상위 그룹 ID (하위 그룹인 경우)
  color?: string; // 그룹 색상 (UI용)
  collapsed?: boolean; // 접힘 상태 (UI용)
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  groupId?: string; // 소속 그룹 ID (QuestionGroup의 id 참조)
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
  // 테이블 검증 규칙 (테이블 타입 전용)
  tableValidationRules?: TableValidationRule[];
  // 질문 표시 조건 (이 질문을 표시하기 위한 조건)
  displayCondition?: QuestionConditionGroup;
}

export interface Survey {
  id: string;
  title: string;
  description?: string;
  slug?: string;           // 공개 설문용 커스텀 URL 슬러그
  privateToken?: string;   // 비공개 설문용 보안 토큰 (UUID)
  groups?: QuestionGroup[]; // 질문 그룹 목록
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

// 보관함 (라이브러리용)
export interface SavedQuestion {
  id: string;
  question: Question;
  name: string;           // 사용자가 지정한 이름 (예: "성별 질문", "연령대 선택")
  description?: string;   // 설명
  tags: string[];         // 태그 (예: ["인구통계", "기본정보"])
  category: string;       // 카테고리 (예: "인구통계", "만족도", "NPS")
  usageCount: number;     // 사용 횟수
  isPreset: boolean;      // 프리셋 질문 여부
  createdAt: Date;
  updatedAt: Date;
}

// 질문 카테고리
export interface QuestionCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
  order: number;
}

// 기본 카테고리 목록
export const DEFAULT_CATEGORIES: QuestionCategory[] = [
  { id: 'demographics', name: '인구통계', color: 'bg-blue-100 text-blue-600', icon: 'Users', order: 0 },
  { id: 'satisfaction', name: '만족도', color: 'bg-green-100 text-green-600', icon: 'ThumbsUp', order: 1 },
  { id: 'nps', name: 'NPS', color: 'bg-purple-100 text-purple-600', icon: 'TrendingUp', order: 2 },
  { id: 'feedback', name: '피드백', color: 'bg-orange-100 text-orange-600', icon: 'MessageSquare', order: 3 },
  { id: 'preference', name: '선호도', color: 'bg-pink-100 text-pink-600', icon: 'Heart', order: 4 },
  { id: 'custom', name: '사용자 정의', color: 'bg-gray-100 text-gray-600', icon: 'Folder', order: 5 },
];