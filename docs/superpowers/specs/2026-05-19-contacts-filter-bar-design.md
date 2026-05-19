# 조사 대상 목록 다중 조건 필터 — 디자인

- **작성일**: 2026-05-19
- **브랜치**: `feat/contacts-filter-bar` (`feat/report-filter-bar` 머지 후 main 에서 분기 권장)
- **대상 페이지**: `/admin/surveys/[id]/operations/contacts`
- **상태**: 디자인 검토 단계
- **선행 작업**: `2026-05-19-report-filter-bar-design.md` (진척 보고 단일 검색바) — `range-list.ts` 공유 유틸 분리에 의존

## 배경

조사 대상 목록 페이지의 현재 필터(`qfield` 5종 하드코딩 + 결과코드 dropdown + 별개 q input)를 진척 보고와 같은 컬럼 select 기반 검색으로 통일하되, **다중 AND/OR 조건**을 지원한다. 운영자가 "5월 + 서울 + 산업 카테고리" 같은 AND 체인뿐 아니라 "서울 OR 부산" 같은 OR 도 함께 표현할 수 있어야 한다. UI 는 진척 보고의 단순 검색바 + [▼ 다중 조건] Collapsible 패널로 확장.

## 목표 / 비목표

**목표**
- `contactColumns` 전체(system + attrs + pii)를 컬럼 후보로 노출
- 다중 조건 AND/OR 결합 — 좌→우 평가, 각 행마다 결합사 토글
- `system.resid` range/list, `system.contact_result` enum dropdown, `system.web` boolean dropdown, `attrs.*` ILIKE, `pii.*` blindIndex 정확 일치
- Collapsible 진입점 — 평소 단순 검색바 한 줄, [▼ 다중 조건] 펼치면 추가 행
- URL 다중값 직렬화 (`?col[]=&q[]=&op[]=`) — 사람 읽기 가능
- 단순 검색바 = 다중 조건 모델의 첫 절 (단일 통합 모델)

**비목표**
- 자유 그룹 표현 (`(A OR B) AND (C OR D)`) — 좌→우 평가만. 운영 시나리오 빈도 5% 미만으로 추정, 별도 슬라이스에서 확장 가능
- pii 부분일치 — blindIndex 구조상 불가, 후속 슬라이스에서 trigram 검토
- `system.email_count` / `system.contact_owner` 검색 — placeholder 컬럼, 후속 슬라이스
- 백워드 호환 `?qfield=&q=&resultCode=` URL — 운영 콘솔 사용자 영향 좁음, deprecate

## 사용자 시나리오

**시나리오 1 — 단일 컬럼 (80% 케이스)**
1. `[컬럼 select]` 에서 "전시회명" 선택 → `[input]` 에 "핵심" → `[검색]`
2. URL `?col=attrs.전시회명&q=핵심&op=`
3. SQL: `WHERE ct.attrs->>'전시회명' ILIKE '%핵심%'`

**시나리오 2 — AND 체인**
1. 단순 검색바: 전시회명 = 핵심
2. `[▼ 다중 조건]` 클릭 → 추가 행: `[AND][지역][서울]`
3. URL `?col=attrs.전시회명&col=attrs.지역&q=핵심&q=서울&op=&op=AND`
4. SQL: `WHERE (attrs->>'전시회명' ILIKE '%핵심%') AND (attrs->>'지역' ILIKE '%서울%')`

**시나리오 3 — OR 결합**
1. 단순 검색바: 지역 = 서울
2. 다중 조건: `[OR][지역][부산]`, `[OR][지역][광주]`
3. SQL: `WHERE ((attrs->>'지역' ILIKE '%서울%') OR (attrs->>'지역' ILIKE '%부산%')) OR (attrs->>'지역' ILIKE '%광주%')`

**시나리오 4 — 결과코드 + 응답 여부**
1. `system.contact_result` 선택 → dropdown 에서 "1.조사완료" → 추가 행 `AND` + `system.web` + "응답 완료"
2. SQL: `WHERE (latestResultCode = '1.조사완료') AND (ct.responded_at IS NOT NULL)`

## §1: 자료구조 + URL 직렬화

### 타입

