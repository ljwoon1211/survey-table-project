# 단체 메일 수신자 필터를 조사대상목록 필터와 통합

작성일: 2026-05-29
브랜치: `feat/mail-recipient-filter-unify`

## 배경

단체 메일 발송 마법사의 "수신자 필터"는 검색어 한 줄(`q`/`qfield`) + "미응답자만" 체크박스만 지원한다.
반면 조사대상목록(컨택리스트)은 컬럼 선택 + AND/OR 다중 절 조합이 가능한 강력한 필터를 이미 갖추고 있다.
두 필터 모두 `contact_targets` 기반이고 URL searchParams 기반으로 동작하며,
`FILTER_SOURCE`·PII blind index·부정 결과코드 판별 로직을 이미 공유하고 있다.

목표: **조사대상목록 필터 UI/로직을 통째로 재사용**해 단체 메일 수신자 필터를 동일하게 만든다.
단, 메일 발송에 필요한 자동 제외 정책과 메일 전용 동선은 그대로 보존한다.

## 핵심 결정 (사용자 확정)

1. **통합 방향**: 필터 UI/로직 통째 재사용 (메일 필터 섹션을 다중 절 필터로 교체).
2. **"미응답자만"**: 응답여부를 컬럼으로 흡수하지 않고 **별도 체크박스로 유지**.
3. **"미오픈자 재발송" 동선**: `unopenedFromCampaignId` 등 메일 전용 진입 파라미터 **그대로 유지**.

## 아키텍처 개요

조사대상목록의 다중 절 필터(`ContactsFilterBar` + `parseClausesFromUrl` + `buildContactsFilterSql`)를
공유 자산으로 승격하고, 메일 마법사가 그것을 그대로 소비한다.
메일 전용 정책(자동 제외 4종 + "미응답자만" + 미오픈 동선)은 필터 결과 SQL 위에 `AND`로 결합한다.

```
[조사대상목록 페이지]                    [메일 마법사 페이지]
        │                                      │
        ├── ContactsFilterBar ◄──────공유──────┤  (+ "미응답자만" 체크박스 별도 유지)
        ├── parseClausesFromUrl ◄────공유───────┤
        ├── buildColumnCandidates ◄──공유(신규추출)┤
        │                                      │
        ▼                                      ▼
  listContactsForSurvey              buildCandidateWhere
   (자동 제외 없음)                    = buildContactsFilterSql(clauses)
        │                              AND [unsubscribed_at IS NULL]
        │                              AND [email PII 존재]
        ▼                              AND [부정코드 제외]
  buildContactsFilterSql ◄─공유(export)─ AND [unrespondedOnly?]
```

**메일 필터 데이터 흐름 변경:**
- 기존: `q`/`qfield`/`unresponded` flat 파라미터 → `buildCandidateWhere`의 자체 검색 분기
- 신규: `col[]`/`q[]`/`op[]` (컨택과 동일) → `parseClausesFromUrl` → `FilterClause[]`
  → `buildContactsFilterSql` + 자동 제외. `unresponded`만 별도 파라미터로 잔류.

**무변경:** 미리보기·선택 테이블, 전체선택/preflight/발송 로직, 자동 제외 정책,
미오픈 재발송 진입 동선. 필터 입력부와 후보 WHERE 빌더만 교체한다.

## 서버 변경

### 2-1. `buildContactsFilterSql` 공유화
현재 `contacts.server.ts`에 비-export. `buildClauseSql` + `buildContactsFilterSql` 두 함수를 **export**
(`latestResultCodeExpr` 등 subquery 표현식이 얽혀 있어 별도 파일 추출보다 최소 변경 우선 — YAGNI).

### 2-2. 컬럼 후보 생성 헬퍼 추출
`contacts/page.tsx`의 `columnCandidates` 생성 블록을 헬퍼로 추출:
```typescript
export function buildColumnCandidates(scheme: ContactColumnScheme | null): ColumnCandidateWithPii[]
```
두 페이지(contacts, mail/new)가 동일 호출. 메일 마법사도 `getContactColumnScheme` +
`getContactResultCodes`를 로드한다.

