'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AlertTriangle, ChevronDown, ChevronUp, Eye, Layers } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSurveyBuilderStore } from '@/stores/survey-store';
import { DynamicRowGroupConfig, Question, QuestionConditionGroup } from '@/types/survey';

import { QuestionConditionEditor, QuestionConditionEditorRef } from './question-condition-editor';

// ── 타입 ──

export interface BulkRowDef {
  label: string;
  rowCode: string;
  displayCondition?: QuestionConditionGroup;
  dynamicGroupId?: string;
}

export interface BulkRowGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentQuestionId: string;
  existingRowCodes: string[];
  dynamicRowGroups: DynamicRowGroupConfig[];
  onGenerate: (rows: BulkRowDef[]) => void;
}

// ── 유틸 ──

const GROUP_COLORS = [
  'bg-purple-500', 'bg-green-500', 'bg-yellow-500', 'bg-blue-500',
  'bg-pink-500', 'bg-orange-500', 'bg-teal-500', 'bg-red-500',
  'bg-indigo-500', 'bg-cyan-500', 'bg-lime-500', 'bg-rose-500',
  'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-sky-500',
  'bg-fuchsia-500', 'bg-stone-500',
];

/** 코드용 zero-padding (최대 번호 자릿수 기준) */
function padCode(num: number, maxNum: number): string {
  const digits = String(maxNum).length;
  return String(num).padStart(digits, '0');
}

/** 행 정의 배열 생성 */
function buildRowDefs(
  baseLabel: string,
  baseCode: string,
  startNumber: number,
  count: number,
  condition: QuestionConditionGroup | undefined,
  dynamicGroupId: string | undefined,
): BulkRowDef[] {
  if (!baseLabel.trim() || !baseCode.trim() || count <= 0) return [];

  const maxNum = startNumber + count - 1;
  const sanitizedLabel = baseLabel.trim();
  const sanitizedCode = baseCode.trim();

  return Array.from({ length: count }, (_, i) => {
    const num = startNumber + i;
    return {
      label: `${sanitizedLabel}${num}`,
      rowCode: `${sanitizedCode}${padCode(num, maxNum)}`,
      displayCondition: condition
        ? JSON.parse(JSON.stringify(condition))
        : undefined,
      dynamicGroupId: dynamicGroupId || undefined,
    };
  });
}

// ── 하위 컴포넌트: 입력 폼 ──

interface BulkRowFormProps {
  baseLabel: string;
  baseCode: string;
  startNumber: number;
  count: number;
  onBaseLabelChange: (v: string) => void;
  onBaseCodeChange: (v: string) => void;
  onStartNumberChange: (v: number) => void;
  onCountChange: (v: number) => void;
}

function BulkRowForm({
  baseLabel,
  baseCode,
  startNumber,
  count,
  onBaseLabelChange,
  onBaseCodeChange,
  onStartNumberChange,
  onCountChange,
}: BulkRowFormProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs font-medium">기본 라벨</Label>
        <Input
          value={baseLabel}
          onChange={(e) => onBaseLabelChange(e.target.value)}
          placeholder="예: 제재목"
          className="h-8 text-sm"
          autoFocus
        />
        <p className="text-[10px] text-gray-400">라벨 뒤에 번호가 붙습니다</p>
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-medium">기본 아이디 (코드)</Label>
        <Input
          value={baseCode}
          onChange={(e) => onBaseCodeChange(e.target.value)}
          placeholder="예: 1u"
          className="h-8 text-sm"
        />
        <p className="text-[10px] text-gray-400">코드 뒤에 zero-padding 번호가 붙습니다</p>
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-medium">시작 번호</Label>
        <Input
          type="number"
          value={startNumber}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 0) onStartNumberChange(v);
          }}
          min={0}
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-medium">생성 개수</Label>
        <Input
          type="number"
          value={count}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 1) onCountChange(v);
          }}
          min={1}
          className="h-8 text-sm"
        />
      </div>
    </div>
  );
}

// ── 하위 컴포넌트: 동적 그룹 선택 ──

