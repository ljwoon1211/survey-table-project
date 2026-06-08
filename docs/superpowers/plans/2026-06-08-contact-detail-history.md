# 조사 대상 단건 편집 — 이메일 발송 현황 + 수정/편집 현황 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 조사 대상 단건 편집 화면의 placeholder 2개(이메일 발송 현황 · 수정/편집 현황)를 실제 데이터로 채우고, 관리자 응답 수정 audit 이력을 기록한다.

**Architecture:** 새 `response_edit_logs` 테이블에 관리자 수정 1회당 행 1개(누가/언제/바뀐 질문 스냅샷)를 기록한다. `saveAdminEdit` service가 편집 시 이전/이후 응답을 deep-diff 해 바뀐 질문만 버전 스냅샷 라벨과 함께 저장한다. 단건 편집 page(RSC)가 메일 수신 이력과 편집 이력을 prefetch 해 collapsible 카드 2개로 표시한다.

**Tech Stack:** Drizzle ORM(postgres-js), oRPC, Next.js App Router(RSC), Vitest. 마이그레이션은 수동 SQL + Supabase MCP `apply_migration`(프로젝트 확립 패턴 — `db:generate` 미사용).

---

## 파일 구조

신규:
- `supabase/migrations/0033_response_edit_logs.sql` — 테이블 + 인덱스 DDL
- `src/lib/operations/response-edit-diff.ts` — 순수 함수(diff + 라벨 매핑)
- `tests/operations/response-edit-diff.test.ts` — 순수 함수 단위 테스트
- `src/components/operations/contacts/contact-mail-history-card.tsx` — 이메일 발송 현황 카드
- `src/components/operations/contacts/contact-edit-history-card.tsx` — 수정/편집 현황 카드

수정:
- `src/db/schema/schema-types.ts` — `ResponseEditChange` 타입 추가
- `src/db/schema/surveys.ts` — `responseEditLogs` 테이블 정의 + 타입 export
- `src/features/survey-response/server/services/response-edit.service.ts` — editor 인자 + audit insert
- `src/features/survey-response/server/procedures/edit.ts` — `context.user` 전달
- `src/features/survey-response/server/procedures/edit.test.ts` — 호출 인자 단언 갱신
- `src/lib/operations/contacts.server.ts` — `getMailRecipientsForTarget` / `getResponseEditLogs` 조회 함수
- `src/components/operations/contacts/contact-detail-form.tsx` — placeholder 교체 + prop
- `src/app/admin/surveys/[id]/operations/contacts/[contactId]/page.tsx` — prefetch + prop 주입

---

## Task 1: 스키마 + 마이그레이션 (`response_edit_logs`)

**Files:**
- Modify: `src/db/schema/schema-types.ts`
- Modify: `src/db/schema/surveys.ts`
- Create: `supabase/migrations/0033_response_edit_logs.sql`

- [ ] **Step 1: `ResponseEditChange` 타입 추가**

`src/db/schema/schema-types.ts` 최상단 "버전 스냅샷 타입" 블록(`export interface SurveyVersionSnapshot {` 위)에 추가:

```typescript
/**
 * response_edit_logs.changed_questions 항목.
 * 바뀐 질문의 버전 스냅샷 기준 식별 정보. 기록 시점에 스냅샷 저장돼
 * 이후 빌더에서 질문 제목이 바뀌어도 당시 값이 보존된다.
 */
export interface ResponseEditChange {
  questionId: string;
  /** SPSS 변수명/문항코드. 스냅샷에 없으면 null. */
  code: string | null;
  /** 문항 제목. 스냅샷에 없으면 questionId 로 폴백. */
  title: string;
}
```

- [ ] **Step 2: `surveys.ts`에 테이블 정의 추가**

`src/db/schema/surveys.ts` 상단 schema-types import 블록(`import type { ... } from './schema-types'` 인근)에 `ResponseEditChange` 추가. 그리고 `surveyVersions` 테이블 정의(`});` 닫힌 251줄) 바로 뒤에 추가:

