import { db } from '@/db';
import { savedQuestions, questionCategories } from '@/db/schema';
import { eq, desc, ilike, or } from 'drizzle-orm';

// ========================
// 질문 보관함 조회 함수
// ========================

// 모든 저장된 질문 조회
export async function getAllSavedQuestions() {
  const questions = await db.query.savedQuestions.findMany({
    orderBy: [desc(savedQuestions.updatedAt)],
  });
  return questions;
}

// 카테고리별 질문 조회
export async function getQuestionsByCategory(category: string) {
  const questions = await db.query.savedQuestions.findMany({
    where: eq(savedQuestions.category, category),
    orderBy: [desc(savedQuestions.updatedAt)],
  });
  return questions;
}

// 질문 검색
export async function searchSavedQuestions(query: string) {
  const questions = await db.query.savedQuestions.findMany({
    where: or(
      ilike(savedQuestions.name, `%${query}%`),
      ilike(savedQuestions.description, `%${query}%`)
    ),
    orderBy: [desc(savedQuestions.updatedAt)],
  });
  return questions;
}

// 최근 사용 질문 조회
export async function getRecentlyUsedQuestions(limit: number = 5) {
  const questions = await db.query.savedQuestions.findMany({
    orderBy: [desc(savedQuestions.updatedAt)],
    limit,
  });
  return questions.filter(q => q.usageCount > 0);
}

// 가장 많이 사용된 질문 조회
export async function getMostUsedQuestions(limit: number = 5) {
  const questions = await db.query.savedQuestions.findMany({
    orderBy: [desc(savedQuestions.usageCount)],
    limit,
  });
  return questions;
}

// 모든 태그 조회
export async function getAllTags() {
  const questions = await db.query.savedQuestions.findMany();
  const tagSet = new Set<string>();

  questions.forEach(q => {
    const tags = q.tags as string[] | null;
    if (tags) {
      tags.forEach(tag => tagSet.add(tag));
    }
  });

  return Array.from(tagSet).sort();
}

// 태그로 질문 조회
export async function getQuestionsByTag(tag: string) {
  const questions = await db.query.savedQuestions.findMany();
  return questions.filter(q => {
    const tags = q.tags as string[] | null;
    return tags?.includes(tag);
  });
}

// ========================
// 카테고리 조회 함수
// ========================

// 모든 카테고리 조회
export async function getAllCategories() {
  const categories = await db.query.questionCategories.findMany({
    orderBy: [questionCategories.order],
  });
  return categories;
}
