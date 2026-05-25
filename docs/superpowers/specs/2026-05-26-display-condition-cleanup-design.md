# 표시 조건 에디터 정리 — Design Spec

작성일: 2026-05-26
범위: `table-cell-check` conditionType UX 정리 + `expression` placeholder 추가

## 1. 배경

`QuestionCondition` 의 `table-cell-check` 모드는 다음 흐름이다:

1. 참조할 질문 선택
2. 조건 타입 선택 (`value-match` / `table-cell-check`)
3. 체크 확인할 행(`rowIds`) 선택
4. 체크 조건 (`any` / `all` / `none`)
5. 특정 열 인덱스(`cellColumnIndex`)
6. 그리고 자동으로 — 셀이 `input + inputType: 'number'` 이면 `NumericComparisonEditor`, 아니면 `TableOptionSelector` 가 노출

여기서 두 가지 UX 문제가 누적되었다:

### 1.1 토글 부재 — "단순 통과" 대 "값 비교" 가 UI 에 명시되지 않음

`branch-logic.ts` 의 평가 규칙상 `expectedValues = undefined && numericComparison = undefined`
이면 셀에 값이 있기만 하면 `isChecked = true` 로 통과한다 (presence-only 모드).
하지만 빌더 UI 는 이 상태를 명시적으로 제공하지 않는다 — 사용자는 행/열을 고르는
순간 자동으로 `NumericComparisonEditor` 또는 `TableOptionSelector` 가 튀어나오는
경험을 한다. "그냥 응답이 있는지만 보고 싶다" 라는 의도가 UI 에서 사라진 셈이다.

### 1.2 NumericComparisonEditor 의 "셀 산술" 탭 — outer 행/열 선택과 의미 충돌

`NumericComparisonEditor` 의 좌변 탭에는 두 가지 모드가 있다:

- "응답값 그대로" — outer 에서 고른 행/열 셀의 값을 비교 좌변으로 사용 (자연스러움)
- "셀 산술" — `binop.left`, `binop.right` 가 outer 셀과 **완전히 무관한 임의의 두 셀**.
  평가 시 outer 행/열 선택은 무시됨

후자는 사용자가 "이 셀에 대해 조건을 추가한다" 라고 인식하고 있는 정신 모델과
충돌한다. 또한 셀 선택 드롭다운은 설문 전체 input 셀을 평탄화해서 노출하므로
설문 규모가 커질수록 사용성이 떨어진다.

### 1.3 다중 행 셀 타입 휴리스틱

`isNumericInputCell()` 은 선택된 `rowIds` 중 **첫 번째 행** 만 보고 셀 타입을
판단한다. 행마다 같은 column 의 셀 타입이 다른 테이블에서는 오판이 발생한다.

## 2. 비목표 (Out of scope)

이번 spec 은 다음을 **다루지 않는다**.

- 본격 수식 / Notion-filter UI 의 실제 구현
- 외부데이터 / 직접입력 / 기존 문항 / 인터렉티브 셀 4-source 산술 엔진
- 기존 `binop` 데이터를 새 `expression` 모드로 자동 마이그레이션

위 항목은 후속 spec 으로 분리한다. 이번 변경의 목표는 **현재 UI 의 의미 충돌을
제거하고, 향후 expression 모드의 자리만 마련** 하는 것이다.

## 3. 변경 사항

### 3.1 데이터 모델

`QuestionCondition.conditionType` 의 union 에 `'expression'` 을 추가한다.

```ts
conditionType: 'value-match' | 'table-cell-check' | 'expression' | 'custom';
```

`expression` 의 평가 로직 / 추가 필드는 **이번 spec 에서 정의하지 않는다**.
빌더 드롭다운에서 선택할 수 있는 옵션으로만 노출하고, 선택 시 "준비 중" 안내를
보인다.

`expectedValues`, `numericComparison`, `LeftOperand`, `RightOperand` 등 기존
필드는 그대로 둔다. 기존 데이터가 가진 `binop` / `lookup` / `comparand` 는 평가
경로에서 backward-compatible 하게 계속 동작한다 (`evaluateNumericComparisonV2` 와
`branch-logic.ts` 의 분기는 변경 없음).

### 3.2 conditionType 드롭다운

`question-condition-editor.tsx` 의 conditionType `<select>` 에 옵션을 추가한다.

