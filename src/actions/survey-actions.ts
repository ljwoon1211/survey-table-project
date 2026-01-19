'use server';

import { revalidatePath } from 'next/cache';

import { eq, inArray, sql } from 'drizzle-orm';

import { getQuestionGroupsBySurvey, getQuestionsBySurvey, getSurveyById } from '@/data/surveys';
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
import { extractImageUrlsFromQuestion, extractImageUrlsFromQuestions } from '@/lib/image-extractor';
import { deleteImagesFromR2Server } from '@/lib/image-utils-server';
import { generateId, isValidUUID } from '@/lib/utils';
import type {
  QuestionConditionGroup,
  Question as QuestionType,
  Survey as SurveyType,
} from '@/types/survey';
import type { Question } from '@/types/survey';

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

  // 삭제 전 설문의 모든 질문 조회
  const surveyQuestions = await db.query.questions.findMany({
    where: eq(questions.surveyId, surveyId),
  });

  // 모든 질문에서 이미지 추출 및 삭제
  if (surveyQuestions.length > 0) {
    const allImages = extractImageUrlsFromQuestions(surveyQuestions as Question[]);
    if (allImages.length > 0) {
      try {
        await deleteImagesFromR2Server(allImages);
      } catch (error) {
        console.error('설문 삭제 시 이미지 삭제 실패:', error);
        // 이미지 삭제 실패해도 설문 삭제는 진행
      }
    }
  }

  await db.delete(surveys).where(eq(surveys.id, surveyId));
  revalidatePath('/admin/surveys');
}

// 설문 복제
export async function duplicateSurvey(surveyId: string) {
  await requireAuth();

  // 원본 설문 조회 (트랜잭션 외부에서 조회 가능)
  const original = await getSurveyById(surveyId);
  if (!original) return null;

  // 🚀 트랜잭션 시작: 모든 복제 작업을 하나의 단위로 실행
  return await db.transaction(async (tx) => {
    // 원본 질문 그룹 조회 (트랜잭션 내에서)
    const originalGroups = await tx.query.questionGroups.findMany({
      where: eq(questionGroups.surveyId, surveyId),
      orderBy: [questionGroups.order],
    });

    // 원본 질문 조회 (트랜잭션 내에서)
    const originalQuestions = await tx.query.questions.findMany({
      where: eq(questions.surveyId, surveyId),
      orderBy: [questions.order],
    });

    // 새 설문 생성 (트랜잭션 내에서 실행)
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

    // 1. 그룹 정렬 (상위 그룹부터 하위 그룹 순으로)
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

    // 2. 그룹 ID 매핑 및 데이터 준비 (정렬된 순서대로)
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

    // 🚀 그룹 일괄 저장 (트랜잭션 내에서 실행)
    if (newGroupsData.length > 0) {
      await tx.insert(questionGroups).values(newGroupsData);
    }

    // 2. 질문 데이터 준비
    const questionIdMap = new Map<string, string>(); // 필요한 경우 유지
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
        imageUrl: question.imageUrl,
        videoUrl: question.videoUrl,
        allowOtherOption: question.allowOtherOption,
        noticeContent: question.noticeContent,
        requiresAcknowledgment: question.requiresAcknowledgment,
        placeholder: question.placeholder,
        tableValidationRules: question.tableValidationRules as NewQuestion['tableValidationRules'],
        displayCondition: question.displayCondition as NewQuestion['displayCondition'],
      };
    });

    // 🚀 질문 일괄 저장 (트랜잭션 내에서 실행)
    if (newQuestionsData.length > 0) {
      await tx.insert(questions).values(newQuestionsData);
    }

    // 트랜잭션 성공 시에만 revalidatePath 실행
    revalidatePath('/admin/surveys');
    return newSurvey;
  });
}

// ========================
// 질문 그룹 변경 액션 (Mutations)
// ========================

