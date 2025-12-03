'use server';

import { db } from '@/db';
import {
  surveys,
  questions,
  questionGroups,
  NewSurvey,
  NewQuestion,
  NewQuestionGroup,
} from '@/db/schema';
import { eq, desc, ilike, and, gte, lte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { Survey as SurveyType, Question as QuestionType, QuestionGroup as QuestionGroupType } from '@/types/survey';

// ========================
// 설문 관련 액션
// ========================

// 설문 생성
export async function createSurvey(data: {
  title: string;
  description?: string;
  slug?: string;
  isPublic?: boolean;
  settings?: Partial<SurveyType['settings']>;
}) {
  const newSurvey: NewSurvey = {
    title: data.title,
    description: data.description,
    slug: data.slug,
    isPublic: data.isPublic ?? true,
    allowMultipleResponses: data.settings?.allowMultipleResponses ?? false,
    showProgressBar: data.settings?.showProgressBar ?? true,
    shuffleQuestions: data.settings?.shuffleQuestions ?? false,
    requireLogin: data.settings?.requireLogin ?? false,
    endDate: data.settings?.endDate ? new Date(data.settings.endDate) : null,
    maxResponses: data.settings?.maxResponses ?? null,
    thankYouMessage: data.settings?.thankYouMessage ?? '응답해주셔서 감사합니다!',
  };

  const [survey] = await db.insert(surveys).values(newSurvey).returning();

  revalidatePath('/admin/surveys');
  return survey;
}

// 설문 업데이트
export async function updateSurvey(
  surveyId: string,
  data: Partial<{
    title: string;
    description: string;
    slug: string;
    isPublic: boolean;
    allowMultipleResponses: boolean;
    showProgressBar: boolean;
    shuffleQuestions: boolean;
    requireLogin: boolean;
    endDate: Date | null;
    maxResponses: number | null;
    thankYouMessage: string;
  }>
) {
  const [updated] = await db
    .update(surveys)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(surveys.id, surveyId))
    .returning();

  revalidatePath('/admin/surveys');
  revalidatePath(`/admin/surveys/${surveyId}`);
  return updated;
}

// 설문 삭제
export async function deleteSurvey(surveyId: string) {
  await db.delete(surveys).where(eq(surveys.id, surveyId));
  revalidatePath('/admin/surveys');
}

// 설문 목록 조회
export async function getSurveys() {
  const result = await db.query.surveys.findMany({
    orderBy: [desc(surveys.createdAt)],
  });
  return result;
}

// 설문 단일 조회
export async function getSurveyById(surveyId: string) {
  const survey = await db.query.surveys.findFirst({
    where: eq(surveys.id, surveyId),
  });
  return survey;
}

// 슬러그로 설문 조회
export async function getSurveyBySlug(slug: string) {
  const survey = await db.query.surveys.findFirst({
    where: eq(surveys.slug, slug),
  });
  return survey;
}

// 비공개 토큰으로 설문 조회
export async function getSurveyByPrivateToken(token: string) {
  const survey = await db.query.surveys.findFirst({
    where: eq(surveys.privateToken, token),
  });
  return survey;
}

// 슬러그 사용 가능 여부 확인
export async function isSlugAvailable(slug: string, excludeSurveyId?: string) {
  const existing = await db.query.surveys.findFirst({
    where: excludeSurveyId
      ? and(eq(surveys.slug, slug), eq(surveys.id, excludeSurveyId))
      : eq(surveys.slug, slug),
  });
  return !existing;
}

// 설문 검색
export async function searchSurveys(query: string) {
  const result = await db.query.surveys.findMany({
    where: ilike(surveys.title, `%${query}%`),
    orderBy: [desc(surveys.createdAt)],
  });
  return result;
}

// 날짜 범위로 설문 조회
export async function getSurveysByDateRange(startDate: Date, endDate: Date) {
  const result = await db.query.surveys.findMany({
    where: and(
      gte(surveys.createdAt, startDate),
      lte(surveys.createdAt, endDate)
    ),
    orderBy: [desc(surveys.createdAt)],
  });
  return result;
}