```ts
// src/lib/operations/contacts-filters.server.ts
import type { NumRange } from './range-list';
import type { PiiFieldType } from '@/lib/crypto/pii-fields';

export type CombineOp = 'AND' | 'OR';
export type ConditionMode = 'idlist' | 'text' | 'exact' | 'enum' | 'boolean';

export interface FilterCondition {
  source: string;
  mode: ConditionMode;
  value: string;
  ranges?: NumRange[];
  blindIndex?: string;
}

export interface FilterClause {
  condition: FilterCondition;
  /** 첫 절 null. 두 번째 이후 AND/OR. */
  op: CombineOp | null;
}

export interface ColumnCandidate {
  source: string;
  label: string;
  piiType?: PiiFieldType;
}
```

### 컬럼 → mode 매핑

| source | mode | 매칭 SQL | UI 위젯 |
|---|---|---|---|
| `system.resid` | `idlist` (숫자 패턴 매치 시) / `text` 폴백 | `ct.resid = X` 또는 `BETWEEN` OR | text input |
| `system.contact_result` | `enum` | `latestResultCodeExpr = ${value}` 정확 일치 | dropdown (결과코드) |
| `system.web` | `boolean` | `ct.responded_at IS NULL/NOT NULL` | dropdown ("응답 완료" / "미응답") |
| `attrs.*` | `text` | `ct.attrs->>key ILIKE '%v%'` | text input |
| `pii.*` | `exact` | `EXISTS(contact_pii.blind_index = ${hash})` | text input |

`system.email_count` / `system.contact_owner` 는 placeholder, 후보 제외.

### URL 직렬화

```
?col=attrs.전시회명&col=attrs.지역&col=attrs.지역
&q=핵심&q=서울&q=부산
&op=&op=AND&op=OR
&page=1&sort=resid&dir=asc
```

- Next.js searchParams 가 같은 키 여러 값 자연 지원 (`string[]`)
- `col[i]` ↔ `q[i]` ↔ `op[i]` 인덱스 페어
- `op[0]` = 빈 문자열 (첫 절은 결합사 없음)
- 길이 불일치 → 짧은 쪽까지만 silent truncate

### 화이트리스트 검증 + 모드 결정 (`parseClausesFromUrl`)

```ts
parseClausesFromUrl(
  cols: string[] | undefined,
  qs: string[] | undefined,
  ops: string[] | undefined,
  candidates: ColumnCandidate[],
  resultCodes: ContactResultCode[],
): FilterClause[]
```

1. `cols`/`qs` 둘 다 array 로 정규화 (`undefined` → 빈 배열, `string` → 1-element). `ops` 도 동일.
2. `Math.min(cols.length, qs.length)` 까지만 순회 (silent truncate).
3. 각 인덱스:
   - `cols[i]` 가 candidates 에 없으면 → 그 절 silent drop
   - `qs[i].trim().length === 0` → silent drop
   - source 종류 따라 mode 결정 (위 매핑 표)
   - `system.contact_result` 의 `value` 가 resultCodes 에 없으면 drop
   - `system.web` 의 `value` 가 `'true'`/`'false'` 아니면 drop
   - `pii.*` 의 `blindIndex` 가 빈 문자열이면 drop (정규화 실패)
   - `op[i]` 가 `'AND'`/`'OR'` 외 값이면 `'AND'` 폴백 (첫 절은 항상 `null` 강제)
4. 반환된 `FilterClause[]` 의 첫 원소 `op` 는 항상 `null`.

## §2: 서버 쿼리 빌더

대상 모듈: `src/lib/operations/contacts-filters.server.ts` (신규) + `src/lib/operations/contacts.server.ts` (수정).

### `buildClauseSql(cond)` — 단일 절