// 질문 그룹 생성
export async function createQuestionGroup(data: {
  surveyId: string;
  id?: string; // 클라이언트에서 제공한 UUID (선택사항)
  name: string;
  description?: string;
  parentGroupId?: string;
  order?: number;
  color?: string;
}) {
  await requireAuth();

  // 같은 레벨의 그룹 중 가장 큰 order 찾기
  const siblingGroups = await getQuestionGroupsBySurvey(data.surveyId);
  const filteredGroups = siblingGroups.filter((g) =>
    data.parentGroupId ? g.parentGroupId === data.parentGroupId : !g.parentGroupId,
  );

  const maxOrder = filteredGroups.length > 0 ? Math.max(...filteredGroups.map((g) => g.order)) : -1;

  const newGroup: NewQuestionGroup = {
    id: data.id || generateId(), // 클라이언트에서 제공한 ID 또는 새로 생성
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
    displayCondition: QuestionConditionGroup | undefined;
  }>,
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

// 질문 그룹 삭제 (메모리 기반 최적화)
export async function deleteQuestionGroup(groupId: string) {
  await requireAuth();

  // 1. 현재 그룹의 정보를 가져와서 surveyId 확인
  const targetGroup = await db.query.questionGroups.findFirst({
    where: eq(questionGroups.id, groupId),
  });

  if (!targetGroup) return;

  // 2. 해당 설문의 '모든' 그룹을 한 번에 가져옴 (효율적)
  const allGroups = await db.query.questionGroups.findMany({
    where: eq(questionGroups.surveyId, targetGroup.surveyId),
  });

  // 3. 메모리에서 자식 그룹 ID들을 재귀적으로 찾음 (DB 호출 없음, 매우 빠름)
  const findDescendantIds = (parentId: string): string[] => {
    const children = allGroups.filter((g) => g.parentGroupId === parentId);
    let ids = children.map((c) => c.id);
    for (const child of children) {
      ids = [...ids, ...findDescendantIds(child.id)];
    }
    return ids;
  };

  const allGroupIdsToDelete = [groupId, ...findDescendantIds(groupId)];

  // 4. 모든 그룹에 속한 질문들 조회 (이미지 삭제용)
  const questionsInGroups = await db.query.questions.findMany({
    where: inArray(questions.groupId, allGroupIdsToDelete),
  });

  // 5. 질문들에서 이미지 추출 및 삭제
  if (questionsInGroups.length > 0) {
    const allImages = extractImageUrlsFromQuestions(questionsInGroups as Question[]);
    if (allImages.length > 0) {
      try {
        await deleteImagesFromR2Server(allImages);
      } catch (error) {
        console.error('그룹 삭제 시 이미지 삭제 실패:', error);
        // 이미지 삭제 실패해도 그룹 삭제는 진행
      }
    }
  }

  // 6. 모든 그룹에 속한 질문들의 groupId를 null로 설정 (일괄 처리)
  if (allGroupIdsToDelete.length > 0) {
    await db
      .update(questions)
      .set({ groupId: null, updatedAt: new Date() })
      .where(inArray(questions.groupId, allGroupIdsToDelete));
  }

  // 7. 그룹 일괄 삭제 (단 1번의 쿼리)
  if (allGroupIdsToDelete.length > 0) {
    await db.delete(questionGroups).where(inArray(questionGroups.id, allGroupIdsToDelete));
  }
}

// [최적화] 그룹 순서 변경 (최상위 그룹만)
export async function reorderGroups(surveyId: string, groupIds: string[]) {
  await requireAuth();

  const validGroupIds = groupIds.filter((id) => isValidUUID(id));
  if (validGroupIds.length === 0) return;

  // 1. 현재 DB에 저장된 순서 조회 (읽기가 쓰기보다 훨씬 저렴합니다)
  const currentGroups = await db.query.questionGroups.findMany({
    where: eq(questionGroups.surveyId, surveyId),
    columns: {
      id: true,
      order: true,
    },
  });

  // ID별 현재 순서 매핑
  const currentOrderMap = new Map(currentGroups.map((g) => [g.id, g.order]));
  const updates: Promise<any>[] = [];

  validGroupIds.forEach((id, index) => {
    const currentOrder = currentOrderMap.get(id);

    // 2. 실제로 순서가 변경된 그룹만 업데이트 큐에 추가 (Diffing)
    if (currentOrder !== index) {
      updates.push(
        db
          .update(questionGroups)
          .set({ order: index, updatedAt: new Date() })
          .where(eq(questionGroups.id, id)),
      );
    }
  });

  // 3. 변경된 것만 병렬 실행
  if (updates.length > 0) {
    await Promise.all(updates);
    revalidatePath(`/admin/surveys/${surveyId}`);
  }
}

// ========================
// 질문 변경 액션 (Mutations)
// ========================

// 질문 생성
export async function createQuestion(data: {
  surveyId: string;
  id?: string; // 클라이언트에서 제공한 UUID (선택사항)
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
  placeholder?: string;
  tableValidationRules?: QuestionType['tableValidationRules'];
  displayCondition?: QuestionType['displayCondition'];
}) {
  await requireAuth();

  // 같은 설문의 질문 중 가장 큰 order 찾기
  const existingQuestions = await getQuestionsBySurvey(data.surveyId);

  const maxOrder =
    existingQuestions.length > 0 ? Math.max(...existingQuestions.map((q) => q.order)) : -1;

  const newQuestion: NewQuestion = {
    id: data.id || generateId(), // 클라이언트에서 제공한 ID 또는 새로 생성
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
    placeholder: data.placeholder,
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
    placeholder: string;
    tableValidationRules: QuestionType['tableValidationRules'];
    displayCondition: QuestionType['displayCondition'];
  }>,
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

  // 삭제 전 질문 조회 및 이미지 추출
  const question = await db.query.questions.findFirst({
    where: eq(questions.id, questionId),
  });

  if (question) {
    const images = extractImageUrlsFromQuestion(question as Question);
    if (images.length > 0) {
      try {
        await deleteImagesFromR2Server(images);
      } catch (error) {
        console.error('질문 삭제 시 이미지 삭제 실패:', error);
        // 이미지 삭제 실패해도 질문 삭제는 진행
      }
    }
  }

  await db.delete(questions).where(eq(questions.id, questionId));
}

// [최적화] 질문 순서 변경
export async function reorderQuestions(questionIds: string[]) {
  await requireAuth();

  const validQuestionIds = questionIds.filter((id) => isValidUUID(id));
  if (validQuestionIds.length === 0) return;

  // 1. 현재 DB에 저장된 순서 조회
  const currentQuestions = await db.query.questions.findMany({
    where: inArray(questions.id, validQuestionIds),
    columns: {
      id: true,
      order: true,
    },
  });

  const currentOrderMap = new Map(currentQuestions.map((q) => [q.id, q.order]));
  const updates: Promise<any>[] = [];

  validQuestionIds.forEach((id, index) => {
    // 기존 로직과 동일하게 index + 1 사용 (질문 순서는 1부터 시작하는 경우가 많음)
    const newOrder = index + 1;
    const currentOrder = currentOrderMap.get(id);

    // 2. 실제로 순서가 변경된 질문만 업데이트 큐에 추가
    if (currentOrder !== newOrder) {
      updates.push(
        db
          .update(questions)
          .set({ order: newOrder, updatedAt: new Date() })
          .where(eq(questions.id, id)),
      );
    }
  });

  // 3. 변경된 것만 병렬 실행
  if (updates.length > 0) {
    await Promise.all(updates);
  }
}

// ========================
// 전체 설문 저장 (설문 + 그룹 + 질문 일괄)
// ========================

export async function saveSurveyWithDetails(surveyData: SurveyType) {
  await requireAuth();

  // 🚀 트랜잭션 시작
  return await db.transaction(async (tx) => {
    // 1. 설문 기본 정보 저장
    // 트랜잭션 내부에서는 반드시 tx 객체로 쿼리를 날려야 합니다.
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

    // 그룹 displayCondition 보존 로직 (기존 유지)
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

    // 안전장치
    if (!surveyData.questions) surveyData.questions = [];
    if (!surveyData.groups) surveyData.groups = [];

    // ==========================================
    // ⚡️ 2. 질문 그룹 처리 (Bulk Upsert 적용)
    // ==========================================
    if (surveyData.groups.length > 0) {
      // 2-1. 삭제된 그룹 정리
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

      // 2-2. 그룹 일괄 저장 (Upsert)
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

      // PostgreSQL ON CONFLICT 구문
      await tx
        .insert(questionGroups)
        .values(groupValues)
        .onConflictDoUpdate({
          target: questionGroups.id, // PK 충돌 시 업데이트
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

    // ==========================================
    // ⚡️ 3. 질문 처리 (Bulk Upsert 적용)
    // ==========================================
    if (surveyData.questions) {
      // 3-1. 삭제된 질문 정리
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
        // 이미지 삭제 (비동기 처리로 속도 향상)
        const questionsToRemove = await tx.query.questions.findMany({
          where: inArray(questions.id, questionIdsToRemove),
        });
        const imagesToDelete = extractImageUrlsFromQuestions(questionsToRemove as Question[]);
        if (imagesToDelete.length > 0) {
          deleteImagesFromR2Server(imagesToDelete).catch(console.error);
        }

        await tx.delete(questions).where(inArray(questions.id, questionIdsToRemove));
      }

      // 3-2. 질문 일괄 저장 (Upsert)
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
          tableRowsData: question.tableRowsData as NewQuestion['tableRowsData'],
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
          displayCondition: question.displayCondition as NewQuestion['displayCondition'],
          updatedAt: new Date(),
        }));

        await tx
          .insert(questions)
          .values(questionValues)
          .onConflictDoUpdate({
            target: questions.id, // PK 충돌 시 업데이트
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
              imageUrl: sql`excluded.image_url`,
              videoUrl: sql`excluded.video_url`,
              allowOtherOption: sql`excluded.allow_other_option`,
              minSelections: sql`excluded.min_selections`,
              maxSelections: sql`excluded.max_selections`,
              noticeContent: sql`excluded.notice_content`,
              requiresAcknowledgment: sql`excluded.requires_acknowledgment`,
              placeholder: sql`excluded.placeholder`,
              tableValidationRules: sql`excluded.table_validation_rules`,
              displayCondition: sql`excluded.display_condition`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
      }
    }

    // 트랜잭션 성공 시에만 revalidatePath 실행
    revalidatePath('/admin/surveys');
    revalidatePath(`/admin/surveys/${surveyId}`);

    return { surveyId };
  });
}