// 설문 복제
export async function duplicateSurvey(surveyId: string) {
  // 원본 설문 조회
  const original = await getSurveyById(surveyId);
  if (!original) return null;

  // 원본 질문 그룹 조회
  const originalGroups = await db.query.questionGroups.findMany({
    where: eq(questionGroups.surveyId, surveyId),
    orderBy: [questionGroups.order],
  });

  // 원본 질문 조회
  const originalQuestions = await db.query.questions.findMany({
    where: eq(questions.surveyId, surveyId),
    orderBy: [questions.order],
  });

  // 새 설문 생성
  const [newSurvey] = await db
    .insert(surveys)
    .values({
      title: `${original.title} (복사본)`,
      description: original.description,
      isPublic: original.isPublic,
      allowMultipleResponses: original.allowMultipleResponses,
      showProgressBar: original.showProgressBar,
      shuffleQuestions: original.shuffleQuestions,
      requireLogin: original.requireLogin,
      endDate: original.endDate,
      maxResponses: original.maxResponses,
      thankYouMessage: original.thankYouMessage,
    })
    .returning();

  // 그룹 ID 매핑 (원본 ID -> 새 ID)
  const groupIdMap = new Map<string, string>();

  // 질문 그룹 복제
  for (const group of originalGroups) {
    const [newGroup] = await db
      .insert(questionGroups)
      .values({
        surveyId: newSurvey.id,
        name: group.name,
        description: group.description,
        order: group.order,
        parentGroupId: group.parentGroupId ? groupIdMap.get(group.parentGroupId) : null,
        color: group.color,
        collapsed: group.collapsed,
      })
      .returning();

    groupIdMap.set(group.id, newGroup.id);
  }

  // 질문 복제
  for (const question of originalQuestions) {
    await db.insert(questions).values({
      surveyId: newSurvey.id,
      groupId: question.groupId ? groupIdMap.get(question.groupId) : null,
      type: question.type,
      title: question.title,
      description: question.description,
      required: question.required,
      order: question.order,
      options: question.options,
      selectLevels: question.selectLevels,
      tableTitle: question.tableTitle,
      tableColumns: question.tableColumns,
      tableRowsData: question.tableRowsData,
      imageUrl: question.imageUrl,
      videoUrl: question.videoUrl,
      allowOtherOption: question.allowOtherOption,
      noticeContent: question.noticeContent,
      requiresAcknowledgment: question.requiresAcknowledgment,
      tableValidationRules: question.tableValidationRules,
      displayCondition: question.displayCondition,
    });
  }

  revalidatePath('/admin/surveys');
  return newSurvey;
}

// ========================
// 질문 그룹 관련 액션
// ========================

// 질문 그룹 생성
export async function createQuestionGroup(data: {
  surveyId: string;
  name: string;
  description?: string;
  parentGroupId?: string;
  order?: number;
  color?: string;
}) {
  // 같은 레벨의 그룹 중 가장 큰 order 찾기
  const siblingGroups = await db.query.questionGroups.findMany({
    where: and(
      eq(questionGroups.surveyId, data.surveyId),
      data.parentGroupId
        ? eq(questionGroups.parentGroupId, data.parentGroupId)
        : eq(questionGroups.parentGroupId, data.parentGroupId as unknown as string)
    ),
  });

  const maxOrder = siblingGroups.length > 0
    ? Math.max(...siblingGroups.map(g => g.order))
    : -1;

  const newGroup: NewQuestionGroup = {
    surveyId: data.surveyId,
    name: data.name,
    description: data.description,
    parentGroupId: data.parentGroupId,
    order: data.order ?? maxOrder + 1,
    color: data.color,
  };

  const [group] = await db.insert(questionGroups).values(newGroup).returning();

  revalidatePath(`/admin/surveys/${data.surveyId}`);
  return group;
}

