'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { ingestContactUpload, parseExcelPreview } from '@/actions/contact-actions';
import type { ParseExcelPreviewResult } from '@/actions/contact-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ContactUploadMapping } from '@/db/schema/schema-types';

type Step = 'file' | 'mapping' | 'result';

interface UploadWizardProps {
  surveyId: string;
}

interface MappingState {
  groupCol: number | null;
  emailCol: number | null;
  bizCol: number | null;
  companyCol: number | null;
  phoneCol: number | null;
  mergeKey: 'email+biz' | 'email' | 'biz';
  mergeKeyPolicy: 'either' | 'both';
}

const initialMapping: MappingState = {
  groupCol: null,
  emailCol: null,
  bizCol: null,
  companyCol: null,
  phoneCol: null,
  mergeKey: 'email+biz',
  mergeKeyPolicy: 'either',
};

export function UploadWizard({ surveyId }: UploadWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('file');
  const [file, setFile] = useState<File | null>(null);
  const [headerRow, setHeaderRow] = useState(2);
  const [sheetName, setSheetName] = useState<string>('');
  const [preview, setPreview] = useState<ParseExcelPreviewResult | null>(null);
  const [mapping, setMapping] = useState<MappingState>(initialMapping);
  const [result, setResult] = useState<{
    uploadedRows: number;
    mergedRows: number;
    errorRows: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handlePreview() {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await parseExcelPreview({ file, sheetName, headerRow });
        setPreview(r);
        if (!sheetName && r.sheetNames.length > 0) setSheetName(r.sheetNames[0]);
        setStep('mapping');
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  async function handleIngest() {
    if (!file || !preview || mapping.groupCol == null) return;
    setError(null);
    startTransition(async () => {
      try {
        const m: ContactUploadMapping = {
          systemFields: {
            group: mapping.groupCol!,
            email: mapping.emailCol ?? undefined,
            biz: mapping.bizCol ?? undefined,
            company: mapping.companyCol ?? undefined,
            phone: mapping.phoneCol ?? undefined,
          },
          mergeKey: mapping.mergeKey,
          mergeKeyPolicy: mapping.mergeKeyPolicy,
          headerRow,
          sheetName,
        };
        const r = await ingestContactUpload({ surveyId, file, mapping: m });
        setResult({
          uploadedRows: r.uploadedRows,
          mergedRows: r.mergedRows,
          errorRows: r.errorRows,
        });
        setStep('result');
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          엑셀 컨택 업로드 —{' '}
          {step === 'file' ? '1/3 파일' : step === 'mapping' ? '2/3 매핑' : '3/3 결과'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {step === 'file' && (
          <div className="space-y-3">
            <Label htmlFor="excel-file">엑셀 파일 .xlsx 최대 10MB · 5,000행</Label>
            <input
              id="excel-file"
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
            <div className="flex items-center gap-3">
              <Label>헤더 행 1-based</Label>
              <input
                type="number"
                min={1}
                max={10}
                value={headerRow}
                onChange={(e) => setHeaderRow(parseInt(e.target.value, 10) || 1)}
                className="w-20 rounded border px-2 py-1 text-sm"
              />
              <span className="text-xs text-slate-500">병합 타이틀이 1행이면 디폴트 2 권장</span>
            </div>
            <Button disabled={!file || isPending} onClick={handlePreview}>
              {isPending ? '파싱 중…' : '미리보기'}
            </Button>
          </div>
        )}

        {step === 'mapping' && preview && (
          <div className="space-y-4">
            {preview.sheetNames.length > 1 && (
              <div className="flex items-center gap-3">
                <Label>시트 선택</Label>
                <Select
                  value={sheetName}
                  onValueChange={(v) => {
                    setSheetName(v);
                    setPreview(null);
                    setStep('file');
                  }}
                >
                  <SelectTrigger className="w-60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {preview.sheetNames.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="text-xs text-slate-500">
              총 {preview.totalRows.toLocaleString('ko-KR')} 행 — 미리보기 5행:
            </div>
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {preview.headers.map((h, i) => (
                      <th key={i} className="border-b px-2 py-1 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, ri) => (
                    <tr key={ri}>
                      {preview.headers.map((h, ci) => (
                        <td key={ci} className="border-b px-2 py-1">
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(['groupCol', 'emailCol', 'bizCol', 'companyCol', 'phoneCol'] as const).map(
                (field) => {
                  const labelMap: Record<typeof field, string> = {
                    groupCol: '그룹 *',
                    emailCol: '이메일',
                    bizCol: '사업자번호',
                    companyCol: '기업명',
                    phoneCol: '전화',
                  };
                  return (
                    <div key={field} className="flex flex-col gap-1">
                      <Label className="text-xs">{labelMap[field]}</Label>
                      <Select
                        value={mapping[field]?.toString() ?? '_none'}
                        onValueChange={(v) =>
                          setMapping((m) => ({
                            ...m,
                            [field]: v === '_none' ? null : parseInt(v, 10),
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="매핑 안 함" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">매핑 안 함</SelectItem>
                          {preview.headers.map((h, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                },
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">머지키</Label>
                <Select
                  value={mapping.mergeKey}
                  onValueChange={(v) =>
                    setMapping((m) => ({
                      ...m,
                      mergeKey: v as 'email+biz' | 'email' | 'biz',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email+biz">이메일 + 사업자번호</SelectItem>
                    <SelectItem value="email">이메일만</SelectItem>
                    <SelectItem value="biz">사업자번호만</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">머지 정책 — email+biz 일 때만 적용</Label>
                <Select
                  value={mapping.mergeKeyPolicy}
                  onValueChange={(v) =>
                    setMapping((m) => ({
                      ...m,
                      mergeKeyPolicy: v as 'either' | 'both',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="either">한쪽이라도 있으면 매칭</SelectItem>
                    <SelectItem value="both">둘 다 필수</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button disabled={mapping.groupCol == null || isPending} onClick={handleIngest}>
              {isPending
                ? '적재 중…'
                : `${preview.totalRows.toLocaleString('ko-KR')} 행 적재 시작`}
            </Button>
            {mapping.groupCol == null && (
              <div className="text-xs text-amber-700">그룹 컬럼은 필수입니다.</div>
            )}
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-3">
            <div className="rounded border bg-slate-50 p-4 text-sm">
              <div>
                신규 적재: <strong>{result.uploadedRows.toLocaleString('ko-KR')}</strong> 행
              </div>
              <div>
                머지 갱신: <strong>{result.mergedRows.toLocaleString('ko-KR')}</strong> 행
              </div>
              <div>
                에러:{' '}
                <strong className={result.errorRows > 0 ? 'text-red-600' : ''}>
                  {result.errorRows.toLocaleString('ko-KR')}
                </strong>{' '}
                행
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  router.push(`/admin/surveys/${surveyId}/operations/contacts`)
                }
              >
                컨택리스트 보기
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('file');
                  setFile(null);
                  setPreview(null);
                  setResult(null);
                }}
              >
                다른 파일 업로드
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