```ts
function buildClauseSql(cond: FilterCondition) {
  if (cond.source === 'system.resid') {
    if (cond.mode === 'idlist') {
      if (!cond.ranges || cond.ranges.length === 0) return sql`FALSE`;
      const conds = cond.ranges.map((r) =>
        r.from === r.to
          ? sql`ct.resid = ${r.from}`
          : sql`ct.resid BETWEEN ${r.from} AND ${r.to}`,
      );
      return sql.join(conds, sql` OR `);
    }
    return sql`FALSE`;
  }

  if (cond.source === 'system.contact_result' && cond.mode === 'enum') {
    return sql`${latestResultCodeExpr} = ${cond.value}`;
  }

  if (cond.source === 'system.web' && cond.mode === 'boolean') {
    return cond.value === 'true'
      ? sql`ct.responded_at IS NOT NULL`
      : sql`ct.responded_at IS NULL`;
  }

  if (cond.source.startsWith('attrs.') && cond.mode === 'text') {
    const key = cond.source.slice('attrs.'.length);
    const escaped = escapeLikePattern(cond.value);
    return sql`ct.attrs->>${key} ILIKE '%' || ${escaped} || '%'`;
  }

  if (cond.source.startsWith('pii.') && cond.mode === 'exact') {
    if (!cond.blindIndex) return sql`FALSE`;
    const columnKey = cond.source.slice('pii.'.length);
    return sql`EXISTS (
      SELECT 1 FROM contact_pii pp
      WHERE pp.contact_target_id = ct.id
        AND pp.column_key = ${columnKey}
        AND pp.blind_index = ${cond.blindIndex}
    )`;
  }

  return sql`FALSE`; // unknown source/mode safety net
}
```

### `buildContactsFilterSql(clauses)` — 좌→우 평가

```ts
function buildContactsFilterSql(clauses: FilterClause[]) {
  if (clauses.length === 0) return sql`TRUE`;
  let expr = buildClauseSql(clauses[0].condition);
  for (let i = 1; i < clauses.length; i++) {
    const next = buildClauseSql(clauses[i].condition);
    const op = clauses[i].op === 'OR' ? sql.raw('OR') : sql.raw('AND');
    expr = sql`(${expr}) ${op} (${next})`;
  }
  return expr;
}
```

각 절을 `(...)` 로 감싸 좌→우 평가를 명시적으로 보장. SQL 의 AND/OR 우선순위 모호함 제거.

### 보안

- `cond.source` / `value` / `blindIndex` / `ranges[].from|to` 모두 parameter binding
- `sql.raw` 는 `'AND'` / `'OR'` 정적 상수만
- pii 평문 SQL 미노출 (`blindIndex` 만 사용)
- `cond.source` / `cond.value` 의 enum 검증은 `parseClausesFromUrl` 단계에서 끝남

### `listContactsForSurvey` 시그니처 변경

```ts
// before
{ surveyId, qfield, q, resultCode, page, pageSize, sort, dir }

// after
{ surveyId, clauses: FilterClause[], page, pageSize, sort, dir }
```

`contacts.server.ts:69-134` 의 qfield/q/resultCode 분기 코드 전부 제거 → `buildContactsFilterSql(clauses)` 한 줄로 대체.

### `latestResultCodeExpr` — 기존 헬퍼 재사용

`contacts.server.ts:81` 의 subquery 그대로. `system.contact_result` 분기에서 활용.

## §3: 클라이언트 UI

대상: `src/components/operations/contacts/contacts-filter-bar.tsx` (전면 재작성).

### Props

```ts
interface Props {
  surveyId: string;
  initialClauses: FilterClause[];
  columnCandidates: ColumnCandidate[];
  resultCodeOptions: ContactResultCode[];
}
```

### Local state

```ts
const [clauses, setClauses] = useState<FilterClause[]>(initialClauses);
const [advancedOpen, setAdvancedOpen] = useState(initialClauses.length >= 2);
```

- 활성 조건 2개 이상이면 자동 펼침 — 사용자가 다중 조건 존재를 인지 못 하는 함정 방지
- 토글 상태는 로컬 state — URL 에 저장 안 함

### 레이아웃 (Collapsible)

