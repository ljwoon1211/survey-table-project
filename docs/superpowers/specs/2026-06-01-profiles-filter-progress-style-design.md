# 응답 내역 필터 진척률 스타일 통일 + 조사 대상 그룹 실제 값 표시

작성일: 2026-06-01

## 배경

운영 콘솔의 두 페이지가 필터 UX와 "조사 대상 그룹" 표시에서 어긋나 있다.

- **진척률**(`/operations/report`): 모집단 명단(`contact_targets`)을 그룹 컬럼(`group_value` = 전시회명 국문)으로 집계. 필터는 명단 컬럼 후보(번호/attrs/개인정보) 단일 검색바 `[컬럼 선택] [검색어] [검색]`.
- **응답 내역**(`/operations/profiles`): `survey_responses`만 조회. "조사 대상 그룹" 컬럼이 `accessorFn: () => '공개링크'`로 **하드코딩**되어 모든 행이 "공개링크"로 표시됨. 필터는 `[검색 input] [검색 항목(전체/순번/브라우저)] [상태] [적용]`.

응답 내역도 `contact_targets`와 join해 명단 정보를 끌어오면 두 문제를 함께 해결할 수 있다. 진척률에 이미 구현된 컬럼 후보·조건 파싱·필터 SQL 로직을 재사용한다.

## 목표

1. 응답 내역 필터바를 진척률 스타일로 통일: `[컬럼 선택 Select] [검색어 Input] [전체 상태 Select] [적용]`.
2. "조사 대상 그룹" 컬럼을 하드코딩 "공개링크" 대신 매칭된 응답의 실제 그룹 값(전시회명 국문)으로 표시. 익명 응답은 "공개링크" 유지.

## 비목표 (YAGNI)

- 진척률처럼 그룹 단위로 집계하지 않는다. 응답 내역은 응답 1행 = 1 row를 유지한다.
- 다중 AND 필터 도입하지 않는다. 진척률과 동일하게 한 번에 한 컬럼만 검색.
- pii 부분 검색은 도입하지 않는다(기존 blindIndex 정확 일치 그대로).

## 핵심 설계 결정

### 결정 1 — 필터 컬럼 후보 구성

후보 = 응답 자체 컬럼 2개 + 명단 컬럼들:

| source | 매칭 대상 | 모드 |
|--------|-----------|------|
| `idx` | `survey_responses` row_number (응답 순번) | 정확 매치 |
| `browser` | `survey_responses.browser` | ilike 부분일치 |
| `system.resid` | `contact_targets.resid` | idlist/range |
| `attrs.*` (전시회명 국문 등) | `contact_targets.attrs->>key` | ilike 부분일치 |
| `pii.*` | `contact_pii.blind_index` | 정확 일치(blindIndex) |

- `idx`/`browser`는 응답 전용. `system.resid`/`attrs.*`/`pii.*`는 진척률과 동일하게 `getContactColumnScheme` + `buildColumnCandidates`로 로드.
- 컬럼 미선택 시 검색 비활성(진척률과 동일).

### 결정 2 — idx 독립성 유지를 위해 필터를 outer에서 적용

현재 `idx`(순번)는 **필터와 독립적인** surveyId 단위 절대 ROW_NUMBER다(`profiles.server.ts` 주석에 명시된 의도: "운영자에게 '최근 응답이 1번' 의미가 일관됨"). 필터를 row_number 매기는 base subquery WHERE에 넣으면 idx가 필터된 집합 기준으로 다시 매겨져 의미가 깨진다.

따라서:
- `numbered` subquery FROM에 `LEFT JOIN contact_targets ct ON ct.id = sr.contact_target_id` 추가.
- subquery select에 `ct.group_value`, `ct.resid`, `ct.attrs`, `ct.id`(pii EXISTS용) 추가. row_number는 전체 기준 그대로.
- 모든 컬럼 필터를 **outer SELECT(`numbered` 위)** WHERE에서 적용해 idx 독립성 유지.

### 결정 3 — 필터 SQL 빌더 공유

진척률의 `buildFilterSql`(현재 `progress-filters.server.ts` 호출부에서 사용, `ct` alias 하드코딩 + module-private)을 **컬럼 alias/fragment를 주입받도록 일반화하여 export**한다. 응답 내역은 outer alias(`numbered`) 컬럼 기준으로 호출. `idx`/`browser`는 진척률 `FilterCondition` 타입에 없으므로 응답 전용 2분기를 별도 추가.