```typescript
// 관리자 응답 수정 audit 이력 (단건 편집 수정/편집 현황 카드용).
// survey_responses 1:N. 관리자 saveAdminEdit 1회당 행 1개.
export const responseEditLogs = pgTable('response_edit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  responseId: uuid('response_id')
    .notNull()
    .references(() => surveyResponses.id, { onDelete: 'cascade' }),
  surveyId: uuid('survey_id')
    .notNull()
    .references(() => surveys.id, { onDelete: 'cascade' }),
  // 수정한 관리자. authed 보장이나 방어적으로 nullable.
  editedBy: text('edited_by'),
  // 스냅샷 — 계정 삭제돼도 누구였는지 보존.
  editorEmail: text('editor_email'),
  changedQuestions: jsonb('changed_questions')
    .$type<ResponseEditChange[]>()
    .notNull()
    .default([]),
  changedCount: integer('changed_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

`surveys.ts` 하단 타입 export 영역(`export type Question = ...` 인근)에 추가:

```typescript
export type ResponseEditLog = typeof responseEditLogs.$inferSelect;
export type NewResponseEditLog = typeof responseEditLogs.$inferInsert;
```

- [ ] **Step 3: 마이그레이션 SQL 작성**

`supabase/migrations/0033_response_edit_logs.sql`:

```sql
-- 관리자 응답 수정 audit 이력 (조사 대상 단건 편집 수정/편집 현황 카드).
CREATE TABLE IF NOT EXISTS response_edit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  edited_by text,
  editor_email text,
  changed_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  changed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_response_edit_logs_response
  ON response_edit_logs (response_id, created_at DESC);
```

- [ ] **Step 4: tsc 통과 확인**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 0 (새 테이블/타입이 타입 체크 통과). `responseEditLogs`가 `schema/index.ts`의 `export * from './surveys'`로 자동 re-export 되는지 확인 — 안 되면 index.ts에 추가.

- [ ] **Step 5: 마이그레이션 적용**

원격(운영) DB: Supabase MCP `apply_migration` (name: `response_edit_logs`, query: Step 3 SQL).
로컬 test DB: `pnpm exec drizzle-kit push` (memory: 로컬은 push 패턴, db:migrate 는 journal 미동기로 skip).
적용 후 `response_edit_logs` 테이블 존재 확인.

- [ ] **Step 6: 커밋**

```bash
git add src/db/schema/schema-types.ts src/db/schema/surveys.ts supabase/migrations/0033_response_edit_logs.sql
git commit -m "feat: 응답 편집 audit 테이블 response_edit_logs 추가"
```

---

## Task 2: diff + 라벨 매핑 순수 함수 (TDD)

**Files:**
- Create: `src/lib/operations/response-edit-diff.ts`
- Test: `tests/operations/response-edit-diff.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/operations/response-edit-diff.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import {
  buildChangedQuestions,
  diffQuestionResponses,
} from '@/lib/operations/response-edit-diff';
import type { SurveyVersionSnapshot } from '@/db/schema/schema-types';

describe('diffQuestionResponses', () => {
  it('값이 바뀐 questionId 를 찾는다', () => {
    expect(diffQuestionResponses({ q1: 'a', q2: 'x' }, { q1: 'b', q2: 'x' })).toEqual(['q1']);
  });

  it('추가/삭제된 questionId 를 찾는다', () => {
    expect(
      diffQuestionResponses({ q1: 'a' }, { q1: 'a', q2: 'new' }).sort(),
    ).toEqual(['q2']);
    expect(diffQuestionResponses({ q1: 'a', q2: 'old' }, { q1: 'a' })).toEqual(['q2']);
  });

  it('키 순서만 다른 객체 값은 변경으로 보지 않는다', () => {
    expect(
      diffQuestionResponses({ q1: { a: 1, b: 2 } }, { q1: { b: 2, a: 1 } }),
    ).toEqual([]);
  });

  it('중첩 배열/객체의 실제 변경을 감지한다', () => {
    expect(
      diffQuestionResponses({ q1: { rows: [1, 2] } }, { q1: { rows: [1, 3] } }),
    ).toEqual(['q1']);
  });
});

