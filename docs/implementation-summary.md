# 조건부 로직 구현 요약

## 개요

TV 보유 현황 설문에서 요구한 두 가지 주요 기능을 범용적인 시스템으로 구현했습니다:

1. **테이블 검증 규칙**: "아날로그 TV만" 또는 "PC TV만" 보유 시 설문 중단
2. **질문 표시 조건**: "디지털 TV/UHD TV" 보유자만 특정 질문 접근

## 구현된 기능

### 1. 타입 정의 확장 (`src/types/survey.ts`)

#### TableValidationRule
```typescript
export interface TableValidationRule {
  id: string;
  type: TableValidationType;
  description?: string;
  conditions: {
    checkType: 'checkbox' | 'radio' | 'select' | 'input';
    rowIds: string[];
    cellColumnIndex?: number;
    expectedValues?: string[];
  };
  action: BranchAction;
  targetQuestionId?: string;
  errorMessage?: string;
}
```

**지원하는 검증 타입:**
- `exclusive-check`: 특정 행만 체크된 경우
- `any-of`: 하나라도 체크
- `all-of`: 모두 체크
- `none-of`: 모두 미체크
- `required-combination`: 필수 조합

#### QuestionCondition & QuestionConditionGroup
```typescript
export interface QuestionCondition {
  id: string;
  sourceQuestionId: string;
  conditionType: 'value-match' | 'table-cell-check' | 'custom';
  requiredValues?: string[];
  tableConditions?: {
    rowIds: string[];
    cellColumnIndex?: number;
    checkType: 'any' | 'all' | 'none';
  };
  logicType: ConditionLogicType;
}

export interface QuestionConditionGroup {
  conditions: QuestionCondition[];
  logicType: ConditionLogicType; // 'AND' | 'OR' | 'NOT'
}
```

### 2. 검증 로직 구현 (`src/utils/branch-logic.ts`)

#### 핵심 함수들

**checkTableValidationRule**
```typescript
export function checkTableValidationRule(
  question: Question,
  response: unknown,
  rule: TableValidationRule
): boolean
```
- 테이블 응답이 검증 규칙을 만족하는지 확인
- exclusive-check 로직으로 "~만 있는 경우" 감지

**getTableValidationBranchRule**
```typescript
export function getTableValidationBranchRule(
  question: Question,
  response: unknown
): BranchRule | null
```
- 검증 규칙을 확인하고 분기 규칙 반환
- 설문 종료 또는 특정 질문 이동 결정

**shouldDisplayQuestion**
```typescript
export function shouldDisplayQuestion(
  question: Question,
  allResponses: Record<string, unknown>,
  allQuestions: Question[]
): boolean
```
- 이전 응답을 기반으로 질문 표시 여부 결정
- AND/OR/NOT 논리 연산 지원

**checkTableCellCondition**
```typescript
function checkTableCellCondition(
  question: Question,
  response: unknown,
  tableConditions?: {
    rowIds: string[];
    cellColumnIndex?: number;
    checkType: 'any' | 'all' | 'none';
  }
): boolean
```
- 테이블의 특정 셀 체크 여부 확인
- 디지털TV/UHD TV 보유 여부 판단에 사용

### 3. UI 컴포넌트

#### TableValidationEditor (`src/components/survey-builder/table-validation-editor.tsx`)

테이블 검증 규칙을 설정하는 UI 컴포넌트:
- 검증 타입 선택 (exclusive-check, any-of, all-of 등)
- 체크할 행 선택 (다중 선택 가능)
- 특정 열 지정 (선택사항)
- 분기 동작 설정 (설문 종료 / 질문 이동)
- 오류 메시지 설정

**주요 기능:**
```typescript
<TableValidationEditor
  question={question}
  onUpdate={(rules) => updateQuestion(questionId, { tableValidationRules: rules })}
  allQuestions={allQuestions}
/>
```

#### QuestionConditionEditor (`src/components/survey-builder/question-condition-editor.tsx`)

