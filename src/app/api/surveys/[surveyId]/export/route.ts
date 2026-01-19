import { NextRequest, NextResponse } from 'next/server';

import { eq } from 'drizzle-orm';
import * as XLSX from 'xlsx';

import { db } from '@/db';
import { surveyResponses, surveys } from '@/db/schema';
import {
  generateExcelWorkbook,
  generateRawDataCombinedWorkbook,
  generateRawDataIndividualWorkbook,
  generateSummaryWorkbook,
  generateVariableMapWorkbook,
} from '@/lib/excel-transformer';
import { Survey, SurveyResponse, SurveySubmission } from '@/types/survey';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> },
) {
  try {
    const { surveyId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const include = searchParams.get('include') || '';

    // 1. 설문 데이터 조회
    const surveyData = await db.query.surveys.findFirst({
      where: eq(surveys.id, surveyId),
      with: {
        questions: true,
      },
    });

    if (!surveyData) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    // 2. 응답 데이터 조회
    // Variable Map만 다운로드할 때는 응답 데이터가 필요 없지만,
    // 로직 단순화를 위해 일단 조회 (성능 이슈 시 최적화 가능)
    const responses = await db.query.surveyResponses.findMany({
      where: eq(surveyResponses.surveyId, surveyId),
      orderBy: (responses, { desc }) => [desc(responses.createdAt)],
    });

    // 3. 엑셀 워크북 생성
    let workbook: XLSX.WorkBook;
    let filenamePrefix = 'Export';

    // Type에 따른 분기 처리
    if (type === 'raw-all') {
      workbook = generateRawDataCombinedWorkbook(
        surveyData as unknown as Survey,
        responses as unknown as SurveySubmission[],
      );
      filenamePrefix = 'RawData_Combined';
    } else if (type === 'raw-individual') {
      workbook = generateRawDataIndividualWorkbook(
        surveyData as unknown as Survey,
        responses as unknown as SurveySubmission[],
      );
      filenamePrefix = 'RawData_Individual';
    } else if (type === 'summary') {
      workbook = generateSummaryWorkbook(
        surveyData as unknown as Survey,
        responses as unknown as SurveySubmission[],
      );
      filenamePrefix = 'Summary';
    } else if (type === 'map') {
      workbook = generateVariableMapWorkbook(surveyData as unknown as Survey);
      filenamePrefix = 'VariableMap';
    } else {
      // Legacy support (include param)
      const options = {
        includeRawData: include.includes('raw'),
        includeSummary: include.includes('summary'),
        includeVariableMap: include.includes('map'),
        includeVerbatim: include.includes('verbatim'),
      };
      workbook = generateExcelWorkbook(
        surveyData as unknown as Survey,
        responses as unknown as SurveySubmission[],
        options,
      );
    }

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // 4. 응답 생성
    const filename = `${encodeURIComponent(surveyData.title)}_${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (error) {
    console.error('Export Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
