# 단체 메일 수신자 필터 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단체 메일 발송 마법사의 수신자 필터를 조사대상목록의 다중 절(AND/OR) 필터 컴포넌트·로직으로 교체하되, 메일 발송 자동 제외 정책과 메일 전용 동선은 보존한다.

**Architecture:** 조사대상목록의 `ContactsFilterBar` UI와 `parseClausesFromUrl`→`buildContactsFilterSql` 변환기를 공유 자산으로 승격한다. 메일 후보 WHERE 빌더(`buildCandidateWhere`)는 `FilterClause[]`를 받아 자동 제외 4종(수신거부·이메일누락·부정코드) + "미응답자만" 토글과 `AND`로 결합한다. 두 화면 모두 이미 URL searchParams 기반이라 직렬화 방식(`col[]`/`q[]`/`op[]`)을 그대로 공유한다.

**Tech Stack:** Next.js 16 App Router (RSC + server actions), Drizzle ORM, Zod, Zustand 미사용(URL state), Vitest.

---

## File Structure

**서버/공유 (lib):**
- `src/db/schema/schema-types.ts` — `CampaignFilterSnapshot`에 `clauses` 필드 추가 (Task 1)
- `src/lib/operations/contacts.server.ts` — `buildClauseSql`/`buildContactsFilterSql` export + `buildColumnCandidates` 헬퍼 추출 (Task 2)
- `src/lib/operations/campaigns.server.ts` — `buildCandidateWhere`/`preview`/`count` 시그니처를 `clauses` 기반으로 재작성 (Task 5, 테스트 포함)
- `src/actions/campaign-actions.ts` — `filterSnapshotSchema` clauses 추가 + `fetchCandidateIdsAction` parse (Task 6)

**UI (components/app):**
- `src/components/operations/contacts/contacts-filter-bar.tsx` — optional props 2개 추가 (Task 4)
- `src/app/admin/surveys/[id]/operations/contacts/page.tsx` — `buildColumnCandidates` 사용 + `columnsSettingsHref` 전달 (Task 3)
- `src/components/operations/mail-campaign/campaign-wizard.tsx` — 필터 Card 교체 (Task 7)
- `src/app/admin/surveys/[id]/operations/mail/campaigns/new/page.tsx` — 스킴 로드 + parse + 새 호출 (Task 8)
- `src/app/admin/surveys/[id]/operations/mail/campaigns/[cid]/page.tsx` — 재발송 동선 clauses 직렬화 (Task 9)

**테스트:**
- `tests/integration/campaign-candidate-filter.test.ts` — 신규 (Task 5)

**실행 순서:** 1 → 2 → 4 → 5 → 6 → 3 → 7 → 8 → 9 → 10(검증). Task 3/7/8/9는 앞선 타입·시그니처에 의존.

---

### Task 1: `CampaignFilterSnapshot`에 `clauses` 필드 추가

**Files:**
- Modify: `src/db/schema/schema-types.ts:457-471`

- [ ] **Step 1: 타입 확장**

`CampaignFilterSnapshot` 인터페이스를 다음으로 교체 (기존 legacy 필드는 하위호환 위해 유지):

```typescript
export interface CampaignFilterSnapshot {
  /** 다중 절 필터 (조사대상목록과 동일 직렬화). blindIndex 미포함 raw — 요청 시 재계산. */
  clauses?: { source: string; value: string; op: 'AND' | 'OR' | null }[];
  /** "미응답자만" 토글 (별도 체크박스로 유지). */
  unrespondedOnly?: boolean;
  /** "발송 후 N일 경과 단체 메일의 미오픈자 재발송" 동선 (?from=<cid>&unopenedAfterDays=7) */
  unopenedFromCampaignId?: string;
  unopenedAfterDays?: number;
  /** @deprecated legacy 단순 검색 — 신규 생성엔 미사용, 기존 저장 캠페인 읽기 호환용. */
  qfield?: 'all' | 'resid' | 'email' | 'group' | 'biz';
  /** @deprecated legacy */
  q?: string;
  /** @deprecated legacy */
  resultCodes?: string[];
  /** @deprecated legacy */
  groupValues?: string[];
}
```

> 기존 필드명/주석은 현재 파일 내용을 확인해 정확히 보존하되, 위 `clauses`/`unrespondedOnly`가 최상단에 존재하면 된다.

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: PASS (타입 추가만이므로 기존 코드 영향 없음)

