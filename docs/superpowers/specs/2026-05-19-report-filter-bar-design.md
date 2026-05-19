# 진척 보고 단일 검색바 — 디자인

- **작성일**: 2026-05-19
- **브랜치**: `feat/report-filter-bar` (main 분기)
- **대상 페이지**: `/admin/surveys/[id]/operations/report`
- **상태**: 디자인 검토 단계
- **대체 대상**: 같은 날짜 작성한 `2026-05-19-report-attrs-filter-design.md` (칩 UI 디자인)을 폐기하고 단일 검색바로 재설계. 폐기 spec 은 `feat/report-attrs-filter-chips` 미머지 브랜치에만 남음

## 배경

진척 보고 페이지의 단일 텍스트 검색(`?q=`)을 컨택 컬럼(`contactColumns`) 전체에서 선택 가능한 단일 컬럼 검색바로 교체. 이전 칩 UI 디자인이 운영 시나리오 대비 과스코프라 판단해 단일 [컬럼 select][값 input][검색] 형태로 단순화. `system.resid` 만 ID 타입 자동 처리해 `1-30, 45` 같은 range/list 입력 허용. pii 컬럼은 후보에 포함하되 blindIndex 정확 일치만 지원.

## 목표 / 비목표

**목표**
- `contactColumns` 전체(표시·숨김 무관)를 select 드롭다운 후보로 노출
- 단일 컬럼 부분일치(ILIKE) 검색 — 한 번에 한 컬럼만
- `system.resid` 자동 ID 타입 — `1-30, 45` range/list 입력 시 정수 IN/BETWEEN 매칭
- pii 컬럼 → blindIndex 정확 일치 매칭
- URL `?col=&q=` 두 평문 파라미터로 직렬화 — 사람이 읽고 디버깅 가능
- 빈 input + [검색] → 필터 해제 (전체 조회)

**비목표**
- 다중 컬럼 AND/OR 결합 — 한 번에 한 컬럼만
- pii 부분일치 — blindIndex 구조상 불가, 별도 슬라이스에서 trigram 등 검토
- `system.resid` 외 다른 system 컬럼 (`contact_result`/`email_count`/`web`/`contact_owner`) 검색 — 의미 정의 후 별도 슬라이스
- attrs 컬럼의 ID 타입 마킹 — `contactColumns` 스킴에 `dataType` 필드 추가는 별도 슬라이스
- 사용자별 필터 프리셋 저장
- 백워드 호환 `?q=` URL 처리 — 폐기된 칩 UI 브랜치는 미머지, main 의 단일 `q` 검색은 의미가 비슷하지만 칩 UI 와 명확히 다름. `?q=` 만 있는 main 의 기존 URL은 새 디자인에서 `col` 없음으로 필터 무시(= 전체 조회) 처리

## 사용자 시나리오

운영자가 진척 보고 페이지에서 빠르게 한 조건만 좁히고 싶다.

**시나리오 1 — 전시회명 부분일치**
1. select 에서 "전시회명" 선택
2. input 에 "핵심" 입력 → [검색]
3. URL `?col=attrs.%EC%A0%84%EC%8B%9C%ED%9A%8C%EB%AA%85&q=%ED%95%B5%EC%8B%AC`
4. SQL: `WHERE ct.attrs->>'전시회명' ILIKE '%핵심%'`

**시나리오 2 — 컨택 번호 range**
1. select 에서 "컨택번호 (ID)" 선택 → input placeholder 가 "예: 1-30, 45" 로 변경
2. `1-30, 45` 입력 → [검색]
3. URL `?col=system.resid&q=1-30%2C+45`
4. SQL: `WHERE ct.resid BETWEEN 1 AND 30 OR ct.resid = 45`

**시나리오 3 — 이메일 정확 일치 (pii)**
1. select 에서 "이메일 (정확 일치)" 선택 → input placeholder 가 "정확한 값 입력 (부분 검색 불가)" 로 변경
2. `user@example.com` 입력 → [검색]
3. Server Component 에서 `blindIndex(piiType='email', value)` 계산
4. SQL: `WHERE EXISTS (SELECT 1 FROM contact_pii pp WHERE pp.contact_target_id = ct.id AND pp.column_key = 'email' AND pp.blind_index = '<hash>')`

