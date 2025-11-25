"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSurveyBuilderStore } from "@/stores/survey-store";
import { useSurveyListStore } from "@/stores/survey-list-store";
import { SortableQuestionList } from "@/components/survey-builder/sortable-question-list";
import { GroupManager } from "@/components/survey-builder/group-manager";
import { generateOTTSurvey } from "@/utils/ott-survey-generator";
import {
  FileText,
  Eye,
  Share2,
  Save,
  ArrowLeft,
  Plus,
  Type,
  List,
  CheckSquare,
  Circle,
  ChevronDown,
  Table,
  PlayCircle,
  Tv,
  Sparkles,
  Check,
  Info,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const questionTypes = [
  {
    type: "notice" as const,
    label: "공지사항",
    icon: Info,
    description: "설명 및 안내 문구",
    color: "bg-blue-100 text-blue-600",
  },
  {
    type: "text" as const,
    label: "단답형",
    icon: Type,
    description: "짧은 텍스트 입력",
    color: "bg-sky-100 text-sky-600",
  },
  {
    type: "textarea" as const,
    label: "장문형",
    icon: FileText,
    description: "긴 텍스트 입력",
    color: "bg-green-100 text-green-600",
  },
  {
    type: "radio" as const,
    label: "단일선택",
    icon: Circle,
    description: "하나만 선택 가능",
    color: "bg-purple-100 text-purple-600",
  },
  {
    type: "checkbox" as const,
    label: "다중선택",
    icon: CheckSquare,
    description: "여러 개 선택 가능",
    color: "bg-orange-100 text-orange-600",
  },
  {
    type: "select" as const,
    label: "드롭다운",
    icon: ChevronDown,
    description: "드롭다운 메뉴",
    color: "bg-pink-100 text-pink-600",
  },
  {
    type: "multiselect" as const,
    label: "다단계선택",
    icon: List,
    description: "다중 드롭다운",
    color: "bg-teal-100 text-teal-600",
  },
  {
    type: "table" as const,
    label: "테이블",
    icon: Table,
    description: "표 형태 질문",
    color: "bg-indigo-100 text-indigo-600",
  },
];

export default function CreateSurveyPage() {
  const router = useRouter();
  const {
    currentSurvey,
    selectedQuestionId,
    isPreviewMode,
    isTestMode,
    updateSurveyTitle,
    addQuestion,
    addPreparedQuestion,
    selectQuestion,
    togglePreviewMode,
    toggleTestMode,
    updateSurveySettings,
    resetSurvey,
  } = useSurveyBuilderStore();

  const { saveSurvey } = useSurveyListStore();

  const [titleInput, setTitleInput] = useState(currentSurvey.title);
  const [saveMessage, setSaveMessage] = useState("");
  const [questionNumberInput, setQuestionNumberInput] = useState("");
  const [showScrollButtons, setShowScrollButtons] = useState(false);

  // 새 설문 생성 시 초기화
  useEffect(() => {
    resetSurvey();
    setTitleInput("새 설문조사");
  }, [resetSurvey]);

  // 스크롤 감지
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 200) {
        setShowScrollButtons(true);
      } else {
        setShowScrollButtons(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // OTT 설문지 예제 추가 함수
  const handleAddOTTSurvey = () => {
    const ottQuestion = generateOTTSurvey();

    // 설문 제목을 OTT 관련으로 업데이트
    if (currentSurvey.title === "새 설문조사") {
      updateSurveyTitle("OTT 서비스 이용 현황 조사");
      setTitleInput("OTT 서비스 이용 현황 조사");
    }

    // 질문을 현재 설문에 추가
    addPreparedQuestion(ottQuestion);
  };

  // 설문 저장
  const handleSaveSurvey = () => {
    // ID가 없으면 새로 생성
    const surveyToSave = currentSurvey.id
      ? currentSurvey
      : { ...currentSurvey, id: `survey-${Date.now()}` };

    saveSurvey(surveyToSave);
    setSaveMessage("저장되었습니다!");

    setTimeout(() => {
      setSaveMessage("");
      // 저장 후 목록 페이지로 이동
      router.push("/admin/surveys");
    }, 1000);
  };

  // 맨 위로 스크롤
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 맨 아래로 스크롤
  const scrollToBottom = () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  };

  // 특정 질문으로 스크롤
  const scrollToQuestion = (questionNumber: number) => {
    const questionIndex = questionNumber - 1;
    if (questionIndex >= 0 && questionIndex < currentSurvey.questions.length) {
      const questionElement = document.querySelector(`[data-question-index="${questionIndex}"]`);
      if (questionElement) {
        questionElement.scrollIntoView({ behavior: "smooth", block: "center" });
        selectQuestion(currentSurvey.questions[questionIndex].id);
      }
    }
  };

  // 질문 번호 입력 핸들러
  const handleQuestionNumberKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const questionNumber = parseInt(questionNumberInput, 10);
      if (!isNaN(questionNumber) && questionNumber > 0) {
        scrollToQuestion(questionNumber);
        setQuestionNumberInput("");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/admin/surveys">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                목록으로
              </Button>
            </Link>
            <div className="h-6 w-px bg-gray-300" />
            <Input
              value={titleInput}
              onChange={(e) => {
                setTitleInput(e.target.value);
                updateSurveyTitle(e.target.value);
              }}
              className="text-lg font-medium border-none bg-transparent px-2 focus:bg-white focus:border focus:border-blue-200"
              placeholder="설문 제목을 입력하세요"
            />
          </div>

          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" onClick={togglePreviewMode}>
              <Eye className="w-4 h-4 mr-2" />
              {isPreviewMode ? "편집" : "미리보기"}
            </Button>
            <Button
              variant={isTestMode ? "default" : "outline"}
              size="sm"
              onClick={toggleTestMode}
              className={isTestMode ? "bg-green-600 hover:bg-green-700" : ""}
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              {isTestMode ? "테스트 중" : "테스트"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleSaveSurvey} className="relative">
              <Save className="w-4 h-4 mr-2" />
              저장
              {saveMessage && (
                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-green-600 text-white text-xs rounded whitespace-nowrap">
                  <Check className="w-3 h-3 inline mr-1" />
                  {saveMessage}
                </span>
              )}
            </Button>
            <Button size="sm">
              <Share2 className="w-4 h-4 mr-2" />
              공유
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - Question Types */}
          <div className="col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-h-[calc(100vh-140px)] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">질문 유형</h3>

            <div className="space-y-3">
              {questionTypes.map((questionType) => {
                const IconComponent = questionType.icon;
                return (
                  <Card
                    key={questionType.type}
                    className="p-4 cursor-pointer hover-lift border-gray-200 hover:border-blue-200 transition-all duration-200"
                    onClick={() => addQuestion(questionType.type)}
                  >
                    <div className="flex items-start space-x-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${questionType.color}`}
                      >
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 text-sm">{questionType.label}</h4>
                        <p className="text-xs text-gray-500 mt-1">{questionType.description}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* OTT 설문지 예제 버튼 */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">설문 예제</h4>
              <Card
                className="p-4 cursor-pointer hover-lift border-gray-200 hover:border-orange-200 transition-all duration-200"
                onClick={handleAddOTTSurvey}
              >
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-orange-100 text-orange-600">
                    <Tv className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 text-sm flex items-center gap-1">
                      OTT 설문지
                      <Sparkles className="w-3 h-3 text-yellow-500" />
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      업로드한 이미지와 동일한 OTT 서비스 설문지
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">설문 정보</h4>
              <div className="text-xs text-gray-500 space-y-1">
                <p>그룹 수: {(currentSurvey.groups || []).length}개</p>
                <p>질문 수: {currentSurvey.questions.length}개</p>
                <p>마지막 수정: {currentSurvey.updatedAt.toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Center - Survey Preview/Edit */}
          <div className="col-span-6 bg-white rounded-xl shadow-sm border border-gray-200 max-h-[calc(100vh-140px)] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {isTestMode ? "질문 테스트" : isPreviewMode ? "미리보기" : "설문 편집"}
                  </h3>
                  {isTestMode && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                      테스트 모드
                    </span>
                  )}
                  {!isTestMode && !isPreviewMode && currentSurvey.questions.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        min="1"
                        max={currentSurvey.questions.length}
                        value={questionNumberInput}
                        onChange={(e) => setQuestionNumberInput(e.target.value)}
                        onKeyPress={handleQuestionNumberKeyPress}
                        placeholder="질문 번호"
                        className="w-24 h-8 text-sm"
                      />
                      <span className="text-xs text-gray-500">
                        / {currentSurvey.questions.length}
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-500">{currentSurvey.questions.length}개 질문</div>
              </div>
            </div>

            <div className="p-6">
              {currentSurvey.questions.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Plus className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">질문을 추가해보세요</h3>
                  <p className="text-gray-500 mb-6">
                    왼쪽에서 원하는 질문 유형을 클릭하여 추가할 수 있습니다.
                  </p>
                  <Button onClick={() => addQuestion("text")}>
                    <Plus className="w-4 h-4 mr-2" />첫 번째 질문 추가
                  </Button>
                </div>
              ) : (
                <SortableQuestionList
                  questions={currentSurvey.questions}
                  selectedQuestionId={selectedQuestionId}
                  isTestMode={isTestMode}
                />
              )}
            </div>
          </div>

          {/* Right Sidebar - Settings */}
          <div className="col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-h-[calc(100vh-140px)] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">설정</h3>

            <div className="space-y-6">
              {/* 설문 설정 */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">설문 설정</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-600">공개 설문</label>
                    <input
                      type="checkbox"
                      checked={currentSurvey.settings.isPublic}
                      onChange={(e) => updateSurveySettings({ isPublic: e.target.checked })}
                      className="rounded"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-600">진행률 표시</label>
                    <input
                      type="checkbox"
                      checked={currentSurvey.settings.showProgressBar}
                      onChange={(e) => updateSurveySettings({ showProgressBar: e.target.checked })}
                      className="rounded"
                    />
                  </div>
                </div>
              </div>

              {/* 그룹 관리 */}
              <div className="pt-6 border-t border-gray-200">
                <GroupManager className="max-h-[400px]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Scroll Buttons */}
      {showScrollButtons && (
        <div className="fixed right-6 bottom-6 flex flex-col space-y-2 z-50">
          <Button
            onClick={scrollToTop}
            size="sm"
            className="w-12 h-12 rounded-full shadow-lg bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 transition-all duration-200 hover:scale-110"
            title="맨 위로"
          >
            <ArrowUp className="w-5 h-5" />
          </Button>
          <Button
            onClick={scrollToBottom}
            size="sm"
            className="w-12 h-12 rounded-full shadow-lg bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 transition-all duration-200 hover:scale-110"
            title="맨 아래로"
          >
            <ArrowDown className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
}