- [ ] **Step 3: Commit**

```bash
git add src/db/schema/schema-types.ts
git commit -m "feat: CampaignFilterSnapshot 에 다중 절 clauses 필드 추가"
```

---

### Task 2: `contacts.server.ts` — SQL 빌더 export + 컬럼 후보 헬퍼 추출

**Files:**
- Modify: `src/lib/operations/contacts.server.ts:87` (buildClauseSql), `:139` (buildContactsFilterSql), import 영역

- [ ] **Step 1: 두 SQL 빌더 함수를 export**

`function buildClauseSql(` → `export function buildClauseSql(`
`function buildContactsFilterSql(` → `export function buildContactsFilterSql(`

(본문 변경 없음 — 키워드 `export`만 추가)

- [ ] **Step 2: `buildColumnCandidates` 헬퍼 추가**

파일 상단 import에 `ColumnCandidateWithPii` 추가 확인 (이미 `FILTER_SOURCE` import 중):

```typescript
import { FILTER_SOURCE, escapeLikePattern, type ColumnCandidateWithPii } from './filter-shared';
```

`getContactColumnScheme` 정의 아래(파일 하단부)에 추가:

```typescript
/**
 * 필터 컬럼 후보 생성 — 조사대상목록·단체 메일 마법사 공유.
 * system.resid / system.contact_result / system.web + attrs.* + pii.* 만 후보.
 * placeholder 전용 컬럼(system.email_count / system.contact_owner)은 제외.
 */
export function buildColumnCandidates(
  scheme: ContactColumnScheme | null,
): ColumnCandidateWithPii[] {
  return (scheme?.columns ?? [])
    .filter(
      (c) =>
        c.source === FILTER_SOURCE.RESID ||
        c.source === FILTER_SOURCE.CONTACT_RESULT ||
        c.source === FILTER_SOURCE.WEB ||
        c.source.startsWith(FILTER_SOURCE.ATTRS_PREFIX) ||
        c.source.startsWith(FILTER_SOURCE.PII_PREFIX),
    )
    .map((c) => ({ source: c.source, label: c.label, piiType: c.piiType }));
}
```