```tsx
<form onSubmit={handleSearch} role="search" aria-label="조사 대상 필터">
  {/* 단순 검색바 (첫 절) */}
  <div className="flex items-center gap-2">
    <Select value={firstSource} onValueChange={...}>
      {columnCandidates.map(...)}
    </Select>
    <ValueWidget source={firstSource} value={firstValue} ... />
    <Button type="submit">검색</Button>
    <Button type="button" variant="outline" onClick={toggleAdvanced}>
      {advancedOpen ? '▲' : '▼'} 다중 조건
      {clauses.length >= 2 && <Badge>{clauses.length - 1}</Badge>}
    </Button>
    <Link href={`/admin/surveys/${surveyId}/operations/contacts/columns`} className="ml-auto">
      컬럼 설정
    </Link>
  </div>

  {/* 다중 패널 (두 번째 절부터) */}
  {advancedOpen && (
    <div className="mt-2 border-t border-dashed p-3">
      {clauses.slice(1).map((c, i) => (
        <ClauseRow
          key={i + 1}
          clause={c}
          columnCandidates={columnCandidates}
          resultCodeOptions={resultCodeOptions}
          onChange={(next) => updateClauseAt(i + 1, next)}
          onRemove={() => removeClauseAt(i + 1)}
        />
      ))}
      <Button type="button" variant="outline" className="border-dashed" onClick={addClause}>
        + 조건 추가
      </Button>
    </div>
  )}
</form>
```

### `ClauseRow` — 추가 행

```tsx
function ClauseRow({ clause, columnCandidates, resultCodeOptions, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Select value={clause.op ?? 'AND'} onValueChange={...} className="w-[70px] font-bold text-blue-700">
        <SelectItem value="AND">AND</SelectItem>
        <SelectItem value="OR">OR</SelectItem>
      </Select>
      <Select value={clause.condition.source} onValueChange={(s) => onChange(switchSource(clause, s))}>
        {columnCandidates.map((c) => (
          <SelectItem key={c.source} value={c.source}>
            {c.label}
            {c.source.startsWith('pii.') && <span>(정확 일치)</span>}
          </SelectItem>
        ))}
      </Select>
      <ValueWidget ... />
      <Button type="button" variant="ghost" size="sm" onClick={onRemove}>×</Button>
    </div>
  );
}
```

### `ValueWidget` — source 따라 동적

```tsx
function ValueWidget({ source, value, onChange, resultCodeOptions }) {
  if (source === 'system.contact_result') {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[260px]"><SelectValue placeholder="결과코드 선택" /></SelectTrigger>
        <SelectContent>
          {resultCodeOptions.map((rc) => (
            <SelectItem key={rc.code} value={rc.code}>{rc.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (source === 'system.web') {
    return (
      <Select value={value || 'true'} onValueChange={onChange}>
        <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="true">응답 완료</SelectItem>
          <SelectItem value="false">미응답</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholderFor(source)}
      className="w-[260px]"
    />
  );
}
```

### `placeholderFor`

```ts
function placeholderFor(source: string): string {
  if (source === 'system.resid') return '예: 1-30, 45';
  if (source.startsWith('pii.')) return '정확한 값 입력 (부분 검색 불가)';
  return '검색어';
}
```

### 동작

- **`handleSearch`** (form submit): 빈 value 조건 silent drop → URL `col[]`/`q[]`/`op[]` 갱신 + `page` 삭제
- **`addClause`**: 빈 새 조건 추가 (`source` = 첫 후보, `value` = '', `op` = 'AND')
- **`switchSource`**: source 변경 시 mode 자동 결정 + value 비움
- **`removeClauseAt`**: 그 행만 제거. 첫 절 (인덱스 0) 은 항상 존재 (빈 값으로 남음 — 데이터 유지)
- **빈 input 으로 검색** = 그 절 drop, 첫 절도 비면 전체 조회

### URL ↔ state 동기화

`useEffect([JSON.stringify(initialClauses)])` 로 props 변경 시 (브라우저 뒤로/앞으로) 로컬 state 갱신. 진척 보고 패턴과 동일하지만 깊은 비교 필요 (배열 + 객체).

### 접근성

- `<form role="search" aria-label="조사 대상 필터">`
- 각 행 `aria-label="조건 N"` (N=1, 2, ...)
- Select / Input 모두 `<label htmlFor>` (sr-only)
- pii 옵션 `(정확 일치)` 마커는 텍스트로 (시각 + 스크린리더 모두 전달)

## §4: 변경 범위 + 테스트 + Known Limitations

### 브랜치 전략

