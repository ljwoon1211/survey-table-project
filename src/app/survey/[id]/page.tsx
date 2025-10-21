"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useSurveyBuilderStore } from "@/stores/survey-store";
import { useSurveyResponseStore } from "@/stores/survey-response-store";
import { InteractiveTableResponse } from "@/components/survey-builder/interactive-table-response";
import { UserDefinedMultiLevelSelect } from "@/components/survey-builder/user-defined-multi-level-select";
import { CheckCircle, AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";

export default function SurveyResponsePage() {
  const params = useParams();
  const router = useRouter();
  const surveyId = params.id as string;

  const { currentSurvey } = useSurveyBuilderStore();
  const { startResponse, updateQuestionResponse, completeResponse, currentResponse } =
    useSurveyResponseStore();

  const [responseId, setResponseId] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const questions = currentSurvey.questions;
  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  useEffect(() => {
    if (!responseId) {
      const newResponseId = startResponse(surveyId);
      setResponseId(newResponseId);
    }
  }, [surveyId, responseId, startResponse]);

  const handleResponse = (questionId: string, value: any) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
    if (responseId) {
      updateQuestionResponse(responseId, questionId, value);
    }
  };

  const isQuestionRequired = (question: any) => {
    return question.required;
  };

  const isQuestionAnswered = (question: any) => {
    const response = responses[question.id];
    if (!response) return false;

    switch (question.type) {
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
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // 필수 질문 검증
      const unansweredRequired = questions.filter(
        (q) => isQuestionRequired(q) && !isQuestionAnswered(q),
      );

      if (unansweredRequired.length > 0) {
        alert(`다음 필수 질문에 답해주세요: ${unansweredRequired.map((q) => q.title).join(", ")}`);
        setIsSubmitting(false);
        return;
      }

      if (responseId) {
        completeResponse(responseId);
        setIsCompleted(true);
      }
    } catch (error) {
      console.error("응답 제출 오류:", error);
      alert("응답 제출 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">설문을 찾을 수 없습니다</h2>
            <p className="text-gray-600 mb-4">
              요청하신 설문이 존재하지 않거나 아직 준비 중입니다.
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

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">응답 완료!</h2>
            <p className="text-gray-600 mb-6">
              {currentSurvey.settings.thankYouMessage || "설문에 참여해주셔서 감사합니다!"}
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{currentSurvey.title}</h1>
              {currentSurvey.description && (
                <p className="text-sm text-gray-600 mt-1">{currentSurvey.description}</p>
              )}
            </div>
            <div className="text-sm text-gray-500">
              {currentQuestionIndex + 1} / {questions.length}
            </div>
          </div>

          {currentSurvey.settings.showProgressBar && (
            <div className="mt-4">
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-4xl mx-auto px-6 py-8">
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
                  <p className="text-sm text-gray-600 mt-2">{currentQuestion.description}</p>
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
          <Button variant="outline" onClick={handlePrevious} disabled={currentQuestionIndex === 0}>
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

  // 값이 변경될 때 기타 입력값도 업데이트
  useEffect(() => {
    if (typeof value === "object" && value?.otherValue) {
      setOtherInput(value.otherValue);
    }
  }, [value]);

  const handleOptionChange = (optionValue: string, optionId: string) => {
    const isOtherOption = optionId === "other-option";
    if (isOtherOption) {
      // 기타 옵션 선택 시 객체로 저장
      onChange({
        selectedValue: optionValue,
        otherValue: otherInput,
        hasOther: true,
      });
    } else {
      // 일반 옵션 선택 시 값만 저장
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
              name={question.id}
              value={option.value}
              checked={isSelected(option.value)}
              onChange={() => handleOptionChange(option.value, option.id)}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <label className="text-sm text-gray-700 cursor-pointer flex-1">{option.label}</label>
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

  // 현재 값을 배열과 기타 입력값으로 분리
  const currentValues = Array.isArray(value) ? value : [];

  useEffect(() => {
    // 기존 기타 입력값들 복원
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
      // 체크됨
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
      // 체크 해제됨
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

    // 현재 값들을 업데이트
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
                checked={checked}
                onChange={(e) => handleOptionChange(option.value, option.id, e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label className="text-sm text-gray-700 cursor-pointer flex-1">{option.label}</label>
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