> `ContactColumnScheme`는 이미 이 파일에서 import 중 (`import type { ContactColumnScheme }`). `c.piiType` 접근은 기존 `contacts/page.tsx:75`와 동일하므로 타입 OK.

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/operations/contacts.server.ts
git commit -m "feat: 컨택 필터 SQL 빌더 export + buildColumnCandidates 헬퍼 추출"
```

---

### Task 4: `ContactsFilterBar` optional props 추가

**Files:**
- Modify: `src/components/operations/contacts/contacts-filter-bar.tsx:31-36` (Props), `:129-135` (form aria-label), `:193-197` (컬럼 설정 버튼)

- [ ] **Step 1: Props 인터페이스 확장**

```typescript
interface Props {
  surveyId: string;
  initialClauses: ClientFilterClause[];
  columnCandidates: ColumnCandidate[];
  resultCodeOptions: ContactResultCode[];
  /** 있을 때만 "컬럼 설정" 버튼 노출 (조사대상목록 전용). 메일 마법사는 미전달. */
  columnsSettingsHref?: string;
  /** form aria-label. 기본 "조사 대상 필터". */
  ariaLabel?: string;
}
```

- [ ] **Step 2: 함수 시그니처 구조분해에 추가**

```typescript
export function ContactsFilterBar({
  surveyId,
  initialClauses,
  columnCandidates,
  resultCodeOptions,
  columnsSettingsHref,
  ariaLabel = '조사 대상 필터',
}: Props) {
```

- [ ] **Step 3: form aria-label을 prop으로**

`aria-label="조사 대상 필터"` → `aria-label={ariaLabel}` (line 134)

- [ ] **Step 4: "컬럼 설정" 버튼 조건부 렌더**

기존 (line 193-197):
```tsx
        <Button asChild variant="outline" className="ml-auto h-10">
          <Link href={`/admin/surveys/${surveyId}/operations/contacts/columns`}>
            컬럼 설정
          </Link>
        </Button>
```
교체:
```tsx
        {columnsSettingsHref && (
          <Button asChild variant="outline" className="ml-auto h-10">
            <Link href={columnsSettingsHref}>컬럼 설정</Link>
          </Button>
        )}
```

- [ ] **Step 5: 타입 체크**

Run: `npx tsc --noEmit`
Expected: `contacts/page.tsx`에서 `columnsSettingsHref` 미전달로 인한 에러는 없음(optional). PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/operations/contacts/contacts-filter-bar.tsx
git commit -m "feat: ContactsFilterBar 에 columnsSettingsHref/ariaLabel optional prop 추가"
```

---

### Task 5: `campaigns.server.ts` — 후보 WHERE 빌더를 clauses 기반으로 재작성 (TDD)

**Files:**
- Test: `tests/integration/campaign-candidate-filter.test.ts` (신규)
- Modify: `src/lib/operations/campaigns.server.ts:368-432` (buildCandidateWhere), `:466-535` (preview/count), import 영역

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/integration/campaign-candidate-filter.test.ts`:

```typescript
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { extractRawSql } from './_helpers/result-code-mock';
import type { FilterClause } from '@/lib/operations/contacts-filters.server';

// countCampaignCandidates 는 getResultCodeStatuses + db.select(count).where(...) 만 사용.
// where 의 raw SQL 을 extractRawSql 로 평탄화해 자동 제외/필터 결합을 검증한다.
// (preflight-exclusion.test.ts 패턴 — db / result-code-statuses mock)

interface FakeState {
  negativeCodes: string[];
  lastWhereRaw: string;
}
const state: FakeState = { negativeCodes: [], lastWhereRaw: '' };

function buildSelectChain() {
  const chain = {
    from() {
      return chain;
    },
    where(whereExpr: unknown) {
      state.lastWhereRaw = extractRawSql(whereExpr);
      return {
        then(resolve: (v: unknown) => unknown) {
          return Promise.resolve([{ total: 0 }]).then(resolve);
        },
      };
    },
  };
  return chain;
}

vi.mock('@/db', () => ({
  db: { select: vi.fn(() => buildSelectChain()) },
}));

vi.mock('@/lib/operations/result-code-statuses.server', async () => {
  const { mockBuildNegativeCodeExists } = await import('./_helpers/result-code-mock');
  return {
    getResultCodeStatuses: vi.fn(async () => ({
      positive: [] as string[],
      negative: state.negativeCodes,
    })),
    buildNegativeCodeExists: mockBuildNegativeCodeExists,
  };
});

import { countCampaignCandidates } from '@/lib/operations/campaigns.server';

const SURVEY_ID = '00000000-0000-4000-8000-000000000040';

describe('countCampaignCandidates — 자동 제외 + clauses 결합', () => {
  beforeEach(() => {
    state.negativeCodes = ['수신거부'];
    state.lastWhereRaw = '';
  });

  it('빈 clauses 여도 자동 제외 3종(email PII / negative code)이 WHERE 에 포함된다', async () => {
    await countCampaignCandidates({ surveyId: SURVEY_ID, clauses: [], unrespondedOnly: false });
    expect(state.lastWhereRaw).toContain('contact_pii'); // HAS_EMAIL_PII
    expect(state.lastWhereRaw).toContain('contact_attempts'); // negative code EXISTS
    expect(state.lastWhereRaw).toContain('result_code');
  });

  it('attrs 텍스트 절이 WHERE 에 결합된다', async () => {
    const clauses: FilterClause[] = [
      { op: null, condition: { source: 'attrs.지역', mode: 'text', value: '서울' } },
    ];
    await countCampaignCandidates({ surveyId: SURVEY_ID, clauses, unrespondedOnly: false });
    expect(state.lastWhereRaw).toContain('attrs');
    expect(state.lastWhereRaw).toContain('서울');
    // 자동 제외도 여전히 유지
    expect(state.lastWhereRaw).toContain('contact_pii');
  });

  it('system.web boolean 절(응답완료=responded_at IS NOT NULL)이 결합된다', async () => {
    const clauses: FilterClause[] = [
      { op: null, condition: { source: 'system.web', mode: 'boolean', value: 'true' } },
    ];
    await countCampaignCandidates({ surveyId: SURVEY_ID, clauses, unrespondedOnly: false });
    expect(state.lastWhereRaw).toContain('responded_at');
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx vitest run tests/integration/campaign-candidate-filter.test.ts`
Expected: FAIL — `countCampaignCandidates`가 아직 `filter` 시그니처라 `clauses` 인자 타입 에러 또는 런타임 실패.

- [ ] **Step 3: import 추가 + `buildCandidateWhere` 재작성**

`campaigns.server.ts` 상단 import에 추가:
```typescript
import { buildContactsFilterSql } from '@/lib/operations/contacts.server';
import type { FilterClause } from '@/lib/operations/contacts-filters.server';
```

기존 `buildCandidateWhere`(line 368-432)를 다음으로 전체 교체:
```typescript
function buildCandidateWhere(
  surveyId: string,
  clauses: FilterClause[],
  unrespondedOnly: boolean,
  negativeCodes: string[],
): SQL {
  const parts: SQL[] = [
    eq(contactTargets.surveyId, surveyId),
    isNull(contactTargets.unsubscribedAt),
    HAS_EMAIL_PII,
    buildNotExcludedByNegativeCode(negativeCodes),
    buildContactsFilterSql(clauses),
  ];

  if (unrespondedOnly) {
    parts.push(isNull(contactTargets.respondedAt));
  }

  return and(...parts)!;
}
```

> 이제 비동기 PII 조회(findContactIdsByBlindIndex 등)가 사라지므로 `buildCandidateWhere`는 동기 함수. `inArray`/`or`/`findContactIdsByBlindIndex`/`findContactIdsByPlainAcrossTypes`/`PiiFieldType` import가 이 함수에서만 쓰였다면 미사용 경고가 날 수 있다 — Step 5에서 정리.

- [ ] **Step 4: `previewCampaignCandidates` / `countCampaignCandidates` 시그니처 변경**

`previewCampaignCandidates`(line 466) args 타입·호출부:
```typescript
export async function previewCampaignCandidates(args: {
  surveyId: string;
  clauses: FilterClause[];
  unrespondedOnly: boolean;
  page?: number;
  pageSize?: number;
}): Promise<CampaignCandidatesResult> {
  const pageSize = args.pageSize ?? DEFAULT_PAGE_SIZE;
  const { negative: negativeCodes } = await getResultCodeStatuses(args.surveyId);
  const where = buildCandidateWhere(args.surveyId, args.clauses, args.unrespondedOnly, negativeCodes);
  // ... 이하 본문 동일 (count → rows → maskMap → return)
```

`countCampaignCandidates`(line 524):
```typescript
export async function countCampaignCandidates(args: {
  surveyId: string;
  clauses: FilterClause[];
  unrespondedOnly: boolean;
}): Promise<number> {
  const { negative: negativeCodes } = await getResultCodeStatuses(args.surveyId);
  const where = buildCandidateWhere(args.surveyId, args.clauses, args.unrespondedOnly, negativeCodes);
  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(contactTargets)
    .where(where);
  return countRow?.total ?? 0;
}
```

- [ ] **Step 5: 미사용 import 정리**

`buildCandidateWhere`에서 제거된 로직이 쓰던 import 중 파일 어디에서도 안 쓰이는 것 제거: `inArray`(다른 함수에서 쓰면 유지), `or`, `findContactIdsByBlindIndex`, `findContactIdsByPlainAcrossTypes`, `PiiFieldType`.
Run: `npx tsc --noEmit` 으로 미사용 여부 확인 후 제거. (`inArray`는 `preflightRecipients`·`createCampaignAction` 외 사용처 확인 — 이 파일 내 `preflightRecipients`가 `inArray` 사용하므로 유지.)

- [ ] **Step 6: 테스트 실행 → 통과 확인**

Run: `npx vitest run tests/integration/campaign-candidate-filter.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: 회귀 — preflight 테스트 통과 확인**

Run: `npx vitest run tests/integration/preflight-exclusion.test.ts`
Expected: PASS (preflightRecipients 무변경)

- [ ] **Step 8: Commit**

```bash
git add src/lib/operations/campaigns.server.ts tests/integration/campaign-candidate-filter.test.ts
git commit -m "feat: 단체 메일 후보 WHERE 빌더를 다중 절 clauses 기반으로 재작성"
```

---

### Task 6: `campaign-actions.ts` — 스키마 clauses 추가 + fetchCandidateIdsAction parse

**Files:**
- Modify: `src/actions/campaign-actions.ts:21-31` (schema), `:297-340` (fetchCandidateIdsAction)

- [ ] **Step 1: `filterSnapshotSchema`에 clauses 추가**

```typescript
const filterSnapshotSchema = z
  .object({
    clauses: z
      .array(
        z.object({
          source: z.string().max(200),
          value: z.string().max(500),
          op: z.enum(['AND', 'OR']).nullable(),
        }),
      )
      .max(20)
      .optional(),
    unrespondedOnly: z.boolean().optional(),
    unopenedFromCampaignId: z.string().uuid().optional(),
    unopenedAfterDays: z.number().int().min(0).max(365).optional(),
    // legacy (기존 저장 캠페인 읽기 호환)
    qfield: z.enum(['all', 'resid', 'email', 'group', 'biz']).optional(),
    q: z.string().optional(),
    resultCodes: z.array(z.string()).optional(),
    groupValues: z.array(z.string()).optional(),
  })
  .strict();
```

- [ ] **Step 2: `fetchCandidateIdsAction` 본문을 clauses parse 기반으로 변경**

`const { surveyId, filter } = parsed.data;` 아래 블록(line 311-331)을 교체:
```typescript
  const { surveyId, filter } = parsed.data;

  const { previewCampaignCandidates, countCampaignCandidates, getContactColumnScheme, getContactResultCodes, buildColumnCandidates } =
    await import('@/lib/operations/campaigns.server').then(async (m) => ({
      ...m,
      ...(await import('@/lib/operations/contacts.server')),
    }));
  const { parseClausesFromUrl } = await import('@/lib/operations/contacts-filters.server');

  const [scheme, resultCodes] = await Promise.all([
    getContactColumnScheme(surveyId),
    getContactResultCodes(surveyId),
  ]);
  const candidates = buildColumnCandidates(scheme);
  const rawClauses = filter.clauses ?? [];
  const clauses = parseClausesFromUrl(
    rawClauses.map((c) => c.source),
    rawClauses.map((c) => c.value),
    rawClauses.map((c) => c.op ?? ''),
    candidates,
    resultCodes,
  );
  const unrespondedOnly = filter.unrespondedOnly ?? false;

  const total = await countCampaignCandidates({ surveyId, clauses, unrespondedOnly });
  const MAX_IDS = 10_000;
  if (total > MAX_IDS) {
    return {
      ok: false,
      error: `필터에 해당하는 수신자가 ${total.toLocaleString('ko-KR')}명입니다. 한 단체 메일당 최대 ${MAX_IDS.toLocaleString('ko-KR')}명 — 필터를 좁혀주세요.`,
    };
  }

  const result = await previewCampaignCandidates({
    surveyId,
    clauses,
    unrespondedOnly,
    page: 1,
    pageSize: Math.max(1, total),
  });
  return {
    ok: true,
    data: { ids: result.rows.map((r) => r.id), total, truncated: false },
  };
```

> import 합치기가 지저분하면 두 개의 별도 `await import(...)`로 나눠도 됨. 핵심은 `campaigns.server`에서 preview/count, `contacts.server`에서 scheme/resultCodes/buildColumnCandidates, `contacts-filters.server`에서 parseClausesFromUrl을 가져오는 것.

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/actions/campaign-actions.ts
git commit -m "feat: fetchCandidateIdsAction 을 다중 절 clauses parse 기반으로 변경"
```

---

### Task 3: 조사대상목록 페이지를 공유 헬퍼·prop으로 정리

**Files:**
- Modify: `src/app/admin/surveys/[id]/operations/contacts/page.tsx:21` (import), `:66-75` (columnCandidates), `:134-143` (ContactsFilterBar 사용)

- [ ] **Step 1: `buildColumnCandidates` import 후 인라인 블록 교체**

import 추가:
```typescript
import {
  buildColumnCandidates,
  getContactColumnScheme,
  getContactResultCodes,
  listContactsForSurvey,
} from '@/lib/operations/contacts.server';
```

기존 `columnCandidates` 생성 블록(line 66-75)을 교체:
```typescript
  const columnCandidates = buildColumnCandidates(scheme);
```

> `FILTER_SOURCE`/`ColumnCandidateWithPii` import가 이제 page에서 안 쓰이면 제거(`FILTER_SOURCE`는 다른 곳에서 안 쓰임 — 제거). `type ColumnCandidateWithPii` import도 제거.

- [ ] **Step 2: ContactsFilterBar에 columnsSettingsHref 전달**

```tsx
          <ContactsFilterBar
            surveyId={surveyId}
            initialClauses={clauses.map((c) => ({
              op: c.op,
              source: c.condition.source,
              value: c.condition.value,
            }))}
            columnCandidates={columnCandidates}
            resultCodeOptions={resultCodes}
            columnsSettingsHref={`/admin/surveys/${surveyId}/operations/contacts/columns`}
          />
```

- [ ] **Step 3: 타입 체크 + 회귀 테스트**

Run: `npx tsc --noEmit && npx vitest run tests/unit/contacts-filters.test.ts`
Expected: PASS (조사대상목록 동작 동일 — 컬럼 설정 버튼 그대로 노출)

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/surveys/[id]/operations/contacts/page.tsx
git commit -m "refactor: 조사대상목록 페이지에 buildColumnCandidates·columnsSettingsHref 적용"
```

---

### Task 7: `CampaignWizard` 수신자 필터 Card 교체

**Files:**
- Modify: `src/components/operations/mail-campaign/campaign-wizard.tsx` — Props(36-47), 상태(74-78), import, 필터 Card(264-297), buildFilterSnapshot(485-500)

- [ ] **Step 1: import 추가**

```typescript
import { ContactsFilterBar } from '@/components/operations/contacts/contacts-filter-bar';
import type { ColumnCandidate } from '@/lib/operations/filter-shared';
import type { ContactResultCode } from '@/db/schema/schema-types';
```

기존 `Input` import가 제목 입력에서 여전히 쓰이므로 유지. `qInput` 관련 외 다른 import는 그대로.

- [ ] **Step 2: Props 확장**

```typescript
interface Props {
  surveyId: string;
  templates: MailTemplate[];
  candidates: {
    rows: CampaignCandidateRow[];
    total: number;
    page: number;
    pageSize: number;
  };
  currentFilter: CampaignFilterSnapshot;
  initialTemplateId: string | null;
  columnCandidates: ColumnCandidate[];
  resultCodeOptions: ContactResultCode[];
  initialClauses: { op: 'AND' | 'OR' | null; source: string; value: string }[];
}
```

함수 구조분해에 `columnCandidates, resultCodeOptions, initialClauses` 추가.

- [ ] **Step 3: `qInput` 상태 제거, unrespondedOnly 토글 핸들러로 교체**

`const [qInput, setQInput] = useState(...)` 제거.
`unrespondedOnly` state는 유지. `applyFilter` 함수 제거하고 토글 핸들러 추가:
```typescript
  function toggleUnresponded(checked: boolean) {
    setUnrespondedOnly(checked);
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    if (checked) next.set('unresponded', '1');
    else next.delete('unresponded');
    next.delete('page');
    router.push(`?${next.toString()}`);
  }
```

- [ ] **Step 4: 필터 Card(264-297) 본문 교체**

```tsx
      {/* ── 2. 필터 ── */}
      <Card className="space-y-4 p-6">
        <h2 className="text-base font-semibold text-slate-900">수신자 필터</h2>

        <ContactsFilterBar
          surveyId={surveyId}
          initialClauses={initialClauses}
          columnCandidates={columnCandidates}
          resultCodeOptions={resultCodeOptions}
          ariaLabel="수신자 필터"
        />

        <div className="flex items-center gap-2">
          <Checkbox
            id="unresponded"
            checked={unrespondedOnly}
            onCheckedChange={(v) => toggleUnresponded(v === true)}
          />
          <Label htmlFor="unresponded" className="cursor-pointer">
            미응답자만
          </Label>
        </div>

        <p className="text-xs text-slate-500">
          수신거부자(unsubscribed_at IS NOT NULL), 부정 결과코드(예: 수신거부) 마킹된 조사 대상,
          이메일 누락 조사 대상은 자동으로 제외됩니다.
        </p>
      </Card>
```

- [ ] **Step 5: `buildFilterSnapshot` 조정**

```typescript
function buildFilterSnapshot(current: CampaignFilterSnapshot): CampaignFilterSnapshot {
  const out: CampaignFilterSnapshot = {};
  if (current.clauses && current.clauses.length > 0) out.clauses = current.clauses;
  if (current.unrespondedOnly) out.unrespondedOnly = true;
  if (current.unopenedFromCampaignId) {
    out.unopenedFromCampaignId = current.unopenedFromCampaignId;
    out.unopenedAfterDays = current.unopenedAfterDays;
  }
  return out;
}
```

- [ ] **Step 6: 타입 체크**

Run: `npx tsc --noEmit`
Expected: `new/page.tsx`가 아직 새 props를 안 넘겨 에러 발생할 수 있음 — Task 8에서 해소. 단독으로는 wizard 내부 타입만 확인. wizard 파일 자체 에러가 없으면 진행.

- [ ] **Step 7: Commit**

```bash
git add src/components/operations/mail-campaign/campaign-wizard.tsx
git commit -m "feat: 단체 메일 마법사 수신자 필터를 ContactsFilterBar 로 교체"
```

---

### Task 8: 새 캠페인 페이지 — 스킴 로드 + parse + 새 호출

**Files:**
- Modify: `src/app/admin/surveys/[id]/operations/mail/campaigns/new/page.tsx`

- [ ] **Step 1: import 추가**

```typescript
import {
  buildColumnCandidates,
  getContactColumnScheme,
  getContactResultCodes,
} from '@/lib/operations/contacts.server';
import { parseClausesFromUrl } from '@/lib/operations/contacts-filters.server';
```

- [ ] **Step 2: searchParams 타입에 col/q/op 추가**

```typescript
  searchParams: Promise<{
    templateId?: string;
    col?: string | string[];
    q?: string | string[];
    op?: string | string[];
    unresponded?: string;
    page?: string;
  }>;
```

- [ ] **Step 3: 스킴·결과코드 로드 + clauses parse + 새 호출**

`const templates = await getMailTemplatesBySurvey(surveyId);` 와 빈 체크/redirect는 유지. redirect 이후(즉 templateId 확정 후)에 추가:

```typescript
  const [scheme, resultCodes] = await Promise.all([
    getContactColumnScheme(surveyId),
    getContactResultCodes(surveyId),
  ]);
  const columnCandidates = buildColumnCandidates(scheme);
  const clauses = parseClausesFromUrl(sp.col, sp.q, sp.op, columnCandidates, resultCodes);
  const unrespondedOnly = sp.unresponded === '1';

  const candidates = await previewCampaignCandidates({
    surveyId,
    clauses,
    unrespondedOnly,
    page: parsePage(sp.page),
    pageSize: PAGE_SIZE,
  });

  const rawClauses = clauses.map((c) => ({
    source: c.condition.source,
    value: c.condition.value,
    op: c.op,
  }));
  const currentFilter: CampaignFilterSnapshot = {
    clauses: rawClauses,
    unrespondedOnly,
  };
  const initialClauses = clauses.map((c) => ({
    op: c.op,
    source: c.condition.source,
    value: c.condition.value,
  }));
```

기존 `const filter: CampaignFilterSnapshot = { q: ..., qfield: 'all', unrespondedOnly: ... }` 블록 및 그것을 쓰던 `previewCampaignCandidates({ surveyId, filter, ... })` 호출 제거(위로 대체).

- [ ] **Step 4: `CampaignWizard`에 새 props 전달**

```tsx
      <CampaignWizard
        surveyId={surveyId}
        templates={templates}
        candidates={{
          rows: candidates.rows,
          total: candidates.total,
          page: candidates.page,
          pageSize: PAGE_SIZE,
        }}
        currentFilter={currentFilter}
        initialTemplateId={sp.templateId}
        columnCandidates={columnCandidates}
        resultCodeOptions={resultCodes}
        initialClauses={initialClauses}
      />
```

- [ ] **Step 5: 타입 체크**

Run: `npx tsc --noEmit`
Expected: PASS (Task 7 wizard props와 매칭)

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/surveys/[id]/operations/mail/campaigns/new/page.tsx"
git commit -m "feat: 새 단체 메일 페이지에서 다중 절 필터 parse 후 후보 조회"
```

---

### Task 9: 재발송 동선의 reuseFilter를 clauses 직렬화로 변경

**Files:**
- Modify: `src/app/admin/surveys/[id]/operations/mail/campaigns/[cid]/page.tsx:74-80`

- [ ] **Step 1: reuseFilter 빌드 교체**

기존(line 74-80):
```typescript
  // "이 단체 메일 미응답자 재발송" 동선 — 같은 필터에 미응답 강제 + 자동 전체 선택
  const reuseFilter = new URLSearchParams();
  if (campaign.filterSnapshot.q) reuseFilter.set('q', campaign.filterSnapshot.q);
  reuseFilter.set('unresponded', '1');
  reuseFilter.set('templateId', campaign.mailTemplateId ?? '');
  reuseFilter.set('autoSelectAll', '1');
```
교체:
```typescript
  // "이 단체 메일 미응답자 재발송" 동선 — 같은 다중 절 필터 재현 + 미응답 강제 + 자동 전체 선택.
  // legacy 스냅샷(clauses 없음)은 필터 없이 미응답+전체선택만 적용(best-effort).
  const reuseFilter = new URLSearchParams();
  for (const c of campaign.filterSnapshot.clauses ?? []) {
    reuseFilter.append('col', c.source);
    reuseFilter.append('q', c.value);
    reuseFilter.append('op', c.op ?? '');
  }
  reuseFilter.set('unresponded', '1');
  reuseFilter.set('templateId', campaign.mailTemplateId ?? '');
  reuseFilter.set('autoSelectAll', '1');
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/surveys/[id]/operations/mail/campaigns/[cid]/page.tsx"
git commit -m "feat: 재발송 동선 reuseFilter 를 다중 절 clauses 직렬화로 변경"
```

---

### Task 10: 전체 통합 검증

**Files:** 없음 (검증 only)

- [ ] **Step 1: 타입 체크 전체**

Run: `npx tsc --noEmit`
Expected: PASS (에러 0)

- [ ] **Step 2: 전체 테스트**

Run: `npx vitest run`
Expected: 기존 통과 + 신규 campaign-candidate-filter 3건 PASS. preflight/contacts-filters 회귀 없음.

- [ ] **Step 3: 빌드**

Run: `pnpm build`
Expected: 성공 (ESLint 인프라 깨짐 — build 단계 lint 통과 여부 무관, type/컴파일 성공이 기준)

> ESLint(`pnpm lint`)는 Next 16 + eslint 8 미스매치로 실패하는 환경이므로 검증에서 제외. tsc + vitest + build로 대체.

- [ ] **Step 4: 수동 확인 (선택)**

`pnpm dev` 후 `/admin/surveys/<id>/operations/mail/campaigns/new`:
- 컬럼 선택 + 검색 + ▼필터 다중 절 동작
- "컬럼 설정" 버튼 미노출
- "미응답자만" 토글 시 후보 수 변화
- 자동 제외 안내문 표시
- 필터 결과 전체 선택 → preflight → 발송 정상

조사대상목록 페이지 회귀:
- 기존 다중 절 필터 + "컬럼 설정" 버튼 정상 노출

---

## Self-Review

**스펙 커버리지:**
- 필터 UI/로직 통째 재사용 → Task 4(prop) + Task 7(교체) + Task 8(parse) ✓
- "미응답자만" 별도 체크박스 유지 → Task 7 toggleUnresponded ✓
- 미오픈 동선 그대로 유지 → Task 1(필드 보존) + Task 9(autoSelectAll 유지) ✓
- 자동 제외 4종 보존 → Task 5 buildCandidateWhere ✓ (테스트로 negative/email 검증)
- buildContactsFilterSql 공유 → Task 2 export ✓
- buildColumnCandidates 추출 → Task 2 + Task 3 적용 ✓
- legacy 스냅샷 호환 → Task 1(필드 유지) + Task 9(clauses ?? [] fallback) ✓
- 미확정 4-1(소비처): `[cid]/page.tsx`의 reuseFilter만 사용 확인됨 → Task 9에서 처리 ✓
- 미확정 4-5(미오픈 실제 동작): buildCandidateWhere에서 안 읽음 확인 → 무변경 유지 ✓

**Placeholder 스캔:** 모든 코드 step에 실제 코드 포함. "appropriate"/"TODO" 없음. ✓

**타입 일관성:** `clauses` raw 형태 `{source, value, op}`는 Task 1·6·7·8·9 전체 동일. `previewCampaignCandidates`/`countCampaignCandidates` 인자 `{surveyId, clauses, unrespondedOnly}`는 Task 5·6·8 동일. `initialClauses` 형태 `{op, source, value}`는 Task 7·8 동일(ContactsFilterBar의 ClientFilterClause와 일치). ✓
