'use server';

import { revalidatePath } from 'next/cache';

import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import {
  getQuestionGroupsBySurvey,
  getSurveyById,
  getSurveyWithDetails,
} from '@/data/surveys';
import { db } from '@/db';
import {
  NewQuestion,
  NewQuestionGroup,
  NewSurvey,
  questionGroups,
  questions,
  surveys,
  surveyVersions,
} from '@/db/schema';
import { requireAuth } from '@/lib/auth';
import { extractImageUrlsFromQuestions } from '@/lib/image-extractor';
import { deleteImagesFromR2Server } from '@/lib/image-utils-server';
import { generateId } from '@/lib/utils';
import { buildSurveySnapshot } from '@/lib/versioning/snapshot-builder';
import type {
  Question,
  Survey as SurveyType,
} from '@/types/survey';
import { stripTableRowsData } from '@/utils/table-cell-optimizer';

// ========================
// 설문 CRUD 액션
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
        options: question.options as NewQuestion['options'],
        selectLevels: question.selectLevels as NewQuestion['selectLevels'],
        tableTitle: question.tableTitle,
        tableColumns: question.tableColumns as NewQuestion['tableColumns'],
        tableRowsData: question.tableRowsData as NewQuestion['tableRowsData'],
        tableHeaderGrid: question.tableHeaderGrid as NewQuestion['tableHeaderGrid'],
        imageUrl: question.imageUrl,
        videoUrl: question.videoUrl,
        allowOtherOption: question.allowOtherOption,
        noticeContent: question.noticeContent,
        requiresAcknowledgment: question.requiresAcknowledgment,
        placeholder: question.placeholder,
        tableValidationRules: question.tableValidationRules as NewQuestion['tableValidationRules'],
        dynamicRowConfigs: question.dynamicRowConfigs as NewQuestion['dynamicRowConfigs'],
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

// ========================
// 전체 설문 저장 (설문 + 그룹 + 질문 일괄)
// ========================

