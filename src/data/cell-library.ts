import { desc, ilike } from 'drizzle-orm';

import { db } from '@/db';
import { savedCells } from '@/db/schema';
import type { SavedCell } from '@/types/survey';

// ========================
// 셀 보관함 조회 함수
// ========================

// 모든 저장된 셀 조회
export async function getAllSavedCells() {
  const cells = await db.query.savedCells.findMany({
    orderBy: [desc(savedCells.updatedAt)],
  });
  return cells as unknown as SavedCell[];
}

// 셀 이름 검색
export async function searchSavedCells(query: string) {
  const cells = await db.query.savedCells.findMany({
    where: ilike(savedCells.name, `%${query}%`),
    orderBy: [desc(savedCells.updatedAt)],
  });
  return cells as unknown as SavedCell[];
}
