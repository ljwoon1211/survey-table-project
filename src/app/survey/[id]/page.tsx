'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useParams, useRouter } from 'next/navigation';

import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle, ChevronLeft, ChevronRight, Loader2, Lock } from 'lucide-react';

import {
  getSurveyByPrivateToken,
  getSurveyBySlug,
  getSurveyForResponse,
} from '@/actions/query-actions';
import { completeResponse, startResponse } from '@/actions/response-actions';
import { QuestionInput } from '@/components/survey-response/question-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useMultiLineDetection } from '@/hooks/use-line-count-detection';
import { useMediaQuery } from '@/hooks/use-media-query';
import { parsesurveyIdentifier } from '@/lib/survey-url';
import { isEmptyHtml } from '@/lib/utils';

import { useSurveyResponseStore } from '@/stores/survey-response-store';
import { useShallow } from 'zustand/react/shallow';
import { Question, Survey } from '@/types/survey';
import {
  getNextQuestionIndex,
  shouldDisplayDynamicGroup,
  shouldDisplayQuestion,
  shouldDisplayRow,
} from '@/utils/branch-logic';

type ResponsesMap = Record<string, unknown>;

export default function SurveyResponsePage() {
  const params = useParams();
  const router = useRouter();
  // URL 인코딩된 한글 slug를 디코딩
  const identifier = decodeURIComponent(params.id as string);

  // 응답 스토어 — 액션만 셀렉트 (전체 구독 → 불필요 리렌더 방지)
  const { setCurrentResponseId, setPendingResponse, resetResponseState } =
    useSurveyResponseStore(
      useShallow((s) => ({
        setCurrentResponseId: s.setCurrentResponseId,
        setPendingResponse: s.setPendingResponse,
        resetResponseState: s.resetResponseState,
      })),
    );
  const currentResponseId = useSurveyResponseStore((s) => s.currentResponseId);

  // 설문 로딩 상태
  const [isLoading, setIsLoading] = useState(true);
  const [loadedSurvey, setLoadedSurvey] = useState<Survey | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<ResponsesMap>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [questionHistory, setQuestionHistory] = useState<number[]>([]);
  const [responseStarted, setResponseStarted] = useState(false);
  const [versionId, setVersionId] = useState<string | null>(null);

  // iOS 키보드 감지 (#7) — 키보드 올라오면 고정 하단바 숨김
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => setKeyboardOpen(vv.height < window.innerHeight * 0.75);
    vv.addEventListener('resize', handler);
    return () => vv.removeEventListener('resize', handler);
  }, []);

  // URL 식별자로 설문 조회
  useEffect(() => {
    const loadSurvey = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        // URL 식별자 타입 판별
        const { type, value } = parsesurveyIdentifier(identifier);

        let surveyId: string | null = null;

        switch (type) {
          case 'slug': {
            const dbSurvey = await getSurveyBySlug(value);
            if (dbSurvey) surveyId = dbSurvey.id;
            break;
          }
          case 'privateToken': {
            const dbSurvey = await getSurveyByPrivateToken(value);
            if (dbSurvey) surveyId = dbSurvey.id;
            break;
          }
          case 'id':
            surveyId = value;
            break;
        }

        if (!surveyId) {
          setLoadError('요청하신 설문을 찾을 수 없습니다.');
          setLoadedSurvey(null);
          return;
        }

        // 배포 버전 스냅샷 우선, 미배포 시 기존 방식 fallback
        const result = await getSurveyForResponse(surveyId);

        if (!result) {
          setLoadError('요청하신 설문을 찾을 수 없습니다.');
          setLoadedSurvey(null);
        } else if (!result.survey.settings.isPublic && type === 'slug') {
          setLoadError('이 설문은 비공개 설문입니다. 올바른 링크로 접근해주세요.');
          setLoadedSurvey(null);
        } else {
          setLoadedSurvey(result.survey);
          setVersionId(result.versionId);
        }
      } catch (error) {
        console.error('설문 로딩 오류:', error);
        setLoadError('설문을 불러오는 중 오류가 발생했습니다.');
        setLoadedSurvey(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadSurvey();
  }, [identifier]);

  // 설문 응답 시작 - DB에 레코드 생성 (versionId 포함)
  useEffect(() => {
    if (loadedSurvey && !responseStarted) {
      setResponseStarted(true);
      startResponse(loadedSurvey.id, undefined, versionId ?? undefined).then((dbResponse) => {
        setCurrentResponseId(dbResponse.id);
      }).catch((err) => {
        console.error('응답 시작 오류:', err);
      });
    }
  }, [loadedSurvey, responseStarted, setCurrentResponseId, versionId]);

  // 현재 설문의 질문들
  const questions = useMemo(() => loadedSurvey?.questions || [], [loadedSurvey]);
  const groups = useMemo(() => loadedSurvey?.groups || [], [loadedSurvey]);
  const currentQuestion = questions[currentQuestionIndex];
  const visibleQuestions = useMemo(() => {
    return questions.filter((q) => shouldDisplayQuestion(q, responses, questions, groups));
  }, [questions, responses, groups]);

  // 모바일 화면 감지 (matchMedia — resize 루프 방지)
  const isMobile = useMediaQuery('(max-width: 767px)');

  // 질문 타이틀 줄 수 감지 (pretext 기반 — DOM 비의존, 리렌더 0회)
  const titleHasMultipleLines = useMultiLineDetection(isMobile, currentQuestion?.title);

  const currentVisibleNumber = useMemo(() => {
    if (!currentQuestion) return 0;
    const idx = visibleQuestions.findIndex((q) => q.id === currentQuestion.id);
    return idx === -1 ? 0 : idx + 1;
  }, [currentQuestion, visibleQuestions]);

  const totalVisibleCount = visibleQuestions.length;

  // 필수 미응답 하이라이트 상태 (제출 시도 후)
  const [showRequiredHighlight, setShowRequiredHighlight] = useState(false);

  const findNextDisplayableIndex = useCallback(
    (startIndex: number): number => {
      if (questions.length === 0) return -1;
      if (startIndex < 0) return -1;

      for (let i = startIndex; i < questions.length; i += 1) {
        const q = questions[i];
        if (!q) continue;
        if (shouldDisplayQuestion(q, responses, questions, groups)) {
          return i;
        }
      }

      return -1;
    },
    [questions, responses, groups],
  );

  // 현재 인덱스가 표시 조건을 만족하지 않으면, 다음 표시 가능한 질문으로 자동 이동
  useEffect(() => {
    if (!loadedSurvey) return;
    if (!currentQuestion) return;

    const isDisplayable = shouldDisplayQuestion(currentQuestion, responses, questions, groups);
    if (isDisplayable) return;

    const nextDisplayable = findNextDisplayableIndex(currentQuestionIndex + 1);
    if (nextDisplayable !== -1) {
      setCurrentQuestionIndex(nextDisplayable);
    }
    // 표시 가능한 질문이 더 없으면, 제출/완료 흐름은 사용자가 "다음"을 통해 진행하도록 둠
    // (자동 제출은 예기치 않은 동작이 될 수 있어 보수적으로 처리)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedSurvey, currentQuestionIndex, questions, responses]);

  const hasPreviousDisplayable = useMemo(() => {
    // 히스토리에 질문이 하나라도 있으면 이전 버튼 활성화
    // 히스토리에 있는 질문은 사용자가 실제로 방문했던 질문이므로
    // 표시 조건과 관계없이 접근 가능
    const hasHistory = questionHistory.length > 0;
    return hasHistory;
  }, [questionHistory]);

  const isLastVisibleStep = useMemo(() => {
    if (!currentQuestion) return false;
    const currentResponse = responses[currentQuestion.id];
    const nextIndex = getNextQuestionIndex(questions, currentQuestionIndex, currentResponse);
    if (nextIndex === -1) return true;
    return findNextDisplayableIndex(nextIndex) === -1;
  }, [currentQuestion, currentQuestionIndex, findNextDisplayableIndex, questions, responses]);

  const handleResponse = useCallback((questionId: string, value: unknown) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
    setPendingResponse(questionId, value);
  }, [setPendingResponse]);

  const currentQuestionId = currentQuestion?.id;
  const currentQuestionOnChange = useCallback(
    (value: unknown) => {
      if (currentQuestionId) handleResponse(currentQuestionId, value);
    },
    [handleResponse, currentQuestionId],
  );

  const isQuestionRequired = (question: Question) => {
    return question.required;
  };

  const isQuestionAnswered = (question: Question) => {
    const response = responses[question.id];
    if (!response) return false;

    switch (question.type) {
      case 'notice':
        if (!question.requiresAcknowledgment) return true;
        if (response && typeof response === 'object' && 'agreed' in response) return (response as { agreed: boolean }).agreed;
        return response === true;
      case 'text':
      case 'textarea':
        return typeof response === 'string' && response.trim().length > 0;
      case 'radio':
      case 'select':
        return response !== null && response !== undefined && response !== '';
      case 'checkbox':
        if (!Array.isArray(response) || response.length === 0) return false;
        if (question.minSelections !== undefined && question.minSelections > 0) {
          return response.length >= question.minSelections;
        }
        return true;
      case 'multiselect':
        return Array.isArray(response) && response.length > 0;
      case 'table':
        return (
          typeof response === 'object' &&
          response !== null &&
          Object.keys(response as Record<string, unknown>).length > 0
        );
      default:
        return true;
    }
  };

  // 응답 완료 카운트 (피드백)
  const answeredCount = useMemo(
    () => visibleQuestions.filter((q) => isQuestionAnswered(q)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleQuestions, responses],
  );
  const requiredRemaining = useMemo(
    () => visibleQuestions.filter((q) => q.required && !isQuestionAnswered(q)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleQuestions, responses],
  );

  const canProceed = () => {
    if (!currentQuestion) return false;
    return !isQuestionRequired(currentQuestion) || isQuestionAnswered(currentQuestion);
  };

  const handleNext = () => {
    const currentResponse = responses[currentQuestion.id];
    const nextIndex = getNextQuestionIndex(questions, currentQuestionIndex, currentResponse);

    // 현재 질문 인덱스를 히스토리에 추가
    setQuestionHistory((prev) => {
      const newHistory = [...prev, currentQuestionIndex];
      return newHistory;
    });

    if (nextIndex === -1) {
      // 마지막 질문 — 제출 확인: 버튼이 이미 "제출"로 표시되므로 진행 (#19)
      handleSubmit();
      return;
    } else if (nextIndex < questions.length) {
      const nextDisplayable = findNextDisplayableIndex(nextIndex);
      if (nextDisplayable === -1) {
        // 다음 표시 가능한 질문이 없으면 제출
        handleSubmit();
        return;
      }
      // 다음 질문으로 이동
      setCurrentQuestionIndex(nextDisplayable);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (questionHistory.length === 0) return;

    // 히스토리에서 마지막 항목을 가져옴 (이전 질문 인덱스)
    const lastIndex = questionHistory.length - 1;
    const previousQuestionIndex = questionHistory[lastIndex];

    if (previousQuestionIndex !== undefined && questions[previousQuestionIndex]) {
      // 이전 질문으로 이동
      setCurrentQuestionIndex(previousQuestionIndex);
      // 현재 질문 인덱스를 히스토리에서 제거
      setQuestionHistory((prev) => prev.slice(0, lastIndex));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // 브라우저 뒤로가기 → 이전 질문 이동 (#24)
  const hasResponses = Object.keys(responses).length > 0;
  useEffect(() => {
    if (!loadedSurvey || isCompleted) return;

    window.history.pushState({ questionIndex: currentQuestionIndex }, '');

    const handlePopState = () => {
      if (questionHistory.length > 0) {
        handlePrevious();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedSurvey, currentQuestionIndex, isCompleted]);

  // 페이지 이탈 시 경고 (#29)
  useEffect(() => {
    if (!hasResponses || isCompleted) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasResponses, isCompleted]);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const unansweredRequired = questions.filter((q) => {
        // 표시되지 않는 질문은 필수 여부를 강제하지 않음
        if (!shouldDisplayQuestion(q, responses, questions, groups)) return false;
        return isQuestionRequired(q) && !isQuestionAnswered(q);
      });

      if (unansweredRequired.length > 0) {
        // 세그먼트에 필수 미응답 하이라이트 (#4 Step 4)
        setShowRequiredHighlight(true);
        // 첫 번째 미응답 필수 질문으로 이동
        const firstUnanswered = unansweredRequired[0];
        const targetIdx = questions.findIndex((q) => q.id === firstUnanswered.id);
        if (targetIdx !== -1 && targetIdx !== currentQuestionIndex) {
          setCurrentQuestionIndex(targetIdx);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        setIsSubmitting(false);
        return;
      }
      // 제출 성공 시 하이라이트 해제
      setShowRequiredHighlight(false);

      // 서버에 응답 및 노출 데이터 저장
      if (currentResponseId) {
        // 1. 노출된 질문 ID 수집
        const exposedQuestionIds = visibleQuestions.map((q) => q.id);

        // 2. 노출된 테이블 행 ID 수집 (displayCondition + 동적 행 선택 반영)
        const exposedRowIds = visibleQuestions
          .filter((q) => q.type === 'table' && q.tableRowsData)
          .flatMap((q) => {
            const qResponse = (responses as Record<string, any>)?.[q.id];
            const selectedDynamicIds = new Set<string>(
              (qResponse?.__selectedRowIds as string[]) ?? [],
            );
            const enabledGroupIds = new Set(
              (q.dynamicRowConfigs ?? [])
                .filter((g) => g.enabled && shouldDisplayDynamicGroup(g, responses as Record<string, unknown>, questions))
                .map((g) => g.groupId),
            );
            const hasDynamic = enabledGroupIds.size > 0 && q.tableRowsData!.some((r) => r.dynamicGroupId);

            // 그룹별 선택 여부
            const groupsWithSelections = new Set<string>();
            if (hasDynamic) {
              for (const row of q.tableRowsData!) {
                if (row.dynamicGroupId && selectedDynamicIds.has(row.id)) {
                  groupsWithSelections.add(row.dynamicGroupId);
                }
              }
            }

            return q.tableRowsData!
              .filter((row) => {
                if (!shouldDisplayRow(row, responses as Record<string, unknown>, questions)) return false;
                if (hasDynamic) {
                  if (row.dynamicGroupId && enabledGroupIds.has(row.dynamicGroupId)) {
                    return selectedDynamicIds.has(row.id);
                  }
                  if (row.showWhenDynamicGroupId && enabledGroupIds.has(row.showWhenDynamicGroupId)) {
                    return groupsWithSelections.has(row.showWhenDynamicGroupId);
                  }
                }
                return true;
              })
              .map((row) => row.id);
          });

        console.log('Impression Logging:', { exposedQuestionIds, exposedRowIds });

        await completeResponse(currentResponseId, {
          questionResponses: responses,
          exposedQuestionIds,
          exposedRowIds,
        });
      }

      // 현재는 클라이언트에서만 완료 처리
      resetResponseState();
      setIsCompleted(true);
    } catch (error) {
      console.error('응답 제출 오류:', error);
      alert('응답 제출 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 현재 질문의 그룹명 조회
  const currentGroupName = useMemo(() => {
    if (!currentQuestion?.groupId) return null;
    const group = groups.find((g) => g.id === currentQuestion.groupId);
    return group?.name || null;
  }, [currentQuestion?.groupId, groups]);

  // 로딩 중
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="mx-auto max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-500" />
            <h2 className="mb-2 text-xl font-semibold text-gray-900">설문을 불러오는 중...</h2>
            <p className="text-gray-600">잠시만 기다려주세요.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 에러 발생
  if (loadError || !loadedSurvey) {
    const isPrivateError = loadError?.includes('비공개');

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="mx-auto max-w-md">
          <CardContent className="p-8 text-center">
            {isPrivateError ? (
              <Lock className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
            ) : (
              <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            )}
            <h2 className="mb-2 text-xl font-semibold text-gray-900">
              {isPrivateError ? '접근이 제한된 설문입니다' : '설문을 찾을 수 없습니다'}
            </h2>
            <p className="mb-4 text-gray-600">
              {loadError || '요청하신 설문이 존재하지 않거나 삭제되었습니다.'}
            </p>
            <Button onClick={() => router.push('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              홈으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 질문이 없는 경우
  if (questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="mx-auto max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
            <h2 className="mb-2 text-xl font-semibold text-gray-900">아직 질문이 없습니다</h2>
            <p className="mb-4 text-gray-600">이 설문에는 아직 질문이 등록되지 않았습니다.</p>
            <Button onClick={() => router.push('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              홈으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 완료 화면
  if (isCompleted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="mx-auto max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
            <h2 className="mb-2 text-2xl font-semibold text-gray-900">응답 완료!</h2>
            <p className="mb-6 text-gray-600">
              {loadedSurvey.settings.thankYouMessage || '설문에 참여해주셔서 감사합니다!'}
            </p>
            <div className="space-y-2 text-sm text-gray-500">
              <p>총 {questions.length}개 질문</p>
              <p>응답 완료 시간: {new Date().toLocaleString()}</p>
            </div>
            <Button onClick={() => router.push('/')} className="mt-6">
              홈으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 현재 질문이 테이블 타입인지 확인
  const isTableQuestion = currentQuestion?.type === 'table';
  const containerMaxWidth = isTableQuestion ? 'max-w-7xl' : 'max-w-4xl';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="border-b border-gray-200 bg-white">
        <div className={`${containerMaxWidth} mx-auto px-4 py-4 transition-all duration-300 md:px-6`}>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 md:text-xl">{loadedSurvey.title}</h1>
              {!isEmptyHtml(loadedSurvey.description) && (
                <p className="mt-1 text-sm text-gray-600">{loadedSurvey.description}</p>
              )}
            </div>
            <div className="hidden self-start text-sm text-gray-500 md:block md:self-auto">
              {currentVisibleNumber || 1} / {Math.max(totalVisibleCount, 1)}
              <span className="ml-2 text-xs text-gray-400">(전체 {questions.length}개)</span>
            </div>
          </div>

          {/* 연속형 프로그레스바 — 데스크톱/모바일 동일 디자인 */}
          <div className="mt-3">
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${(currentVisibleNumber / Math.max(totalVisibleCount, 1)) * 100}%` }}
              />
            </div>
            {/* 모바일: 요약 텍스트 */}
            {isMobile && (
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-400">
                <span>{answeredCount}/{totalVisibleCount} 응답 완료</span>
                {requiredRemaining > 0 && (
                  <span className={showRequiredHighlight ? 'font-medium text-orange-500' : ''}>
                    필수 {requiredRemaining}개 남음
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className={`${containerMaxWidth} mx-auto px-4 py-6 transition-all duration-300 md:px-6 md:py-8 ${isMobile && !keyboardOpen ? 'pb-28' : ''}`}>
        {/* 모바일: 제목/설명을 카드 밖으로 분리 */}
        {isMobile && (
          <div className="mb-4 space-y-2.5">
            {currentGroupName && (
              <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                {currentGroupName}
              </span>
            )}
            <h2
              className={`${
                titleHasMultipleLines ? 'text-base' : 'text-lg'
              } leading-[1.6] font-bold break-keep text-gray-900`}
            >
              {currentQuestion.title}
              {isQuestionRequired(currentQuestion) && (
                <span className="ml-1 align-top text-sm text-red-500" aria-label="필수 질문">*</span>
              )}
            </h2>
            {!isEmptyHtml(currentQuestion.description) && (
              <div
                className="prose prose-sm max-h-[40vh] max-w-none overflow-auto leading-relaxed text-[13px] text-gray-500 [&_p]:min-h-[1.5em] [&_p]:leading-relaxed [&_table]:my-2 [&_table]:min-w-full [&_table]:table-auto [&_table]:border-collapse [&_table]:border [&_table]:border-gray-200 [&_table_p]:m-0 [&_table_td]:border [&_table_td]:border-gray-200 [&_table_td]:px-3 [&_table_td]:py-1.5 [&_table_th]:border [&_table_th]:border-gray-200 [&_table_th]:bg-gray-50 [&_table_th]:px-3 [&_table_th]:py-1.5 [&_table_th]:font-semibold"
                style={{ WebkitOverflowScrolling: 'touch' }}
                dangerouslySetInnerHTML={{ __html: currentQuestion.description! }}
              />
            )}
          </div>
        )}

        <Card key={currentQuestion.id} className="animate-in fade-in duration-200">
          {/* 데스크톱: 기존 카드 안에 제목+설명 유지 */}
          {!isMobile && (
            <CardHeader className="pb-4">
              <div className="flex items-start gap-4">
                <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600 shadow-sm">
                  {currentVisibleNumber || 1}
                </span>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-2xl leading-relaxed font-semibold break-keep text-gray-900">
                    {currentQuestion.title}
                    {isQuestionRequired(currentQuestion) && (
                      <span className="ml-1.5 align-top text-sm text-red-500" aria-label="필수 질문">
                        *
                      </span>
                    )}
                  </CardTitle>
                  {!isEmptyHtml(currentQuestion.description) && (
                    <div
                      className="prose prose-base mt-3 max-h-[60vh] max-w-none overflow-auto text-base text-gray-600 [&_p]:min-h-[1.6em] [&_table]:my-2 [&_table]:min-w-full [&_table]:table-auto [&_table]:border-collapse [&_table]:border [&_table]:border-gray-200 [&_table_p]:m-0 [&_table_td]:border [&_table_td]:border-gray-200 [&_table_td]:px-4 [&_table_td]:py-2 [&_table_th]:border [&_table_th]:border-gray-200 [&_table_th]:bg-gray-50 [&_table_th]:px-4 [&_table_th]:py-2 [&_table_th]:font-semibold"
                      style={{ WebkitOverflowScrolling: 'touch' }}
                      dangerouslySetInnerHTML={{ __html: currentQuestion.description! }}
                    />
                  )}
                </div>
              </div>
            </CardHeader>
          )}

          <CardContent className={`${isMobile ? 'p-4' : ''} ${isTableQuestion ? '' : 'md:px-16'}`}>
            <div className="space-y-4">
              <QuestionInput
                question={currentQuestion}
                value={responses[currentQuestion.id]}
                onChange={currentQuestionOnChange}
                allResponses={responses as Record<string, unknown>}
                allQuestions={questions}
              />
            </div>
          </CardContent>
        </Card>

        {/* 데스크톱 네비게이션 */}
        <div className="mt-8 hidden items-center justify-between md:flex">
          <Button variant="outline" onClick={handlePrevious} disabled={!hasPreviousDisplayable}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            이전
          </Button>

          <div className="text-sm text-gray-500">
            {isQuestionRequired(currentQuestion) && !isQuestionAnswered(currentQuestion) && (
              <span className="text-red-500">* 필수 질문입니다</span>
            )}
          </div>

          {isLastVisibleStep ? (
            <Button onClick={handleNext} disabled={!canProceed() || isSubmitting}>
              {isSubmitting ? '제출 중...' : '제출'}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canProceed()}>
              다음
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 모바일 고정 하단 네비게이션 (#4: 테이블 질문은 MobileTableStepper가 자체 네비게이션 보유 → 숨김) */}
      {isMobile && !keyboardOpen && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={handlePrevious}
              disabled={!hasPreviousDisplayable}
              className="flex items-center gap-1 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 active:scale-[0.98] disabled:pointer-events-none disabled:text-gray-300"
            >
              <ChevronLeft className="h-4 w-4" />
              이전
            </button>

            <div className="flex flex-col items-center">
              <span className="text-sm font-medium text-gray-900">
                {currentVisibleNumber || 1} / {Math.max(totalVisibleCount, 1)}
              </span>
              {isQuestionRequired(currentQuestion) && !isQuestionAnswered(currentQuestion) && (
                <span className="text-[11px] text-red-500">필수 질문</span>
              )}
            </div>

            {isLastVisibleStep ? (
              <button
                onClick={handleNext}
                disabled={!canProceed() || isSubmitting}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:scale-[0.98] disabled:pointer-events-none disabled:bg-gray-200 disabled:text-gray-400"
              >
                {isSubmitting ? '제출 중...' : '제출'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:scale-[0.98] disabled:pointer-events-none disabled:bg-gray-200 disabled:text-gray-400"
              >
                다음
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

