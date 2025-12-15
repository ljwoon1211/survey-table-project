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
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { Survey as SurveyType, Question as QuestionType, QuestionGroup as QuestionGroupType } from '@/types/survey';
import {
  getSurveyById,
  getQuestionGroupsBySurvey,
  getQuestionsBySurvey,
} from '@/data/surveys';
import { requireAuth } from '@/lib/auth';

// ========================
// 설문 변경 액션 (Mutations)
// ========================

// 설문 생성
export async function createSurvey(data: {
  title: string;
  description?: string;
  slug?: string;
  isPublic?: boolean;
  settings?: Partial<SurveyType['settings']>;
}) {
  await requireAuth();

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
  await requireAuth();

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
  await requireAuth();

  await db.delete(surveys).where(eq(surveys.id, surveyId));
  revalidatePath('/admin/surveys');
}

// 설문 복제
export async function duplicateSurvey(surveyId: string) {
  await requireAuth();

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
// 질문 그룹 변경 액션 (Mutations)
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
  await requireAuth();

  // 같은 레벨의 그룹 중 가장 큰 order 찾기
  const siblingGroups = await getQuestionGroupsBySurvey(data.surveyId);
  const filteredGroups = siblingGroups.filter(g =>
    data.parentGroupId ? g.parentGroupId === data.parentGroupId : !g.parentGroupId
  );

  const maxOrder = filteredGroups.length > 0
    ? Math.max(...filteredGroups.map(g => g.order))
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
    parentGroupId: string | null;
    color: string;
    collapsed: boolean;
  }>
) {
  await requireAuth();

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
  await requireAuth();

  // 재귀적으로 하위 그룹들의 ID를 수집
  const collectChildGroupIds = async (parentId: string): Promise<string[]> => {
    const childGroups = await db.query.questionGroups.findMany({
      where: eq(questionGroups.parentGroupId, parentId),
    });
    
    let allIds = [parentId];
    for (const child of childGroups) {
      const childIds = await collectChildGroupIds(child.id);
      allIds = [...allIds, ...childIds];
    }
    return allIds;
  };

  const allGroupIdsToDelete = await collectChildGroupIds(groupId);

  // 모든 그룹에 속한 질문들의 groupId를 null로 설정
  // DB 스키마에 onDelete: 'set null'이 있지만, 명시적으로 처리하여 안전하게 처리
  for (const gId of allGroupIdsToDelete) {
    await db
      .update(questions)
      .set({ groupId: null, updatedAt: new Date() })
      .where(eq(questions.groupId, gId));
  }

  // 하위 그룹부터 역순으로 삭제 (부모 그룹이 먼저 삭제되면 외래키 제약으로 인한 오류 방지)
  // 하지만 실제로는 cascade로 처리되므로, 최상위 그룹만 삭제해도 하위 그룹이 자동 삭제됨
  // 안전을 위해 하위 그룹부터 역순으로 삭제
  const deleteGroups = async (gId: string) => {
    // 먼저 하위 그룹들을 삭제
    const childGroups = await db.query.questionGroups.findMany({
      where: eq(questionGroups.parentGroupId, gId),
    });
    
    for (const child of childGroups) {
      await deleteGroups(child.id);
    }
    
    // 하위 그룹 삭제 후 현재 그룹 삭제
    await db.delete(questionGroups).where(eq(questionGroups.id, gId));
  };

  await deleteGroups(groupId);
}

// 그룹 순서 변경 (최상위 그룹만)
export async function reorderGroups(surveyId: string, groupIds: string[]) {
  await requireAuth();

  // 최상위 그룹(parentGroupId가 null인 그룹)만 순서 변경
  // 각 그룹의 order를 인덱스로 설정
  for (let i = 0; i < groupIds.length; i++) {
    await db
      .update(questionGroups)
      .set({ order: i, updatedAt: new Date() })
      .where(eq(questionGroups.id, groupIds[i]));
  }

  revalidatePath(`/admin/surveys/${surveyId}`);
}

// ========================
// 질문 변경 액션 (Mutations)
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
  await requireAuth();

  // 같은 설문의 질문 중 가장 큰 order 찾기
  const existingQuestions = await getQuestionsBySurvey(data.surveyId);

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
  await requireAuth();

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
  await requireAuth();

  await db.delete(questions).where(eq(questions.id, questionId));
}

// 질문 순서 변경
export async function reorderQuestions(questionIds: string[]) {
  await requireAuth();

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
  await requireAuth();

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
