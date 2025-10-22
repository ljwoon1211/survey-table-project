# Zustand 스토어 가이드

이 프로젝트에서는 Zustand와 localStorage를 사용하여 설문조사 데이터를 관리합니다.

## 📦 스토어 구성

### 1. `survey-store.ts` - 설문 편집 스토어

현재 편집 중인 설문을 관리합니다.

**localStorage 키:** `survey-builder-storage`

**저장되는 데이터:**

- `currentSurvey`: 현재 편집 중인 설문 데이터

**UI 상태 (저장 안 됨):**

- selectedQuestionId
- isPreviewMode
- isTestMode
- testResponses

```typescript
import { useSurveyBuilderStore } from "@/stores";

function MyComponent() {
  const currentSurvey = useSurveyBuilderStore((state) => state.currentSurvey);
  const updateSurveyTitle = useSurveyBuilderStore((state) => state.updateSurveyTitle);

  const handleTitleChange = (title: string) => {
    updateSurveyTitle(title);
  };

  return <div>{currentSurvey.title}</div>;
}
```

### 2. `survey-response-store.ts` - 설문 응답 스토어

설문조사 응답 데이터를 관리합니다.

**localStorage 키:** `survey-response-store`

**저장되는 데이터:**

- `responses`: 모든 응답 데이터
- `responseSummaries`: 설문별 요약 통계

```typescript
import { useSurveyResponseStore } from "@/stores";

function SurveyForm() {
  const startResponse = useSurveyResponseStore((state) => state.startResponse);
  const updateQuestionResponse = useSurveyResponseStore((state) => state.updateQuestionResponse);
  const completeResponse = useSurveyResponseStore((state) => state.completeResponse);

  const handleSubmit = () => {
    const responseId = startResponse("survey-123");
    updateQuestionResponse(responseId, "question-1", "답변");
    completeResponse(responseId);
  };

  return <button onClick={handleSubmit}>제출</button>;
}
```

### 3. `survey-list-store.ts` - 설문 목록 스토어 (NEW!)

여러 설문을 저장하고 관리합니다.

**localStorage 키:** `survey-list-storage`

**저장되는 데이터:**

- `surveys`: 모든 설문 목록

```typescript
import { useSurveyListStore } from "@/stores";

function SurveyList() {
  const surveys = useSurveyListStore((state) => state.surveys);
  const saveSurvey = useSurveyListStore((state) => state.saveSurvey);
  const deleteSurvey = useSurveyListStore((state) => state.deleteSurvey);
  const duplicateSurvey = useSurveyListStore((state) => state.duplicateSurvey);

  return (
    <div>
      {surveys.map((survey) => (
        <div key={survey.id}>
          <h3>{survey.title}</h3>
          <button onClick={() => duplicateSurvey(survey.id)}>복사</button>
          <button onClick={() => deleteSurvey(survey.id)}>삭제</button>
        </div>
      ))}
    </div>
  );
}
```

## 🔄 일반적인 워크플로우

### 설문 생성 및 저장

```typescript
import { useSurveyBuilderStore, useSurveyListStore } from "@/stores";

function CreateSurvey() {
  const currentSurvey = useSurveyBuilderStore((state) => state.currentSurvey);
  const resetSurvey = useSurveyBuilderStore((state) => state.resetSurvey);
  const saveSurvey = useSurveyListStore((state) => state.saveSurvey);

  const handleSave = () => {
    // 1. 현재 편집 중인 설문을 목록에 저장
    saveSurvey(currentSurvey);

    // 2. 편집기 초기화 (새 설문 작성 준비)
    resetSurvey();

    alert("설문이 저장되었습니다!");
  };

  return <button onClick={handleSave}>저장</button>;
}
```

### 저장된 설문 불러오기

```typescript
import { useSurveyBuilderStore, useSurveyListStore } from "@/stores";

function LoadSurvey({ surveyId }: { surveyId: string }) {
  const getSurveyById = useSurveyListStore((state) => state.getSurveyById);
  const currentSurvey = useSurveyBuilderStore((state) => state.currentSurvey);

  const handleLoad = () => {
    const savedSurvey = getSurveyById(surveyId);
    if (savedSurvey) {
      // 저장된 설문을 편집기에 로드
      useSurveyBuilderStore.setState({ currentSurvey: savedSurvey });
    }
  };

  return <button onClick={handleLoad}>불러오기</button>;
}
```

### 설문 응답 수집 및 조회

```typescript
import { useSurveyResponseStore } from "@/stores";

function Analytics({ surveyId }: { surveyId: string }) {
  const getCompletedResponses = useSurveyResponseStore((state) => state.getCompletedResponses);
  const calculateSummary = useSurveyResponseStore((state) => state.calculateSummary);
  const exportResponses = useSurveyResponseStore((state) => state.exportResponses);

  const responses = getCompletedResponses(surveyId);
  const summary = calculateSummary(surveyId);

  const handleExport = () => {
    const csv = exportResponses(surveyId, "csv");
    // CSV 다운로드 로직
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `survey-${surveyId}-responses.csv`;
    a.click();
  };

  return (
    <div>
      <h2>응답 통계</h2>
      <p>전체 응답: {summary.totalResponses}건</p>
      <p>완료된 응답: {summary.completedResponses}건</p>
      <p>평균 완료 시간: {summary.averageCompletionTime.toFixed(1)}분</p>
      <button onClick={handleExport}>CSV 다운로드</button>
    </div>
  );
}
```

## 🛠️ 유용한 기능들

### 설문 검색

```typescript
const searchSurveys = useSurveyListStore((state) => state.searchSurveys);
const results = searchSurveys("고객 만족도");
```

### 설문 복제

```typescript
const duplicateSurvey = useSurveyListStore((state) => state.duplicateSurvey);
const newSurvey = duplicateSurvey("survey-123");
```

### 설문 내보내기/가져오기

```typescript
const exportSurveys = useSurveyListStore((state) => state.exportSurveys);
const importSurveys = useSurveyListStore((state) => state.importSurveys);

// 내보내기
const json = exportSurveys(["survey-1", "survey-2"]);
console.log(json);

// 가져오기
importSurveys(json);
```

### 질문별 통계

```typescript
const getQuestionStatistics = useSurveyResponseStore((state) => state.getQuestionStatistics);
const stats = getQuestionStatistics("survey-123", "question-1");

console.log(stats.totalResponses); // 전체 응답 수
console.log(stats.responseCounts); // 옵션별 응답 수
```

## 🔍 localStorage 디버깅

브라우저 개발자 도구에서 localStorage를 확인할 수 있습니다:

```javascript
// Chrome DevTools Console에서
localStorage.getItem("survey-builder-storage");
localStorage.getItem("survey-response-store");
localStorage.getItem("survey-list-storage");

// 모든 데이터 삭제 (주의!)
localStorage.clear();
```

## 📝 주의사항

1. **Date 객체 처리**: 모든 스토어는 Date 객체를 자동으로 직렬화/역직렬화합니다.
2. **용량 제한**: localStorage는 약 5-10MB 제한이 있습니다. 대용량 데이터는 주의하세요.
3. **브라우저 별**: localStorage는 브라우저별로 독립적입니다.
4. **보안**: 민감한 정보는 localStorage에 저장하지 마세요.

## 🚀 다음 단계

실제 DB를 사용하고 싶다면:

- Vercel Postgres
- Supabase
- Firebase

등을 고려해보세요. 현재 localStorage 코드를 API 호출로 쉽게 변경할 수 있습니다!
