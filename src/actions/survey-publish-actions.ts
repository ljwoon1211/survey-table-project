'use server';

import { revalidatePath } from 'next/cache';

import { and, desc, eq } from 'drizzle-orm';

import { getSurveyWithDetails } from '@/data/surveys';
import { db } from '@/db';
import { surveys, surveyVersions } from '@/db/schema';
import { requireAuth } from '@/lib/auth';
import { buildSurveySnapshot } from '@/lib/versioning/snapshot-builder';

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
