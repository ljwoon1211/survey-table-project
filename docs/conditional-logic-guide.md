# 조건부 로직 및 검증 규칙 가이드

설문조사에서 테이블 검증 규칙과 질문 표시 조건을 설정하는 방법을 설명합니다.

## 목차

1. [테이블 검증 규칙](#테이블-검증-규칙)
2. [질문 표시 조건](#질문-표시-조건)
3. [실제 사용 예시](#실제-사용-예시)

---

## 테이블 검증 규칙

테이블 질문에서 특정 조건을 만족할 때 설문을 중단하거나 다른 질문으로 이동하는 기능입니다.

### 기능

- **exclusive-check (독점 체크)**: 지정한 행만 체크되고 다른 행은 체크 안됨
- **any-of (하나라도 체크)**: 지정한 행 중 하나라도 체크됨
- **all-of (모두 체크)**: 지정한 행이 모두 체크됨
- **none-of (모두 미체크)**: 지정한 행이 모두 체크 안됨
- **required-combination (필수 조합)**: 지정한 행들이 모두 체크되어야 함

### 설정 방법

1. 테이블 질문 편집 모달 열기
2. **"검증 규칙"** 탭 선택
3. **"규칙 추가"** 버튼 클릭
4. 다음 항목 설정:
   - **규칙 설명**: 규칙에 대한 설명 (예: "아날로그 TV만 있는 경우")
   - **검증 타입**: 어떤 조건을 확인할지 선택
   - **체크할 행**: 확인할 행들 선택
   - **특정 열**: 특정 열만 확인 (선택사항)
   - **체크 타입**: checkbox, radio, select, input 중 선택
   - **조건 만족 시 동작**: 설문 종료 또는 특정 질문으로 이동
   - **오류 메시지**: 조건 불만족 시 표시할 메시지 (선택)

### 예시 1: "아날로그 TV만 있는 경우" 설문 중단

```typescript
{
  id: "rule-1",
  type: "exclusive-check",
  description: "아날로그 TV만 있는 경우 설문 중단",
  conditions: {
    checkType: "checkbox",
    rowIds: ["row-analog-tv"],  // 아날로그 TV 행 ID
    cellColumnIndex: 0,          // 첫 번째 열 (보유 TV 종류)
  },
  action: "end",
  errorMessage: "아날로그 TV만 보유한 경우 설문이 종료됩니다."
}
```

### 예시 2: "PC TV만 있는 경우" 설문 중단

```typescript
{
  id: "rule-2",
  type: "exclusive-check",
  description: "PC TV만 있는 경우 설문 중단",
  conditions: {
    checkType: "checkbox",
    rowIds: ["row-pc-tv"],      // PC TV 행 ID
    cellColumnIndex: 0,
  },
  action: "end"
}
```

---

## 질문 표시 조건

이전 질문의 응답에 따라 현재 질문을 표시하거나 숨기는 기능입니다.

### 기능

- **table-cell-check**: 테이블의 특정 셀이 체크되었는지 확인
- **value-match**: 특정 값과 일치하는지 확인 (radio, select, checkbox)
- **조건 결합**: AND, OR, NOT으로 여러 조건 결합

### 설정 방법

1. 질문 편집 모달 열기
2. **"표시 조건"** 탭 선택
3. **"조건 활성화"** 버튼 클릭
4. **"조건 추가"** 버튼 클릭
5. 다음 항목 설정:
   - **참조할 질문**: 조건을 확인할 이전 질문 선택
   - **조건 타입**: table-cell-check 또는 value-match
   - **체크 조건**: any (하나라도), all (모두), none (모두 아님)
   - **필요한 값들**: value-match인 경우 일치해야 할 값들

### 예시 1: "디지털 TV 또는 UHD TV 보유자"만 질문 표시

```typescript
{
  conditions: [
    {
      id: "cond-1",
      sourceQuestionId: "question-tv-type",  // TV 종류 질문
      conditionType: "table-cell-check",
      tableConditions: {
        rowIds: ["row-digital-tv", "row-uhd-tv"],
        cellColumnIndex: 0,
        checkType: "any"  // 하나라도 체크됨
      },
      logicType: "AND"
    }
  ],
  logicType: "AND"
}
```

이렇게 설정하면:

- TV 종류 질문에서 "디지털 TV" 또는 "UHD TV"를 체크한 사람만
- 이 질문을 볼 수 있습니다

### 예시 2: 복합 조건 - "디지털 TV와 UHD TV 모두 보유"

```typescript
{
  conditions: [
    {
      id: "cond-1",
      sourceQuestionId: "question-tv-type",
      conditionType: "table-cell-check",
      tableConditions: {
        rowIds: ["row-digital-tv", "row-uhd-tv"],
        checkType: "all"  // 모두 체크됨
      },
      logicType: "AND"
    }
  ],
  logicType: "AND"
}
```

### 예시 3: 여러 조건 결합 - OR 조건

여러 조건 중 하나라도 만족하면 질문 표시:

```typescript
{
  conditions: [
    {
      id: "cond-1",
      sourceQuestionId: "question-1",
      conditionType: "value-match",
      requiredValues: ["옵션A"],
      logicType: "OR"
    },
    {
      id: "cond-2",
      sourceQuestionId: "question-2",
      conditionType: "table-cell-check",
      tableConditions: {
        rowIds: ["row-1"],
        checkType: "any"
      },
      logicType: "OR"
    }
  ],
  logicType: "OR"  // 둘 중 하나만 만족하면 됨
}
```

---

## 실제 사용 예시

### 시나리오: TV 보유 현황 설문

#### 질문 17: TV 보유 현황 (테이블)

**테이블 구조:**

- 열 1: 보유 TV 종류 (체크박스)
- 열 2: 보유하고 있는 TV 종류 (텍스트)
- 열 3: 보유 대수 (입력)

**행:**

1. 디지털 TV
2. UHD TV
3. 아날로그 TV
4. PC TV (컴퓨터 모니터 겸용)
5. 케이블 TV
6. 위성 TV
7. IPTV
8. OTT 전용 TV

**검증 규칙 1: 아날로그 TV만 보유한 경우**

```typescript
{
  type: "exclusive-check",
  description: "아날로그 TV만 있는 경우 설문 중단",
  conditions: {
    checkType: "checkbox",
    rowIds: ["row-analog-tv"],
    cellColumnIndex: 0
  },
  action: "end"
}
```

**검증 규칙 2: PC TV만 보유한 경우**

```typescript
{
  type: "exclusive-check",
  description: "PC TV만 있는 경우 설문 중단",
  conditions: {
    checkType: "checkbox",
    rowIds: ["row-pc-tv"],
    cellColumnIndex: 0
  },
  action: "end"
}
```

#### 질문 18: 디지털/UHD TV 만족도 (라디오)

**표시 조건:**

```typescript
{
  conditions: [
    {
      sourceQuestionId: "question-17",
      conditionType: "table-cell-check",
      tableConditions: {
        rowIds: ["row-digital-tv", "row-uhd-tv"],
        cellColumnIndex: 0,
        checkType: "any"  // 디지털 또는 UHD 하나라도 체크
      },
      logicType: "AND"
    }
  ],
  logicType: "AND"
}
```

이렇게 설정하면:

1. 질문 17에서 "아날로그 TV만" 또는 "PC TV만" 체크 → **설문 즉시 종료**
2. 질문 17에서 "디지털 TV" 또는 "UHD TV" 체크 → **질문 18 표시**
3. 질문 17에서 해당 없음 → **질문 18 건너뛰고 다음 질문으로**

---

## 프로그래밍 방식 사용

### 직접 Question 객체에 설정

```typescript
import { Question, TableValidationRule, QuestionConditionGroup } from "@/types/survey";

// 테이블 질문 생성
const tvQuestion: Question = {
  id: "question-17",
  type: "table",
  title: "귀댁에서 보유하고 있는 TV종류는?",
  description: "해당되는 것을 모두 응답해 주세요.",
  required: true,
  order: 17,
  tableColumns: [
    { id: "col-1", label: "보유 TV종류(√)", width: 200 },
    { id: "col-2", label: "보유하고 있는 TV종류", width: 750 },
    { id: "col-3", label: "보유대수", width: 150 },
  ],
  tableRowsData: [
    {
      id: "row-digital-tv",
      label: "디지털 TV",
      height: 60,
      cells: [
        {
          id: "cell-1-1",
          type: "checkbox",
          content: "",
          checkboxOptions: [{ id: "check-1", label: "보유", value: "보유" }],
        },
        { id: "cell-1-2", type: "text", content: "디지털 TV" },
        { id: "cell-1-3", type: "input", content: "", placeholder: "대수" },
      ],
    },
    // ... 다른 행들
  ],
  // 검증 규칙 추가
  tableValidationRules: [
    {
      id: "rule-analog-only",
      type: "exclusive-check",
      description: "아날로그 TV만 있는 경우 설문 중단",
      conditions: {
        checkType: "checkbox",
        rowIds: ["row-analog-tv"],
        cellColumnIndex: 0,
      },
      action: "end",
    },
  ],
};

// 후속 질문 생성 (조건부 표시)
const satisfactionQuestion: Question = {
  id: "question-18",
  type: "radio",
  title: "디지털/UHD TV 만족도는?",
  required: true,
  order: 18,
  options: [
    { id: "opt-1", label: "매우 만족", value: "very-satisfied" },
    { id: "opt-2", label: "만족", value: "satisfied" },
    { id: "opt-3", label: "보통", value: "neutral" },
    { id: "opt-4", label: "불만족", value: "dissatisfied" },
  ],
  // 표시 조건 추가
  displayCondition: {
    conditions: [
      {
        id: "cond-digital-uhd",
        sourceQuestionId: "question-17",
        conditionType: "table-cell-check",
        tableConditions: {
          rowIds: ["row-digital-tv", "row-uhd-tv"],
          cellColumnIndex: 0,
          checkType: "any",
        },
        logicType: "AND",
      },
    ],
    logicType: "AND",
  },
};
```

---

## 주의사항

1. **검증 규칙 우선순위**: 여러 검증 규칙이 있을 경우, 첫 번째로 만족하는 규칙이 적용됩니다.

2. **표시 조건 참조**: 표시 조건은 현재 질문보다 **앞에 있는 질문**만 참조할 수 있습니다.

3. **순환 참조 방지**: 질문 A가 질문 B를 참조하고, 질문 B가 질문 A를 참조하는 것은 불가능합니다.

4. **exclusive-check 동작**:

   - 지정된 행만 체크되어야 함
   - 다른 행이 하나라도 체크되면 조건 불만족

5. **테스트 권장**: 복잡한 조건 설정 후에는 반드시 테스트 모드로 확인하세요.

---

## API 레퍼런스

### checkTableValidationRule

테이블 검증 규칙을 확인합니다.

```typescript
function checkTableValidationRule(
  question: Question,
  response: unknown,
  rule: TableValidationRule,
): boolean;
```

### shouldDisplayQuestion

질문 표시 조건을 확인합니다.

```typescript
function shouldDisplayQuestion(
  question: Question,
  allResponses: Record<string, unknown>,
  allQuestions: Question[],
): boolean;
```

### getTableValidationBranchRule

테이블 검증 규칙에서 분기 규칙을 가져옵니다.

```typescript
function getTableValidationBranchRule(question: Question, response: unknown): BranchRule | null;
```

---

## 문제 해결

### 검증 규칙이 작동하지 않음

- 행 ID가 올바른지 확인
- 열 인덱스가 올바른지 확인 (0부터 시작)
- 체크 타입이 셀 타입과 일치하는지 확인

### 표시 조건이 작동하지 않음

- 참조 질문이 현재 질문보다 앞에 있는지 확인
- 행 ID가 올바른지 확인
- 조건 결합 로직 (AND/OR/NOT)이 올바른지 확인

### 설문이 예상치 못하게 종료됨

- 검증 규칙을 다시 확인
- exclusive-check 타입의 경우 다른 행 체크 여부 확인
- 브라우저 콘솔에서 에러 메시지 확인

---

## 더 알아보기

- [분기 로직 가이드](./branch-logic-guide.md)
- [테이블 질문 가이드](./table-question-guide.md)
- [API 문서](./api-reference.md)



