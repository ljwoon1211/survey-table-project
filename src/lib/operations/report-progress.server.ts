import 'server-only';

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { surveys } from '@/db/schema/surveys';
import type { ProgressColumnScheme } from '@/db/schema/schema-types';

const EMPTY_SCHEME: ProgressColumnScheme = { version: 1, columns: [] };

/**
 * `surveys.progress_columns` 가져오기. NULL → 빈 스킴 (4개 고정 컬럼만).
 */
export async function getProgressColumnScheme(surveyId: string): Promise<ProgressColumnScheme> {
  const rows = await db
    .select({ progressColumns: surveys.progressColumns })
    .from(surveys)
    .where(eq(surveys.id, surveyId))
    .limit(1);
  const scheme = rows[0]?.progressColumns;
  return scheme ?? EMPTY_SCHEME;
}