```
값 일치 (radio, select, checkbox)
테이블 셀 체크 확인
─────────────────
장기 계산식 (준비 중)         ← disabled
```

`expression` 선택 시 본문 영역에 "본 조건 타입은 다음 업데이트에서 제공됩니다."
안내 박스를 보이고, 다른 입력 필드는 표시하지 않는다 (구분선 + disabled 처리로
드롭다운에서 선택 자체가 막힘 — 안내 박스는 사실상 dead code 지만 향후 교체점을
한 곳에 둠).

### 3.3 table-cell-check — "값 비교 조건 추가" 펼치기

행/열 선택 영역 아래에 자동 노출되던 비교 에디터를 **접힘 기본 펼치기 섹션** 으로
바꾼다.

**Before** (`question-condition-editor.tsx:531-578` 메인 조건):

```
[행 선택]
[체크 조건]
[열 인덱스]
NumericComparisonEditor or TableOptionSelector  ← 자동 노출
```

**After**:

```
[행 선택]
[체크 조건]
[열 인덱스]
─────────────────────────────────────────
+ 값 비교 조건 추가 ▾     ← 펼치기 버튼, 접힘 기본

(펼친 상태)
값 비교 조건                          [×]
└─ 셀 타입에 따라 분기:
   • radio / checkbox / select
       → TableOptionSelector (현행 그대로)
   • input + inputType='number'
       → NumericComparisonEditor (간소화 — 3.4 참조)
   • input + inputType='text' (또는 미지정)
       → 비활성 안내 박스: "텍스트 일치 매칭은 다음 업데이트에서 제공됩니다.
          지금은 응답 유무로만 검사합니다."
   • 행 여러 개 선택 + 동일 column 의 셀 타입이 행마다 다름
       → 펼치기 버튼 자체 비활성 + 사유 안내:
         "선택한 행들의 셀 타입이 달라 값 비교를 적용할 수 없습니다.
          행 그룹을 나눠 별도 조건으로 만드세요."
```

펼치기 상태 = `tableConditions.expectedValues != null || tableConditions.numericComparison != null` 의 derived state.
접기(`[×]`) = 두 필드 모두 `undefined` 로 설정. 펼침 → 접힘 시 입력 값은 **보존하지 않는다**.

추가 조건(`additionalConditions`) 경로 (`:668-719`) 의 셀 에디터 자리에도 동일한 펼치기 패턴을 적용한다. (`additionalConditions` 자체의 outer Switch `:588-604` 는 그대로 유지 — "추가 조건 사용" 의 의미는 별개)

### 3.4 NumericComparisonEditor 간소화

`LeftOperandEditor` import 와 좌변 탭 UI 를 **제거** 한다. 좌변은 항상 outer-picked
셀의 응답값 ("응답값 그대로" 모드, `value.left === undefined`).

**Before**:

```
숫자 비교 조건
─────────────
좌변 (응답값 또는 산술)
  [응답값 그대로] [셀 산술 (셀 ± 셀/숫자)]   ← 탭

비교: [같음 (=) ▼]

우변
  [직접 입력 값] [외부 데이터 룩업]
  [0]
```

**After**:

```
숫자 비교 조건
─────────────
비교: [같음 (=) ▼]

우변
  [직접 입력 값] [외부 데이터 룩업]
  [0]
```

신규 생성되는 `NumericComparison` 은 항상 `left: undefined`. 기존 데이터의 `left`
필드 (`CellRef` 또는 `binop`) 는 read-only 라벨로 표시한다:

```
숫자 비교 조건
─────────────
⚠ 이 조건은 이전 버전 "셀 산술" 모드로 만들어졌습니다.
   편집은 지원되지 않습니다. 다시 만들려면 위 [×] 로 비교를 해제 후
   다시 추가하세요.

(좌변 binop 요약 표시: e.g., "출장비 ÷ 부스임차비")
비교: [같음 (=) ▼]    ← 우변과 연산자는 계속 편집 가능
우변
  [직접 입력 값]
  [0]
```

평가 경로(`branch-logic.ts`, `evaluateNumericComparisonV2`) 는 변경하지 않는다.
기존 `binop` 데이터는 평가 시 계속 backward-compat 하게 동작한다.

