'use client';

import { useState } from 'react';
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
import { Loader2, FileSpreadsheet, FileText, Table, BarChart3 } from 'lucide-react';

interface Props {
  surveyId: string;
  surveyTitle: string;
}

export function ExportDataModal({ surveyId, surveyTitle }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [exportingType, setExportingType] = useState<string | null>(null);

  const handleExport = async (type: string) => {
    try {
      setExportingType(type);
      
      // API 호출 (파일 다운로드 트리거)
      const response = await fetch(`/api/surveys/${surveyId}/export?type=${type}`);
      
      if (!response.ok) throw new Error('Export failed');

      // Blob 변환 및 다운로드 링크 생성
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // 파일명 설정 (헤더에서 가져오거나 기본값 사용)
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${surveyTitle}_Export.xlsx`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1]);
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // 다운로드 후 모달 닫기 여부는 선택사항 (연속 다운로드를 위해 유지)
    } catch (error) {
      console.error('Export error:', error);
      alert('데이터 내보내기 중 오류가 발생했습니다.');
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
          <DialogDescription>
            원하는 데이터 형식을 선택하여 다운로드하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 py-4">
          
          {/* 1. Raw Data (통합) */}
          <ExportCard
            title="Raw Data (통합)"
            description="모든 응답 데이터를 하나의 시트에 모아봅니다. 통계 패키지(SPSS, R 등) 분석이나 피벗 테이블 생성에 적합합니다."
            icon={<Table className="h-5 w-5 text-blue-600" />}
            isLoading={exportingType === 'raw-all'}
            onClick={() => handleExport('raw-all')}
          />

          {/* 2. Raw Data (개별) */}
          <ExportCard
            title="Raw Data (개별)"
            description="응답자별로 시트를 나누어 상세 내용을 확인합니다. 테이블형 문항이 설문지와 동일한 형태로 시각화되어 가독성이 좋습니다."
            icon={<FileSpreadsheet className="h-5 w-5 text-green-600" />}
            isLoading={exportingType === 'raw-individual'}
            onClick={() => handleExport('raw-individual')}
          />

          {/* 3. Summary */}
          <ExportCard
            title="Summary Report"
            description="문항별 응답 빈도와 비율(%)이 계산된 요약 리포트입니다."
            icon={<BarChart3 className="h-5 w-5 text-orange-600" />}
            isLoading={exportingType === 'summary'}
            onClick={() => handleExport('summary')}
          />

          {/* 4. Variable Map */}
          <ExportCard
            title="Variable Map"
            description="설문 문항 ID, 라벨, 보기 값 등에 대한 변수 정의서입니다."
            icon={<FileText className="h-5 w-5 text-gray-600" />}
            isLoading={exportingType === 'map'}
            onClick={() => handleExport('map')}
          />

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>닫기</Button>
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
  onClick: () => void;
}

function ExportCard({ title, description, icon, isLoading, onClick }: ExportCardProps) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
      <div className="flex items-start gap-4">
        <div className="mt-1 p-2 bg-white border rounded-md shadow-sm">
          {icon}
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold leading-none">{title}</h4>
          <p className="text-sm text-muted-foreground pr-4">
            {description}
          </p>
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={onClick} disabled={isLoading}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          '다운로드'
        )}
      </Button>
    </div>
  );
}