**시나리오 4 — 필터 해제**
1. [초기화] 또는 input 비우고 [검색] → URL `col`/`q` 모두 삭제 → 전체 조회

## §1: 데이터 모델 & URL 직렬화

### 자료구조

```ts
// src/lib/operations/progress-filters.ts
export interface NumRange { from: number; to: number }  // 양의 정수, from ≤ to

export type FilterCondition =
  | { source: 'system.resid'; mode: 'idlist'; ranges: NumRange[] }
  | { source: 'system.resid'; mode: 'text';   value: string }    // 비숫자 입력 폴백 — 매칭 0건
  | { source: `attrs.${string}`; mode: 'text'; value: string }   // ILIKE 부분일치
  | { source: `pii.${string}`;   mode: 'exact'; value: string; blindIndex: string };
```

`pii.*` 의 `blindIndex` 는 Server Component 에서 `blindIndex(piiType, value)` 호출로 계산 후 채워진다. 운영자가 입력한 평문 `value` 는 SQL 에 들어가지 않고 해시(`blindIndex`)만 들어간다. `value` 자체는 UI 표시(현재 검색 조건 보여주기)에만 사용.

### URL 직렬화

`?col=<source>&q=<value>` 두 평문 파라미터. URL-encoded.

```
?col=attrs.%EC%A0%84%EC%8B%9C%ED%9A%8C%EB%AA%85&q=%ED%95%B5%EC%8B%AC
?col=system.resid&q=1-30%2C+45
?col=pii.email&q=user%40example.com
```

- base64url JSON 안 씀 (단일 조건이라 불필요)
- 한글 source 안전 (URL-encoded)
- 운영자가 URL 보고 무슨 검색인지 즉시 파악
- `col` 만 있고 `q` 비어있으면 필터 없음 (전체 조회)
- 알 수 없는 `col` (화이트리스트 위반) → 필터 무시 (silent drop, 페이지 깨짐 방지)

### 모드 자동 결정

`source` 기반:

- `source === 'system.resid'`:
  - 입력이 숫자 range/list 패턴 매치 → `idlist`
  - 그 외 → `text` (resid 가 정수 컬럼이라 매칭 0건이지만 안전)
- `source.startsWith('attrs.')` → 항상 `text` (range/list 패턴이라도 그냥 ILIKE `%1-30%`)
- `source.startsWith('pii.')` → 항상 `exact` (blindIndex 매칭)

`parseIdListInput` 규칙 — 이전 spec 동일:
- 정규식 `^\s*\d+(\s*-\s*\d+)?(\s*,\s*\d+(\s*-\s*\d+)?)*\s*$` 매치만 통과
- `1-30, 45` → `[{from:1,to:30},{from:45,to:45}]`
- `50-10` 자동 swap
- 음수·소수점·INT32_MAX 초과·빈 토큰 → null

### 컬럼 후보 (select 드롭다운)

`surveys.contactColumns.columns` 전체 순회 후:
- `source === 'system.resid'` → 후보 포함
- `source.startsWith('attrs.')` → 후보 포함
- `source.startsWith('pii.')` → 후보 포함, label 에 "(정확 일치)" 마커
- 그 외 system.* (`contact_result`/`email_count`/`web`/`contact_owner`) → 제외

표시/숨김(`hidden`) 무관 — 운영자가 숨긴 컬럼도 검색 가능.

### 화이트리스트 검증 (서버)

Server Component 에서 `parseConditionFromUrl(col, q, columnCandidates)` 호출:
1. `col` 이 `columnCandidates` 의 `source` 와 매칭되는지 확인 — 위반 시 null 반환 (silent drop)
2. `q` 가 빈 문자열이면 null 반환 (필터 없음)
3. 매칭되면 `source` 종류에 따라 `FilterCondition` 객체 생성:
   - `system.resid` + 숫자 패턴 → idlist
   - `system.resid` + 비숫자 → text
   - `attrs.*` → text
   - `pii.*` → exact + `blindIndex(piiType, value)` 호출 결과 첨부

## §2: 서버 쿼리 빌더