- 새 브랜치 `feat/contacts-filter-bar`
- `feat/report-filter-bar` 머지 후 main 에서 분기 권장 — `range-list.ts` 공유 유틸 분리에 의존
- 진척 보고 PR 머지 안 됐다면 `feat/report-filter-bar` 분기에서 새 브랜치 가능

### 변경 파일

| 변경 | 파일 | 책임 |
|---|---|---|
| 신규 | `src/lib/operations/range-list.ts` | `NumRange` 타입 + `parseIdListInput` pure utility |
| 신규 | `src/lib/operations/contacts-filters.server.ts` | `FilterCondition`/`Clause`/`CombineOp` 타입, `parseClausesFromUrl`, pii blindIndex 계산 |
| 신규 | `tests/unit/contacts-filters.test.ts` | 단위 테스트 |
| 수정 | `src/lib/operations/progress-filters.server.ts` | `parseIdListInput` 인라인 제거 → `range-list.ts` import |
| 수정 | `src/lib/operations/contacts.server.ts` | `qfield`/`q`/`resultCode` 분기 제거 → `buildContactsFilterSql` 호출, `listContactsForSurvey` 시그니처 변경 |
| 수정 | `src/components/operations/contacts/contacts-filter-bar.tsx` | 전면 재작성 — Collapsible + 다중 조건 패널 |
| 수정 | `src/app/admin/surveys/[id]/operations/contacts/page.tsx` | `sp.col[]`/`sp.q[]`/`sp.op[]` 파싱, `getContactResultCodes` 로드 |

DB 스키마 변경 없음 / 마이그레이션 없음.

### 테스트 전략

**단위 테스트** — `tests/unit/contacts-filters.test.ts`:
- `parseClausesFromUrl(cols, qs, ops, candidates, resultCodes)`:
  - 길이 불일치 → 짧은 쪽까지 silent truncate
  - `col[i]` 화이트리스트 위반 → 그 절 drop, 나머지 유지
  - 모든 source 종류(`system.resid`/`contact_result`/`web`/`attrs.*`/`pii.*`) 정확한 mode 결정
  - `system.contact_result` 값이 resultCodes 에 없으면 drop
  - `system.web` 값이 `'true'`/`'false'` 아니면 drop
  - `pii.*` 정규화 실패 → drop
  - 빈 value → drop
  - 첫 절 `op` 는 강제 `null`
  - `op` 가 `AND`/`OR` 외 값이면 `AND` 폴백
- `parseIdListInput` 기존 25 케이스는 `range-list.test.ts` 로 이동

서버 SQL 빌더 직접 테스트 안 함 (Drizzle `sql` 출력 inspecting brittle). 진척 보고와 동일 정책.

UI 컴포넌트는 단위 테스트 X — 수동 dogfooding.

### Known Limitations

1. **그룹 표현 불가** — `(A OR B) AND (C OR D)` 같은 자유 결합 불가. 좌→우 평가만. 운영 시나리오 빈도 5% 미만 추정, 별도 슬라이스에서 확장 가능
2. **pii 부분일치 미지원** — blindIndex 정확 일치만. 진척 보고와 동일 제약. 후속에서 trigram blind index 검토
3. **`system.email_count` / `system.contact_owner` 검색 미지원** — placeholder, 후속 슬라이스
4. **`system.contact_result` 결과코드 enum** — `getContactResultCodes(surveyId)` 가 설문별 커스텀 코드 반환. 운영 중 코드 추가/삭제되면 기존 URL 무효 가능 (해당 절 silent drop)
5. **북마크된 `?qfield=&q=&resultCode=` URL 깨짐** — 마이그레이션 없음
6. **`contact_pii` 복합 인덱스 누락** — 진척 보고 spec §4-9 와 동일, 후속에서 같이 해소
7. **빈 다중 조건 패널 펼친 상태** — 첫 절만 활성, 진척 보고와 동일 동작
8. **`switchSource` 시 value 초기화** — 사용자가 컬럼 바꾸면 이전 값 손실. mode 가 변하므로 의도된 단순화

### 마이그레이션 / 데이터 변경

- DB 스키마 변경 없음
- 마이그레이션 파일 없음
- 기존 URL deprecate (운영 콘솔 사용자 영향 좁음)
