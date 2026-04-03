# 질문 목록 렌더링 최적화

편집 페이지(`/admin/surveys/[id]/edit`)의 질문 목록 렌더링 성능 최적화 기록.

---

## 문제

질문 30개가 한 번에 모두 마운트/페인트됨.
특히 테이블 질문(4개 × ~5000셀)이 InteractiveTableResponse/TablePreview를 동시 렌더 → 초기 로드 병목 + 스크롤 밀림(Layout Shift).

## 해결 구조

```
┌─ content-visibility: auto ─────────────────────────┐
│  카드 wrapper (per-card containIntrinsicSize)       │
│  ├─ 카드 shell (제목, 번호, 설명): 즉시 렌더        │
│  └─ 입력 영역                                       │
│      ├─ text/radio/checkbox/select: 즉시 렌더       │
│      └─ table: LazyMount (IO lazy mount)            │
│          ├─ 뷰포트 ±800px 진입 전: placeholder      │
│          └─ 진입 후: InteractiveTableResponse 마운트 │
└─────────────────────────────────────────────────────┘
```

### 1. `content-visibility: auto` (브라우저 페인팅 최적화)

- 뷰포트 밖 카드의 **페인팅만 스킵** (React 마운트는 전부 실행)
- `contain-intrinsic-size: auto {height}px` — per-card 높이를 pretext/산술로 사전 계산
- `auto` 키워드: 첫 페인트 후 브라우저가 실측값 캐시 → 이후 추정 오차 0
- dnd-kit 호환: `getBoundingClientRect()` 정확 반환, 문서 흐름 유지

### 2. `LazyMount` (React 마운트 지연 — table만)

- table 질문의 무거운 내부 컴포넌트만 IO로 뷰포트 접근 시 마운트
- `rootMargin: '800px 0px'` — 뷰포트 진입 전 충분히 미리 마운트
- `immediate` prop — DragOverlay에서 즉시 렌더
- `mountedTableIdsRef` — 그룹 접기/펼치기 시 이전 마운트 상태 기억

### 3. `estimateCardHeight` (per-card 높이 추정)

- 테스트/편집 모드별 카드 shell 높이 분리 (`TEST_SHELL` / `EDIT_SHELL`)
- 타입별 입력 영역 높이: 산술 (radio: 옵션 수 × 28px 등)
- table 높이: `computeTableEstimatedHeight` — pretext `prepare()` + `layout()`로 정확 계산
- `cardHeightMap` (useMemo) — questions/isTestMode 변경 시만 재계산

### 4. `computeTableEstimatedHeight` (pretext 기반 테이블 높이)

- `use-row-heights.ts`의 `computeCellHeight` 재사용
- 셀 타입별 정확한 높이: text(pretext), checkbox(옵션 수), radio, select, image, video
- 헤더 행 수 × 45px + 행별 높이 합산 + 패딩
- LazyMount placeholder 높이로 사용 → 교체 시 스크롤 밀림 ≈ 0

---

## 추가 최적화

### 콜백 참조 안정화 (React.memo 효과 극대화)

- `handleEdit`, `handleDelete`, `handleDuplicate` — `useCallback` + `questionsRef`
- DragOverlay — `noop` 상수로 인라인 함수 제거
- `SortableQuestion`의 `React.memo`가 실제로 동작

### Store 구독 범위 축소

- 편집 페이지: `questions` 배열 → `questionCount` (숫자만 구독)
- `SortableQuestionList` 내부에서 `questions` 직접 구독
- 질문 변경 시 페이지 전체 리렌더 차단

### InteractiveTableResponse allResponses 의존성

- displayCondition에 참조된 질문의 응답만 추출 (`relevantResponseKeys`)
- JSON 직렬화로 값 비교 (`relevantResponsesJson`)
- 무관한 질문 응답 변경 시 visibleColumns/visibleRows 재계산 스킵

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/components/survey-builder/sortable-question-list.tsx` | LazyMount, estimateCardHeight, cardHeightMap, content-visibility 적용 |
| `src/hooks/use-row-heights.ts` | computeCellHeight, computeTableEstimatedHeight (pretext) |
| `src/components/survey-builder/interactive-table-response.tsx` | relevantResponseKeys 최적화 |
| `src/app/admin/surveys/[id]/edit/page.tsx` | questionCount/groupCount 구독 |
