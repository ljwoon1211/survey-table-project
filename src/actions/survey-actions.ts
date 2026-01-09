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
import { eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { Survey as SurveyType, Question as QuestionType, QuestionConditionGroup } from '@/types/survey';
import {
  getSurveyById,
  getQuestionGroupsBySurvey,
  getQuestionsBySurvey,
} from '@/data/surveys';
import { requireAuth } from '@/lib/auth';
import { isValidUUID, generateId } from '@/lib/utils';
import { extractImageUrlsFromQuestion, extractImageUrlsFromQuestions } from '@/lib/image-extractor';
import { deleteImagesFromR2Server } from '@/lib/image-utils-server';
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

  // 삭제 전 설문의 모든 질문 조회
  const surveyQuestions = await db.query.questions.findMany({
    where: eq(questions.surveyId, surveyId),
  });

  // 모든 질문에서 이미지 추출 및 삭제
  if (surveyQuestions.length > 0) {
    const allImages = extractImageUrlsFromQuestions(
      surveyQuestions as Question[]
    );
    if (allImages.length > 0) {
      try {
        await deleteImagesFromR2Server(allImages);
      } catch (error) {
        console.error("설문 삭제 시 이미지 삭제 실패:", error);
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

  // 질문 그룹 복제 (새 UUID 생성)
  for (const group of originalGroups) {
    const newGroupId = generateId();
    await db
      .insert(questionGroups)
      .values({
        id: newGroupId,
        surveyId: newSurvey.id,
        name: group.name,
        description: group.description,
        order: group.order,
        parentGroupId: group.parentGroupId ? groupIdMap.get(group.parentGroupId) : null,
        color: group.color,
        collapsed: group.collapsed,
        displayCondition: group.displayCondition as NewQuestionGroup['displayCondition'],
      });

    groupIdMap.set(group.id, newGroupId);
  }

  // 질문 ID 매핑 (원본 ID -> 새 ID) - 복제 시 참조 관계 업데이트용
  const questionIdMap = new Map<string, string>();

  // 질문 복제 (새 UUID 생성)
  for (const question of originalQuestions) {
    const newQuestionId = generateId();
    questionIdMap.set(question.id, newQuestionId);

    await db.insert(questions).values({
      id: newQuestionId,
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
      placeholder: question.placeholder,
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
  const filteredGroups = siblingGroups.filter(g =>
    data.parentGroupId ? g.parentGroupId === data.parentGroupId : !g.parentGroupId
  );

  const maxOrder = filteredGroups.length > 0
    ? Math.max(...filteredGroups.map(g => g.order))
    : -1;

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

  // 모든 그룹에 속한 질문들 조회 (이미지 삭제용)
  const questionsInGroups = await db.query.questions.findMany({
    where: inArray(questions.groupId, allGroupIdsToDelete),
  });

  // 질문들에서 이미지 추출 및 삭제
  if (questionsInGroups.length > 0) {
    const allImages = extractImageUrlsFromQuestions(
      questionsInGroups as Question[]
    );
    if (allImages.length > 0) {
      try {
        await deleteImagesFromR2Server(allImages);
      } catch (error) {
        console.error("그룹 삭제 시 이미지 삭제 실패:", error);
        // 이미지 삭제 실패해도 그룹 삭제는 진행
      }
    }
  }

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

  // UUID 형식인 그룹 ID만 필터링 (임시 ID는 DB에 없으므로 제외)
  const validGroupIds = groupIds.filter(id => isValidUUID(id));

  // 최상위 그룹(parentGroupId가 null인 그룹)만 순서 변경
  // 각 그룹의 order를 인덱스로 설정
  for (let i = 0; i < validGroupIds.length; i++) {
    await db
      .update(questionGroups)
      .set({ order: i, updatedAt: new Date() })
      .where(eq(questionGroups.id, validGroupIds[i]));
  }

  revalidatePath(`/admin/surveys/${surveyId}`);
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

  const maxOrder = existingQuestions.length > 0
    ? Math.max(...existingQuestions.map(q => q.order))
    : -1;

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
        console.error("질문 삭제 시 이미지 삭제 실패:", error);
        // 이미지 삭제 실패해도 질문 삭제는 진행
      }
    }
  }

  await db.delete(questions).where(eq(questions.id, questionId));
}

// 질문 순서 변경
export async function reorderQuestions(questionIds: string[]) {
  await requireAuth();

  // UUID 형식인 질문 ID만 필터링 (임시 ID는 DB에 없으므로 제외)
  const validQuestionIds = questionIds.filter(id => isValidUUID(id));

  for (let i = 0; i < validQuestionIds.length; i++) {
    await db
      .update(questions)
      .set({ order: i, updatedAt: new Date() })
      .where(eq(questions.id, validQuestionIds[i]));
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

    // 그룹 삭제 전에 DB에서 최신 그룹 정보 가져오기 (displayCondition 포함)
    const existingGroups = await db.query.questionGroups.findMany({
      where: eq(questionGroups.surveyId, surveyId),
    });

    // surveyData.groups의 displayCondition을 업데이트
    // 우선순위: 1) surveyData.groups의 값 (최신 스토어 상태) 2) DB의 값 (fallback)
    const updatedGroups = (surveyData.groups || []).map((group) => {
      const existingGroup = existingGroups.find((g) => g.id === group.id);

      // surveyData.groups에 displayCondition이 있으면 그것을 우선 사용 (최신 스토어 상태)
      if (group.displayCondition) {
        return group;
      }

      // surveyData.groups에 displayCondition이 없고, DB에 있으면 DB의 값을 사용
      if (existingGroup?.displayCondition) {
        return {
          ...group,
          displayCondition: existingGroup.displayCondition as NonNullable<SurveyType['groups']>[0]['displayCondition'],
        };
      }

      // 둘 다 없으면 그대로 반환
      return group;
    });

    // surveyData를 업데이트된 그룹으로 교체
    surveyData = {
      ...surveyData,
      groups: updatedGroups,
    };

    // 데이터 검증: questions와 groups가 배열인지 확인
    if (!Array.isArray(surveyData.questions)) {
      console.error('surveyData.questions가 배열이 아닙니다:', surveyData.questions);
      throw new Error('질문 데이터가 올바르지 않습니다.');
    }
    if (!Array.isArray(surveyData.groups)) {
      console.error('surveyData.groups가 배열이 아닙니다:', surveyData.groups);
      throw new Error('그룹 데이터가 올바르지 않습니다.');
    }

    // 기존 그룹과 질문 삭제 (새 데이터로 교체하기 위해)
    // 주의: 이 로직은 전체 삭제 후 재생성 방식이므로, surveyData에 모든 데이터가 포함되어 있어야 함
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

  // 안전장치: questions와 groups가 없으면 빈 배열로 설정
  if (!surveyData.questions) {
    surveyData.questions = [];
  }
  if (!surveyData.groups) {
    surveyData.groups = [];
  }

  // 질문 그룹 저장 (상위 그룹부터 하위 그룹 순으로 정렬하여 저장) - 질문보다 먼저 저장해야 함
  if (surveyData.groups && surveyData.groups.length > 0) {
    // 그룹을 상위 그룹부터 하위 그룹 순으로 정렬
    // 1. parentGroupId가 null인 그룹들 (최상위 그룹)을 order 순으로 정렬
    // 2. 그 다음 각 상위 그룹의 하위 그룹들을 order 순으로 정렬
    const sortedGroups: typeof surveyData.groups = [];
    const processedGroupIds = new Set<string>();

    // 최상위 그룹들 (parentGroupId가 null)을 order 순으로 정렬하여 추가
    const topLevelGroups = surveyData.groups
      .filter((g) => !g.parentGroupId)
      .sort((a, b) => a.order - b.order);
    sortedGroups.push(...topLevelGroups);
    topLevelGroups.forEach((g) => processedGroupIds.add(g.id));

    // 하위 그룹들을 재귀적으로 추가
    const addSubGroups = (parentId: string) => {
      const subGroups = (surveyData.groups || [])
        .filter((g) => g.parentGroupId === parentId && !processedGroupIds.has(g.id))
        .sort((a, b) => a.order - b.order);

      subGroups.forEach((g) => {
        sortedGroups.push(g);
        processedGroupIds.add(g.id);
        // 재귀적으로 하위 그룹 추가
        addSubGroups(g.id);
      });
    };

    // 각 최상위 그룹의 하위 그룹들을 추가
    topLevelGroups.forEach((group) => {
      addSubGroups(group.id);
    });

    // 정렬된 순서대로 그룹 저장 (클라이언트에서 제공한 UUID 그대로 사용)
    for (const group of sortedGroups) {
      await db
        .insert(questionGroups)
        .values({
          id: group.id, // 클라이언트 UUID 그대로 사용
          surveyId,
          name: group.name,
          description: group.description,
          order: group.order,
          parentGroupId: group.parentGroupId || null,
          color: group.color,
          collapsed: group.collapsed,
          displayCondition: group.displayCondition as NewQuestionGroup['displayCondition'],
        });
    }
  }

  // 질문 저장 (클라이언트에서 제공한 UUID 그대로 사용) - 그룹 저장 후에 실행
  for (const question of surveyData.questions) {
    await db
      .insert(questions)
      .values({
        id: question.id, // 클라이언트 UUID 그대로 사용
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
        noticeContent: question.noticeContent,
        requiresAcknowledgment: question.requiresAcknowledgment,
        placeholder: question.placeholder,
        tableValidationRules: question.tableValidationRules as NewQuestion['tableValidationRules'],
        displayCondition: question.displayCondition as NewQuestion['displayCondition'],
      });
  }

  revalidatePath('/admin/surveys');
  revalidatePath(`/admin/surveys/${surveyId}`);

  return { surveyId };
}
