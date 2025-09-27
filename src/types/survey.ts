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