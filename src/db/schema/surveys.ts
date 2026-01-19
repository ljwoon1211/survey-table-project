import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// 설문 테이블
export const surveys = pgTable('surveys', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  slug: text('slug').unique(),
  privateToken: uuid('private_token').defaultRandom(),

  // 설정
  isPublic: boolean('is_public').default(true).notNull(),
  allowMultipleResponses: boolean('allow_multiple_responses').default(false).notNull(),
  showProgressBar: boolean('show_progress_bar').default(true).notNull(),
  shuffleQuestions: boolean('shuffle_questions').default(false).notNull(),
  requireLogin: boolean('require_login').default(false).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  maxResponses: integer('max_responses'),
  thankYouMessage: text('thank_you_message').default('응답해주셔서 감사합니다!').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 질문 그룹 테이블
export const questionGroups = pgTable('question_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  surveyId: uuid('survey_id')
    .notNull()
    .references(() => surveys.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  order: integer('order').notNull().default(0),
  parentGroupId: uuid('parent_group_id'),
  color: text('color'),
  collapsed: boolean('collapsed').default(false),
  displayCondition: jsonb('display_condition').$type<QuestionConditionGroup>(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 질문 테이블
export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  surveyId: uuid('survey_id')
    .notNull()
    .references(() => surveys.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id').references(() => questionGroups.id, { onDelete: 'set null' }),

  type: text('type').notNull(), // 'text' | 'textarea' | 'radio' | 'checkbox' | 'select' | 'multiselect' | 'table' | 'notice'
  title: text('title').notNull(),
  description: text('description'),
  required: boolean('required').default(false).notNull(),
  order: integer('order').notNull().default(0),

  // 옵션들 (radio, checkbox, select용) - JSON으로 저장
  options: jsonb('options').$type<QuestionOption[]>(),

  // 다단계 select용
  selectLevels: jsonb('select_levels').$type<SelectLevel[]>(),

  // 테이블 관련
  tableTitle: text('table_title'),
  tableColumns: jsonb('table_columns').$type<TableColumn[]>(),
  tableRowsData: jsonb('table_rows_data').$type<TableRow[]>(),

  // 미디어
  imageUrl: text('image_url'),
  videoUrl: text('video_url'),

  // 기타 옵션
  allowOtherOption: boolean('allow_other_option').default(false),

  // 체크박스 선택 개수 제한 (checkbox 타입 전용)
  minSelections: integer('min_selections'),
  maxSelections: integer('max_selections'),

  // 공지사항용
  noticeContent: text('notice_content'),
  requiresAcknowledgment: boolean('requires_acknowledgment').default(false),

  // 단답형(text) 타입용
  placeholder: text('placeholder'),

  // 검증 규칙 및 조건부 표시
  tableValidationRules: jsonb('table_validation_rules').$type<TableValidationRule[]>(),
  displayCondition: jsonb('display_condition').$type<QuestionConditionGroup>(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 설문 응답 테이블
export const surveyResponses = pgTable('survey_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  surveyId: uuid('survey_id')
    .notNull()
    .references(() => surveys.id, { onDelete: 'cascade' }),

  // 응답 데이터 (질문ID -> 응답값 매핑)
  questionResponses: jsonb('question_responses').notNull().$type<Record<string, unknown>>(),

  isCompleted: boolean('is_completed').default(false).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  // 메타데이터
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  sessionId: text('session_id'),
  metadata: jsonb('metadata').$type<{
    exposedQuestionIds?: string[];
    exposedRowIds?: string[]; // 테이블 질문의 노출된 행 ID들
    [key: string]: unknown;
  }>(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 질문 보관함 테이블
export const savedQuestions = pgTable('saved_questions', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 질문 데이터
  question: jsonb('question').notNull().$type<QuestionData>(),

  // 메타데이터
  name: text('name').notNull(),
  description: text('description'),
  tags: jsonb('tags').$type<string[]>().default([]),
  category: text('category').notNull(),
  usageCount: integer('usage_count').default(0).notNull(),
  isPreset: boolean('is_preset').default(false).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 질문 카테고리 테이블
export const questionCategories = pgTable('question_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  icon: text('icon'),
  order: integer('order').notNull().default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ========================
// Relations 정의
// ========================

export const surveysRelations = relations(surveys, ({ many }) => ({
  questions: many(questions),
  groups: many(questionGroups),
  responses: many(surveyResponses),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  survey: one(surveys, {
    fields: [questions.surveyId],
    references: [surveys.id],
  }),
  group: one(questionGroups, {
    fields: [questions.groupId],
    references: [questionGroups.id],
  }),
}));

export const questionGroupsRelations = relations(questionGroups, ({ one, many }) => ({
  survey: one(surveys, {
    fields: [questionGroups.surveyId],
    references: [surveys.id],
  }),
  parentGroup: one(questionGroups, {
    fields: [questionGroups.parentGroupId],
    references: [questionGroups.id],
    relationName: 'childGroups',
  }),
  childGroups: many(questionGroups, {
    relationName: 'childGroups',
  }),
  questions: many(questions),
}));

export const surveyResponsesRelations = relations(surveyResponses, ({ one }) => ({
  survey: one(surveys, {
    fields: [surveyResponses.surveyId],
    references: [surveys.id],
  }),
}));

// ========================
// TypeScript 타입 정의
// ========================

// 분기 규칙
interface BranchRule {
  id: string;
  value: string;
  action: 'goto' | 'end';
  targetQuestionId?: string;
}

// 질문 옵션
interface QuestionOption {
  id: string;
  label: string;
  value: string;
  hasOther?: boolean;
  branchRule?: BranchRule;
}

// 다단계 select 레벨
interface SelectLevel {
  id: string;
  label: string;
  placeholder?: string;
  order: number;
  options: QuestionOption[];
}

// 체크박스 옵션
interface CheckboxOption {
  id: string;
  label: string;
  value: string;
  checked?: boolean;
  hasOther?: boolean;
  branchRule?: BranchRule;
}

// 라디오 옵션
interface RadioOption {
  id: string;
  label: string;
  value: string;
  selected?: boolean;
  hasOther?: boolean;
  branchRule?: BranchRule;
}

// 테이블 셀
interface TableCell {
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
interface TableRow {
  id: string;
  label: string;
  cells: TableCell[];
  height?: number;
  minHeight?: number;
}

// 테이블 열
interface TableColumn {
  id: string;
  label: string;
  width?: number;
  minWidth?: number;
}

// 테이블 검증 규칙
interface TableValidationRule {
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
interface QuestionCondition {
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

interface QuestionConditionGroup {
  conditions: QuestionCondition[];
  logicType: 'AND' | 'OR' | 'NOT';
}

// 보관함용 질문 데이터
interface QuestionData {
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

// ========================
// 타입 추론 (Drizzle)
// ========================
export type Survey = typeof surveys.$inferSelect;
export type NewSurvey = typeof surveys.$inferInsert;

export type QuestionGroup = typeof questionGroups.$inferSelect;
export type NewQuestionGroup = typeof questionGroups.$inferInsert;

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;

export type SurveyResponse = typeof surveyResponses.$inferSelect;
export type NewSurveyResponse = typeof surveyResponses.$inferInsert;

export type SavedQuestion = typeof savedQuestions.$inferSelect;
export type NewSavedQuestion = typeof savedQuestions.$inferInsert;

export type QuestionCategory = typeof questionCategories.$inferSelect;
export type NewQuestionCategory = typeof questionCategories.$inferInsert;