### 2-3. `CampaignFilterSnapshot` 확장 (하위호환 유지)
```typescript
interface CampaignFilterSnapshot {
  // 신규 — 다중 절 필터 (컨택과 동일 직렬화, blindIndex 미포함 raw)
  clauses?: { source: string; value: string; op: 'AND' | 'OR' | null }[];
  unrespondedOnly?: boolean;          // 유지 (별도 체크박스)
  unopenedFromCampaignId?: string;    // 유지 (미오픈 동선)
  unopenedAfterDays?: number;         // 유지
  // legacy — 기존 저장 캠페인 읽기 호환용 (신규 생성엔 미사용)
  q?: string; qfield?: 'all' | 'resid' | 'email' | 'group' | 'biz';
  resultCodes?: string[]; groupValues?: string[];
}
```
`clauses`는 raw 직렬화만 저장. PII blindIndex는 매 요청 시 `parseClausesFromUrl`이 재계산.

### 2-4. `buildCandidateWhere` 재작성
이미 파싱된 `clauses: FilterClause[]` + `unrespondedOnly: boolean`을 받도록 시그니처 변경
(PII 비동기 계산을 page에서 끝내고 넘기는 게 일관적):
```typescript
function buildCandidateWhere(surveyId, clauses, unrespondedOnly, negativeCodes): SQL {
  const parts = [
    eq(surveyId), isNull(unsubscribedAt), HAS_EMAIL_PII,
    buildNotExcludedByNegativeCode(negativeCodes),
    buildContactsFilterSql(clauses),     // ← 컨택 필터 결과
  ];
  if (unrespondedOnly) parts.push(isNull(respondedAt));
  return and(...parts)!;
}
```
기존 q/qfield/groupValues/resultCodes 검색 분기 **제거** — clauses가 흡수.
`buildCandidateWhere`가 더 이상 비동기 PII 조회를 하지 않으므로 동기 함수로 단순화 가능.

### 2-5. 영향받는 함수 (시그니처 통일)
`previewCampaignCandidates`, `countCampaignCandidates`, `fetchCandidateIdsAction`(server action)이
`filter` 대신 `{ clauses, unrespondedOnly }`를 받도록 조정.
`previewCampaignPreflightAction`/`preflightRecipients`는 selectedContactIds 기반이라 **무변경**.

## UI 변경

### 3-1. `ContactsFilterBar` 일반화 (소폭)
"컬럼 설정" 링크가 contacts 전용으로 하드코딩됨 → optional prop으로:
```typescript
interface Props {
  ...
  columnsSettingsHref?: string;  // 없으면 "컬럼 설정" 버튼 숨김
  ariaLabel?: string;            // 기본 "조사 대상 필터" → 메일은 "수신자 필터"
}
```
- contacts 페이지: `columnsSettingsHref` 전달 (기존 동작 유지)
- 메일 마법사: 미전달 → 버튼 미표시

나머지(검색바·다중 절 패널·URL `col[]`/`q[]`/`op[]` 직렬화)는 그대로 재사용.
`useSearchParamsMutator`가 col/q/op + page만 건드리고 `templateId`/`unresponded`는 보존하므로
메일 마법사의 다른 파라미터와 안전하게 공존.

### 3-2. `CampaignWizard` "수신자 필터" Card 교체
```
┌─ 수신자 필터 ─────────────────────────────┐
│ [ContactsFilterBar (컬럼선택+검색+▼필터)]   │  ← 공유 컴포넌트
│ ☐ 미응답자만                               │  ← 별도 유지, 토글 시 ?unresponded 갱신
│ ⓘ 수신거부·부정 결과코드·이메일 누락 자동제외  │  ← 안내문 유지
└──────────────────────────────────────────┘
```
- `qInput`/`applyFilter` 상태·핸들러 제거 (ContactsFilterBar가 URL 직접 갱신)
- "미응답자만" 체크박스는 토글 시 즉시 `?unresponded=1` push (단일 토글로 단순화)
- `buildFilterSnapshot`은 현재 URL의 col/q/op를 raw `clauses`로 담도록 조정

