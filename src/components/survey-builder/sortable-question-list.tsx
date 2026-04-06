'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useShallow } from 'zustand/react/shallow';

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  BookmarkPlus,
  Copy,
  Edit3,
  GripVertical,
  Trash2,
} from 'lucide-react';

import {
  createQuestion as createQuestionAction,
  deleteQuestion as deleteQuestionAction,
  reorderQuestions as reorderQuestionsAction,
} from '@/actions/question-actions';
import { useEnsureSurveyInDb } from '@/hooks/use-ensure-survey-in-db';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { extractImageUrlsFromQuestion } from '@/lib/image-extractor';
import { convertHtmlImageUrlsToProxy, deleteImagesFromR2 } from '@/lib/image-utils';
import { generateId, isEmptyHtml, isValidUUID } from '@/lib/utils';
import { useSurveyBuilderStore } from '@/stores/survey-store';
import { useSurveyUIStore } from '@/stores/ui-store';
import { computeTableEstimatedHeight } from '@/hooks/use-row-heights';
import { Question } from '@/types/survey';

import { noop, estimateCardHeight, getQuestionTypeLabel } from './question-list-utils';
import { QuestionPreview } from './question-preview';
import { QuestionTestCard } from './question-test-card';
import { GroupHeader } from './group-header';
import { QuestionEditModal } from './question-edit-modal';

// LazyMount에서 그룹 접기/펼치기 시 이전 마운트 상태 기억
const mountedTableIdsRef = { current: new Set<string>() };

// table 질문의 무거운 내부 컴포넌트만 IO lazy mount
export function LazyMount({
  children,
  estimatedHeight = 128,
  immediate = false,
  questionId,
}: {
  children: React.ReactNode;
  estimatedHeight?: number;
  immediate?: boolean;
  questionId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(
    immediate || (questionId ? mountedTableIdsRef.current.has(questionId) : false),
  );

  useEffect(() => {
    if (mounted && questionId) mountedTableIdsRef.current.add(questionId);
  }, [mounted, questionId]);

  useEffect(() => {
    if (mounted) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: '800px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted]);

  if (mounted) return <>{children}</>;

  return (
    <div ref={ref}>
      <div
        style={{ height: estimatedHeight }}
        className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400"
      >
        테이블 로딩 중...
      </div>
    </div>
  );
}

interface SortableQuestionProps {
  question: Question;
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onSaveToLibrary?: (question: Question) => void;
  isDragOverlay?: boolean;
}

const SortableQuestion = React.memo(function SortableQuestion({
  question,
  index,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onSaveToLibrary,
  isDragOverlay = false,
}: SortableQuestionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      data-question-index={index}
      className={`group relative transition-all duration-200 ${
        isSelected
          ? 'border-blue-200 ring-2 shadow-lg ring-blue-500'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      } ${
        isDragging
          ? 'ring-opacity-50 z-50 scale-105 rotate-2 border-blue-300 bg-blue-50 ring-4 shadow-2xl ring-blue-300'
          : ''
      }`}
      onClick={() => onSelect(question.id)}
    >
      <div className="p-6">
        {/* Header with drag handle */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`rounded-md p-2 transition-all duration-200 ${
                isDragging
                  ? 'cursor-grabbing bg-blue-200 text-blue-700'
                  : 'cursor-grab text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing'
              }`}
              {...attributes}
              {...listeners}
              title="드래그하여 순서 변경"
            >
              <GripVertical className={`h-4 w-4 ${isDragging ? 'animate-pulse' : ''}`} />
            </div>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
              {index + 1}
            </span>
            <span className="text-sm font-medium text-gray-600 capitalize">
              {getQuestionTypeLabel(question.type)}
            </span>
          </div>

          <div className="flex items-center space-x-1">
            {question.required && (
              <span className="rounded bg-red-50 px-2 py-1 text-xs text-red-500">필수</span>
            )}

            {/* Action buttons - show on hover */}
            <div className="flex items-center space-x-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(question.id);
                }}
                title="편집"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(question.id);
                }}
                title="복제"
              >
                <Copy className="h-4 w-4" />
              </Button>
              {onSaveToLibrary && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-50 hover:text-blue-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSaveToLibrary(question);
                  }}
                  title="질문 저장"
                >
                  <BookmarkPlus className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(question.id);
                }}
                title="삭제"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Question content */}
        <div className="mb-4">
          <h4 className="mb-2 text-base font-medium text-gray-900">{question.title}</h4>
          {!isEmptyHtml(question.description) && (
            <div
              className="prose prose-sm mb-3 max-w-none overflow-x-auto text-sm text-gray-600 [&_p]:min-h-[1.6em] [&_table]:my-2 [&_table]:w-full [&_table]:table-fixed [&_table]:border-collapse [&_table]:border-2 [&_table]:border-gray-300 [&_table_p]:m-0 [&_table_td]:border [&_table_td]:border-gray-300 [&_table_td]:px-3 [&_table_td]:py-2 [&_table_th]:border [&_table_th]:border-gray-300 [&_table_th]:bg-transparent [&_table_th]:px-3 [&_table_th]:py-2 [&_table_th]:font-normal"
              style={{
                WebkitOverflowScrolling: 'touch',
              }}
              dangerouslySetInnerHTML={{
                __html: convertHtmlImageUrlsToProxy(question.description!),
              }}
            />
          )}
        </div>

        {/* Question preview */}
        <div className="rounded-lg bg-gray-50 p-3">
          {question.type === 'table' ? (
            <LazyMount
              questionId={question.id}

              estimatedHeight={computeTableEstimatedHeight(question.tableColumns ?? [], question.tableRowsData ?? [], question.tableHeaderGrid)}
              immediate={isDragOverlay}
            >
              <QuestionPreview question={question} />
            </LazyMount>
          ) : (
            <QuestionPreview question={question} />
          )}
        </div>
      </div>
    </Card>
  );
});