describe('buildChangedQuestions', () => {
  const snapshot = {
    questions: [
      { id: 'q1', title: '성별', questionCode: 'Q1' },
      { id: 'q2', title: '나이' },
    ],
  } as unknown as SurveyVersionSnapshot;

  it('스냅샷에서 code/title 을 매핑한다', () => {
    expect(buildChangedQuestions(['q1'], snapshot)).toEqual([
      { questionId: 'q1', code: 'Q1', title: '성별' },
    ]);
  });

  it('questionCode 없으면 code=null', () => {
    expect(buildChangedQuestions(['q2'], snapshot)).toEqual([
      { questionId: 'q2', code: null, title: '나이' },
    ]);
  });

  it('스냅샷에 없는 id 는 title 을 questionId 로 폴백', () => {
    expect(buildChangedQuestions(['zzz'], snapshot)).toEqual([
      { questionId: 'zzz', code: null, title: 'zzz' },
    ]);
    expect(buildChangedQuestions(['q1'], null)).toEqual([
      { questionId: 'q1', code: null, title: 'q1' },
    ]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test tests/operations/response-edit-diff.test.ts`
Expected: FAIL — "Cannot find module '@/lib/operations/response-edit-diff'"

- [ ] **Step 3: 구현 작성**

`src/lib/operations/response-edit-diff.ts`:

```typescript
import type { ResponseEditChange, SurveyVersionSnapshot } from '@/db/schema/schema-types';

/**
 * 키 순서 무관 안정 직렬화 — deep-equal 비교용.
 * JSON.stringify 의 키 순서 의존으로 거짓 변경이 잡히는 것을 막는다.
 */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/**
 * 이전/이후 questionResponses 를 비교해 값이 바뀐 questionId 목록을 반환.
 * 추가·삭제·변경 모두 포함. 변경 없으면 빈 배열.
 */
export function diffQuestionResponses(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): string[] {
  const ids = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const changed: string[] = [];
  for (const id of ids) {
    if (stableStringify(prev[id]) !== stableStringify(next[id])) changed.push(id);
  }
  return changed;
}

/**
 * 바뀐 questionId 를 버전 스냅샷 기준 { questionId, code, title } 로 매핑.
 * 스냅샷에 없으면 code=null, title=questionId 폴백.
 */
export function buildChangedQuestions(
  changedIds: string[],
  snapshot: SurveyVersionSnapshot | null,
): ResponseEditChange[] {
  const map = new Map<string, { code: string | null; title: string }>();
  for (const q of snapshot?.questions ?? []) {
    // questionCode 는 schema-types.QuestionData 타입에 없으므로 안전 단언.
    const code = (q as { questionCode?: string }).questionCode ?? null;
    map.set(q.id, { code, title: q.title });
  }
  return changedIds.map((id) => {
    const meta = map.get(id);
    return { questionId: id, code: meta?.code ?? null, title: meta?.title ?? id };
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test tests/operations/response-edit-diff.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/operations/response-edit-diff.ts tests/operations/response-edit-diff.test.ts
git commit -m "feat: 응답 편집 diff 및 바뀐 질문 라벨 매핑 유틸 추가"
```

---

## Task 3: `saveAdminEdit` audit 기록 (service + procedure)

**Files:**
- Modify: `src/features/survey-response/server/services/response-edit.service.ts`
- Modify: `src/features/survey-response/server/procedures/edit.ts`
- Modify: `src/features/survey-response/server/procedures/edit.test.ts`

- [ ] **Step 1: service에 editor 인자 + audit insert 추가**

`response-edit.service.ts` 상단 import에 추가:

```typescript
import { surveyResponses, surveys, surveyVersions, responseEditLogs } from '@/db/schema';
import type { SurveyVersionSnapshot } from '@/db/schema/schema-types';
import {
  buildChangedQuestions,
  diffQuestionResponses,
} from '@/lib/operations/response-edit-diff';
```

(기존 `import { surveyResponses, surveys } from '@/db/schema';` 라인을 위 확장 버전으로 교체.)

`saveAdminEdit` 시그니처를 editor 인자 추가로 변경:

```typescript
export async function saveAdminEdit(
  input: SaveAdminEditInput,
  editor: { id: string | null; email: string | null },
): Promise<{ ok: true }> {
```

`const now = new Date();` 아래, progress_pct 재계산 블록 **앞**에 diff + 스냅샷 라벨 계산 추가:

```typescript
  // 바뀐 질문 추출 (audit 용). 변경 0개면 audit 행 미생성.
  const prevResponses = (existing.questionResponses ?? {}) as Record<string, unknown>;
  const changedIds = diffQuestionResponses(prevResponses, questionResponses);
  let changedQuestions: ReturnType<typeof buildChangedQuestions> = [];
  if (changedIds.length > 0) {
    const [verRow] = existing.versionId
      ? await db
          .select({ snapshot: surveyVersions.snapshot })
          .from(surveyVersions)
          .where(eq(surveyVersions.id, existing.versionId))
          .limit(1)
      : [];
    const snapshot = (verRow?.snapshot ?? null) as SurveyVersionSnapshot | null;
    changedQuestions = buildChangedQuestions(changedIds, snapshot);
  }
```

기존 `db.transaction` 블록의 `replaceResponseAnswers(...)` 호출 **뒤**에 audit insert 추가:

```typescript
    if (changedQuestions.length > 0) {
      await tx.insert(responseEditLogs).values({
        responseId,
        surveyId,
        editedBy: editor.id,
        editorEmail: editor.email,
        changedQuestions,
        changedCount: changedQuestions.length,
      });
    }
```

- [ ] **Step 2: procedure에서 context.user 전달**

`edit.ts`의 handler 변경:

```typescript
const saveAdminEdit = authed
  .input(SaveAdminEditInput)
  .output(SaveAdminEditOutput)
  .handler(async ({ input, context }) => {
    try {
      return await svc.saveAdminEdit(input, {
        id: context.user?.id ?? null,
        email: context.user?.email ?? null,
      });
    } catch (err) {
      mapServiceError(err);
    }
  });
```

- [ ] **Step 3: 기존 procedure 테스트 갱신**

`edit.test.ts`의 첫 테스트에서 호출 인자 단언을 새 시그니처에 맞게 변경. `expect(svc.saveAdminEdit).toHaveBeenCalledWith(input);` 를:

```typescript
    expect(svc.saveAdminEdit).toHaveBeenCalledWith(input, {
      id: 'admin-1',
      email: 'a@b.com',
    });
```

로 교체. (`authedContext()`의 user 가 `{ id: 'admin-1', email: 'a@b.com' }` 이므로 일치.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test src/features/survey-response/server/procedures/edit.test.ts`
Expected: PASS (기존 테스트 전부)

- [ ] **Step 5: tsc 통과 확인**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 0. `saveAdminEdit` 다른 호출처가 있으면(grep `saveAdminEdit(`) 인자 누락 에러가 나므로 확인 — 현재 호출처는 edit.ts 1곳.

- [ ] **Step 6: 커밋**

```bash
git add src/features/survey-response/server
git commit -m "feat: 관리자 응답 수정 시 편집 audit 이력 기록"
```

---

## Task 4: 조회 함수 (`contacts.server.ts`)

**Files:**
- Modify: `src/lib/operations/contacts.server.ts`

- [ ] **Step 1: import 보강**

`contacts.server.ts`의 `import { contactTargets, contactUploads, surveys } from '@/db/schema';` 를 확장:

```typescript
import {
  contactTargets,
  contactUploads,
  surveys,
  mailRecipients,
  mailCampaigns,
  responseEditLogs,
} from '@/db/schema';
import type { ResponseEditChange } from '@/db/schema/schema-types';
```

(`MailRecipientStatus` 는 이미 import 됨.)

- [ ] **Step 2: 메일 발송 이력 조회 함수 추가**

파일 하단(`export { CONTACT_METHOD_LABEL };` 위)에 추가:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// 단건 편집 — 이메일 발송 현황 / 수정·편집 현황 카드용 조회
// ─────────────────────────────────────────────────────────────────────────────

export interface MailHistoryRow {
  /** mail_recipients.id — React key 용 */
  id: string;
  campaignTitle: string;
  runNumber: number;
  status: MailRecipientStatus;
  sentAt: Date | null;
  deliveredAt: Date | null;
  openedAt: Date | null;
  bouncedAt: Date | null;
  errorReason: string | null;
  createdAt: Date;
}

/** 조사 대상에게 발송된 메일 수신 이력 (최근순). 캠페인 제목/회차 조인. */
export async function getMailRecipientsForTarget(
  contactTargetId: string,
): Promise<MailHistoryRow[]> {
  return db
    .select({
      id: mailRecipients.id,
      campaignTitle: mailCampaigns.title,
      runNumber: mailCampaigns.runNumber,
      status: mailRecipients.status,
      sentAt: mailRecipients.sentAt,
      deliveredAt: mailRecipients.deliveredAt,
      openedAt: mailRecipients.openedAt,
      bouncedAt: mailRecipients.bouncedAt,
      errorReason: mailRecipients.errorReason,
      createdAt: mailRecipients.createdAt,
    })
    .from(mailRecipients)
    .innerJoin(mailCampaigns, eq(mailRecipients.campaignId, mailCampaigns.id))
    .where(eq(mailRecipients.contactTargetId, contactTargetId))
    .orderBy(desc(mailRecipients.createdAt));
}

export interface ResponseEditLogRow {
  id: string;
  editorEmail: string | null;
  changedQuestions: ResponseEditChange[];
  changedCount: number;
  createdAt: Date;
}

/** 응답 편집 audit 이력 (최근순). responseId 없으면 빈 배열. */
export async function getResponseEditLogs(
  responseId: string | null,
): Promise<ResponseEditLogRow[]> {
  if (!responseId) return [];
  return db
    .select({
      id: responseEditLogs.id,
      editorEmail: responseEditLogs.editorEmail,
      changedQuestions: responseEditLogs.changedQuestions,
      changedCount: responseEditLogs.changedCount,
      createdAt: responseEditLogs.createdAt,
    })
    .from(responseEditLogs)
    .where(eq(responseEditLogs.responseId, responseId))
    .orderBy(desc(responseEditLogs.createdAt));
}
```

- [ ] **Step 3: tsc 통과 확인**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 0. (`eq`, `desc` 는 파일 상단에서 이미 import 됨.)

- [ ] **Step 4: 커밋**

```bash
git add src/lib/operations/contacts.server.ts
git commit -m "feat: 조사 대상 메일 발송 이력 및 응답 편집 이력 조회 함수 추가"
```

---

## Task 5: UI 카드 2개 + 단건 편집 통합

**Files:**
- Create: `src/components/operations/contacts/contact-mail-history-card.tsx`
- Create: `src/components/operations/contacts/contact-edit-history-card.tsx`
- Modify: `src/components/operations/contacts/contact-detail-form.tsx`
- Modify: `src/app/admin/surveys/[id]/operations/contacts/[contactId]/page.tsx`

- [ ] **Step 1: 이메일 발송 현황 카드**

`contact-mail-history-card.tsx`:

```tsx
import { RecipientStatusBadge } from '@/components/operations/mail-campaign/recipient-status-badge';
import { formatLocalDateTime } from '@/lib/date-formatters';
import type { MailHistoryRow } from '@/lib/operations/contacts.server';

/** 조사 대상 메일 발송 이력 — 기본 접힘 collapsible. */
export function ContactMailHistoryCard({ rows }: { rows: MailHistoryRow[] }) {
  const latest = rows[0];
  return (
    <details className="rounded-lg border bg-white">
      <summary className="flex cursor-pointer items-center justify-between px-5 py-3 text-sm">
        <span className="font-medium text-slate-700">
          이메일 발송 현황 ({rows.length}건)
        </span>
        {latest ? <RecipientStatusBadge status={latest.status} /> : null}
      </summary>
      <div className="border-t px-5 py-3">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">발송 내역이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-1 border-b border-slate-100 pb-2 last:border-0 last:pb-0"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">
                    {r.runNumber}회차 · {r.campaignTitle}
                  </span>
                  <RecipientStatusBadge status={r.status} />
                </div>
                <div className="text-xs text-slate-500">
                  {[
                    r.sentAt && `발송 ${formatLocalDateTime(r.sentAt)}`,
                    r.deliveredAt && `전달 ${formatLocalDateTime(r.deliveredAt)}`,
                    r.openedAt && `열람 ${formatLocalDateTime(r.openedAt)}`,
                    r.bouncedAt && `반송 ${formatLocalDateTime(r.bouncedAt)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '발송 대기'}
                </div>
                {r.errorReason ? (
                  <div className="text-xs text-rose-500">{r.errorReason}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
```

- [ ] **Step 2: 수정/편집 현황 카드**

`contact-edit-history-card.tsx`:

```tsx
import { formatLocalDateTime } from '@/lib/date-formatters';
import type { ResponseEditChange } from '@/db/schema/schema-types';
import type { ResponseEditLogRow } from '@/lib/operations/contacts.server';

/** 바뀐 질문 요약 — 앞 3개 code/title + "외 N개". */
function summarizeChanges(changes: ResponseEditChange[], count: number): string {
  const labels = changes.slice(0, 3).map((c) => c.code ?? c.title);
  const head = labels.join(', ');
  if (count <= 3) return head ? `${head} 수정` : '응답 수정';
  return `${head} 외 ${count - 3}개 수정`;
}

interface Props {
  rows: ResponseEditLogRow[];
  /** 매칭된 응답이 있는지 (없으면 "매칭된 응답 없음" 안내). */
  hasResponse: boolean;
}

/** 응답 편집 audit 이력 — 기본 접힘 collapsible. */
export function ContactEditHistoryCard({ rows, hasResponse }: Props) {
  return (
    <details className="rounded-lg border bg-white">
      <summary className="flex cursor-pointer items-center justify-between px-5 py-3 text-sm">
        <span className="font-medium text-slate-700">
          수정 / 편집 현황 ({rows.length}건)
        </span>
      </summary>
      <div className="border-t px-5 py-3">
        {!hasResponse ? (
          <p className="text-sm text-slate-400">매칭된 응답이 없습니다.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-400">수정 이력이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="border-b border-slate-100 pb-2 last:border-0 last:pb-0"
              >
                <div className="text-sm text-slate-700">{r.editorEmail ?? '관리자'}</div>
                <div className="text-xs text-slate-500">
                  {formatLocalDateTime(r.createdAt)} ·{' '}
                  {summarizeChanges(r.changedQuestions, r.changedCount)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
```

- [ ] **Step 3: `contact-detail-form.tsx` — prop 추가 + placeholder 교체**

import 추가(상단 컴포넌트 import 영역):

```typescript
import { ContactMailHistoryCard } from '@/components/operations/contacts/contact-mail-history-card';
import { ContactEditHistoryCard } from '@/components/operations/contacts/contact-edit-history-card';
import type {
  MailHistoryRow,
  ResponseEditLogRow,
} from '@/lib/operations/contacts.server';
```

`ContactDetailFormProps`에 prop 추가:

```typescript
  /** 메일 발송 이력 (편집 모드에서만 의미, 신규 모드는 빈 배열). */
  mailHistory?: MailHistoryRow[];
  /** 응답 편집 audit 이력 (편집 모드에서만 의미). */
  editLogs?: ResponseEditLogRow[];
```

`initial` 타입에 `responseId` 추가:

```typescript
    inviteToken: string;
    responseId: string | null;
    attempts: ContactAttemptRow[];
```

함수 시그니처 구조분해에 추가:

```typescript
export function ContactDetailForm({
  surveyId,
  scheme,
  resultCodes,
  systemFieldKeys,
  initial,
  mailHistory = [],
  editLogs = [],
}: ContactDetailFormProps) {
```

placeholder 블록(현재 `{/* 후속 슬라이스 placeholders */}` ~ 두 번째 `</div>`까지, 약 351~363줄)을 통째로 교체. **신규 모드에선 숨기기 위해 `isEdit && initial` 블록 안으로 이동** — 기존 `<ContactAttemptHistoryCard .../>` 바로 뒤(`</>` 닫기 전)에 배치:

```tsx
              <ContactMailHistoryCard rows={mailHistory} />
              <ContactEditHistoryCard
                rows={editLogs}
                hasResponse={initial.responseId != null}
              />
```

그리고 기존 placeholder 2개 `<div>` 블록은 삭제.

- [ ] **Step 4: `page.tsx` — prefetch + prop 주입**

import 추가:

```typescript
import {
  getContactColumnScheme,
  getContactDetailById,
  getContactResultCodes,
  getMailRecipientsForTarget,
  getResponseEditLogs,
} from '@/lib/operations/contacts.server';
```

`getContactDetailById` 결과 검증 후의 `Promise.all` 을 확장:

```typescript
  const [scheme, resultCodes, mailHistory, editLogs] = await Promise.all([
    getContactColumnScheme(surveyId),
    getContactResultCodes(surveyId),
    getMailRecipientsForTarget(detail.contact.id),
    getResponseEditLogs(detail.contact.responseId),
  ]);
  if (!scheme) notFound();
```

`<ContactDetailForm>` 에 prop 추가:

```tsx
      <ContactDetailForm
        surveyId={surveyId}
        scheme={scheme}
        resultCodes={resultCodes}
        systemFieldKeys={extractSystemFieldKeys(scheme)}
        mailHistory={mailHistory}
        editLogs={editLogs}
        initial={{
          id: detail.contact.id,
          resid: detail.contact.resid,
          attrs: detail.contact.attrs,
          piiDecrypted: detail.contact.piiDecrypted,
          memo: detail.contact.memo,
          contactMethod: detail.contact.contactMethod,
          respondedAt: detail.contact.respondedAt,
          inviteToken: detail.contact.inviteToken,
          responseId: detail.contact.responseId,
          attempts: detail.attempts,
        }}
      />
```

(`detail.contact.responseId` 는 `ContactDetailRow`에 이미 존재 — `getContactDetailById` 가 select 함.)

- [ ] **Step 5: tsc + lint 확인**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: 에러 0.

- [ ] **Step 6: 커밋**

```bash
git add src/components/operations/contacts/contact-mail-history-card.tsx src/components/operations/contacts/contact-edit-history-card.tsx src/components/operations/contacts/contact-detail-form.tsx "src/app/admin/surveys/[id]/operations/contacts/[contactId]/page.tsx"
git commit -m "feat: 조사 대상 단건 편집에 이메일 발송 및 수정편집 현황 카드 표시"
```

---

## Task 6: 전체 검증 + 수동 확인

**Files:** 없음(검증만)

- [ ] **Step 1: 전체 테스트**

Run: `pnpm test`
Expected: 신규 테스트 통과, 기존 회귀 0. (단 `tests/integration/profiles-row-actions.test.ts` 의 알려진 flaky 12 fail 은 회귀 아님 — CLAUDE.md 참고.)

- [ ] **Step 2: tsc + lint 최종**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: 에러 0.

- [ ] **Step 3: 수동 확인 (개발 서버)**

`pnpm dev` 후 `/admin/surveys/<id>/operations/contacts/<contactId>`:
- 메일 발송 이력 있는 대상: "이메일 발송 현황 (N건)" + 최신 status badge, 펼치면 캠페인별 행.
- 미응답(responseId null) 대상: "수정/편집 현황" 펼치면 "매칭된 응답이 없습니다".
- 응답 매칭된 대상을 `profiles/<responseId>/edit` 에서 한 문항 수정 후 저장 → 단건 편집 새로고침 → "수정/편집 현황 (1건)" 에 관리자 이메일 + 바뀐 질문 표시.
- 신규 추가 화면(`contacts/new`): 두 카드 미표시 확인.

- [ ] **Step 4: 변경 없는 저장이 audit 안 만드는지 확인**

`profiles/<responseId>/edit` 에서 아무것도 바꾸지 않고 저장 → 단건 편집의 "수정/편집 현황" 건수가 증가하지 않음 확인.

---

## 한계 / 메모

- audit는 0033 마이그레이션 적용 **이후 편집부터** 기록됨(소급 없음).
- 바뀐 질문 라벨은 응답 **버전 스냅샷 기준** — versionId 없는 구 응답은 title=questionId 폴백.
- 응답자 본인 재제출은 기록 안 함(관리자 saveAdminEdit 만). 향후 확장 시 saveResponse 에 동일 패턴 추가 가능.
- **테스트 범위 결정:** audit 핵심 로직(diff·라벨 매핑)은 순수 함수로 분리해 단위 테스트로 커버(Task 2). service 의 트랜잭션 내 insert 글루는 `db.transaction`/`db.query`/`db.select` 전체 mock 이 비현실적이라 단위 테스트 대신 수동검증(Task 6 Step 3~4)으로 둔다. 로컬 supabase 가 있으면 `*.realdb.test.ts` 로 보강 가능하나 본 계획 범위 밖.