질문 표시 조건을 설정하는 UI 컴포넌트:
- 조건 활성화/비활성화 토글
- 참조 질문 선택 (이전 질문만)
- 조건 타입 선택 (table-cell-check, value-match)
- 테이블 행 선택 및 체크 조건 설정
- 여러 조건 결합 (AND/OR/NOT)

**주요 기능:**
```typescript
<QuestionConditionEditor
  question={question}
  onUpdate={(conditionGroup) => updateQuestion(questionId, { displayCondition: conditionGroup })}
  allQuestions={allQuestions}
/>
```

#### QuestionEditModal 통합

질문 편집 모달에 탭 추가:
- **기본 설정**: 기존 질문 설정
- **검증 규칙** (테이블 질문만): TableValidationEditor
- **표시 조건**: QuestionConditionEditor

```typescript
<Tabs defaultValue="basic">
  <TabsList>
    <TabsTrigger value="basic">기본 설정</TabsTrigger>
    {isTableType && <TabsTrigger value="validation">검증 규칙</TabsTrigger>}
    <TabsTrigger value="display-condition">표시 조건</TabsTrigger>
  </TabsList>
  
  <TabsContent value="basic">...</TabsContent>
  <TabsContent value="validation">
    <TableValidationEditor ... />
  </TabsContent>
  <TabsContent value="display-condition">
    <QuestionConditionEditor ... />
  </TabsContent>
</Tabs>
```

### 4. 설문 응답 페이지 통합 (`src/app/survey/[id]/page.tsx`)

#### handleNext 함수 업데이트

```typescript
const handleNext = () => {
  const currentResponse = responses[currentQuestion.id];
  let nextIndex = getNextQuestionIndex(questions, currentQuestionIndex, currentResponse);

  if (nextIndex === -1) {
    handleSubmit(); // 검증 규칙으로 설문 종료
    return;
  }

  // 표시 조건을 만족하는 다음 질문 찾기
  while (nextIndex < questions.length) {
    const nextQuestion = questions[nextIndex];
    
    if (shouldDisplayQuestion(nextQuestion, responses, questions)) {
      setCurrentQuestionIndex(nextIndex);
      return;
    }
    
    nextIndex++; // 조건 불만족 시 건너뛰기
  }

  if (nextIndex >= questions.length) {
    handleSubmit(); // 더 이상 표시할 질문 없음
  }
};
```

#### 초기 로딩 시 조건 확인

```typescript
useEffect(() => {
  if (questions.length > 0) {
    const currentQ = questions[currentQuestionIndex];
    if (currentQ && !shouldDisplayQuestion(currentQ, responses, questions)) {
      // 현재 질문이 조건 불만족 시 다음 질문으로
      let nextIndex = currentQuestionIndex + 1;
      while (nextIndex < questions.length) {
        if (shouldDisplayQuestion(questions[nextIndex], responses, questions)) {
          setCurrentQuestionIndex(nextIndex);
          return;
        }
        nextIndex++;
      }
    }
  }
}, [currentQuestionIndex, responses, questions]);
```

## 사용 예시

### 예시 1: TV 보유 현황 설문

```typescript
// 질문 17: TV 보유 현황 (테이블)
const tvQuestion: Question = {
  id: "question-17",
  type: "table",
  title: "귀댁에서 보유하고 있는 TV종류는?",
  tableValidationRules: [
    {
      id: "rule-1",
      type: "exclusive-check",
      description: "아날로그 TV만 있는 경우 설문 중단",
      conditions: {
        checkType: "checkbox",
        rowIds: ["row-analog-tv"],
        cellColumnIndex: 0
      },
      action: "end"
    },
    {
      id: "rule-2",
      type: "exclusive-check",
      description: "PC TV만 있는 경우 설문 중단",
      conditions: {
        checkType: "checkbox",
        rowIds: ["row-pc-tv"],
        cellColumnIndex: 0
      },
      action: "end"
    }
  ]
};

// 질문 18: 디지털/UHD TV 만족도
const satisfactionQuestion: Question = {
  id: "question-18",
  type: "radio",
  title: "디지털/UHD TV 만족도는?",
  displayCondition: {
    conditions: [
      {
        id: "cond-1",
        sourceQuestionId: "question-17",
        conditionType: "table-cell-check",
        tableConditions: {
          rowIds: ["row-digital-tv", "row-uhd-tv"],
          cellColumnIndex: 0,
          checkType: "any" // 하나라도 체크됨
        },
        logicType: "AND"
      }
    ],
    logicType: "AND"
  }
};
```

