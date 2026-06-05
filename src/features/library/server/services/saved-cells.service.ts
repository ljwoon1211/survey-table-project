import 'server-only';

import { desc, eq, ilike, sql } from 'drizzle-orm';

import { db } from '@/db';
import { NewSavedCell, savedCells } from '@/db/schema/surveys';
import type { SavedCell, TableCell } from '@/types/survey';
import { sanitizeCellForLibrary } from '@/utils/cell-library-helpers';

import type { CreateSavedCellInput } from '../../domain/saved-cell';

// drizzle $inferSelect row -> domain SavedCell 명시 변환.
// 모든 컬럼이 NOT NULL이라 null-coalescing은 불필요하나, as unknown as 세탁 대신
// 명시 매퍼로 필드를 1:1 복사한다. cell은 스키마에서 이미 TableCell로 $type 지정됨.
function toDomainSavedCell(row: typeof savedCells.$inferSelect): SavedCell {
  return {
    id: row.id,
    cell: row.cell,
    name: row.name,
    cellType: row.cellType as TableCell['type'],
    usageCount: row.usageCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ========================
// 쿼리
// ========================

/** 모든 저장된 셀 조회 (최근 수정순) */
export async function listSavedCells(): Promise<SavedCell[]> {
  const rows = await db.query.savedCells.findMany({
    orderBy: [desc(savedCells.updatedAt)],
  });
  return rows.map(toDomainSavedCell);
}

/** 셀 이름 검색 */
export async function searchSavedCells(query: string): Promise<SavedCell[]> {
  const rows = await db.query.savedCells.findMany({
    where: ilike(savedCells.name, `%${query}%`),
    orderBy: [desc(savedCells.updatedAt)],
  });
  return rows.map(toDomainSavedCell);
}

// ========================
// 뮤테이션
// ========================

/** 셀 저장 — 위치/이미지/메타 필드를 제거(sanitize)한 뒤 insert */
export async function createSavedCell(input: CreateSavedCellInput): Promise<SavedCell> {
  const sanitizedCell = sanitizeCellForLibrary(input.cell);

  const newSavedCell: NewSavedCell = {
    cell: sanitizedCell as NewSavedCell['cell'],
    name: input.name,
    cellType: input.cell.type,
    usageCount: 0,
  };

  const [saved] = await db.insert(savedCells).values(newSavedCell).returning();
  if (!saved) throw new Error('셀 저장에 실패했습니다.');
  return toDomainSavedCell(saved);
}

/** 저장된 셀 삭제 */
export async function deleteSavedCell(id: string): Promise<void> {
  await db.delete(savedCells).where(eq(savedCells.id, id));
}

/**
 * 셀 사용 — usageCount 원자적 증가 후 sanitize된 셀 데이터(Partial)를 반환.
 * 존재하지 않는 id면 null 반환.
 */
export async function applySavedCell(id: string): Promise<Partial<TableCell> | null> {
  const [updated] = await db
    .update(savedCells)
    .set({
      usageCount: sql`${savedCells.usageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(savedCells.id, id))
    .returning();

  if (!updated) return null;

  return updated.cell;
}
