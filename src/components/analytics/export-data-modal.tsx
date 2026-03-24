'use client';

import { useState } from 'react';

import { BarChart3, Database, FileDown, FileSpreadsheet, FileText, Loader2, Table } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function buildSafeFilename(title: string, suffix: string, ext: string): string {
  const safeName = title.replace(/[^a-zA-Z0-9가-힣\s]/g, '').slice(0, 50);
  const timestamp = new Date().toISOString().split('T')[0];
  return `${safeName}_${suffix}_${timestamp}.${ext}`;
}

interface Props {
  surveyId: string;
  surveyTitle: string;
  onExportCompactExcel?: () => Promise<Blob | null>;
  onExportSpssExcel?: () => Promise<Blob | null>;
}

export function ExportDataModal({
  surveyId,
  surveyTitle,
  onExportCompactExcel,
  onExportSpssExcel,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [exportingType, setExportingType] = useState<string | null>(null);

  const handleExport = async (type: string) => {
    try {
      setExportingType(type);

      if (type === 'compact' && onExportCompactExcel) {
        const blob = await onExportCompactExcel();
        if (!blob) { alert('내보낼 데이터가 없습니다.'); return; }
        downloadBlob(blob, buildSafeFilename(surveyTitle, 'Compact', 'xlsx'));
      } else if (type === 'spss' && onExportSpssExcel) {
        const blob = await onExportSpssExcel();
        if (!blob) { alert('내보낼 데이터가 없습니다.'); return; }
        downloadBlob(blob, buildSafeFilename(surveyTitle, 'SPSS', 'xlsx'));
      } else {
        // Server-side API Export
        const response = await fetch(`/api/surveys/${surveyId}/export?type=${type}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.error || '내보내기에 실패했습니다.');
        }

        const blob = await response.blob();
        const contentDisposition = response.headers.get('Content-Disposition');
        const ext = type === 'sav' ? 'sav' : 'xlsx';
        let filename = buildSafeFilename(surveyTitle, 'Export', ext);
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
          if (filenameMatch) filename = decodeURIComponent(filenameMatch[1]);
        }
        downloadBlob(blob, filename);
      }

      // 다운로드 후 모달 닫기 여부는 선택사항 (연속 다운로드를 위해 유지)
    } catch (error) {
      console.error('Export error:', error);
      alert(error instanceof Error ? error.message : '데이터 내보내기 중 오류가 발생했습니다.');
    } finally {
      setExportingType(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          엑셀 다운로드
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>데이터 내보내기</DialogTitle>
          <DialogDescription>원하는 데이터 형식을 선택하여 다운로드하세요.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 py-4">
          {/* 1. 통계 분석용 (Legacy/Flat) */}
          <ExportCard
            title="통계 분석용 (Legacy)"
            description="모든 응답을 하나의 시트에 모읍니다. SPSS/SAS 등 통계 패키지 분석이나 피벗 테이블 생성에 최적화된 형식입니다."
            icon={<Table className="h-5 w-5 text-blue-600" />}
            isLoading={exportingType === 'raw-all'}
            disabled={!!exportingType}
            onClick={() => handleExport('raw-all')}
          />

          {/* 2. SPSS 호환 형식 */}
          {onExportSpssExcel && (
            <ExportCard
              title="SPSS 호환 형식"
              description="복수응답을 옵션별 독립 변수로 분리하고, 값을 숫자 코딩한 SPSS 통계 분석용 형식입니다. 코딩북 시트가 포함됩니다."
              icon={<Database className="h-5 w-5 text-purple-600" />}
              isLoading={exportingType === 'spss'}
              disabled={!!exportingType}
              onClick={() => handleExport('spss')}
            />
          )}

          {/* SPSS .sav 네이티브 파일 */}
          <ExportCard
            title="SPSS .sav 파일"
            description="SPSS에서 바로 열 수 있는 네이티브 파일입니다. 변수 라벨, 값 라벨, 측정 수준이 포함됩니다."
            icon={<FileDown className="h-5 w-5 text-red-600" />}
            isLoading={exportingType === 'sav'}
            disabled={!!exportingType}
            onClick={() => handleExport('sav')}
          />

          {/* 3. 데이터 확인용 (Compact) */}
          {onExportCompactExcel && (
            <ExportCard
              title="데이터 확인용 (Compact)"
              description="사람이 보기 편한 간결한 형식입니다. 불필요한 코드를 줄이고 가독성을 높였습니다."
              icon={<FileSpreadsheet className="h-5 w-5 text-indigo-600" />}
              isLoading={exportingType === 'compact'}
              disabled={!!exportingType}
              onClick={() => handleExport('compact')}
            />
          )}

          {/* 3. 응답별 상세 보기 (Individual) */}
          <ExportCard
            title="응답별 상세 보기 (Individual)"
            description="응답자별로 시트를 나누어 상세 내용을 확인합니다. 설문지와 동일한 형태로 시각화되어 가독성이 좋습니다."
            icon={<FileSpreadsheet className="h-5 w-5 text-green-600" />}
            isLoading={exportingType === 'raw-individual'}
            disabled={!!exportingType}
            onClick={() => handleExport('raw-individual')}
          />

          {/* 4. 요약 리포트 (Summary) */}
          <ExportCard
            title="요약 리포트 (Summary)"
            description="문항별 응답 빈도와 비율(%)이 계산된 요약 리포트입니다."
            icon={<BarChart3 className="h-5 w-5 text-orange-600" />}
            isLoading={exportingType === 'summary'}
            disabled={!!exportingType}
            onClick={() => handleExport('summary')}
          />

          {/* 5. 코딩북 (Variable Map) */}
          <ExportCard
            title="코딩북 (Variable Map)"
            description="설문 문항 ID, 라벨, 보기 값 등에 대한 변수 정의서입니다."
            icon={<FileText className="h-5 w-5 text-gray-600" />}
            isLoading={exportingType === 'map'}
            disabled={!!exportingType}
            onClick={() => handleExport('map')}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ExportCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  isLoading: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ExportCard({ title, description, icon, isLoading, disabled, onClick }: ExportCardProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-slate-50">
      <div className="flex items-start gap-4">
        <div className="mt-1 rounded-md border bg-white p-2 shadow-sm">{icon}</div>
        <div className="space-y-1">
          <h4 className="text-sm leading-none font-semibold">{title}</h4>
          <p className="text-muted-foreground pr-4 text-sm">{description}</p>
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={onClick} disabled={isLoading || disabled}>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '다운로드'}
      </Button>
    </div>
  );
}