- 진척률 호출부는 alias 기본값 `ct`로 동작 무회귀.
- 완전 통합이 아닌 "조건 SQL 빌더 공유 + 응답 전용 2분기" 형태.

### 결정 4 — 익명 응답 그룹 표시

`row.groupValue ?? '공개링크'`. 매칭된 응답은 전시회명 국문, 익명(`contact_target_id IS NULL` 또는 매칭 없음)은 "공개링크" 유지.

## 변경 대상

### `src/lib/operations/profiles.ts` (pure, 클라/서버 공용)

- `QFIELDS`/`QField` 제거 → URL 파라미터 `qfield` → `col`.
- `NormalizedListArgs`: `qfield` → `col: string | null`.
- `normalizeListArgs`: `col` 정규화(후보 화이트리스트 검증은 server에서 condition 파싱 시 수행하므로 여기선 원시 string 보존).
- `hasActiveFilters`: `qfield` → `col` 기준.
- 단위 테스트 `tests/unit/domains/operations/profiles.test.ts` 동반 수정.

### `src/lib/operations/profiles.server.ts`

- `ProfilesRow`에 `groupValue: string | null` 추가.
- `numbered` subquery: `LEFT JOIN contact_targets ct` + ct 컬럼 select.
- outer WHERE: condition 기반 필터 (idx/browser 전용 분기 + 공유 `buildFilterSql`).
- 어댑터 인자 시그니처: `qfield`/`q` → `condition: FilterCondition | ProfilesExtraCondition | null` 형태.

### `src/lib/operations/progress-filters.server.ts`

- `buildFilterSql`을 alias 주입 가능하도록 일반화 + export(또는 별도 공유 모듈로 추출).

### `src/components/operations/profiles/profiles-filter-bar.tsx`

- 진척률 `ProgressFilterBar`와 동일 레이아웃 + shadcn `Select`/`Input`/`Button`.
- props: `surveyId`, `initialSource`, `initialValue`, `initialStatus`, `columnCandidates`.
- `placeholderFor` 공유, 컬럼 미선택 시 검색 비활성. status Select 유지.

### `src/components/operations/profiles/profiles-table.tsx`

- `group` 컬럼 `accessorFn: () => '공개링크'` → `accessorFn: (r) => r.groupValue ?? '공개링크'`.
- `DisplayRow`에 `groupValue` 추가.

### `src/app/admin/surveys/[id]/operations/profiles/page.tsx`

- `getContactColumnScheme` + `buildColumnCandidates`로 후보 로드.
- `parseConditionFromUrl`(+ idx/browser 후보 포함) 로 condition 파싱해 어댑터/필터바에 전달.

## 데이터 흐름

```
profiles/page.tsx (RSC)
  ├─ getContactColumnScheme → buildColumnCandidates ─┐
  │                                                  ├→ columnCandidates (idx/browser 합침)
  │  idx/browser 후보 상수 ───────────────────────────┘
  ├─ parseCondition(col, q, candidates) → condition
  ├─ listResponsesForProfiles({ surveyId, condition, status, ... })
  │     └─ numbered(LEFT JOIN ct) → outer WHERE(condition) → rows{ groupValue }
  └─ <ProfilesFilterBar columnCandidates initialSource initialValue initialStatus />
     <ProfilesTable rows(groupValue) />
```

## 에지 케이스

- 컬럼 미선택 + 검색어 있음 → 검색 버튼 비활성(진척률과 동일).
- 명단 컬럼(resid/attrs/pii)으로 검색 → 익명 응답 자동 제외(join 미매칭). 의도된 동작.
- `idx` 비숫자 입력 → 0건(기존 로직 유지).
- `attrs->>key`가 NULL → ilike false 자동 제외.
- 그룹 값이 NULL인 매칭 응답(group_value 미설정) → "공개링크"로 표시(익명과 동일 폴백).
- `status='deleted'` 뷰 + 명단 필터 동시 → 기존 deleted 분기 유지하며 condition 적용.

## 검증

- `tests/unit/domains/operations/profiles.test.ts` 갱신 + 통과.
- `npx tsc --noEmit` (ESLint 인프라 깨짐 — tsc + vitest + build로 대체 검증).
- `pnpm build`.
- 진척률 페이지 무회귀(buildFilterSql alias 기본값) 수동 확인.
