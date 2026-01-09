"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useSurveyResponseStore } from "@/stores/survey-response-store";
import { InteractiveTableResponse } from "@/components/survey-builder/interactive-table-response";
import { UserDefinedMultiLevelSelect } from "@/components/survey-builder/user-defined-multi-level-select";
import { NoticeRenderer } from "@/components/survey-builder/notice-renderer";
import { CheckCircle, AlertCircle, ArrowLeft, ArrowRight, Loader2, Lock } from "lucide-react";
import { getNextQuestionIndex, shouldDisplayQuestion } from "@/utils/branch-logic";
import { parsesurveyIdentifier } from "@/lib/survey-url";
import { Question, QuestionOption, Survey } from "@/types/survey";
import { generateId } from "@/lib/utils";
import {
  getSurveyWithDetails,
  getSurveyBySlug,
  getSurveyByPrivateToken,
} from "@/actions/query-actions";
import { useLineCountDetection } from "@/hooks/use-line-count-detection";

type ResponsesMap = Record<string, unknown>;

type OtherChoiceValue = {
  selectedValue: string;
  otherValue?: string;
  hasOther: true;
};

function isOtherChoiceValue(value: unknown): value is OtherChoiceValue {
  if (!value || typeof value !== "object") return false;
  return (
    "selectedValue" in value &&
    typeof (value as { selectedValue: unknown }).selectedValue === "string" &&
    "hasOther" in value &&
    (value as { hasOther: unknown }).hasOther === true
  );
}

type SingleChoiceResponse = string | null | OtherChoiceValue;
type MultiChoiceResponse = Array<string | OtherChoiceValue>;

