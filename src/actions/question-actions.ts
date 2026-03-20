'use server';

import { revalidatePath } from 'next/cache';

import { eq, inArray } from 'drizzle-orm';

import { getQuestionsBySurvey } from '@/data/surveys';
import { db } from '@/db';
import { NewQuestion, questions } from '@/db/schema';
import { requireAuth } from '@/lib/auth';
import { extractImageUrlsFromQuestion } from '@/lib/image-extractor';
import { deleteImagesFromR2Server } from '@/lib/image-utils-server';
import { generateId, isValidUUID } from '@/lib/utils';
import type { Question, Question as QuestionType } from '@/types/survey';

// ========================
// 질문 변경 액션 (Mutations)
// ========================

// 질문 생성
export async function createQuestion(data: {
  surveyId: string;
  id?: string;
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

  const existingQuestions = await getQuestionsBySurvey(data.surveyId);

  const maxOrder =
    existingQuestions.length > 0 ? Math.max(...existingQuestions.map((q) => q.order)) : -1;

  const newQuestion: NewQuestion = {
    id: data.id || generateId(),
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
    const newOrder = index + 1;
    const currentOrder = currentOrderMap.get(id);

    if (currentOrder !== newOrder) {
      updates.push(
        db
          .update(questions)
          .set({ order: newOrder, updatedAt: new Date() })
          .where(eq(questions.id, id)),
      );
    }
  });

  if (updates.length > 0) {
    await Promise.all(updates);
  }
}
