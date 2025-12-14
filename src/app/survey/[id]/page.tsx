"use client";

import { useState, useEffect, useMemo } from "react";
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
import { getNextQuestionIndex } from "@/utils/branch-logic";
import { parsesurveyIdentifier } from "@/lib/survey-url";
import { Survey } from "@/types/survey";
import {
  getSurveyWithDetails,
  getSurveyBySlug,
  getSurveyByPrivateToken,
} from "@/actions/query-actions";

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
  const [responses, setResponses] = useState<Record<string, any>>({});
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
      const newResponseId = `response-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setCurrentResponseId(newResponseId);
      setResponseStarted(true);
    }
  }, [loadedSurvey, responseStarted, setCurrentResponseId]);

  // 현재 설문의 질문들
  const questions = useMemo(() => loadedSurvey?.questions || [], [loadedSurvey]);
  const currentQuestion = questions[currentQuestionIndex];
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  const handleResponse = (questionId: string, value: any) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
    // 스토어에도 임시 응답 저장
    setPendingResponse(questionId, value);
  };

  const isQuestionRequired = (question: any) => {
    return question.required;
  };

  const isQuestionAnswered = (question: any) => {
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
        return Array.isArray(response) && response.length > 0;
      case "multiselect":
        return Array.isArray(response) && response.length > 0;
      case "table":
        return response && Object.keys(response).length > 0;
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

    setQuestionHistory((prev) => [...prev, currentQuestionIndex]);

    if (nextIndex === -1) {
      handleSubmit();
    } else if (nextIndex < questions.length) {
      setCurrentQuestionIndex(nextIndex);
    }
  };

  const handlePrevious = () => {
    if (questionHistory.length > 0) {
      const previousIndex = questionHistory[questionHistory.length - 1];
      setQuestionHistory((prev) => prev.slice(0, -1));
      setCurrentQuestionIndex(previousIndex);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const unansweredRequired = questions.filter(
        (q) => isQuestionRequired(q) && !isQuestionAnswered(q),
      );

      if (unansweredRequired.length > 0) {
        alert(`다음 필수 질문에 답해주세요: ${unansweredRequired.map((q) => q.title).join(", ")}`);
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
  const containerMaxWidth = isTableQuestion ? "max-w-7xl" : "max-w-4xl";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className={`${containerMaxWidth} mx-auto px-6 py-4 transition-all duration-300`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{loadedSurvey.title}</h1>
              {loadedSurvey.description && (
                <p className="text-sm text-gray-600 mt-1">{loadedSurvey.description}</p>
              )}
            </div>
            <div className="text-sm text-gray-500">
              {currentQuestionIndex + 1} / {questions.length}
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
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 text-sm font-medium">
                    {currentQuestionIndex + 1}
                  </span>
                  {isQuestionRequired(currentQuestion) && (
                    <span className="text-red-500 text-sm">*</span>
                  )}
                </div>
                <CardTitle className="text-lg font-medium text-gray-900">
                  {currentQuestion.title}
                </CardTitle>
                {currentQuestion.description && (
                  <div
                    className="text-sm text-gray-600 mt-2 prose prose-sm max-w-none
                      [&_table]:border-collapse [&_table]:w-full [&_table]:my-2 [&_table]:border-2 [&_table]:border-gray-300
                      [&_table_td]:border [&_table_td]:border-gray-300 [&_table_td]:px-3 [&_table_td]:py-2
                      [&_table_th]:border [&_table_th]:border-gray-300 [&_table_th]:px-3 [&_table_th]:py-2
                      [&_table_th]:font-normal [&_table_th]:bg-transparent
                      [&_table_p]:m-0
                      [&_p]:min-h-[1.6em]"
                    dangerouslySetInnerHTML={{ __html: currentQuestion.description }}
                  />
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
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
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={questionHistory.length === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            이전
          </Button>

          <div className="text-sm text-gray-500">
            {isQuestionRequired(currentQuestion) && !isQuestionAnswered(currentQuestion) && (
              <span className="text-red-500">* 필수 질문입니다</span>
            )}
          </div>

          {currentQuestionIndex === questions.length - 1 ? (
            <Button onClick={handleSubmit} disabled={!canProceed() || isSubmitting}>
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
  question: any;
  value: any;
  onChange: (value: any) => void;
}) {
  switch (question.type) {
    case "notice":
      return (
        <NoticeRenderer
          content={question.noticeContent || ""}
          requiresAcknowledgment={question.requiresAcknowledgment}
          value={value || false}
          onChange={onChange}
          isTestMode={false}
        />
      );

    case "text":
      return (
        <Input
          placeholder="답변을 입력하세요..."
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full"
        />
      );

    case "textarea":
      return (
        <textarea
          className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={4}
          placeholder="답변을 입력하세요..."
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "radio":
      return <RadioQuestion question={question} value={value} onChange={onChange} />;

    case "checkbox":
      return <CheckboxQuestion question={question} value={value} onChange={onChange} />;

    case "select":
      return <SelectQuestion question={question} value={value} onChange={onChange} />;

    case "multiselect":
      return question.selectLevels ? (
        <UserDefinedMultiLevelSelect
          levels={question.selectLevels}
          values={Array.isArray(value) ? value : []}
          onChange={onChange}
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
          value={value}
          onChange={onChange}
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
  question: any;
  value: any;
  onChange: (value: any) => void;
}) {
  const [otherInput, setOtherInput] = useState("");

  useEffect(() => {
    if (typeof value === "object" && value?.otherValue) {
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
    if (typeof value === "object" && value?.hasOther) {
      onChange({
        ...value,
        otherValue: inputValue,
      });
    }
  };

  const isSelected = (optionValue: string) => {
    if (typeof value === "object" && value?.selectedValue) {
      return value.selectedValue === optionValue;
    }
    return value === optionValue;
  };

  return (
    <div className="space-y-3">
      {question.options?.map((option: any) => (
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
              className="text-sm text-gray-700 cursor-pointer flex-1"
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
  question: any;
  value: any;
  onChange: (value: any) => void;
}) {
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>({});

  const currentValues = Array.isArray(value) ? value : [];

  useEffect(() => {
    const newOtherInputs: Record<string, string> = {};
    currentValues.forEach((val: any) => {
      if (typeof val === "object" && val?.hasOther) {
        newOtherInputs[val.selectedValue] = val.otherValue || "";
      }
    });
    setOtherInputs(newOtherInputs);
  }, [currentValues]);

  const handleOptionChange = (optionValue: string, optionId: string, isChecked: boolean) => {
    let newValues = [...currentValues];
    const isOtherOption = optionId === "other-option";

    if (isChecked) {
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
      newValues = newValues.filter((val: any) => {
        if (typeof val === "object" && val?.selectedValue) {
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

    const newValues = currentValues.map((val: any) => {
      if (typeof val === "object" && val?.selectedValue === optionValue) {
        return { ...val, otherValue: inputValue };
      }
      return val;
    });

    onChange(newValues);
  };

  const isChecked = (optionValue: string) => {
    return currentValues.some((val: any) => {
      if (typeof val === "object" && val?.selectedValue) {
        return val.selectedValue === optionValue;
      }
      return val === optionValue;
    });
  };

  return (
    <div className="space-y-3">
      {question.options?.map((option: any) => {
        const checked = isChecked(option.value);

        return (
          <div key={option.id} className="space-y-2">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id={`${question.id}-${option.id}`}
                checked={checked}
                onChange={(e) => handleOptionChange(option.value, option.id, e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label
                htmlFor={`${question.id}-${option.id}`}
                className="text-sm text-gray-700 cursor-pointer flex-1"
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
    </div>
  );
}

// 드롭다운(Select) 질문 컴포넌트
function SelectQuestion({
  question,
  value,
  onChange,
}: {
  question: any;
  value: any;
  onChange: (value: any) => void;
}) {
  const [otherInput, setOtherInput] = useState("");

  useEffect(() => {
    if (typeof value === "object" && value?.otherValue) {
      setOtherInput(value.otherValue);
    }
  }, [value]);

  const handleSelectChange = (selectedValue: string) => {
    const selectedOption = question.options?.find((opt: any) => opt.value === selectedValue);

    if (selectedOption?.id === "other-option") {
      onChange({
        selectedValue,
        otherValue: otherInput,
        hasOther: true,
      });
    } else {
      onChange(selectedValue);
    }
  };

  const handleOtherInputChange = (inputValue: string) => {
    setOtherInput(inputValue);
    if (typeof value === "object" && value?.hasOther) {
      onChange({
        ...value,
        otherValue: inputValue,
      });
    }
  };

  const getCurrentValue = () => {
    if (typeof value === "object" && value?.selectedValue) {
      return value.selectedValue;
    }
    return value || "";
  };

  const showOtherInput = () => {
    const currentValue = getCurrentValue();
    const selectedOption = question.options?.find((opt: any) => opt.value === currentValue);
    return selectedOption?.id === "other-option";
  };

  return (
    <div className="space-y-3">
      <select
        value={getCurrentValue()}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">선택하세요...</option>
        {question.options?.map((option: any) => (
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
