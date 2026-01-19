'use server';

/**
 * 클라이언트에서 호출 가능한 조회용 Server Actions
 *
 * 주의: 이 파일의 함수들은 TanStack Query에서 사용하기 위한 것입니다.
 * Server Component에서는 @/data/* 함수들을 직접 사용하세요.
 */
import * as libraryData from '@/data/library';
import * as responseData from '@/data/responses';
import * as surveyData from '@/data/surveys';

// ========================
// Survey 조회
// ========================

export async function getSurveys() {
  return surveyData.getSurveys();
}

export async function getSurveyById(surveyId: string) {
  return surveyData.getSurveyById(surveyId);
}

export async function getSurveyBySlug(slug: string) {
  return surveyData.getSurveyBySlug(slug);
}

export async function getSurveyByPrivateToken(token: string) {
  return surveyData.getSurveyByPrivateToken(token);
}

export async function isSlugAvailable(slug: string, excludeSurveyId?: string) {
  return surveyData.isSlugAvailable(slug, excludeSurveyId);
}

export async function searchSurveys(query: string) {
  return surveyData.searchSurveys(query);
}

export async function getSurveysByDateRange(startDate: Date, endDate: Date) {
  return surveyData.getSurveysByDateRange(startDate, endDate);
}

export async function getQuestionGroupsBySurvey(surveyId: string) {
  return surveyData.getQuestionGroupsBySurvey(surveyId);
}

export async function getQuestionsBySurvey(surveyId: string) {
  return surveyData.getQuestionsBySurvey(surveyId);
}

export async function getSurveyWithDetails(surveyId: string) {
  return surveyData.getSurveyWithDetails(surveyId);
}

export async function getSurveyListWithCounts() {
  return surveyData.getSurveyListWithCounts();
}

// ========================
// Response 조회
// ========================

export async function getResponsesBySurvey(surveyId: string) {
  return responseData.getResponsesBySurvey(surveyId);
}

export async function getCompletedResponses(surveyId: string) {
  return responseData.getCompletedResponses(surveyId);
}

export async function getResponseById(responseId: string) {
  return responseData.getResponseById(responseId);
}

export async function getResponseCountBySurvey(surveyId: string) {
  return responseData.getResponseCountBySurvey(surveyId);
}

export async function getCompletedResponseCountBySurvey(surveyId: string) {
  return responseData.getCompletedResponseCountBySurvey(surveyId);
}

export async function calculateResponseSummary(surveyId: string) {
  return responseData.calculateResponseSummary(surveyId);
}

export async function getQuestionStatistics(surveyId: string, questionId: string) {
  return responseData.getQuestionStatistics(surveyId, questionId);
}

export async function exportResponsesAsJson(surveyId: string) {
  return responseData.exportResponsesAsJson(surveyId);
}

export async function exportResponsesAsCsv(surveyId: string) {
  return responseData.exportResponsesAsCsv(surveyId);
}

// ========================
// Library 조회
// ========================

export async function getAllSavedQuestions() {
  return libraryData.getAllSavedQuestions();
}

export async function getQuestionsByCategory(category: string) {
  return libraryData.getQuestionsByCategory(category);
}

export async function searchSavedQuestions(query: string) {
  return libraryData.searchSavedQuestions(query);
}

export async function getRecentlyUsedQuestions(limit?: number) {
  return libraryData.getRecentlyUsedQuestions(limit);
}

export async function getMostUsedQuestions(limit?: number) {
  return libraryData.getMostUsedQuestions(limit);
}

export async function getAllTags() {
  return libraryData.getAllTags();
}

export async function getQuestionsByTag(tag: string) {
  return libraryData.getQuestionsByTag(tag);
}

export async function getAllCategories() {
  return libraryData.getAllCategories();
}
