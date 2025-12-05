"use client";

import { useState } from "react";
import { Card, Button } from "@tremor/react";
import { Download, FileJson, FileSpreadsheet, Loader2 } from "lucide-react";

interface ExportPanelProps {
  surveyId: string;
  onExportJson: () => Promise<string>;
  onExportCsv: () => Promise<string>;
  surveyTitle?: string;
}

export function ExportPanel({
  surveyId,
  onExportJson,
  onExportCsv,
  surveyTitle = "survey",
}: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState<"json" | "csv" | null>(null);

  const handleExport = async (format: "json" | "csv") => {
    setIsExporting(format);
    try {
      const data = format === "json" ? await onExportJson() : await onExportCsv();

      if (!data) {
        alert("내보낼 데이터가 없습니다.");
        return;
      }

      const blob = new Blob([data], {
        type: format === "json" ? "application/json" : "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // 파일명에서 특수문자 제거
      const safeName = surveyTitle.replace(/[^a-zA-Z0-9가-힣\s]/g, "").slice(0, 50);
      const timestamp = new Date().toISOString().split("T")[0];
      link.download = `${safeName}_응답_${timestamp}.${format}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
      alert("내보내기 중 오류가 발생했습니다.");
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-gray-500" />
          <span className="font-medium text-gray-900">데이터 내보내기</span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={isExporting === "csv" ? Loader2 : FileSpreadsheet}
            onClick={() => handleExport("csv")}
            disabled={isExporting !== null}
            className={isExporting === "csv" ? "animate-pulse" : ""}
          >
            CSV
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={isExporting === "json" ? Loader2 : FileJson}
            onClick={() => handleExport("json")}
            disabled={isExporting !== null}
            className={isExporting === "json" ? "animate-pulse" : ""}
          >
            JSON
          </Button>
        </div>
      </div>
    </Card>
  );
}