interface SortableQuestionListProps {
  selectedQuestionId: string | null;
  isTestMode?: boolean;
  onSaveToLibrary?: (question: Question) => void;
}

export function SortableQuestionList({
  selectedQuestionId,
  isTestMode = false,
  onSaveToLibrary,
}: SortableQuestionListProps) {
  // 스토어에서 직접 구독 (편집 페이지 리렌더와 분리)
  const questions = useSurveyBuilderStore(useShallow((s) => s.currentSurvey.questions));
  const { reorderQuestions, deleteQuestion, updateQuestion, addQuestion } =
    useSurveyBuilderStore(
      useShallow((s) => ({
        reorderQuestions: s.reorderQuestions,
        deleteQuestion: s.deleteQuestion,
        updateQuestion: s.updateQuestion,
        addQuestion: s.addQuestion,
      })),
    );
  const { surveyId } = useSurveyBuilderStore(
    useShallow((s) => ({ surveyId: s.currentSurvey.id })),
  );
  const groups = useSurveyBuilderStore(useShallow((s) => s.currentSurvey.groups || []));
  const selectQuestion = useSurveyUIStore((s) => s.selectQuestion);
  const ensureSurvey = useEnsureSurveyInDb();

  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // 테스트 모드 lazy 첫 마운트: 첫 토글 전까지 테스트 트리를 렌더하지 않음
  const [testModeEverActivated, setTestModeEverActivated] = useState(isTestMode);
  useEffect(() => {
    if (isTestMode && !testModeEverActivated) setTestModeEverActivated(true);
  }, [isTestMode, testModeEverActivated]);

  // querySelector 스코프용 컨테이너 ref
  const editContainerRef = useRef<HTMLDivElement>(null);
  const testContainerRef = useRef<HTMLDivElement>(null);

  // 콜백 안정화용 ref (questions 참조를 useCallback deps에서 제거)
  const questionsRef = useRef(questions);
  questionsRef.current = questions;

  // content-visibility용 카드 높이 캐시 (모드별 분리)
  const editHeightMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of questions) map.set(q.id, estimateCardHeight(q, 'edit'));
    return map;
  }, [questions]);

  const testHeightMap = useMemo(() => {
    if (!testModeEverActivated) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const q of questions) map.set(q.id, estimateCardHeight(q, 'test'));
    return map;
  }, [questions, testModeEverActivated]);

  // SPA 내비게이션 시 모듈 레벨 mountedTableIdsRef 정리
  useEffect(() => {
    return () => { mountedTableIdsRef.current.clear(); };
  }, []);

  // 중복 제거: 같은 ID를 가진 그룹이 있으면 첫 번째 것만 사용
  const uniqueGroups = Array.from(new Map(groups.map((g) => [g.id, g])).values());

  // 최상위 그룹만 필터링
  const topLevelGroups = uniqueGroups
    .filter((g) => !g.parentGroupId)
    .sort((a, b) => a.order - b.order);

  // 특정 그룹의 하위 그룹들 가져오기
  const getSubGroups = (parentId: string) => {
    return uniqueGroups
      .filter((g) => g.parentGroupId === parentId)
      .sort((a, b) => a.order - b.order);
  };

  // 그룹별로 질문 분류
  const questionsByGroup = questions.reduce(
    (acc, question) => {
      const groupId = question.groupId || 'ungrouped';
      if (!acc[groupId]) {
        acc[groupId] = [];
      }
      acc[groupId].push(question);
      return acc;
    },
    {} as Record<string, Question[]>,
  );

  // 재귀적으로 그룹과 모든 하위 그룹의 질문 개수 합계 계산
  const getTotalQuestionCount = (groupId: string): number => {
    const directCount = (questionsByGroup[groupId] || []).length;
    const subGroups = getSubGroups(groupId);
    const subGroupsCount = subGroups.reduce((sum, subGroup) => {
      return sum + getTotalQuestionCount(subGroup.id);
    }, 0);
    return directCount + subGroupsCount;
  };

  // 재귀적으로 모든 하위 그룹 개수 계산 (직접 하위 + 하위의 하위)
  const getTotalSubGroupCount = (groupId: string): number => {
    const directSubGroups = getSubGroups(groupId);
    const directCount = directSubGroups.length;
    const nestedCount = directSubGroups.reduce((sum, subGroup) => {
      return sum + getTotalSubGroupCount(subGroup.id);
    }, 0);
    return directCount + nestedCount;
  };

  // 그룹 없는 질문들
  const ungroupedQuestions = questionsByGroup['ungrouped'] || [];

  // 선택된 질문으로 스크롤 (활성 모드 컨테이너 내에서 검색)
  useEffect(() => {
    if (!selectedQuestionId) return;
    requestAnimationFrame(() => {
      const container = isTestMode ? testContainerRef.current : editContainerRef.current;
      const el = container?.querySelector(`[data-question-id="${selectedQuestionId}"]`)
        ?? document.querySelector(`[data-question-id="${selectedQuestionId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }, [selectedQuestionId, isTestMode]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    setActiveId(active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    setOverId((over?.id as string) || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // 전체 질문 목록을 그룹 순서대로 정렬
      // 1. 그룹별로 질문 분류 (이미 questionsByGroup에 있음)
      // 2. 그룹 순서대로 질문들을 평탄화
      const orderedQuestions: Question[] = [];

      // 최상위 그룹 순서대로
      topLevelGroups.forEach((group) => {
        const groupQuestions = (questionsByGroup[group.id] || []).sort((a, b) => a.order - b.order);
        orderedQuestions.push(...groupQuestions);

        // 하위 그룹들도 순서대로
        const subGroups = getSubGroups(group.id);
        subGroups.forEach((subGroup) => {
          const subGroupQuestions = (questionsByGroup[subGroup.id] || []).sort(
            (a, b) => a.order - b.order,
          );
          orderedQuestions.push(...subGroupQuestions);
        });
      });

      // 그룹 없는 질문들
      const ungrouped = (questionsByGroup['ungrouped'] || []).sort((a, b) => a.order - b.order);
      orderedQuestions.push(...ungrouped);

      const oldIndex = orderedQuestions.findIndex((q) => q.id === active.id);
      const newIndex = orderedQuestions.findIndex((q) => q.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(orderedQuestions, oldIndex, newIndex);
        const questionIds = newOrder.map((q) => q.id);

        // 로컬 스토어 업데이트
        reorderQuestions(questionIds);

        // 서버에 질문 순서 변경 API 호출
        if (surveyId) {
          ensureSurvey().then(() =>
            reorderQuestionsAction(questionIds).catch((error) => {
              console.error('질문 순서 변경 실패:', error);
            }),
          );
        }
      }
    }

    setActiveId(null);
    setOverId(null);
  }

  const handleEdit = useCallback((questionId: string) => {
    setEditingQuestionId(questionId);
  }, []);

  const handleDelete = useCallback(async (questionId: string) => {
    if (confirm('이 질문을 삭제하시겠습니까?')) {
      const questionToDelete = questionsRef.current.find((q) => q.id === questionId);
      if (questionToDelete) {
        const images = extractImageUrlsFromQuestion(questionToDelete);
        if (images.length > 0) {
          try {
            await deleteImagesFromR2(images);
          } catch (error) {
            console.error('질문 삭제 시 이미지 삭제 실패:', error);
          }
        }
      }

      deleteQuestion(questionId);

      if (isValidUUID(questionId)) {
        try {
          await ensureSurvey();
          await deleteQuestionAction(questionId);
        } catch (error) {
          console.error('질문 삭제 실패:', error);
        }
      }
    }
  }, [deleteQuestion, ensureSurvey]);

  const handleDuplicate = useCallback(async (questionId: string) => {
    const questionToDuplicate = questionsRef.current.find((q) => q.id === questionId);
    if (questionToDuplicate) {
      // 먼저 컬럼을 복제하여 새 컬럼 ID들을 확보
      const newTableColumns = questionToDuplicate.tableColumns
        ? questionToDuplicate.tableColumns.map((col) => ({
            ...col,
            id: generateId(),
          }))
        : undefined;

      // 행 ID 매핑 생성 (dynamicRowConfigs의 insertAfterRowId 업데이트용)
      const rowIdMap = new Map<string, string>();

      // tableRowsData 복사 (새 ID 부여 및 셀 ID 규칙 적용)
      const newTableRowsData = questionToDuplicate.tableRowsData
        ? questionToDuplicate.tableRowsData.map((row) => {
            const newRowId = generateId();
            rowIdMap.set(row.id, newRowId);
            return {
              ...row,
              id: newRowId,
              cells: row.cells.map((cell, cellIndex) => {
                // 해당 셀의 새 컬럼 ID 찾기
                const newColId = newTableColumns?.[cellIndex]?.id;
                const newCellId = newColId ? `cell-${newRowId}-${newColId}` : generateId();

                return {
                  ...cell,
                  id: newCellId,
                  // 셀 내부의 옵션들도 복사
                  checkboxOptions: cell.checkboxOptions
                    ? cell.checkboxOptions.map((opt) => ({
                        ...opt,
                        id: generateId(),
                      }))
                    : undefined,
                  radioOptions: cell.radioOptions
                    ? cell.radioOptions.map((opt) => ({
                        ...opt,
                        id: generateId(),
                      }))
                    : undefined,
                  selectOptions: cell.selectOptions
                    ? cell.selectOptions.map((opt) => ({
                        ...opt,
                        id: generateId(),
                      }))
                    : undefined,
                };
              }),
            };
          })
        : undefined;

      // dynamicRowConfigs 복사 (insertAfterRowId를 새 행 ID로 매핑)
      const newDynamicRowConfigs = questionToDuplicate.dynamicRowConfigs
        ? questionToDuplicate.dynamicRowConfigs.map((config) => ({
            ...config,
            insertAfterRowId: config.insertAfterRowId
              ? rowIdMap.get(config.insertAfterRowId) ?? config.insertAfterRowId
              : undefined,
          }))
        : undefined;

      // 기존 질문들의 최대 order를 찾아서 +1 (없으면 1부터 시작)
      const currentQuestions = questionsRef.current;
      const maxOrder = currentQuestions.length > 0 ? Math.max(...currentQuestions.map((q) => q.order), 0) : 0;

      // 새로운 ID를 가진 완전한 복사본 생성
      const newQuestion: Question = {
        ...questionToDuplicate,
        id: generateId(),
        title: `${questionToDuplicate.title} (복사본)`,
        order: maxOrder + 1, // 1부터 시작하는 실제 질문 번호
        // options 복사 (새 ID 부여)
        options: questionToDuplicate.options
          ? questionToDuplicate.options.map((opt) => ({
              ...opt,
              id: generateId(),
            }))
          : undefined,
        // selectLevels 복사 (새 ID 부여)
        selectLevels: questionToDuplicate.selectLevels
          ? questionToDuplicate.selectLevels.map((level) => ({
              ...level,
              id: generateId(),
              options: level.options.map((opt) => ({
                ...opt,
                id: generateId(),
              })),
            }))
          : undefined,
        // tableColumns 복사 (위에서 생성한 새 컬럼 사용)
        tableColumns: newTableColumns,
        tableRowsData: newTableRowsData,
        dynamicRowConfigs: newDynamicRowConfigs,
      };

      // 로컬 스토어에 추가
      useSurveyBuilderStore.getState().addPreparedQuestion(newQuestion);

      // 서버에 질문 생성 API 호출
      if (surveyId) {
        try {
          await ensureSurvey();
          await createQuestionAction({
            surveyId: surveyId,
            groupId: newQuestion.groupId,
            type: newQuestion.type,
            title: newQuestion.title,
            description: newQuestion.description,
            required: newQuestion.required,
            order: newQuestion.order,
            options: newQuestion.options,
            selectLevels: newQuestion.selectLevels,
            tableTitle: newQuestion.tableTitle,
            tableColumns: newQuestion.tableColumns,
            tableRowsData: newQuestion.tableRowsData,
            imageUrl: newQuestion.imageUrl,
            videoUrl: newQuestion.videoUrl,
            allowOtherOption: newQuestion.allowOtherOption,
            noticeContent: newQuestion.noticeContent,
            requiresAcknowledgment: newQuestion.requiresAcknowledgment,
            tableValidationRules: newQuestion.tableValidationRules,
            displayCondition: newQuestion.displayCondition,
            dynamicRowConfigs: newQuestion.dynamicRowConfigs,
          });
        } catch (error) {
          console.error('질문 복제 실패:', error);
        }
      }
    }
  }, [surveyId, ensureSurvey]);

  if (questions.length === 0) {
    return null;
  }

  // 편집/테스트 모드를 display:none으로 토글 (언마운트 방지 → 즉시 전환)
  const editStyle = isTestMode ? { display: 'none' as const } : undefined;
  const testStyle = isTestMode ? undefined : { display: 'none' as const };

  // 질문 카드 렌더 헬퍼 — 테스트 모드
  const renderTestCard = (question: Question) => (
    <div
      key={question.id}
      data-question-id={question.id}
      style={{ contentVisibility: 'auto', containIntrinsicSize: `auto ${testHeightMap.get(question.id) ?? estimateCardHeight(question, 'test')}px` }}
    >
      <QuestionTestCard question={question} index={questions.indexOf(question)} />
    </div>
  );

  // 질문 카드 렌더 헬퍼 — 편집 모드
  const renderEditCard = (question: Question) => {
    const qIdx = questions.indexOf(question);
    return (
      <div
        key={question.id}
        data-question-id={question.id}
        className="relative"
        style={{ contentVisibility: 'auto', containIntrinsicSize: `auto ${editHeightMap.get(question.id) ?? estimateCardHeight(question, 'edit')}px` }}
      >
        {overId === question.id && activeId !== question.id && (
          <div className="absolute -top-2 right-0 left-0 z-10 h-1 animate-pulse rounded-full bg-blue-500" />
        )}
        <SortableQuestion
          question={question}
          index={qIdx}
          isSelected={selectedQuestionId === question.id}
          onSelect={selectQuestion}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onSaveToLibrary={onSaveToLibrary}
        />
      </div>
    );
  };

  // 그룹 렌더 헬퍼
  const renderGroups = (renderCard: (q: Question) => React.ReactNode) => (
    <>
      {topLevelGroups.map((group) => {
        const groupQuestions = questionsByGroup[group.id] || [];
        const subGroups = getSubGroups(group.id);
        return (
          <div key={group.id} className="space-y-4">
            <GroupHeader
              group={group}
              questionCount={getTotalQuestionCount(group.id)}
              subGroupCount={getTotalSubGroupCount(group.id)}
            />
            {!group.collapsed && (
              <>
                {groupQuestions.length > 0 && (
                  <div className="space-y-4 pl-4">
                    {groupQuestions.map(renderCard)}
                  </div>
                )}
                {subGroups.map((subGroup) => {
                  const subGroupQuestions = questionsByGroup[subGroup.id] || [];
                  return (
                    <div key={subGroup.id} className="ml-4 space-y-4">
                      <GroupHeader
                        group={subGroup}
                        questionCount={getTotalQuestionCount(subGroup.id)}
                        subGroupCount={getTotalSubGroupCount(subGroup.id)}
                      />
                      {!subGroup.collapsed && (
                        <div className="space-y-4 pl-4">
                          {subGroupQuestions.map(renderCard)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })}
      {ungroupedQuestions.length > 0 && (
        <div className="space-y-4">
          {topLevelGroups.length > 0 && (
            <div className="flex items-center space-x-2 py-2">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">그룹 없음</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
          )}
          {ungroupedQuestions.map(renderCard)}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* 편집 모드 */}
      <div ref={editContainerRef} style={editStyle}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-6">
              {renderGroups(renderEditCard)}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeId ? (
              <div className="opacity-95">
                <SortableQuestion
                  question={questions.find((q) => q.id === activeId)!}
                  index={questions.findIndex((q) => q.id === activeId)}
                  isSelected={false}
                  onSelect={noop}
                  onEdit={noop}
                  onDelete={noop}
                  onDuplicate={noop}
                  isDragOverlay
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* 테스트 모드 (첫 토글 시에만 마운트) */}
      {testModeEverActivated && (
        <div ref={testContainerRef} style={testStyle}>
          <div className="space-y-6">
            {renderGroups(renderTestCard)}
          </div>
        </div>
      )}

      {/* 모달 — 양 모드 밖 */}
      <QuestionEditModal
        questionId={editingQuestionId}
        isOpen={!!editingQuestionId}
        onClose={() => setEditingQuestionId(null)}
      />
    </>
  );
}
