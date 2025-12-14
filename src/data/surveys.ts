import { db } from '@/db';
import { surveys, questions, questionGroups } from '@/db/schema';
import { eq, desc, ilike, and, gte, lte } from 'drizzle-orm';
import type { Survey as SurveyType, Question as QuestionType } from '@/types/survey';

// ========================
// 설문 조회 함수
// ========================

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

// ========================
// 질문 그룹 조회 함수
// ========================

// 설문의 질문 그룹 조회
export async function getQuestionGroupsBySurvey(surveyId: string) {
  const groups = await db.query.questionGroups.findMany({
    where: eq(questionGroups.surveyId, surveyId),
    orderBy: [questionGroups.order],
  });
  return groups;
}

// ========================
// 질문 조회 함수
// ========================

// 설문의 질문 조회
export async function getQuestionsBySurvey(surveyId: string) {
  const result = await db.query.questions.findMany({
    where: eq(questions.surveyId, surveyId),
    orderBy: [questions.order],
  });
  return result;
}

// ========================
// 복합 조회 함수
// ========================

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