export async function saveSurveyWithDetails(surveyData: SurveyType) {
  await requireAuth();

  return await db.transaction(async (tx) => {
    const existingSurvey = await tx.query.surveys.findFirst({
      where: eq(surveys.id, surveyData.id),
    });
    const surveyId = surveyData.id;

    if (existingSurvey) {
      await tx
        .update(surveys)
        .set({
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
          updatedAt: new Date(),
        })
        .where(eq(surveys.id, surveyData.id));
    } else {
      await tx.insert(surveys).values({
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
      });
    }

    // 그룹 displayCondition 보존 로직
    if (existingSurvey && surveyData.groups) {
      const existingGroups = await tx.query.questionGroups.findMany({
        where: eq(questionGroups.surveyId, surveyId),
      });

      surveyData.groups = surveyData.groups.map((group) => {
        if (group.displayCondition) return group;
        const existingGroup = existingGroups.find((g) => g.id === group.id);
        if (existingGroup?.displayCondition) {
          return {
            ...group,
            displayCondition: existingGroup.displayCondition as NonNullable<
              SurveyType['groups']
            >[0]['displayCondition'],
          };
        }
        return group;
      });
    }

    if (!surveyData.questions) surveyData.questions = [];
    if (!surveyData.groups) surveyData.groups = [];

    // 질문 그룹 처리 (Bulk Upsert)
    if (surveyData.groups.length > 0) {
      const existingGroups = existingSurvey
        ? await tx.query.questionGroups.findMany({
            where: eq(questionGroups.surveyId, surveyId),
            columns: { id: true },
          })
        : [];

      const newGroupIds = new Set(surveyData.groups.map((g) => g.id));
      const groupIdsToRemove = existingGroups
        .filter((g) => !newGroupIds.has(g.id))
        .map((g) => g.id);

      if (groupIdsToRemove.length > 0) {
        await tx.delete(questionGroups).where(inArray(questionGroups.id, groupIdsToRemove));
      }

      const groupValues = surveyData.groups.map((group) => ({
        id: group.id,
        surveyId,
        name: group.name,
        description: group.description,
        order: group.order,
        parentGroupId: group.parentGroupId || null,
        color: group.color,
        collapsed: group.collapsed,
        displayCondition: group.displayCondition as NewQuestionGroup['displayCondition'],
        updatedAt: new Date(),
      }));

      await tx
        .insert(questionGroups)
        .values(groupValues)
        .onConflictDoUpdate({
          target: questionGroups.id,
          set: {
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            order: sql`excluded.order`,
            parentGroupId: sql`excluded.parent_group_id`,
            color: sql`excluded.color`,
            collapsed: sql`excluded.collapsed`,
            displayCondition: sql`excluded.display_condition`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }

    // 질문 처리 (Bulk Upsert)
    if (surveyData.questions) {
      const existingQuestions = existingSurvey
        ? await tx.query.questions.findMany({
            where: eq(questions.surveyId, surveyId),
            columns: { id: true },
          })
        : [];

      const newQuestionIds = new Set(surveyData.questions.map((q) => q.id));
      const questionIdsToRemove = existingQuestions
        .filter((q) => !newQuestionIds.has(q.id))
        .map((q) => q.id);

      if (questionIdsToRemove.length > 0) {
        const questionsToRemove = await tx.query.questions.findMany({
          where: inArray(questions.id, questionIdsToRemove),
        });
        const imagesToDelete = extractImageUrlsFromQuestions(questionsToRemove as Question[]);
        if (imagesToDelete.length > 0) {
          deleteImagesFromR2Server(imagesToDelete).catch(console.error);
        }

        await tx.delete(questions).where(inArray(questions.id, questionIdsToRemove));
      }

      if (surveyData.questions.length > 0) {
        const questionValues = surveyData.questions.map((question) => ({
          id: question.id,
          surveyId,
          groupId: question.groupId || null,
          type: question.type,
          title: question.title,
          description: question.description,
          required: question.required,
          order: question.order,
          options: question.options as NewQuestion['options'],
          selectLevels: question.selectLevels as NewQuestion['selectLevels'],
          tableTitle: question.tableTitle,
          tableColumns: question.tableColumns as NewQuestion['tableColumns'],
          tableRowsData: (question.type === 'table' && question.tableRowsData
            ? stripTableRowsData(question.tableRowsData)
            : question.tableRowsData) as NewQuestion['tableRowsData'],
          tableHeaderGrid: question.tableHeaderGrid as NewQuestion['tableHeaderGrid'],
          imageUrl: question.imageUrl,
          videoUrl: question.videoUrl,
          allowOtherOption: question.allowOtherOption,
          minSelections: question.minSelections,
          maxSelections: question.maxSelections,
          noticeContent: question.noticeContent,
          requiresAcknowledgment: question.requiresAcknowledgment,
          placeholder: question.placeholder,
          tableValidationRules:
            question.tableValidationRules as NewQuestion['tableValidationRules'],
          dynamicRowConfigs:
            question.dynamicRowConfigs as NewQuestion['dynamicRowConfigs'],
          displayCondition: question.displayCondition as NewQuestion['displayCondition'],
          questionCode: question.questionCode,
          isCustomSpssVarName: question.isCustomSpssVarName,
          exportLabel: question.exportLabel,
          updatedAt: new Date(),
        }));

        await tx
          .insert(questions)
          .values(questionValues)
          .onConflictDoUpdate({
            target: questions.id,
            set: {
              groupId: sql`excluded.group_id`,
              type: sql`excluded.type`,
              title: sql`excluded.title`,
              description: sql`excluded.description`,
              required: sql`excluded.required`,
              order: sql`excluded.order`,
              options: sql`excluded.options`,
              selectLevels: sql`excluded.select_levels`,
              tableTitle: sql`excluded.table_title`,
              tableColumns: sql`excluded.table_columns`,
              tableRowsData: sql`excluded.table_rows_data`,
              tableHeaderGrid: sql`excluded.table_header_grid`,
              imageUrl: sql`excluded.image_url`,
              videoUrl: sql`excluded.video_url`,
              allowOtherOption: sql`excluded.allow_other_option`,
              minSelections: sql`excluded.min_selections`,
              maxSelections: sql`excluded.max_selections`,
              noticeContent: sql`excluded.notice_content`,
              requiresAcknowledgment: sql`excluded.requires_acknowledgment`,
              placeholder: sql`excluded.placeholder`,
              tableValidationRules: sql`excluded.table_validation_rules`,
              dynamicRowConfigs: sql`excluded.dynamic_row_config`,
              displayCondition: sql`excluded.display_condition`,
              questionCode: sql`excluded.question_code`,
              isCustomSpssVarName: sql`excluded.is_custom_spss_var_name`,
              exportLabel: sql`excluded.export_label`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
      }
    }

    revalidatePath('/admin/surveys');
    revalidatePath(`/admin/surveys/${surveyId}`);

    return { surveyId };
  });
}

// ========================
// 설문 배포 (Publish)
// ========================

export async function publishSurvey(surveyId: string, changeNote?: string) {
  await requireAuth();

  const surveyData = await getSurveyWithDetails(surveyId);
  if (!surveyData) {
    throw new Error('설문을 찾을 수 없습니다.');
  }

  if (!surveyData.questions || surveyData.questions.length === 0) {
    throw new Error('질문이 없는 설문은 배포할 수 없습니다.');
  }

  const snapshot = buildSurveySnapshot(surveyData);

  return await db.transaction(async (tx) => {
    await tx
      .update(surveyVersions)
      .set({ status: 'superseded' })
      .where(
        and(
          eq(surveyVersions.surveyId, surveyId),
          eq(surveyVersions.status, 'published'),
        ),
      );

    const latestVersion = await tx.query.surveyVersions.findFirst({
      where: eq(surveyVersions.surveyId, surveyId),
      orderBy: [desc(surveyVersions.versionNumber)],
      columns: { versionNumber: true },
    });
    const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    const [newVersion] = await tx
      .insert(surveyVersions)
      .values({
        surveyId,
        versionNumber: nextVersionNumber,
        status: 'published',
        snapshot,
        changeNote: changeNote || null,
      })
      .returning();

    await tx
      .update(surveys)
      .set({
        status: 'published',
        currentVersionId: newVersion.id,
        updatedAt: new Date(),
      })
      .where(eq(surveys.id, surveyId));

    revalidatePath('/admin/surveys');
    revalidatePath(`/admin/surveys/${surveyId}`);

    return newVersion;
  });
}