대상 파일: `src/lib/operations/report-progress.server.ts`

### WHERE 절 헬퍼

```ts
function buildFilterSql(condition: FilterCondition | null) {
  if (!condition) return sql`TRUE`;

  if (condition.source === 'system.resid') {
    if (condition.mode === 'idlist') {
      if (condition.ranges.length === 0) return sql`FALSE`;
      const conds = condition.ranges.map((r) =>
        r.from === r.to
          ? sql`ct.resid = ${r.from}`
          : sql`ct.resid BETWEEN ${r.from} AND ${r.to}`,
      );
      return sql.join(conds, sql` OR `);
    }
    return sql`FALSE`; // text 폴백 — resid 가 정수 컬럼이라 비숫자 매칭 0건
  }

  if (condition.source.startsWith('attrs.')) {
    const key = condition.source.slice('attrs.'.length);
    const escaped = escapeLikePattern(condition.value);
    return sql`ct.attrs->>${key} ILIKE '%' || ${escaped} || '%'`;
  }

  if (condition.source.startsWith('pii.')) {
    const columnKey = condition.source.slice('pii.'.length);
    return sql`EXISTS (
      SELECT 1 FROM contact_pii pp
      WHERE pp.contact_target_id = ct.id
        AND pp.column_key = ${columnKey}
        AND pp.blind_index = ${condition.blindIndex}
    )`;
  }

  return sql`TRUE`; // 알 수 없는 source — 페이지 깨짐 방지
}
```

### 보안

- `condition.source` 는 page.tsx 에서 `contactColumns` 화이트리스트 검증 후 진입
- `value`, `from`, `to`, `blindIndex`, `key`, `columnKey` 모두 parameter binding
- pii 평문 `condition.value` 는 SQL 에 들어가지 않음 — 해시(`blindIndex`)만 사용
- `sql.raw` 미사용

### `getProgressRows` / `getProgressTotals` 시그니처

```ts
interface GetProgressRowsArgs {
  surveyId: string;
  condition: FilterCondition | null;
  page: number;
  size: number;
  sort: ProgressSortKey;
  dir: SortDir;
  metaKeys: string[];
}

export async function getProgressRows(args: GetProgressRowsArgs): Promise<ProgressRow[]>;
export async function getProgressTotals(surveyId: string, condition: FilterCondition | null): Promise<ProgressTotals>;
```

WHERE 절 변경:
```ts
WHERE ct.survey_id = ${surveyId}
  AND ${buildFilterSql(condition)}
```

기존 `qLike` / `(${q} = '' OR ... ILIKE ...)` 제거 → `${filterSql}` 로 대체.

### 유지되는 항목

- `SORT_COL_MAP` / `meta_<idx>` 정렬 로직 그대로
- `closingFilter` 그대로
- `escapeLikePattern` 그대로 (attrs 분기에서 사용)
- `getProgressColumnScheme` / `getProgressGroupLabel` 그대로

### NULL 동작

- `attrs.*`: `ct.attrs->>key` 가 NULL 이면 `NULL ILIKE` → 매칭 false (자동 제외)
- `pii.*`: `EXISTS` 가 false (해당 컬럼의 pii 행 없음) → 매칭 false
- `system.resid`: resid 는 NOT NULL 컬럼이라 무관

Known Limitation: 한 그룹 내 컨택 간 attrs/pii 값이 다른 경우 진척률 분모 의미가 시프트 — 이전 spec 동일.

## §3: 클라이언트 UI 컴포넌트

신규 컴포넌트: `src/components/operations/report/progress-filter-bar.tsx`

### Props

```ts
import type { PiiFieldType } from '@/lib/crypto/pii-fields';

interface ColumnCandidate {
  source: string;          // 'system.resid' | `attrs.${key}` | `pii.${key}`
  label: string;           // 사용자 표시 라벨
  piiType?: PiiFieldType;  // pii.* 인 경우만 (서버 측 blindIndex 호출에 사용)
}

interface Props {
  initialSource: string | null;
  initialValue: string;
  columnCandidates: ColumnCandidate[];
}
```

### UI 구조