### 3-3. 마법사 페이지(`mail/campaigns/new/page.tsx`) 수정
```typescript
const [scheme, resultCodes] = await Promise.all([
  getContactColumnScheme(surveyId), getContactResultCodes(surveyId),
]);
const columnCandidates = buildColumnCandidates(scheme);
const clauses = parseClausesFromUrl(sp.col, sp.q, sp.op, columnCandidates, resultCodes);
const unrespondedOnly = sp.unresponded === '1';

const candidates = await previewCampaignCandidates({
  surveyId, clauses, unrespondedOnly, page, pageSize,
});
```
- `searchParams` 타입에 `col`/`q`/`op` (string|string[]) 추가, 기존 `q`(단일) 의미 변경
- `CampaignWizard`에 `columnCandidates`, `resultCodeOptions`, `initialClauses`, `unrespondedOnly` 전달

### 3-4. 선택 상태 보존
필터 변경 시 URL이 바뀌고 서버 컴포넌트가 refetch되지만 `selectedIds`는 클라이언트 상태라 유지됨
(현재와 동일). 다른 필터로 골라 누적 선택하는 기존 UX 그대로.

## 엣지케이스 · 하위호환

### 4-1. legacy `filterSnapshot` 소비처 (구현 전 확정 필요)
기존 캠페인은 `{ q, qfield, unrespondedOnly, ... }` legacy 구조로 저장됨.
구현 착수 시 `getCampaignDetail`의 `filterSnapshot` 소비처를 grep으로 확정:
- 재현/미리보기 미사용 (발송은 selectedContactIds 기반): legacy 필드는 표시용으로만 남기고 무변경 안전
- 상세에서 필터를 사람이 읽는 문자열로 렌더: `clauses`도 함께 렌더하도록 보강

### 4-2. PII 검색 모드 차이
컨택 필터의 `pii.email`/`pii.biz`는 정확 매칭(blind index)만 가능.
기존 메일 `qfield=all`의 PII 부분일치 습관은 안 됨 — 단 컨택 목록과 동일 제약이므로 일관성 측면 수용.
placeholder가 "정확한 값 입력"으로 안내됨.

### 4-3. 빈 필터 = 전체
`buildContactsFilterSql([])` → `TRUE`. 자동 제외 4종만 남아 "발송 가능한 전체 컨택"이 후보.
현재 기본 동작과 동일.

### 4-4. `system.web`(응답여부) vs "미응답자만" 중복
컨택 필터의 `system.web` 컬럼이 곧 `responded_at IS NOT NULL/NULL`. "미응답자만" 체크박스와 의미 겹침.
둘 다 `AND`라 모순 없음. 이번엔 둘 다 두되 체크박스는 "빠른 토글" 편의로 포지셔닝.
(추후 통합 여지 메모.)

### 4-5. 미오픈 동선(`unopenedFromCampaignId`)
현재 `buildCandidateWhere`에서 읽지 않음(스냅샷에만 저장, 실제 필터링 미구현 상태).
"그대로 유지" = 현 동작 보존. 이번 작업에서 새로 구현하지 않음.
autoSelectAll 진입 동선만 깨지지 않게 확인.

## 테스트 (TDD)

`tests/` 디렉토리에 integration 패턴으로 (vitest는 `tests/`만 include):
- `buildCandidateWhere`: clauses + 자동 제외 결합 WHERE 검증 / 빈 clauses=전체 /
  unrespondedOnly AND / 부정코드 제외 유지
- `parseClausesFromUrl` 기존 커버리지 확인 후 부족분만 보강
- preflight/발송 경로 무변경 → 회귀 테스트 통과 확인
- 검증 명령: `tsc` + `vitest` + `build` (ESLint 인프라 깨짐 — tsc/vitest/build로 대체 검증)

## 미확정 항목 (구현 착수 시 grep 확정)
- 4-1: legacy `filterSnapshot` 소비처
- 4-5: 미오픈 동선의 실제 필터 동작 여부