// 질문 그룹 업데이트
export async function updateQuestionGroup(
  groupId: string,
  data: Partial<{
    name: string;
    description: string;
    order: number;
    parentGroupId: string;
    color: string;
    collapsed: boolean;
  }>
) {
  const [updated] = await db
    .update(questionGroups)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(questionGroups.id, groupId))
    .returning();

  return updated;
}

// 질문 그룹 삭제
export async function deleteQuestionGroup(groupId: string) {
  // 하위 그룹도 함께 삭제됨 (cascade)
  await db.delete(questionGroups).where(eq(questionGroups.id, groupId));
}

// 설문의 질문 그룹 조회
export async function getQuestionGroupsBySurvey(surveyId: string) {
  const groups = await db.query.questionGroups.findMany({
    where: eq(questionGroups.surveyId, surveyId),
    orderBy: [questionGroups.order],
  });
  return groups;
}

// ========================
// 질문 관련 액션
// ========================

// 질문 생성
export async function createQuestion(data: {
  surveyId: string;
  groupId?: string;
  type: string;
  title: string;
  description?: string;
  required?: boolean;
  order?: number;
  options?: QuestionType['options'];
  selectLevels?: QuestionType['selectLevels'];
  tableTitle?: string;
  tableColumns?: QuestionType['tableColumns'];
  tableRowsData?: QuestionType['tableRowsData'];
  imageUrl?: string;
  videoUrl?: string;
  allowOtherOption?: boolean;
  noticeContent?: string;
  requiresAcknowledgment?: boolean;
  tableValidationRules?: QuestionType['tableValidationRules'];
  displayCondition?: QuestionType['displayCondition'];
}) {
  // 같은 설문의 질문 중 가장 큰 order 찾기
  const existingQuestions = await db.query.questions.findMany({
    where: eq(questions.surveyId, data.surveyId),
  });

  const maxOrder = existingQuestions.length > 0
    ? Math.max(...existingQuestions.map(q => q.order))
    : -1;

  const newQuestion: NewQuestion = {
    surveyId: data.surveyId,
    groupId: data.groupId,
    type: data.type,
    title: data.title,
    description: data.description,
    required: data.required ?? false,
    order: data.order ?? maxOrder + 1,
    options: data.options as NewQuestion['options'],
    selectLevels: data.selectLevels as NewQuestion['selectLevels'],
    tableTitle: data.tableTitle,
    tableColumns: data.tableColumns as NewQuestion['tableColumns'],
    tableRowsData: data.tableRowsData as NewQuestion['tableRowsData'],
    imageUrl: data.imageUrl,
    videoUrl: data.videoUrl,
    allowOtherOption: data.allowOtherOption,
    noticeContent: data.noticeContent,
    requiresAcknowledgment: data.requiresAcknowledgment,
    tableValidationRules: data.tableValidationRules as NewQuestion['tableValidationRules'],
    displayCondition: data.displayCondition as NewQuestion['displayCondition'],
  };

  const [question] = await db.insert(questions).values(newQuestion).returning();

  revalidatePath(`/admin/surveys/${data.surveyId}`);
  return question;
}

// 질문 업데이트
export async function updateQuestion(
  questionId: string,
  data: Partial<{
    groupId: string | null;
    type: string;
    title: string;
    description: string;
    required: boolean;
    order: number;
    options: QuestionType['options'];
    selectLevels: QuestionType['selectLevels'];
    tableTitle: string;
    tableColumns: QuestionType['tableColumns'];
    tableRowsData: QuestionType['tableRowsData'];
    imageUrl: string;
    videoUrl: string;
    allowOtherOption: boolean;
    noticeContent: string;
    requiresAcknowledgment: boolean;
    tableValidationRules: QuestionType['tableValidationRules'];
    displayCondition: QuestionType['displayCondition'];
  }>
) {
  const [updated] = await db
    .update(questions)
    .set({
      ...data,
      updatedAt: new Date(),
    } as Partial<NewQuestion>)
    .where(eq(questions.id, questionId))
    .returning();

  return updated;
}

