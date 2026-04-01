'use server';

import { revalidatePath } from 'next/cache';

import { eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { NewSavedCell, savedCells } from '@/db/schema';
import { requireAuth } from '@/lib/auth';
import type { TableCell } from '@/types/survey';
import { sanitizeCellForLibrary } from '@/utils/cell-library-helpers';

// ========================
// 셀 보관함 변경 액션 (Mutations)
// ========================

// 셀 저장
export async function saveCellAction(cell: TableCell, name: string) {
  await requireAuth();

  const sanitizedCell = sanitizeCellForLibrary(cell);

  const newSavedCell: NewSavedCell = {
    cell: sanitizedCell as NewSavedCell['cell'],
    name,
    cellType: cell.type,
    usageCount: 0,
  };

  const [saved] = await db.insert(savedCells).values(newSavedCell).returning();
  revalidatePath('/admin/surveys');
  return saved;
}

// 셀 삭제
export async function deleteSavedCellAction(id: string) {
  await requireAuth();

  await db.delete(savedCells).where(eq(savedCells.id, id));
  revalidatePath('/admin/surveys');
}

// 셀 사용 (usageCount 원자적 증가 + cell 데이터 반환)
export async function applySavedCellAction(id: string) {
  await requireAuth();

  const [updated] = await db
    .update(savedCells)
    .set({
      usageCount: sql`${savedCells.usageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(savedCells.id, id))
    .returning();

  if (!updated) return null;

  return updated.cell as unknown as Partial<TableCell>;
}
