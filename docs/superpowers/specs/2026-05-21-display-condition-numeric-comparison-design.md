# 분기 조건 — 숫자 비교 연산자 도입 (Design)

- **Date**: 2026-05-21
- **Trigger**: 5-1-1 같은 "셀 값이 0과 같음 AND 다른 셀 값이 1 이상" 형태의 표시 조건을 빌더에서 표현 불가
- **Scope**: displayCondition (문항/그룹/테이블 행/테이블 열) 에서 input 셀의 숫자 비교 지원
- **Related memory**: `project_display_condition_arithmetic_future` (L1~L5 스펙트럼), `project_contact_attrs_token_done` (미래 외부 참조 시드)

---

## 배경

현재 분기 조건 평가 ([src/utils/branch-logic.ts:1372-1382](../../../src/utils/branch-logic.ts#L1372-L1382)) 의 input 셀 처리는 두 가지 모드만 지원한다.

- `expectedValues` 있음 → 문자열 정확 매칭 (`includes(cellValue.trim())`)
- `expectedValues` 없음 → "값이 입력되어 있으면 OK"

5-1-1 케이스 예시:
- ⑤ 현장 계약 **건수** (input) 가 **1건 이상** 이고
- ⑥ 현장 계약 **금액** (input) 이 **0** 일 때 추가 질문 표시

⑤ 의 "1건 이상" 을 현재 시스템으로 표현하려고 하면 응답자가 "0"을 적었을 때도 조건이 만족된다 (값 있음 모드). 즉 **숫자 비교 연산자가 필요한 케이스**.

---

## 결정 사항 (Decisions)

### D1. 범위 = displayCondition only

이번 작업은 **표시/비표시 분기**에만 적용. 셀끼리 산술/합계/평균 같은 응답값 계산은 추후 트랙.

### D2. 셀 모델에 `inputType: 'text' | 'number'` 메타 추가

- 응답자의 자유 입력 ("1,000원", "없음", "약 100") 모호성을 원천 차단.
- input 셀 정의에 optional 메타 한 필드만 추가. 미지정/`'text'` 면 기존 자유 입력 동작 유지.
- 분기 조건의 숫자 비교 연산자는 `inputType: 'number'` 인 셀에만 빌더 UI 노출.

### D3. 응답자 입력은 HTML `type="number"` 안 쓰고 직접 필터링

HTML `<input type="number">` 의 known quirks 회피:
- 빈 상태 안 되고 자동 0 채워지는 동작
- 스피너/스크롤 시 값 변경
- 자동 타입 코어션

**대체 패턴:**
- `<input type="text" inputMode="decimal">`
- `onChange` 정규식 필터 `^-?\d*\.?\d*$`, 불일치 입력 reject
- 빈 문자열은 그대로 유지 (자동 0 prepend 안 함)
- 음수/소수점 허용. 정수 강제는 비범위.

### D4. 비교 연산자 6개 풀세트

`==`, `!=`, `>`, `<`, `>=`, `<=`.

빌더 라벨은 한국어 + 기호 병기:
- "같음 (=)", "다름 (≠)", "이상 (≥)", "이하 (≤)", "초과 (>)", "미만 (<)"

### D5. 우변은 forward-compatible union 으로 시작, 이번엔 literal 만

```typescript
comparand: { kind: 'literal'; value: number }
```

미래 확장 카탈로그 (이번 구현 X):
| kind | 용도 | 의존성 |
|------|------|--------|
| `literal` | 숫자 리터럴 | 없음 — **이번 구현** |
| `cellRef` | 같은/다른 표 셀값 | 셀 식별자 |
| `questionRef` | 다른 질문 응답값 | 질문 ID |
| `contactAttr` | 응답자 메타 (예: 개최지역) | 컨택 토큰 시스템 (이미 있음) |
| `lookupTable` | 설문 레벨 LUT | 새 도메인 |
| `lookupByAttr` | LUT + attr 키 lookup | 위 둘 조합 |

좌변 (산술 표현식 트리) hook 은 **두지 않음**. 산술 도입 시 별도 트랙.

### D6. 평가 엔진 한 곳만 수정

`displayCondition` 은 4가지 표시 대상이 같은 `QuestionConditionGroup` 타입을 공유 ([src/types/survey.ts:254-358](../../../src/types/survey.ts#L254-L358)). 평가 엔진 한 곳 수정으로 문항/그룹/테이블 행/테이블 열이 자동 혜택.

### D7. 빈 값 / NaN 처리

- 응답자가 셀을 비우면 모든 비교 false
- 어떻게든 비숫자 문자열 저장 시 (DevTools 우회 등) `parseFloat` → NaN → false
- 부동소수점 epsilon 도입은 비범위 (정수 중심 입력이라 실용적으로 충분, 문제 보고 시 재검토)

---

## 데이터 모델

### 셀 정의 (테이블 컬럼)

```typescript
type TableCell = {
  type: 'text' | 'image' | 'video' | 'checkbox' | 'radio' | 'select' | 'input';
  inputType?: 'text' | 'number';  // 신규. type === 'input' 일 때만 의미. 기본 'text'.
  // ... 기존 필드
};
```

### 분기 조건 (`tableConditions` / `additionalConditions` 양쪽 동일)

```typescript
{
  rowIds: string[];
  checkType: 'any' | 'all' | 'none';
  cellColumnIndex?: number;

  // 기존 — 옵션/문자열 정확 매칭 (radio/checkbox/select/text-input 셀용)
  expectedValues?: string[];

  // 신규 — 숫자 비교 (input + inputType=number 셀 전용)
  numericComparison?: {
    operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
    comparand:
      | { kind: 'literal'; value: number };
      // 미래: | { kind: 'cellRef'; ... } | { kind: 'contactAttr'; ... } | ...
  };
}
```

### 우선순위 (평가 엔진)

input 셀 분기에서:
1. `numericComparison` 있음 → 숫자 비교 (`comparand.kind === 'literal'` 만 처리, 나머지는 false)
2. 없고 `expectedValues` 있음 → 기존 문자열 매칭
3. 둘 다 없음 → 값 있음 모드 (기존 default)

### 빌더 UI 상호 배타성

빌더에서 `cellColumnIndex` 로 지정된 열의 셀 타입을 보고 자동 분기:
- `input + inputType: 'number'` → `numericComparison` UI 노출
- 그 외 (input + text, radio, checkbox, select 등) → 기존 `expectedValues` UI (`TableOptionSelector`) 노출

빌더 사용자는 셀 타입에 따라 한 종류의 UI 만 보게 됨 — 명시적 모드 토글 없음.

### 마이그레이션

- 모든 신규 필드 optional. SQL 마이그레이션 불필요.
- 기존 데이터 그대로 동작. JSONB 컬럼 (`questions.options`, `questions.tableColumns`, `*.displayCondition`) 안에 신규 필드만 추가.

---

## 구현 영역

### 1. 셀 에디터 (테이블 컬럼 정의)
- input 타입 셀 설정에 **"숫자 입력" 토글** 한 줄 추가
- 토글 on/off 전환 시 영향받는 분기 조건 검증/경고는 **비범위** (stale 조건 처리는 별도 트랙)

### 2. 분기 조건 에디터 (`src/components/survey-builder/question-condition-editor.tsx`)
- 선택한 셀이 `input + inputType: 'number'` 인 경우, 기존 `TableOptionSelector` 자리에 비교 연산자 UI 노출
- 컴포넌트: `[연산자 select] [우변 숫자 input]`
- 우변 input 은 응답자 입력과 동일한 숫자 필터링 패턴
- `additionalConditions` 영역에도 동일한 분기 적용

### 3. 응답자 페이지 (`src/components/survey-builder/interactive-table-response.tsx`)
- 숫자 input 셀 렌더링 시 `type="text"` + `inputMode="decimal"` + 정규식 필터
- 빈 값 허용, 자동 0 prepend 안 함

### 4. 평가 엔진 (`src/utils/branch-logic.ts`)
- input 셀 처리 분기에 `numericComparison` 케이스 추가
- 우선순위 규칙 (위 데이터 모델 섹션) 적용

### 5. 타입 정의 (`src/types/survey.ts`)
- `TableCell` 에 `inputType?: 'text' | 'number'` 추가
- `QuestionCondition.tableConditions` / `additionalConditions` 에 `numericComparison?` 추가

---

## 테스트 전략

### 단위 테스트 (`tests/`, vitest)

평가 엔진:
- 6개 연산자 × (양수/음수/소수/0) 정상 케이스
- NaN 케이스 (응답자가 비숫자 저장)
- 빈 셀 케이스
- `expectedValues` 와 `numericComparison` 공존 시 우선순위

### 통합 테스트

- 5-1-1 패턴 시나리오: ⑤행 건수 변화에 따라 ⑥행 금액 == 0 일 때만 추가 질문 표시
- displayCondition 4가지 적용 대상 (문항/그룹/행/열) 각각 검증

### 수동 검증 체크리스트

- 응답자 페이지에서 콤마/단위 입력 차단되는지
- 빈 상태로 셀 비울 수 있는지 (자동 0 채워지지 않음)
- 빌더에서 inputType 토글 시 분기 조건 UI 가 자동으로 바뀌는지
- 같은 데이터로 미리보기/테스트 모드/실제 응답 페이지가 동일하게 동작하는지

---

## 리스크

### 부동소수점 동등 비교
- 응답자/빌더 둘 다 사용자 입력이라 산술 결과 비교가 아님. 정수 중심.
- 실제 문제 보고 시 epsilon 도입 (이번 비범위).

### Stale 조건 (셀 inputType 변경)
- 셀 `inputType` 을 number → text 로 되돌리면 기존 `numericComparison` 분기 조건이 남음.
- 평가 엔진은 셀 타입과 무관하게 평가. 응답값이 우연히 숫자면 매칭 가능.
- **이번 비범위**, 셀 메타 변경 시 분기 조건 검증/마이그레이션 패스를 별도 트랙으로.

### 응답 페이지 / 빌더 / 미리보기 / 테스트 모드 일관성
- snapshot 기반 응답 페이지 (memory: `project_response_page_snapshot_based`) 의 publish 누락 함정. 빌더 변경 시 publish 필요.
- 테스트 모드와 실제 응답 페이지 모두 같은 평가 엔진 사용하는지 확인.

---

## 비범위 (Out of Scope)

이번 작업에서 명시적으로 **하지 않음**:

- 셀 모델에 단위 suffix (원/달러/%) UI
- `lookupTable` 등 외부 참조 우변 종류 (forward-compat hook 만 둠)
- 좌변 산술 표현식 트리
- 정수/소수 구분 강제 (`integer: true` 같은 메타)
- 셀 inputType 변경 시 stale 분기 조건 자동 마이그레이션/경고
- 우변 콤마 자동 포맷팅
- 부동소수점 epsilon 비교

---

## 미래 확장 시점 신호

- 사용자가 "출장비/출장인원 ≤ 개최지역 평균 항공요금" 같은 케이스 요청 → 우변에 `contactAttr` + `lookupTable` 도입 필요. 좌변 산술도 같이 들어옴.
- 우변 union 의 첫 확장은 `contactAttr` 일 가능성 (컨택 토큰 시스템 이미 있음).
- LUT 등록 UI 는 설문 레벨 새 도메인 — 별도 brainstorm.