**dangling cell 처리**: `binop.left` / `binop.right` 가 참조하는 `questionId` 또는
`cellId` 가 더 이상 설문에 존재하지 않을 수 있다 (질문 삭제, 행/열 삭제 등). 이런 경우
read-only 라벨은 "(삭제된 셀)" 로 표시하고, 평가는 기존 동작 (`branch-logic` 의
fail-safe SHOW) 을 그대로 따른다.

### 3.5 다중 행 셀 타입 가드

`isNumericInputCell()` 을 다음과 같은 정밀 함수로 교체한다:

```ts
type CellTypeKind =
  | 'numeric-input'    // input + inputType === 'number'
  | 'text-input'       // input + inputType === 'text' 또는 미지정
  | 'option'           // radio / checkbox / select
  | 'mixed'            // 행마다 다름
  | 'unsupported';     // image / video / static text / ranking / ranking_opt

function detectCellTypeKind(
  question: Question | undefined,
  rowIds: string[],
  colIndex: number | undefined,
): CellTypeKind;
```

- 행 전체를 순회해서 같은 종류면 그 종류, 아니면 `'mixed'`
- 펼치기 버튼의 활성/비활성 + 본문 분기 모두 이 함수 결과를 기반으로 결정

이 함수는 메인 조건 / 추가 조건 양쪽에서 공용.

### 3.6 영향 없는 영역

- `value-match` conditionType: 변경 없음 (radio/select/checkbox 일반 질문)
- `branch-logic.ts` 의 평가 함수들: 변경 없음
- `LeftOperandEditor` 파일 자체: 유지 (read-only 표시 모드 추가만)
- `LookupComparandEditor`: 변경 없음 (우변 lookup 탭은 그대로 유지)

## 4. 컴포넌트 변경 요약

| 파일 | 변경 내용 |
|---|---|
| `src/types/survey.ts` | `conditionType` union 에 `'expression'` 추가 |
| `src/components/survey-builder/question-condition-editor.tsx` | conditionType 드롭다운 옵션 추가; `isNumericInputCell` → `detectCellTypeKind` 로 교체; 자동 비교 에디터 노출 → 펼치기 패턴으로 변경 (메인 + additionalConditions 두 곳) |
| `src/components/survey-builder/numeric-comparison-editor.tsx` | `LeftOperandEditor` 통합 제거; 신규 생성 시 `left: undefined`; 기존 `left` 데이터는 read-only 라벨 |
| `src/components/survey-builder/left-operand-editor.tsx` | "셀 산술" 탭 코드는 유지 (기존 데이터 read-only 렌더에 재활용). 신규 작성 진입점만 차단 |

## 5. 테스트 전략

- **회귀 방지**: 기존 `binop` / `lookup` / `numericComparison` 데이터가 들어간
  설문 응답이 평가 결과가 동일하게 유지되는지 확인. `branch-logic` 평가 함수의
  스냅샷이 있다면 그대로 통과해야 함
- **새 UX 단위 테스트**: `detectCellTypeKind` 의 4-5 가지 케이스 (모든 numeric,
  모든 option, 혼재, 빈 행, 미정 column)
- **수동 검증**:
  - 신규 조건 추가 → 행/열 선택 → 펼치기 버튼이 보이는지
  - 펼치기 후 셀 타입별 분기가 맞는지 (numeric → NumericComparisonEditor 간소화
    버전, option → TableOptionSelector, mixed → 비활성)
  - 기존 binop 조건이 있는 설문을 빌더에서 열 때 read-only 표시가 뜨고 평가가
    그대로 동작하는지
  - conditionType 드롭다운에서 "장기 계산식 (준비 중)" 이 disabled 로 보이는지

## 6. 마이그레이션 / 호환성

- 데이터 마이그레이션 **없음**. 기존 `displayCondition` 그대로 사용.
- 기존 `binop` 데이터를 가진 조건은 빌더에서 read-only 표시 + 사용자가 수동으로
  비교를 해제하고 다시 만들면 정리됨
- 미래 `expression` 모드가 도입되면 그때 `binop` 데이터를 마이그레이션할 후속
  spec 을 별도로 작성

## 7. Follow-up (다음 spec)

- `expression` conditionType 의 데이터 모델 / 평가기 / Notion-filter UI 본격 설계
- 4-source operand (외부데이터 / 직접입력 / 기존 문항 / 인터렉티브 셀) 통합 picker
- 기존 binop 데이터의 expression 모드 자동 마이그레이션 경로
