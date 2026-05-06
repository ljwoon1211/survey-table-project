'use server';

import { requireAuth } from '@/lib/auth';
import { previewExcel } from '@/lib/contacts/excel-parser';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 5000;

function ensureXlsx(file: File): void {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('xlsx 파일만 업로드할 수 있습니다.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`파일 크기가 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB 를 초과합니다.`);
  }
}

export interface ParseExcelPreviewInput {
  file: File;
  sheetName?: string;
  headerRow?: number;
}

export interface ParseExcelPreviewResult {
  sheetNames: string[];
  headers: string[];
  rows: Array<Record<string, string>>;
  totalRows: number;
}

/**
 * 매핑 모달용 미리보기. admin 인증 필수.
 */
export async function parseExcelPreview(
  input: ParseExcelPreviewInput,
): Promise<ParseExcelPreviewResult> {
  await requireAuth();
  ensureXlsx(input.file);

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const result = await previewExcel(buffer, {
    sheetName: input.sheetName ?? '',
    headerRow: input.headerRow ?? 1,
    maxRows: 5,
  });

  if (result.totalRows > MAX_ROWS) {
    throw new Error(
      `최대 ${MAX_ROWS.toLocaleString('ko-KR')} 행까지 적재 가능합니다 (현재 ${result.totalRows.toLocaleString('ko-KR')} 행).`,
    );
  }

  return {
    sheetNames: result.sheetNames,
    headers: result.headers,
    rows: result.rows,
    totalRows: result.totalRows,
  };
}