// 질문 삭제
export async function deleteQuestion(questionId: string) {
  await db.delete(questions).where(eq(questions.id, questionId));
}

// 설문의 질문 조회
export async function getQuestionsBySurvey(surveyId: string) {
  const result = await db.query.questions.findMany({
    where: eq(questions.surveyId, surveyId),
    orderBy: [questions.order],
  });
  return result;
}

// 질문 순서 변경
export async function reorderQuestions(questionIds: string[]) {
  for (let i = 0; i < questionIds.length; i++) {
    await db
      .update(questions)
      .set({ order: i, updatedAt: new Date() })
      .where(eq(questions.id, questionIds[i]));
  }
}

// ========================
// 전체 설문 저장 (설문 + 그룹 + 질문 일괄)
// ========================

export async function saveSurveyWithDetails(surveyData: SurveyType) {
  // 설문이 이미 존재하는지 확인
  const existingSurvey = await getSurveyById(surveyData.id);

  let surveyId: string;

  if (existingSurvey) {
    // 기존 설문 업데이트
    await updateSurvey(surveyData.id, {
      title: surveyData.title,
      description: surveyData.description,
      slug: surveyData.slug,
      isPublic: surveyData.settings.isPublic,
      allowMultipleResponses: surveyData.settings.allowMultipleResponses,
      showProgressBar: surveyData.settings.showProgressBar,
      shuffleQuestions: surveyData.settings.shuffleQuestions,
      requireLogin: surveyData.settings.requireLogin,
      endDate: surveyData.settings.endDate ? new Date(surveyData.settings.endDate) : null,
      maxResponses: surveyData.settings.maxResponses ?? null,
      thankYouMessage: surveyData.settings.thankYouMessage,
    });
    surveyId = surveyData.id;

    // 기존 그룹과 질문 삭제
    await db.delete(questionGroups).where(eq(questionGroups.surveyId, surveyId));
    await db.delete(questions).where(eq(questions.surveyId, surveyId));
  } else {
    // 새 설문 생성
    const [newSurvey] = await db
      .insert(surveys)
      .values({
        id: surveyData.id,
        title: surveyData.title,
        description: surveyData.description,
        slug: surveyData.slug,
        privateToken: surveyData.privateToken,
        isPublic: surveyData.settings.isPublic,
        allowMultipleResponses: surveyData.settings.allowMultipleResponses,
        showProgressBar: surveyData.settings.showProgressBar,
        shuffleQuestions: surveyData.settings.shuffleQuestions,
        requireLogin: surveyData.settings.requireLogin,
        endDate: surveyData.settings.endDate ? new Date(surveyData.settings.endDate) : null,
        maxResponses: surveyData.settings.maxResponses ?? null,
        thankYouMessage: surveyData.settings.thankYouMessage,
      })
      .returning();
    surveyId = newSurvey.id;
  }

  // 그룹 ID 매핑 (클라이언트 ID -> DB ID)
  const groupIdMap = new Map<string, string>();

  // 질문 그룹 저장
  if (surveyData.groups && surveyData.groups.length > 0) {
    for (const group of surveyData.groups) {
      const [newGroup] = await db
        .insert(questionGroups)
        .values({
          surveyId,
          name: group.name,
          description: group.description,
          order: group.order,
          parentGroupId: group.parentGroupId ? groupIdMap.get(group.parentGroupId) : null,
          color: group.color,
          collapsed: group.collapsed,
        })
        .returning();

      groupIdMap.set(group.id, newGroup.id);
    }
  }

  // 질문 저장
  for (const question of surveyData.questions) {
    await db.insert(questions).values({
      surveyId,
      groupId: question.groupId ? groupIdMap.get(question.groupId) : null,
      type: question.type,
      title: question.title,
      description: question.description,
      required: question.required,
      order: question.order,
      options: question.options as NewQuestion['options'],
      selectLevels: question.selectLevels as NewQuestion['selectLevels'],
      tableTitle: question.tableTitle,
      tableColumns: question.tableColumns as NewQuestion['tableColumns'],
      tableRowsData: question.tableRowsData as NewQuestion['tableRowsData'],
      imageUrl: question.imageUrl,
      videoUrl: question.videoUrl,
      allowOtherOption: question.allowOtherOption,
      noticeContent: question.noticeContent,
      requiresAcknowledgment: question.requiresAcknowledgment,
      tableValidationRules: question.tableValidationRules as NewQuestion['tableValidationRules'],
      displayCondition: question.displayCondition as NewQuestion['displayCondition'],
    });
  }

  revalidatePath('/admin/surveys');
  revalidatePath(`/admin/surveys/${surveyId}`);

  return { surveyId };
}