interface BulkRowDynamicGroupSectionProps {
  dynamicRowGroups: DynamicRowGroupConfig[];
  selectedGroupId: string | undefined;
  onSelect: (groupId: string | undefined) => void;
}

function BulkRowDynamicGroupSection({
  dynamicRowGroups,
  selectedGroupId,
  onSelect,
}: BulkRowDynamicGroupSectionProps) {
  if (dynamicRowGroups.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium">
        <Layers className="h-3.5 w-3.5 text-purple-600" />
        동적 행 그룹 (선택사항)
      </Label>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onSelect(undefined)}
          className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
            !selectedGroupId
              ? 'border-gray-400 bg-gray-100 font-medium'
              : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          없음
        </button>
        {dynamicRowGroups.map((group, idx) => (
          <button
            key={group.groupId}
            type="button"
            onClick={() => onSelect(group.groupId)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
              selectedGroupId === group.groupId
                ? 'border-purple-400 bg-purple-50 font-medium'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${GROUP_COLORS[idx % GROUP_COLORS.length]}`}
            />
            {group.label || group.groupId}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 하위 컴포넌트: 조건부 표시 섹션 ──

interface BulkRowConditionSectionProps {
  allQuestions: Question[];
  currentQuestionId: string;
  conditionEditorRef: React.RefObject<QuestionConditionEditorRef | null>;
  onConditionChange: (condition: QuestionConditionGroup | undefined) => void;
}

function BulkRowConditionSection({
  allQuestions,
  currentQuestionId,
  conditionEditorRef,
  onConditionChange,
}: BulkRowConditionSectionProps) {
  const [expanded, setExpanded] = useState(false);

  // 더미 Question 객체 (조건 에디터에 필요)
  const dummyQuestion = useMemo<Question>(
    () => ({
      id: currentQuestionId,
      type: 'table',
      title: '',
      order: 0,
      required: false,
    }),
    [currentQuestionId],
  );

  const filteredQuestions = useMemo(
    () => allQuestions.filter((q) => q.id !== currentQuestionId),
    [allQuestions, currentQuestionId],
  );

  if (filteredQuestions.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-900"
      >
        <Eye className="h-3.5 w-3.5 text-blue-500" />
        조건부 표시 (선택사항)
        {expanded ? (
          <ChevronUp className="ml-auto h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="ml-auto h-3.5 w-3.5" />
        )}
      </button>
      {expanded && (
        <div className="rounded-md border border-blue-100 bg-blue-50/30 p-3">
          <QuestionConditionEditor
            ref={conditionEditorRef}
            question={dummyQuestion}
            allQuestions={allQuestions}
            allowAllQuestions
            onUpdate={onConditionChange}
          />
        </div>
      )}
    </div>
  );
}

// ── 하위 컴포넌트: 미리보기 테이블 ──

interface BulkRowPreviewProps {
  rows: BulkRowDef[];
  existingRowCodes: string[];
  maxPreviewCount?: number;
}

function BulkRowPreview({
  rows,
  existingRowCodes,
  maxPreviewCount = 20,
}: BulkRowPreviewProps) {
  const existingSet = useMemo(() => new Set(existingRowCodes), [existingRowCodes]);
  const duplicates = useMemo(
    () => rows.filter((r) => existingSet.has(r.rowCode)),
    [rows, existingSet],
  );

  const previewRows = rows.slice(0, maxPreviewCount);
  const hasMore = rows.length > maxPreviewCount;

  if (rows.length === 0) {
    return (
      <p className="py-2 text-center text-xs text-gray-400">
        기본 라벨과 아이디를 입력하면 미리보기가 표시됩니다.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">
          미리보기 (총 {rows.length}개)
        </Label>
        {duplicates.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            코드 중복 {duplicates.length}건
          </span>
        )}
      </div>
      <div className="max-h-[200px] overflow-y-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="w-10 border-b px-2 py-1 text-left font-medium text-gray-500">#</th>
              <th className="border-b px-2 py-1 text-left font-medium text-gray-500">라벨</th>
              <th className="border-b px-2 py-1 text-left font-medium text-gray-500">코드</th>
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => {
              const isDuplicate = existingSet.has(row.rowCode);
              return (
                <tr
                  key={i}
                  className={isDuplicate ? 'bg-amber-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                >
                  <td className="px-2 py-0.5 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-0.5">{row.label}</td>
                  <td className={`px-2 py-0.5 font-mono ${isDuplicate ? 'text-amber-600' : 'text-gray-600'}`}>
                    {row.rowCode}
                    {isDuplicate && <AlertTriangle className="ml-1 inline h-3 w-3" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {hasMore && (
          <p className="border-t bg-gray-50 px-2 py-1 text-center text-[10px] text-gray-400">
            ... 외 {rows.length - maxPreviewCount}개
          </p>
        )}
      </div>
    </div>
  );
}

// ── 메인 모달 ──

export function BulkRowGeneratorModal({
  open,
  onOpenChange,
  currentQuestionId,
  existingRowCodes,
  dynamicRowGroups,
  onGenerate,
}: BulkRowGeneratorModalProps) {
  const allQuestions = useSurveyBuilderStore(useShallow((s) => s.currentSurvey.questions));
  // ── 입력 상태 ──
  const [baseLabel, setBaseLabel] = useState('');
  const [baseCode, setBaseCode] = useState('');
  const [startNumber, setStartNumber] = useState(1);
  const [count, setCount] = useState(10);
  const [dynamicGroupId, setDynamicGroupId] = useState<string | undefined>(undefined);
  const [condition, setCondition] = useState<QuestionConditionGroup | undefined>(undefined);

  const conditionEditorRef = useRef<QuestionConditionEditorRef | null>(null);

  // ── 모달 열릴 때 상태 초기화 ──
  useEffect(() => {
    if (open) {
      setBaseLabel('');
      setBaseCode('');
      setStartNumber(1);
      setCount(10);
      setDynamicGroupId(undefined);
      setCondition(undefined);
    }
  }, [open]);

  // ── 미리보기 행 생성 (메모이제이션) ──
  const previewRows = useMemo(
    () => buildRowDefs(baseLabel, baseCode, startNumber, count, condition, dynamicGroupId),
    [baseLabel, baseCode, startNumber, count, condition, dynamicGroupId],
  );

  // ── 유효성 검사 ──
  const isValid = baseLabel.trim().length > 0 && baseCode.trim().length > 0 && count > 0;

  // ── 생성 핸들러 ──
  const handleGenerate = useCallback(() => {
    if (!isValid) return;

    // 최종 조건을 에디터 ref에서 직접 가져옴 (동기화 보장)
    const finalCondition = conditionEditorRef.current?.getCurrentConditionGroup() ?? condition;
    const rows = buildRowDefs(baseLabel, baseCode, startNumber, count, finalCondition, dynamicGroupId);

    onGenerate(rows);
    onOpenChange(false);
  }, [isValid, baseLabel, baseCode, startNumber, count, condition, dynamicGroupId, onGenerate, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>행 일괄 생성</DialogTitle>
          <DialogDescription>
            기본 라벨과 아이디를 입력하면 번호가 자동으로 붙어 여러 행이 한번에 생성됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 입력 폼 */}
          <BulkRowForm
            baseLabel={baseLabel}
            baseCode={baseCode}
            startNumber={startNumber}
            count={count}
            onBaseLabelChange={setBaseLabel}
            onBaseCodeChange={setBaseCode}
            onStartNumberChange={setStartNumber}
            onCountChange={setCount}
          />

          {/* 동적 그룹 선택 */}
          <BulkRowDynamicGroupSection
            dynamicRowGroups={dynamicRowGroups}
            selectedGroupId={dynamicGroupId}
            onSelect={setDynamicGroupId}
          />

          {/* 조건부 표시 */}
          <BulkRowConditionSection
            allQuestions={allQuestions}
            currentQuestionId={currentQuestionId}
            conditionEditorRef={conditionEditorRef}
            onConditionChange={setCondition}
          />

          {/* 미리보기 */}
          <BulkRowPreview
            rows={previewRows}
            existingRowCodes={existingRowCodes}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleGenerate} disabled={!isValid}>
            {count}개 행 생성
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