```tsx
<form onSubmit={handleSearch} className="flex items-center gap-2 p-3 bg-muted rounded-md">
  <label htmlFor="filter-column" className="sr-only">검색 컬럼</label>
  <Select value={source ?? ''} onValueChange={setSource}>
    <SelectTrigger id="filter-column" className="min-w-[160px]">
      <SelectValue placeholder="컬럼 선택" />
    </SelectTrigger>
    <SelectContent>
      {columnCandidates.map((c) => (
        <SelectItem key={c.source} value={c.source}>
          {c.label}
          {c.source.startsWith('pii.') && (
            <span className="ml-1 text-muted-foreground text-xs">(정확 일치)</span>
          )}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>

  <label htmlFor="filter-value" className="sr-only">검색어</label>
  <Input
    id="filter-value"
    value={value}
    onChange={(e) => setValue(e.target.value)}
    placeholder={placeholderFor(source)}
    aria-describedby="filter-value-hint"
    className="flex-1"
  />

  <Button type="submit">검색</Button>
  <Button type="button" variant="ghost" onClick={handleReset}>초기화</Button>
</form>
```

### Placeholder 자동 변경

```ts
function placeholderFor(source: string | null): string {
  if (!source) return '검색어';
  if (source === 'system.resid') return '예: 1-30, 45';
  if (source.startsWith('pii.')) return '정확한 값 입력 (부분 검색 불가)';
  return '부분일치';
}
```

### 동작

**[검색] 또는 Enter 시** (`handleSearch`):
1. `value.trim()` 이 빈 문자열이면:
   - `pushParams((p) => { p.delete('col'); p.delete('q'); p.delete('page'); })` — 필터 해제
2. `source === null` 이면 무시 (Select 미선택)
3. 그 외:
   - `pushParams((p) => { p.set('col', source); p.set('q', value.trim()); p.delete('page'); })`

`startTransition` 으로 감쌈.

**[초기화]** (`handleReset`):
- 로컬 state `source`/`value` 모두 비움
- URL `col`/`q`/`page` 삭제

**URL ↔ state 동기화**:
- `useEffect([JSON.stringify({ initialSource, initialValue })])` 로 브라우저 뒤로/앞 대응
- 이전 spec 의 동일 패턴 (무한 re-render 방지)

### 접근성

- `<form>` 사용 → Enter 자동 submit
- `<label htmlFor>` Select 와 Input 모두 명시적 연결 (스크린리더용 `sr-only` 라벨)
- pii option 의 "(정확 일치)" 마커 → 시각 + 스크린리더 둘 다 전달
- 검색/초기화 버튼은 `<button type="submit">` / `<button type="button">` 명시

### 컬럼 후보 데이터 전달 (page.tsx)

Server Component:
1. `surveys.contactColumns` 전체 로드
2. 후보 필터: `system.resid` / `attrs.*` / `pii.*` 만, 그 외 system.* 제외
3. `pii.*` 인 경우 `piiType` 도 객체에 포함
4. Client component 에 prop 으로 전달

## §4: 변경 범위 / 테스트 / Known Limitations

### 브랜치 전략

- 기존 `feat/report-attrs-filter-chips` 브랜치(13 커밋, 미머지) → 폐기. 칩 UI 전체가 사라지므로 history 가져갈 가치 낮음
- 새 브랜치 `feat/report-filter-bar` (main 분기)
- 새 spec/plan 도 main 기준으로 새로 작성

### 변경 파일

| 변경 | 파일 | 책임 |
| --- | --- | --- |
| 신규 | `src/lib/operations/progress-filters.ts` | `FilterCondition` 타입, `parseIdListInput`, `parseConditionFromUrl`, `placeholderFor` |
| 신규 | `src/components/operations/report/progress-filter-bar.tsx` | 단일 검색바 form 컴포넌트 |
| 신규 | `tests/unit/progress-filters.test.ts` | 단위 테스트 |
| 수정 | `src/lib/operations/report-progress.server.ts` | `buildFilterSql(condition)` 헬퍼, `getProgressRows`/`getProgressTotals` 시그니처 |
| 수정 | `src/app/admin/surveys/[id]/operations/report/page.tsx` | `sp.col`/`sp.q` 파싱, contactColumns 후보 빌드, pii 면 blindIndex 계산 |