// 전체 설문 데이터 조회 (설문 + 그룹 + 질문)
export async function getSurveyWithDetails(surveyId: string): Promise<SurveyType | null> {
  const survey = await getSurveyById(surveyId);
  if (!survey) return null;

  const groups = await getQuestionGroupsBySurvey(surveyId);
  const questionList = await getQuestionsBySurvey(surveyId);

  // DB 데이터를 클라이언트 타입으로 변환
  const surveyData: SurveyType = {
    id: survey.id,
    title: survey.title,
    description: survey.description ?? undefined,
    slug: survey.slug ?? undefined,
    privateToken: survey.privateToken ?? undefined,
    groups: groups.map(g => ({
      id: g.id,
      name: g.name,
      description: g.description ?? undefined,
      order: g.order,
      parentGroupId: g.parentGroupId ?? undefined,
      color: g.color ?? undefined,
      collapsed: g.collapsed ?? undefined,
    })),
    questions: questionList.map(q => ({
      id: q.id,
      type: q.type as QuestionType['type'],
      title: q.title,
      description: q.description ?? undefined,
      required: q.required,
      groupId: q.groupId ?? undefined,
      options: q.options as QuestionType['options'],
      selectLevels: q.selectLevels as QuestionType['selectLevels'],
      tableTitle: q.tableTitle ?? undefined,
      tableColumns: q.tableColumns as QuestionType['tableColumns'],
      tableRowsData: q.tableRowsData as QuestionType['tableRowsData'],
      imageUrl: q.imageUrl ?? undefined,
      videoUrl: q.videoUrl ?? undefined,
      order: q.order,
      allowOtherOption: q.allowOtherOption ?? undefined,
      noticeContent: q.noticeContent ?? undefined,
      requiresAcknowledgment: q.requiresAcknowledgment ?? undefined,
      tableValidationRules: q.tableValidationRules as QuestionType['tableValidationRules'],
      displayCondition: q.displayCondition as QuestionType['displayCondition'],
    })),
    settings: {
      isPublic: survey.isPublic,
      allowMultipleResponses: survey.allowMultipleResponses,
      showProgressBar: survey.showProgressBar,
      shuffleQuestions: survey.shuffleQuestions,
      requireLogin: survey.requireLogin,
      endDate: survey.endDate ?? undefined,
      maxResponses: survey.maxResponses ?? undefined,
      thankYouMessage: survey.thankYouMessage,
    },
    createdAt: survey.createdAt,
    updatedAt: survey.updatedAt,
  };

  return surveyData;
}

// 전체 설문 목록 조회 (요약 정보)
export async function getSurveyListWithCounts() {
  const surveyList = await getSurveys();

  // 각 설문의 질문 수 조회
  const surveysWithCounts = await Promise.all(
    surveyList.map(async (survey) => {
      const questionList = await db.query.questions.findMany({
        where: eq(questions.surveyId, survey.id),
      });

      return {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        slug: survey.slug,
        privateToken: survey.privateToken,
        questionCount: questionList.length,
        responseCount: 0, // TODO: 응답 수 조회 추가
        createdAt: survey.createdAt,
        updatedAt: survey.updatedAt,
        isPublic: survey.isPublic,
      };
    })
  );

  return surveysWithCounts;
}