export default function SurveyResponsePage() {
  const params = useParams();
  const router = useRouter();
  // URL 인코딩된 한글 slug를 디코딩
  const identifier = decodeURIComponent(params.id as string);

  // 응답 스토어
  const { setCurrentResponseId, setPendingResponse, resetResponseState } = useSurveyResponseStore();

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

  // URL 식별자로 설문 조회
  useEffect(() => {
    const loadSurvey = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        // URL 식별자 타입 판별
        const { type, value } = parsesurveyIdentifier(identifier);

        let survey: Survey | null = null;

        switch (type) {
          case "slug": {
            const dbSurvey = await getSurveyBySlug(value);
            if (dbSurvey) {
              survey = await getSurveyWithDetails(dbSurvey.id);
            }
            break;
          }
          case "privateToken": {
            const dbSurvey = await getSurveyByPrivateToken(value);
            if (dbSurvey) {
              survey = await getSurveyWithDetails(dbSurvey.id);
            }
            break;
          }
          case "id":
            survey = await getSurveyWithDetails(value);
            break;
        }

        if (!survey) {
          setLoadError("요청하신 설문을 찾을 수 없습니다.");
          setLoadedSurvey(null);
        } else if (!survey.settings.isPublic && type === "slug") {
          // 비공개 설문인데 slug로 접근한 경우
          setLoadError("이 설문은 비공개 설문입니다. 올바른 링크로 접근해주세요.");
          setLoadedSurvey(null);
        } else {
          setLoadedSurvey(survey);
        }
      } catch (error) {
        console.error("설문 로딩 오류:", error);
        setLoadError("설문을 불러오는 중 오류가 발생했습니다.");
        setLoadedSurvey(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadSurvey();
  }, [identifier]);

  // 설문 응답 시작
  useEffect(() => {
    if (loadedSurvey && !responseStarted) {
      // 응답 ID 생성 및 스토어에 설정
      const newResponseId = generateId();
      setCurrentResponseId(newResponseId);
      setResponseStarted(true);
    }
  }, [loadedSurvey, responseStarted, setCurrentResponseId]);

  // 현재 설문의 질문들
  const questions = useMemo(() => loadedSurvey?.questions || [], [loadedSurvey]);
  const groups = useMemo(() => loadedSurvey?.groups || [], [loadedSurvey]);
  const currentQuestion = questions[currentQuestionIndex];
  const visibleQuestions = useMemo(() => {
    return questions.filter((q) => shouldDisplayQuestion(q, responses, questions, groups));
  }, [questions, responses, groups]);

  // 모바일 화면 감지
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md 브레이크포인트
    };

    // 초기 체크
    checkMobile();

    // 리사이즈 이벤트 리스너
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  // 질문 타이틀 줄 수 감지
  const [titleRef, titleHasMultipleLines] = useLineCountDetection<HTMLParagraphElement>(
    isMobile,
    currentQuestion?.title,
  );

  // 질문 설명 줄 수 감지
  const [descriptionRef, descriptionHasMultipleLines] = useLineCountDetection<HTMLDivElement>(
    isMobile,
    currentQuestion?.description,
  );

  const currentVisibleNumber = useMemo(() => {
    if (!currentQuestion) return 0;
    const idx = visibleQuestions.findIndex((q) => q.id === currentQuestion.id);
    return idx === -1 ? 0 : idx + 1;
  }, [currentQuestion, visibleQuestions]);

  const totalVisibleCount = visibleQuestions.length;

  const progress = totalVisibleCount > 0 ? (currentVisibleNumber / totalVisibleCount) * 100 : 0;

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

  const handleResponse = (questionId: string, value: unknown) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
    // 스토어에도 임시 응답 저장
    setPendingResponse(questionId, value);
  };

  const isQuestionRequired = (question: Question) => {
    return question.required;
  };

  const isQuestionAnswered = (question: Question) => {
    const response = responses[question.id];
    if (!response) return false;

    switch (question.type) {
      case "notice":
        return question.requiresAcknowledgment ? response === true : true;
      case "text":
      case "textarea":
        return typeof response === "string" && response.trim().length > 0;
      case "radio":
      case "select":
        return response !== null && response !== undefined && response !== "";
      case "checkbox":
        if (!Array.isArray(response) || response.length === 0) return false;
        // 최소 선택 개수 검증
        if (question.minSelections !== undefined && question.minSelections > 0) {
          return response.length >= question.minSelections;
        }
        return true;
      case "multiselect":
        return Array.isArray(response) && response.length > 0;
      case "table":
        return (
          typeof response === "object" &&
          response !== null &&
          Object.keys(response as Record<string, unknown>).length > 0
        );
      default:
        return true;
    }
  };

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
      // 마지막 질문이면 제출
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
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const unansweredRequired = questions.filter((q) => {
        // 표시되지 않는 질문은 필수 여부를 강제하지 않음
        if (!shouldDisplayQuestion(q, responses, questions, groups)) return false;
        return isQuestionRequired(q) && !isQuestionAnswered(q);
      });

      if (unansweredRequired.length > 0) {
        const errorMessages = unansweredRequired.map((q) => {
          if (q.type === "checkbox" && q.minSelections !== undefined && q.minSelections > 0) {
            const response = responses[q.id];
            const count = Array.isArray(response) ? response.length : 0;
            return `${q.title} (최소 ${q.minSelections}개 선택 필요, 현재 ${count}개 선택됨)`;
          }
          return q.title;
        });
        alert(`다음 필수 질문에 답해주세요:\n${errorMessages.join("\n")}`);
        setIsSubmitting(false);
        return;
      }

      // TODO: 서버에 응답 저장 로직 추가 필요
      // 현재는 클라이언트에서만 완료 처리
      resetResponseState();
      setIsCompleted(true);
    } catch (error) {
      console.error("응답 제출 오류:", error);
      alert("응답 제출 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 로딩 중
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">설문을 불러오는 중...</h2>
            <p className="text-gray-600">잠시만 기다려주세요.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 에러 발생
  if (loadError || !loadedSurvey) {
    const isPrivateError = loadError?.includes("비공개");

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            {isPrivateError ? (
              <Lock className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
            ) : (
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            )}
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {isPrivateError ? "접근이 제한된 설문입니다" : "설문을 찾을 수 없습니다"}
            </h2>
            <p className="text-gray-600 mb-4">
              {loadError || "요청하신 설문이 존재하지 않거나 삭제되었습니다."}
            </p>
            <Button onClick={() => router.push("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">아직 질문이 없습니다</h2>
            <p className="text-gray-600 mb-4">이 설문에는 아직 질문이 등록되지 않았습니다.</p>
            <Button onClick={() => router.push("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">응답 완료!</h2>
            <p className="text-gray-600 mb-6">
              {loadedSurvey.settings.thankYouMessage || "설문에 참여해주셔서 감사합니다!"}
            </p>
            <div className="space-y-2 text-sm text-gray-500">
              <p>총 {questions.length}개 질문</p>
              <p>응답 완료 시간: {new Date().toLocaleString()}</p>
            </div>
            <Button onClick={() => router.push("/")} className="mt-6">
              홈으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 현재 질문이 테이블 타입인지 확인
  const isTableQuestion = currentQuestion?.type === "table";
  const containerMaxWidth = "max-w-4xl";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className={`${containerMaxWidth} mx-auto px-6 py-4 transition-all duration-300`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{loadedSurvey.title}</h1>
              {loadedSurvey.description && (
                <p className="text-sm text-gray-600 mt-1">{loadedSurvey.description}</p>
              )}
            </div>
            <div className="text-sm text-gray-500 self-start md:self-auto">
              {currentVisibleNumber || 1} / {Math.max(totalVisibleCount, 1)}
              <span className="ml-2 text-xs text-gray-400">(전체 {questions.length}개)</span>
            </div>
          </div>

          {loadedSurvey.settings.showProgressBar && (
            <div className="mt-4">
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className={`${containerMaxWidth} mx-auto px-6 py-8 transition-all duration-300`}>
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start gap-4">
              <span className="hidden md:flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 text-sm font-semibold mt-0.5 shadow-sm">
                {currentVisibleNumber || 1}
              </span>
              <div className="flex-1 min-w-0">
                <CardTitle
                  ref={titleRef}
                  className={`${
                    titleHasMultipleLines && isMobile
                      ? "text-base md:text-2xl"
                      : "text-xl md:text-2xl"
                  } font-semibold text-gray-900 leading-relaxed break-keep`}
                >
                  {currentQuestion.title}
                  {isQuestionRequired(currentQuestion) && (
                    <span className="text-red-500 text-sm ml-1.5 align-top" aria-label="필수 질문">
                      *
                    </span>
                  )}
                </CardTitle>
                {currentQuestion.description && (
                  <div
                    ref={descriptionRef}
                    className={`${
                      descriptionHasMultipleLines && isMobile ? "text-base" : "text-base"
                    } text-gray-600 mt-3 prose prose-base max-w-none overflow-auto max-h-[60vh]
                      [&_table]:border-collapse [&_table]:table-auto [&_table]:min-w-full [&_table]:my-2 [&_table]:border [&_table]:border-gray-200
                      [&_table_td]:border [&_table_td]:border-gray-200 [&_table_td]:px-4 [&_table_td]:py-2
                      [&_table_th]:border [&_table_th]:border-gray-200 [&_table_th]:px-4 [&_table_th]:py-2 [&_table_th]:bg-gray-50 [&_table_th]:font-semibold
                      [&_table_p]:m-0
                      [&_p]:min-h-[1.6em]`}
                    style={{
                      WebkitOverflowScrolling: "touch",
                    }}
                    dangerouslySetInnerHTML={{ __html: currentQuestion.description }}
                  />
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className={isTableQuestion ? "" : "md:pl-18"}>
            <div className="space-y-4">
              <QuestionInput
                question={currentQuestion}
                value={responses[currentQuestion.id]}
                onChange={(value) => handleResponse(currentQuestion.id, value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 네비게이션 */}
        <div className="flex justify-between items-center mt-8">
          <Button variant="outline" onClick={handlePrevious} disabled={!hasPreviousDisplayable}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            이전
          </Button>

          <div className="text-sm text-gray-500">
            {isQuestionRequired(currentQuestion) && !isQuestionAnswered(currentQuestion) && (
              <span className="text-red-500">* 필수 질문입니다</span>
            )}
          </div>

          {isLastVisibleStep ? (
            <Button onClick={handleNext} disabled={!canProceed() || isSubmitting}>
              {isSubmitting ? "제출 중..." : "제출"}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canProceed()}>
              다음
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (question.type) {
    case "notice":
      return (
        <NoticeRenderer
          content={question.noticeContent || ""}
          requiresAcknowledgment={question.requiresAcknowledgment}
          value={typeof value === "boolean" ? value : false}
          onChange={(v) => onChange(v)}
          isTestMode={false}
        />
      );

    case "text":
      return (
        <Input
          placeholder={question.placeholder || "답변을 입력하세요..."}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-base"
        />
      );

    case "textarea":
      return (
        <textarea
          className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
          rows={4}
          placeholder="답변을 입력하세요..."
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "radio":
      return (
        <RadioQuestion
          question={question}
          value={(value ?? null) as SingleChoiceResponse}
          onChange={onChange}
        />
      );

    case "checkbox":
      return (
        <CheckboxQuestion
          question={question}
          value={value as MultiChoiceResponse | unknown}
          onChange={onChange}
        />
      );

    case "select":
      return (
        <SelectQuestion
          question={question}
          value={(value ?? "") as SingleChoiceResponse}
          onChange={onChange}
        />
      );

    case "multiselect":
      return question.selectLevels ? (
        <UserDefinedMultiLevelSelect
          levels={question.selectLevels}
          values={Array.isArray(value) ? (value as string[]) : []}
          onChange={(v) => onChange(v)}
          className="w-full"
        />
      ) : (
        <div className="text-gray-500 text-center py-4">다단계 선택이 구성되지 않았습니다.</div>
      );

    case "table":
      return question.tableColumns && question.tableRowsData ? (
        <InteractiveTableResponse
          questionId={question.id}
          tableTitle={question.tableTitle}
          columns={question.tableColumns}
          rows={question.tableRowsData}
          value={
            typeof value === "object" && value !== null
              ? (value as Record<string, unknown>)
              : undefined
          }
          onChange={(v) => onChange(v)}
          isTestMode={false}
          className="border-0 shadow-none"
        />
      ) : (
        <div className="text-gray-500 text-center py-4">테이블이 구성되지 않았습니다.</div>
      );

    default:
      return <div className="text-gray-500 text-center py-4">지원하지 않는 질문 유형입니다.</div>;
  }
}

// 단일선택(Radio) 질문 컴포넌트
function RadioQuestion({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: SingleChoiceResponse;
  onChange: (value: SingleChoiceResponse) => void;
}) {
  const [otherInput, setOtherInput] = useState("");

  useEffect(() => {
    if (isOtherChoiceValue(value) && value.otherValue) {
      setOtherInput(value.otherValue);
    }
  }, [value]);

  const handleOptionChange = (optionValue: string, optionId: string) => {
    const isOtherOption = optionId === "other-option";

    if (isSelected(optionValue)) {
      onChange(null);
      return;
    }

    if (isOtherOption) {
      onChange({
        selectedValue: optionValue,
        otherValue: otherInput,
        hasOther: true,
      });
    } else {
      onChange(optionValue);
    }
  };

  const handleOtherInputChange = (inputValue: string) => {
    setOtherInput(inputValue);
    if (isOtherChoiceValue(value)) {
      onChange({
        ...value,
        otherValue: inputValue,
      });
    }
  };

  const isSelected = (optionValue: string) => {
    if (isOtherChoiceValue(value)) {
      return value.selectedValue === optionValue;
    }
    return value === optionValue;
  };

  return (
    <div className="space-y-3">
      {question.options?.map((option: QuestionOption) => (
        <div key={option.id} className="space-y-2">
          <div className="flex items-center space-x-3">
            <input
              type="radio"
              id={`${question.id}-${option.id}`}
              name={question.id}
              value={option.value}
              checked={isSelected(option.value)}
              onChange={() => handleOptionChange(option.value, option.id)}
              onClick={() => handleOptionChange(option.value, option.id)}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
            />
            <label
              htmlFor={`${question.id}-${option.id}`}
              onClick={(e) => {
                e.preventDefault();
                handleOptionChange(option.value, option.id);
              }}
              className="text-base text-gray-700 cursor-pointer flex-1"
            >
              {option.label}
            </label>
          </div>
          {option.id === "other-option" && isSelected(option.value) && (
            <div className="ml-7">
              <Input
                placeholder="기타 내용을 입력하세요..."
                value={otherInput}
                onChange={(e) => handleOtherInputChange(e.target.value)}
                className="w-full"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// 다중선택(Checkbox) 질문 컴포넌트
function CheckboxQuestion({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: unknown;
  onChange: (value: MultiChoiceResponse) => void;
}) {
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>({});

  const currentValues = useMemo<MultiChoiceResponse>(
    () => (Array.isArray(value) ? (value as MultiChoiceResponse) : []),
    [value],
  );

  useEffect(() => {
    const newOtherInputs: Record<string, string> = {};
    currentValues.forEach((val) => {
      if (isOtherChoiceValue(val)) {
        newOtherInputs[val.selectedValue] = val.otherValue || "";
      }
    });
    setOtherInputs(newOtherInputs);
  }, [currentValues]);

  const handleOptionChange = (optionValue: string, optionId: string, isChecked: boolean) => {
    let newValues = [...currentValues];
    const isOtherOption = optionId === "other-option";

    if (isChecked) {
      // 최대 선택 개수 체크
      const maxSelections = question.maxSelections;
      if (maxSelections !== undefined && maxSelections > 0) {
        const currentCount = newValues.length;
        if (currentCount >= maxSelections) {
          // 최대 개수 도달 시 추가 선택 불가
          return;
        }
      }

      if (isOtherOption) {
        newValues.push({
          selectedValue: optionValue,
          otherValue: otherInputs[optionValue] || "",
          hasOther: true,
        });
      } else {
        newValues.push(optionValue);
      }
    } else {
      newValues = newValues.filter((val) => {
        if (isOtherChoiceValue(val)) {
          return val.selectedValue !== optionValue;
        }
        return val !== optionValue;
      });
    }

    onChange(newValues);
  };

  const handleOtherInputChange = (optionValue: string, inputValue: string) => {
    const newOtherInputs = { ...otherInputs, [optionValue]: inputValue };
    setOtherInputs(newOtherInputs);

    const newValues = currentValues.map((val) => {
      if (isOtherChoiceValue(val) && val.selectedValue === optionValue) {
        return { ...val, otherValue: inputValue };
      }
      return val;
    });

    onChange(newValues);
  };

  const isChecked = (optionValue: string) => {
    return currentValues.some((val) => {
      if (isOtherChoiceValue(val)) {
        return val.selectedValue === optionValue;
      }
      return val === optionValue;
    });
  };

  const currentCount = currentValues.length;
  const maxSelections = question.maxSelections;
  const minSelections = question.minSelections;
  const isMaxReached =
    maxSelections !== undefined && maxSelections > 0 && currentCount >= maxSelections;
  const isMinNotMet =
    minSelections !== undefined && minSelections > 0 && currentCount < minSelections;

  const canSelect = (optionValue: string) => {
    if (isChecked(optionValue)) return true; // 이미 선택된 것은 해제 가능
    if (isMaxReached) return false; // 최대 개수 도달 시 추가 선택 불가
    return true;
  };

  return (
    <div className="space-y-3">
      {question.options?.map((option: QuestionOption) => {
        const checked = isChecked(option.value);
        const disabled = !canSelect(option.value);

        return (
          <div key={option.id} className="space-y-2">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id={`${question.id}-${option.id}`}
                checked={checked}
                disabled={disabled}
                onChange={(e) => handleOptionChange(option.value, option.id, e.target.checked)}
                className={`w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${
                  disabled ? "opacity-50 cursor-not-allowed" : ""
                }`}
              />
              <label
                htmlFor={`${question.id}-${option.id}`}
                className={`text-base text-gray-700 flex-1 ${
                  disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                {option.label}
              </label>
            </div>
            {option.id === "other-option" && checked && (
              <div className="ml-7">
                <Input
                  placeholder="기타 내용을 입력하세요..."
                  value={otherInputs[option.value] || ""}
                  onChange={(e) => handleOtherInputChange(option.value, e.target.value)}
                  className="w-full"
                />
              </div>
            )}
          </div>
        );
      })}

      {/* 선택 개수 표시 */}
      {(maxSelections !== undefined || minSelections !== undefined) && (
        <div className="pt-2 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {maxSelections !== undefined && maxSelections > 0
                ? `${currentCount}/${maxSelections}개 선택됨`
                : `${currentCount}개 선택됨`}
            </span>
            {isMinNotMet && (
              <span className="text-orange-600">최소 {minSelections}개 이상 선택해주세요</span>
            )}
            {isMaxReached && <span className="text-blue-600">최대 선택 개수에 도달했습니다</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// 드롭다운(Select) 질문 컴포넌트
function SelectQuestion({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: SingleChoiceResponse;
  onChange: (value: SingleChoiceResponse) => void;
}) {
  const [otherInput, setOtherInput] = useState("");
  const [selectedValue, setSelectedValue] = useState<string>("");

  // value가 변경될 때 selectedValue와 otherInput 동기화
  useEffect(() => {
    if (isOtherChoiceValue(value)) {
      setSelectedValue(value.selectedValue);
      setOtherInput(value.otherValue || "");
    } else {
      setSelectedValue(value || "");
      setOtherInput("");
    }
  }, [value]);

  const handleSelectChange = (newValue: string) => {
    setSelectedValue(newValue);
    const selectedOption = question.options?.find((opt) => opt.value === newValue);

    if (selectedOption?.id === "other-option") {
      onChange({
        selectedValue: newValue,
        otherValue: otherInput,
        hasOther: true,
      });
    } else {
      onChange(newValue);
    }
  };

  const handleOtherInputChange = (inputValue: string) => {
    setOtherInput(inputValue);
    if (selectedValue) {
      const selectedOption = question.options?.find((opt) => opt.value === selectedValue);
      if (selectedOption?.id === "other-option") {
        onChange({
          selectedValue,
          otherValue: inputValue,
          hasOther: true,
        });
      }
    }
  };

  const showOtherInput = () => {
    if (!selectedValue) return false;
    const selectedOption = question.options?.find((opt) => opt.value === selectedValue);
    return selectedOption?.id === "other-option";
  };

  return (
    <div className="space-y-3">
      <select
        value={selectedValue}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
      >
        <option value="">선택하세요...</option>
        {question.options?.map((option: QuestionOption) => (
          <option key={option.id} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {showOtherInput() && (
        <div>
          <Input
            placeholder="기타 내용을 입력하세요..."
            value={otherInput}
            onChange={(e) => handleOtherInputChange(e.target.value)}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}