### 동작 흐름

1. **사용자가 질문 17 응답**:
   - 아날로그 TV만 체크 → exclusive-check 만족 → **설문 즉시 종료**
   - PC TV만 체크 → exclusive-check 만족 → **설문 즉시 종료**
   - 디지털 TV 체크 → 검증 규칙 통과 → 다음 질문으로

2. **질문 18 표시 여부**:
   - 질문 17에서 디지털 TV 또는 UHD TV 체크 → **질문 18 표시**
   - 질문 17에서 해당 없음 → **질문 18 건너뛰고 질문 19로**

3. **분기 로직 통합**:
   ```typescript
   // getBranchRuleForResponse 함수에서 자동 처리
   if (question.type === "table") {
     const validationRule = getTableValidationBranchRule(question, response);
     if (validationRule) {
       return validationRule; // 검증 규칙 우선 적용
     }
   }
   ```

## 장점

### 1. 재사용성
- 다른 테이블 질문에도 동일한 패턴 적용 가능
- 검증 규칙과 표시 조건을 자유롭게 조합

### 2. 확장성
- 새로운 검증 타입 추가 용이
- 새로운 조건 타입 추가 가능
- 커스텀 로직 구현 가능

### 3. 유지보수성
- 명확한 타입 정의
- 분리된 로직과 UI
- 직관적인 인터페이스

### 4. 유연성
- 테이블 외 다른 질문 타입도 지원
- 여러 조건 결합 (AND/OR/NOT)
- 중첩된 조건 설정 가능

## 테스트 방법

1. **설문 빌더에서 테이블 질문 생성**
2. **"검증 규칙" 탭에서 규칙 추가**:
   - exclusive-check 선택
   - 아날로그 TV 행 선택
   - 설문 종료로 설정
3. **후속 질문 생성**
4. **"표시 조건" 탭에서 조건 추가**:
   - TV 질문 참조
   - table-cell-check 선택
   - 디지털/UHD TV 행 선택
   - checkType: any 설정
5. **테스트 모드로 실제 응답 시뮬레이션**

## 파일 구조

```
src/
├── types/
│   └── survey.ts                          # 타입 정의 확장
├── utils/
│   └── branch-logic.ts                    # 검증 및 조건 로직
├── components/
│   └── survey-builder/
│       ├── table-validation-editor.tsx    # 검증 규칙 에디터
│       ├── question-condition-editor.tsx  # 표시 조건 에디터
│       └── question-edit-modal.tsx        # 모달 통합
└── app/
    └── survey/
        └── [id]/
            └── page.tsx                   # 설문 응답 페이지
```

## 향후 개선 방향

1. **시각적 플로우 차트**: 분기 로직을 시각화
2. **규칙 충돌 감지**: 모순되는 규칙 경고
3. **프리셋 템플릿**: 자주 사용하는 패턴 저장
4. **성능 최적화**: 대량 질문 처리 최적화
5. **로깅 및 디버깅**: 분기 결정 과정 로깅

## 결론

이번 구현으로 설문조사에서 다음이 가능해졌습니다:

✅ **테이블 검증 규칙**으로 특정 조건 시 설문 중단/분기  
✅ **질문 표시 조건**으로 조건부 질문 필터링  
✅ **범용적인 시스템**으로 다양한 시나리오 지원  
✅ **직관적인 UI**로 쉬운 설정  
✅ **확장 가능한 구조**로 미래 요구사항 대응  

특히 TV 보유 현황 설문 케이스를 완벽하게 구현하면서도, 다른 유사한 시나리오에도 적용 가능한 범용 시스템을 구축했습니다.




