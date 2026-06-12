# Survey Table Project — 도메인 언어

설문 빌더·응답·운영 플랫폼의 도메인 용어집. 아키텍처 리뷰와 설계 대화에서 이 용어를 정본으로 쓴다.

## Language

### 테이블 질문 평가

**테이블 셀 의미론 (table-cell-semantics)**:
테이블 셀 응답값의 해석·판정 규칙 전체 — optionId 언랩, optionId→옵션 value 해석, input 값 정본화(`String(v).trim()`), 응답됨 판정, 기대값 매칭, isHidden 정책. `src/utils/table-cell-semantics.ts` 한 곳이 소유한다.
_Avoid_: 셀 값 추출 로직, 셀 타입 switch

**검증 규칙 (table validation rule)**:
테이블 응답에 대한 분기 규칙. 5종 수량자(exclusive-check / any-of / all-of / none-of / required-combination)를 가지며, 이 수량자 어휘는 검증 규칙 interface 소유다 — 셀 의미론으로 내리지 않는다.
_Avoid_: 테이블 밸리데이션, 검증 조건

**표시조건 (displayCondition)**:
질문·그룹·행·열·동적 그룹의 노출 여부를 결정하는 조건 그룹(AND/OR/NOT + 조건 목록). 테이블 검사 시 checkType(any/all/none) 어휘를 쓰며 검증 규칙의 5종 수량자와 별개 interface다.
_Avoid_: 분기 조건(분기는 검증 규칙의 action 쪽 어휘)

**응답됨 (answered)**:
셀에 유효한 응답값이 존재하는 상태. 두 변종이 실재한다 — 인터랙티브 타입 게이트 판정(매칭의 기본값)과 타입 불문 값 존재 판정(exclusive-check 전수 스캔). 둘은 다른 판정이며 함수 이름으로 구분한다.
_Avoid_: 체크됨(checkbox 한정 어감), 입력됨

**행 완료 판정 (row completion)**:
테이블 행의 모든 answerable 셀이 응답됐는지의 판정 (`table-row-completion.ts`). isHidden 셀과 radioGroup 버킷을 제외/그룹 단위 처리한다. 셀 의미론과 같은 개념을 공유하지만 빈 배열·공백 처리의 의미가 달라 별도 module로 둔다.

**branch-eval**:
분기 평가의 leaf 의존 — `BranchEvalCtx`, `emptyBranchEvalCtx`, `evaluateNumericComparisonV2`. 셀 의미론과 branch-logic이 모두 의존하는 순환 없는 최하층(`src/utils/branch-eval.ts`).
