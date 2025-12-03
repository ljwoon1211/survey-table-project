"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSavedQuestions, useExportLibrary, useImportLibrary } from "@/hooks/queries/use-library";
import { Download, Upload, Copy, Check, FileJson, AlertCircle } from "lucide-react";

interface ImportExportLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportExportLibraryModal({ open, onOpenChange }: ImportExportLibraryModalProps) {
  // TanStack Query 훅 사용
  const { data: savedQuestions = [] } = useSavedQuestions();
  const exportLibraryMutation = useExportLibrary();
  const importLibraryMutation = useImportLibrary();

  const [activeTab, setActiveTab] = useState<"export" | "import">("export");
  const [exportData, setExportData] = useState("");
  const [importData, setImportData] = useState("");
  const [importError, setImportError] = useState("");
  const [copied, setCopied] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      const data = await exportLibraryMutation.mutateAsync();
      setExportData(data);
    } catch (error) {
      console.error("Failed to export:", error);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(exportData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([exportData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `question-library-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    setImportError("");
    setImportSuccess(false);

    if (!importData.trim()) {
      setImportError("가져올 데이터를 입력해주세요.");
      return;
    }

    try {
      const result = await importLibraryMutation.mutateAsync(importData);
      if (result.success) {
        setImportSuccess(true);
        setImportData("");
        setTimeout(() => {
          setImportSuccess(false);
          onOpenChange(false);
        }, 1500);
      } else {
        setImportError("유효하지 않은 데이터입니다.");
      }
    } catch (error) {
      setImportError("유효하지 않은 데이터입니다.");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setImportData(content);
    };
    reader.onerror = () => {
      setImportError("파일을 읽는 중 오류가 발생했습니다.");
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-blue-600" />
            보관함 내보내기 / 가져오기
          </DialogTitle>
          <DialogDescription>
            보관함의 질문을 JSON 파일로 내보내거나 가져올 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "export" | "import")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              내보내기
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              가져오기
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="bg-gray-50 rounded-lg p-3 border">
              <p className="text-sm text-gray-600">
                현재 보관함에 저장된 <strong>{savedQuestions.length}개</strong>의 질문을 내보냅니다.
              </p>
            </div>

            <Textarea
              value={exportData}
              readOnly
              rows={8}
              placeholder="내보내기 버튼을 클릭하면 JSON 데이터가 표시됩니다."
              className="font-mono text-xs"
            />

            <div className="flex gap-2">
              <Button onClick={handleExport} variant="outline" className="flex-1">
                <FileJson className="w-4 h-4 mr-2" />
                JSON 생성
              </Button>
              {exportData && (
                <>
                  <Button onClick={handleCopyToClipboard} variant="outline">
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                  <Button onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-2" />
                    다운로드
                  </Button>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-sm text-blue-700">
                JSON 파일을 업로드하거나 JSON 텍스트를 직접 붙여넣기 하세요.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />

            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              JSON 파일 선택
            </Button>

            <Textarea
              value={importData}
              onChange={(e) => {
                setImportData(e.target.value);
                setImportError("");
              }}
              rows={8}
              placeholder="JSON 데이터를 붙여넣기 하세요..."
              className="font-mono text-xs"
            />

            {importError && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                {importError}
              </div>
            )}

            {importSuccess && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <Check className="w-4 h-4" />
                성공적으로 가져왔습니다!
              </div>
            )}

            <Button onClick={handleImport} disabled={!importData.trim()} className="w-full">
              <Upload className="w-4 h-4 mr-2" />
              가져오기
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
