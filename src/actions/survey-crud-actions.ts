'use server';

import { revalidatePath } from 'next/cache';

import { eq } from 'drizzle-orm';

import { getSurveyById } from '@/data/surveys';
import { db } from '@/db';
import {
  NewQuestion,
  NewQuestionGroup,
  NewSurvey,
  questionGroups,
  questions,
  surveys,
} from '@/db/schema';
import { requireAuth } from '@/lib/auth';
import { extractImageUrlsFromQuestions } from '@/lib/image-extractor';
import { deleteImagesFromR2Server } from '@/lib/image-utils-server';
import { generateId } from '@/lib/utils';
import type {
  Question,
  Survey as SurveyType,
  SurveySettings,
} from '@/types/survey';
import { stripOptionCodes } from '@/utils/option-code-generator';

// ========================
// 설문 CRUD 액션
// ========================

// 설문이 DB에 존재하는지 확인하고, 없으면 최소한의 레코드를 생성 (idempotent)
export async function ensureSurveyInDb(surveyData: {
  id: string;
  title: string;
  privateToken?: string;
  settings: SurveySettings;
}) {
  await requireAuth();

  const existing = await db.query.surveys.findFirst({
    where: eq(surveys.id, surveyData.id),
    columns: { id: true },
  });

  if (existing) return { surveyId: surveyData.id, created: false };

  await db.insert(surveys).values({
    id: surveyData.id,
    title: surveyData.title,
    privateToken: surveyData.privateToken,
    isPublic: surveyData.settings.isPublic ?? true,
    allowMultipleResponses: surveyData.settings.allowMultipleResponses ?? false,
    showProgressBar: surveyData.settings.showProgressBar ?? true,
    shuffleQuestions: surveyData.settings.shuffleQuestions ?? false,
    requireLogin: surveyData.settings.requireLogin ?? false,
    thankYouMessage: surveyData.settings.thankYouMessage ?? '응답해주셔서 감사합니다!',
  });

  return { surveyId: surveyData.id, created: true };
}

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
  }>,
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

  const surveyQuestions = await db.query.questions.findMany({
    where: eq(questions.surveyId, surveyId),
  });

  if (surveyQuestions.length > 0) {
    const allImages = extractImageUrlsFromQuestions(surveyQuestions as Question[]);
    if (allImages.length > 0) {
      try {
        await deleteImagesFromR2Server(allImages);
      } catch (error) {
        console.error('설문 삭제 시 이미지 삭제 실패:', error);
      }
    }
  }

  await db.delete(surveys).where(eq(surveys.id, surveyId));
  revalidatePath('/admin/surveys');
}

// 설문 복제
export async function duplicateSurvey(surveyId: string) {
  await requireAuth();

  const original = await getSurveyById(surveyId);
  if (!original) return null;

  return await db.transaction(async (tx) => {
    const originalGroups = await tx.query.questionGroups.findMany({
      where: eq(questionGroups.surveyId, surveyId),
      orderBy: [questionGroups.order],
    });

    const originalQuestions = await tx.query.questions.findMany({
      where: eq(questions.surveyId, surveyId),
      orderBy: [questions.order],
    });

    const [newSurvey] = await tx
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

    // 그룹 정렬 (상위 그룹부터 하위 그룹 순으로)
    const sortedGroups: typeof originalGroups = [];
    if (originalGroups.length > 0) {
      const processedGroupIds = new Set<string>();
      const topLevelGroups = originalGroups
        .filter((g) => !g.parentGroupId)
        .sort((a, b) => a.order - b.order);
      sortedGroups.push(...topLevelGroups);
      topLevelGroups.forEach((g) => processedGroupIds.add(g.id));

      const addSubGroups = (parentId: string) => {
        const subGroups = originalGroups
          .filter((g) => g.parentGroupId === parentId && !processedGroupIds.has(g.id))
          .sort((a, b) => a.order - b.order);

        subGroups.forEach((g) => {
          sortedGroups.push(g);
          processedGroupIds.add(g.id);
          addSubGroups(g.id);
        });
      };

      topLevelGroups.forEach((group) => {
        addSubGroups(group.id);
      });
    }

    // 그룹 ID 매핑 및 데이터 준비
    const groupIdMap = new Map<string, string>();
    const newGroupsData = sortedGroups.map((group) => {
      const newGroupId = generateId();
      groupIdMap.set(group.id, newGroupId);
      return {
        id: newGroupId,
        surveyId: newSurvey.id,
        name: group.name,
        description: group.description,
        order: group.order,
        parentGroupId: group.parentGroupId ? groupIdMap.get(group.parentGroupId) : null,
        color: group.color,
        collapsed: group.collapsed,
        displayCondition: group.displayCondition as NewQuestionGroup['displayCondition'],
      };
    });

    if (newGroupsData.length > 0) {
      await tx.insert(questionGroups).values(newGroupsData);
    }

    // 질문 데이터 준비
    const questionIdMap = new Map<string, string>();
    const newQuestionsData = originalQuestions.map((question) => {
      const newQuestionId = generateId();
      questionIdMap.set(question.id, newQuestionId);
      return {
        id: newQuestionId,
        surveyId: newSurvey.id,
        groupId: question.groupId ? groupIdMap.get(question.groupId) : null,
        type: question.type,
        title: question.title,
        description: question.description,
        required: question.required,
        order: question.order,
        options: (question.options ? stripOptionCodes(question.options) : question.options) as NewQuestion['options'],
        selectLevels: question.selectLevels as NewQuestion['selectLevels'],
        tableTitle: question.tableTitle,
        tableColumns: question.tableColumns as NewQuestion['tableColumns'],
        tableRowsData: question.tableRowsData as NewQuestion['tableRowsData'],
        tableHeaderGrid: question.tableHeaderGrid as NewQuestion['tableHeaderGrid'],
        imageUrl: question.imageUrl,
        videoUrl: question.videoUrl,
        allowOtherOption: question.allowOtherOption,
        optionsColumns: question.optionsColumns,
        rankingConfig: question.rankingConfig as NewQuestion['rankingConfig'],
        noticeContent: question.noticeContent,
        requiresAcknowledgment: question.requiresAcknowledgment,
        placeholder: question.placeholder,
        tableValidationRules: question.tableValidationRules as NewQuestion['tableValidationRules'],
        dynamicRowConfigs: question.dynamicRowConfigs as NewQuestion['dynamicRowConfigs'],
        hideColumnLabels: question.hideColumnLabels,
        displayCondition: question.displayCondition as NewQuestion['displayCondition'],
      };
    });

    if (newQuestionsData.length > 0) {
      await tx.insert(questions).values(newQuestionsData);
    }

    revalidatePath('/admin/surveys');
    return newSurvey;
  });
}