DB 스키마 변경 없음 / 마이그레이션 없음.

### 테스트 전략

vitest 는 `tests/` 디렉토리만 include — `tests/unit/` 아래에 둘 것.

**단위 테스트** — `tests/unit/progress-filters.test.ts`:
- `parseIdListInput`:
  - 단일 `5` → `[{from:5,to:5}]`
  - range `1-30` → `[{from:1,to:30}]`
  - 혼합 `1-30, 45` → `[{from:1,to:30},{from:45,to:45}]`
  - 공백 허용 `1 - 30 , 45`
  - 역방향 swap `50-10` → `{from:10,to:50}`
  - 빈 토큰 `1,,2` → `null`
  - 소수점/E표기/INT32_MAX 초과/음수 → `null`
  - 텍스트 → `null`
- `placeholderFor`: null/system.resid/pii.*/attrs.* 각 케이스
- `parseConditionFromUrl(col, q, columnCandidates)`:
  - `col` 화이트리스트 위반 → null
  - `q` 빈 문자열 → null
  - `system.resid` + 숫자 패턴 → idlist
  - `system.resid` + 비숫자 → text
  - `attrs.*` → text
  - `pii.*` → exact + blindIndex 함수 호출 검증 (mock 또는 실제 env 변수 셋업 후 실제 계산)

**통합 테스트** — `tests/integration/` 에 report-progress 패턴이 있으면 추가, 없으면 단위 테스트 + 수동 dogfooding 으로 검증.

UI 컴포넌트는 단위 테스트 X — 수동 dogfooding.

### Known Limitations

1. **pii 부분일치 미지원** — blindIndex 정확 일치만. 도메인만 검색(@gmail.com)·이름 일부 검색 같은 건 불가. 별도 슬라이스에서 trigram blind index 또는 도메인 분리 해시 검토
2. **다른 system 컬럼 검색 미지원** — `system.contact_result`/`system.email_count`/`system.web`/`system.contact_owner` 등. 의미 정의 + 데이터 구조 정리 후 별도 슬라이스
3. **다중 컬럼 AND 미지원** — 한 번에 한 컬럼만. 여러 조건 동시 필터 필요하면 별도 슬라이스
4. **attrs ID-like 컬럼도 ILIKE 만** — 컬럼 설정 UI 에 `dataType` 마킹 추가는 별도 슬라이스. 이번엔 `system.resid` 만 range/list
5. **attrs JSONB 인덱스 없음** — 응답 1만+ 시점 GIN 인덱스 검토. `profiles_scale_optimization` 메모와 동일 시점
6. **pii blindIndex 컬럼 매칭** — `pp.column_key` 는 정확 일치 필요. 한글 attrs 라벨에서 한글 변형 매칭 불가 (db 저장된 key 그대로 사용)
7. **그룹 내 attrs/pii 불일치 시 진척률 분모 의미 시프트** — 정상 업로드(전시회 단위 = 동일 attrs)에서는 무관
8. **북마크된 기존 `?q=` URL 깨짐** — main 의 단일 q 검색은 의미가 비슷하지만 새 디자인은 `col` 도 필요. `?q=` 만 있는 기존 URL은 `col` 없음으로 필터 무시 → 전체 조회로 폴백 (페이지 안 깨짐)
9. **`contact_pii` 복합 인덱스 누락** — pii.* EXISTS 서브쿼리가 `(contact_target_id, column_key, blind_index)` 복합 인덱스를 필요로 한다. 현재 마이그레이션은 `idx_contact_pii_target(contact_target_id)` + `idx_contact_pii_field_blind(field_type, blind_index)` 만 있어 컨택 1만+ 시점 느려질 수 있음. 그 시점에 복합 인덱스 추가 검토

### 미커밋 작업 분리 (작업 시작 시점)

이전 브랜치(`feat/report-attrs-filter-chips`)에서 발견된 미커밋 변경(메일 템플릿/리치 텍스트 에디터 관련 6 파일)은 stash 에 보존 중. 이번 작업과 완전히 독립적인 별도 작업이므로 stash 그대로 두고 사용자가 별도 처리.
