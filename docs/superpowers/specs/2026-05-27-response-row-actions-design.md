# 응답 내역 행 액션 (수정·삭제·초기화) — 설계 문서

작성일: 2026-05-27
대상 페이지: `/admin/surveys/[id]/operations/profiles`
관련 메모:
- `feedback_no_emoji_in_code`, `feedback_no_jsdom_in_server`, `feedback_drizzle_migrate_journal`
- `feedback_survey_save_explicit_fields`, `feedback_vitest_tests_dir_only`
- `project_response_page_snapshot_based`, `project_operations_console_slice2_done`

---

## 1. 목표

운영 콘솔의 응답 내역 표에서 운영자가 각 응답 행을 직접 정리할 수 있게 한다.

- **수정**: 응답 내용을 어드민 페이지에서 다시 채워 저장한다. 시작·종료 시각은 보존한다.
- **삭제**: 통계·목록에서 즉시 제외하되 복원 가능한 휴지통으로 보낸다.
- **초기화**: 응답 행을 완전히 제거하여 동일 컨택이 같은 inviteToken으로 다시 처음부터 응답할 수 있게 한다.

부수 목표: `surveyResponses.deletedAt` 컬럼이 이미 schema에는 있으나 실제 set/필터 통합이 되어 있지 않아 발생한 사각지대(통계 누수)와 dead-code server actions를 함께 정리한다.

---

## 2. 사용자 흐름

### 2.1 진입점

응답 내역 테이블의 마지막 컬럼에 kebab 메뉴가 노출된다.

**활성(active) 모드**:
- 수정 — 새 탭으로 어드민 수정 라우트 진입
- 초기화 — 확인 모달 → server action → 행 사라짐
- 삭제 — 확인 모달 → server action → 행 사라짐 (휴지통으로 이동)

**휴지통(deleted) 모드**:
- 복원 — 확인 없이 단일 클릭

### 2.2 휴지통 진입

기존 status 드롭다운에 구분선과 함께 `삭제됨` 항목을 추가한다. 선택 시 URL 쿼리 `?status=deleted`. 라우트 분리 없음.

휴지통 모드의 헤더 보조 문구:
> 삭제된 응답 — N건. 복원하면 통계에 다시 포함됩니다.

### 2.3 수정 흐름

1. 운영자가 활성 응답의 kebab 메뉴에서 "수정"을 클릭.
2. 새 탭으로 `/admin/surveys/[id]/operations/profiles/[responseId]/edit` 열림.
3. 어드민 layout의 세션 가드 + surveys ownership 검증 통과.
4. 응답의 `versionId` 스냅샷 questions로 prefill (응답자 흐름과 동일한 컨디셔널 로직 평가).
5. 상단 amber 배너: "어드민 수정 모드 — 응답 #N · 응답자 흐름과 동일하게 보입니다".
6. 저장 시 `completedAt` 보존, `lastEditedAt` 갱신, `questionResponses` 및 `response_answers` 재기록.
7. 저장 완료 후 `/admin/surveys/[id]/operations/profiles`로 redirect.

---

## 3. 데이터 모델 변경

### 3.1 컬럼

`survey_responses` 테이블:

| 컬럼 | 타입 | 처리 |
|---|---|---|
| `deleted_at` | `timestamptz NULL` | **이미 존재** (schema:181). 신규 마이그레이션 없음. set/필터 로직만 추가. |
| `last_edited_at` | `timestamptz NULL` | **신규 추가**. 어드민 수정 시각 추적. |

### 3.2 인덱스

```sql
CREATE INDEX idx_survey_responses_deleted_at
  ON survey_responses (survey_id, deleted_at);
```

`listResponsesForProfiles`의 row_number 윈도우와 view 필터에 사용된다. survey 단위 부분 인덱스는 카디널리티가 충분히 낮아 별도 partial index는 만들지 않는다.

### 3.3 마이그레이션

`pnpm db:generate`로 drizzle 자동 생성을 1차 시도한다. journal 누락이 발생하면 Supabase MCP `apply_migration`으로 직접 적용한다 (`feedback_drizzle_migrate_journal`).

```sql
ALTER TABLE survey_responses
  ADD COLUMN last_edited_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_survey_responses_deleted_at
  ON survey_responses (survey_id, deleted_at);
```

기존 데이터는 모두 `deleted_at = NULL`, `last_edited_at = NULL`로 자동 active·미수정 분류된다.

### 3.4 `contact_targets` 연동

| 동작 | `contact_targets.response_id` | `contact_targets.responded_at` |
|---|---|---|
| 삭제 (soft) | 유지 | 유지 |
| 복원 | 유지 (변동 없음) | 유지 |
| 초기화 (hard) | `NULL`로 복원 | `NULL`로 복원 |

초기화 시 컨택 명단 진척률이 자동으로 미응답으로 되돌아간다. 삭제 시는 FK가 살아있으므로 그대로 두되, 진척률 집계 단에서 `deleted_at IS NULL`을 조인 조건에 추가하여 미응답처럼 취급한다.

---

## 4. UI 변경

### 4.1 `ProfilesTable` 컬럼 추가

9번째 컬럼 `actions` 추가. width 좁게, sortable: false, align: center.

```tsx
{
  id: 'actions',
  header: '',
  cell: ({ row }) => <ProfilesRowActions row={row.original} view={view} />,
  meta: meta('center', false),
}
```

신규 컴포넌트 `src/components/operations/profiles/profiles-row-actions.tsx`:
- shadcn `DropdownMenu` 사용.
- view='active'일 때 메뉴: 수정 / 초기화 / 구분선 / 삭제(destructive 컬러).
- view='deleted'일 때 메뉴: 복원.
- destructive 액션은 모두 `AlertDialog` 확인 모달 거침.
- 모달 문구:
  - **삭제**: "응답 #{idx}를 삭제합니다. 통계에서 제외되며 휴지통에서 복원 가능합니다."
  - **초기화**: "응답 #{idx}를 완전히 제거합니다. 응답 데이터는 복구할 수 없습니다. 컨택 명단의 진척 상태도 함께 되돌아갑니다."
  - **복원**: 모달 없이 즉시 실행.
- 액션은 server action 직접 호출 → `useTransition`으로 pending UI.

### 4.2 `ProfilesFilterBar` — status 드롭다운 확장

기존 status 옵션 아래 구분선 + `삭제됨` 항목 추가.

```
[ 전체 상태 ▾ ]
  ─ 전체 상태
  ─ 완료
  ─ 진행 중
  ─ 스크리닝 제외
  ─ ──────────
  ─ 삭제됨        ← 신규
```

URL 쿼리 매핑:
- `?status=all` (기본) → active 모드, 모든 status
- `?status=completed|in_progress|...` → active 모드, 해당 status만
- `?status=deleted` → deleted 모드 (status 추가 필터 없이 deleted 전체)

`normalizeListArgs` 시그니처에 `view: 'active' | 'deleted'` 파생값을 추가한다. 외부에서는 단일 `status` 파라미터로 노출되어 URL 구조 단순.

### 4.3 휴지통 헤더 보조 문구

`profiles/page.tsx`에서 `view==='deleted'`일 때 `<h2>` 보조 문구를 교체한다.

### 4.4 수정 라우트 — 신규

```
src/app/admin/surveys/[id]/operations/profiles/[responseId]/edit/
├── page.tsx           # Server Component, 가드 + prefill
└── admin-response-editor.tsx  # Client wrapper
```

`AdminResponseEditor`는 응답 페이지의 핵심 렌더러(`SurveyResponseRenderer` 또는 동등 컴포넌트)를 재사용한다. 차이점:
- 헤더 배너 1개 (amber).
- 저장 콜백을 `saveAdminEdit` server action으로 교체.
- 시작 페이지가 첫 번째 group이 아닌 응답 페이로드에 따라 자동 선택될 수 있도록 응답자 흐름의 분기 로직을 그대로 사용.

라우트 metadata: `title: '응답 #N 수정 — {survey.title}'`.

---

## 5. 서버 액션 변경

### 5.1 신규 파일 — `src/actions/profiles-row-actions.ts`

```ts
'use server';

import 'server-only';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { surveyResponses, contactTargets } from '@/db/schema';
import { requireSurveyOwnership } from '@/lib/auth/require-survey-ownership';

export async function softDeleteResponse(surveyId: string, responseId: string) {
  await requireSurveyOwnership(surveyId);
  await db
    .update(surveyResponses)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(surveyResponses.id, responseId),
        eq(surveyResponses.surveyId, surveyId),
      ),
    );
  revalidatePath(`/admin/surveys/${surveyId}/operations/profiles`);
  return { ok: true as const };
}

export async function restoreResponse(surveyId: string, responseId: string) {
  await requireSurveyOwnership(surveyId);
  await db
    .update(surveyResponses)
    .set({ deletedAt: null })
    .where(
      and(
        eq(surveyResponses.id, responseId),
        eq(surveyResponses.surveyId, surveyId),
      ),
    );
  revalidatePath(`/admin/surveys/${surveyId}/operations/profiles`);
  return { ok: true as const };
}

export async function hardResetResponse(surveyId: string, responseId: string) {
  await requireSurveyOwnership(surveyId);
  await db.transaction(async (tx) => {
    await tx
      .update(contactTargets)
      .set({ responseId: null, respondedAt: null })
      .where(eq(contactTargets.responseId, responseId));
    await tx
      .delete(surveyResponses)
      .where(
        and(
          eq(surveyResponses.id, responseId),
          eq(surveyResponses.surveyId, surveyId),
        ),
      );
  });
  revalidatePath(`/admin/surveys/${surveyId}/operations/profiles`);
  return { ok: true as const };
}
```

세 액션 모두 idempotent: 이미 변경된 상태로 호출되면 변경 행 0건이지만 ok 반환.

`requireSurveyOwnership(surveyId)` 헬퍼는 기존 admin server action들의 공통 가드 패턴을 그대로 재사용한다. 없다면 `src/lib/auth/require-survey-ownership.ts`로 추출하여 본 작업과 함께 도입 (response-actions.ts IDOR 메모 정리 효과).

`response_answers`는 `surveyResponses.id`에 cascade 설정되어 있어 `hardResetResponse`의 delete에서 자동 정리된다.

### 5.2 신규 — `saveAdminEdit`

`src/actions/profiles-row-actions.ts` 동일 파일에 추가하거나, 응답 저장 로직이 길면 `src/actions/admin-edit-response.ts` 분리.

```ts
export async function saveAdminEdit(
  surveyId: string,
  responseId: string,
  payload: SaveAdminEditPayload,
) {
  await requireSurveyOwnership(surveyId);

  const existing = await db.query.surveyResponses.findFirst({
    where: and(
      eq(surveyResponses.id, responseId),
      eq(surveyResponses.surveyId, surveyId),
    ),
  });
  if (!existing) throw notFound();
  if (existing.deletedAt !== null)
    throw new Error('Cannot edit deleted response');

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(surveyResponses)
      .set({
        questionResponses: payload.questionResponses,
        lastEditedAt: now,
        lastActivityAt: now,
        currentStepId: null,
        totalSeconds: existing.completedAt
          ? Math.floor(
              (existing.completedAt.getTime() - existing.startedAt.getTime()) /
                1000,
            )
          : null,
        // completedAt 은 set 하지 않음 — 명시적 보존
        // status 도 set 하지 않음 — 'completed' 유지
      })
      .where(eq(surveyResponses.id, responseId));

    await replaceResponseAnswers(tx, responseId, payload.questionResponses);
  });

  revalidatePath(`/admin/surveys/${surveyId}/operations/profiles`);
  return { ok: true as const };
}
```

`replaceResponseAnswers`는 기존 `completeResponse` 내부에서 `response_answers`를 채우는 로직을 분리한 헬퍼다. 구현 단계에서 코드를 보고 분리 또는 재사용 결정 (사용자 합의 사항).

`feedback_survey_save_explicit_fields` 준수: spread 사용 금지, 모든 필드 명시적 set/생략.

### 5.3 dead code 제거

`src/actions/response-actions.ts`:
- `deleteResponse(responseId)` — 삭제
- `clearSurveyResponses(surveyId)` — 삭제
- `clearAllResponses()` — 삭제
- `importResponses(data)` — 삭제

`src/actions/index.ts`의 re-export 라인 정리.

`src/hooks/queries/use-responses.ts`:
- `useDeleteResponse`, `useClearSurveyResponses`, `useImportResponses` 훅 정의 및 import 라인 삭제.
- `src/hooks/queries/index.ts`의 re-export 정리.

호출자 0건임을 grep으로 확인 후 한 번에 제거.

---

## 6. 조회 필터 일괄 통합

`surveyResponses` SELECT/COUNT가 발생하는 모든 경로에 `isNull(surveyResponses.deletedAt)`를 추가한다.

### 6.1 Data layer (`src/data/responses.ts`)

| 함수 | 변경 |
|---|---|
| `getResponsesBySurvey(surveyId)` | `where`에 `isNull(deletedAt)` AND 결합 |
| `getCompletedResponses(surveyId)` | 동일 |
| `getResponseCountBySurvey(surveyId)` | 동일 |
| `getCompletedResponseCountBySurvey(surveyId)` | 동일 |
| `getResponsesWithAnswers(surveyId, versionId)` | 동일 |
| `getResponseById(responseId, { includeDeleted? })` | **시그니처 확장**. 기본 `false` → `isNull(deletedAt)`. 어드민 수정 페이지에서만 `true` 전달하여 deleted 응답도 조회 가능 |

`getResponseById`만 옵트인 구조로 만든 이유: 어드민 수정 페이지가 사용자가 휴지통의 응답을 직접 URL로 열었을 때 "삭제된 응답은 수정할 수 없습니다" 메시지를 띄우려면 행 자체는 읽혀야 한다.

### 6.2 Operations layer (`src/lib/operations/*.server.ts`)

| 파일 | 쿼리 수 | 변경 |
|---|---|---|
| `aggregate-daily.server.ts` | 3 | `where`에 `isNull(deletedAt)` 결합 |
| `daily-stats.server.ts` | 1 | 동일 |
| `aggregate-status.server.ts` | 1 | 동일 |
| `response-time.server.ts` | 1 | 동일 |
| `report-progress.server.ts` | 1 | 동일 (컨택 진척 집계) |
| `profiles.server.ts` | 1 (base subquery) | **분기**: `view==='active'` → `isNull`, `view==='deleted'` → `isNotNull`. row_number도 view 단위로 매김. |

`profiles.server.ts`의 row_number 분리는 active와 deleted 각각 1번부터 매겨지도록 동작이 자연스러워진다. UI 표시도 일관됨.

### 6.3 API layer

`src/app/api/surveys/[surveyId]/export/route.ts`:
- pre-check count 쿼리 (라인 66-76)에 `isNull(deletedAt)` 추가
- data fetch 쿼리 (라인 78-81)에 동일 추가

### 6.4 자동 보호 영역 — 변경 불필요

- `src/lib/analytics/{analyzer,cross-tab,filter}.ts` — 입력 배열을 소비할 뿐. data layer가 정제하므로 자동 보호.
- `src/app/admin/surveys/[id]/analytics/page.tsx`, `src/app/analytics/[surveyId]/page.tsx`, `src/app/analytics/page.tsx` — data layer 함수만 호출.
- `src/app/admin/surveys/[id]/operations/overview/page.tsx` — operations server 함수만 호출.
- `src/lib/duplicate-detection/check.ts` — 이미 `isNull(deletedAt)` 적용됨.

### 6.5 응답자 동선 server actions — 변경 불필요

`response-actions.ts`의 `updateQuestionResponse`, `resumeOrUpdateResponse`, `markPageLeaveTime`, `completeResponse` 등은 `responseId` 직접 타게팅이라 `deletedAt` 필터 추가 불필요.

응답자가 동일 `(surveyId, sessionId)`로 재진입하는 경우는 발생하더라도 unique 제약상 충돌이 아니라 기존 행을 그대로 잇는 동작이며, soft-deleted 응답에 새 답변이 덧씌워지는 정상적이지 않은 케이스는 다음 보호장치로 충분히 막힌다.
- 어드민이 초기화(hard reset)를 호출한 경우: 행 자체가 사라져서 unique 제약 통과, 정상 신규 응답으로 시작.
- 어드민이 단순 soft delete만 한 경우: 응답자가 같은 sessionId로 들어와도 deletedAt이 set된 행이 unique 충돌을 일으켜 별도 분기로 처리. 본 작업의 통계 누수 차단 목표와는 별개 시나리오이며 현 작업 범위에 포함되지 않는다 (섹션 9 참조).

---

## 7. 테스트

`tests/integration/` 신규 파일 1개 (`feedback_vitest_tests_dir_only` 준수): `tests/integration/profiles-row-actions.test.ts`.

| 케이스 | 검증 |
|---|---|
| softDelete → 같은 surveyId | profiles active list에서 제외, deleted list에 포함, overview completed 카운트 감소, report 진척 감소, export 제외 |
| restore | 위 모든 변화가 원복 |
| hardReset | surveyResponses 행 없음, response_answers cascade 정리됨, contact_targets.response_id NULL + responded_at NULL, 같은 inviteToken으로 startResponse 재진입 가능 |
| saveAdminEdit | questionResponses 갱신, completedAt 불변, lastEditedAt 갱신, response_answers 재기록 |
| saveAdminEdit on deleted | 에러 — "Cannot edit deleted response" |
| IDOR 가드 | 다른 user의 survey 응답에 대한 액션 호출 시 401/403 |

UI 단 vitest는 사용 안 함. 행 액션 컴포넌트는 통합 테스트로 커버되고, 별도 컴포넌트 테스트는 비용 대비 가치 낮음.

수동 검증 체크리스트 (PR description에 포함):
- 활성 응답 1건 삭제 → overview/report/profiles/analytics에서 모두 사라짐 확인
- 복원 → 모두 원복 확인
- 초기화 → 행 사라지고 컨택 진척이 미응답으로 돌아옴 확인
- 수정 → 종료일시는 그대로, lastEditedAt이 표시됨 확인 (UI 노출은 별도 작업 시)
- 어드민 export 결과에 삭제된 응답 없음 확인

---

## 8. 회귀 방어 — grep 가드

PR 완료 시 다음 명령을 실행해 사각지대를 마지막으로 점검한다.

```bash
# surveyResponses SELECT/COUNT 중 deletedAt 미적용 위치 탐지
grep -rn "from(surveyResponses)\|surveyResponses)\.where\|.from(.*surveyResponses" src/ \
  | grep -v "deletedAt\|INSERT\|insert(\|update(\|response-actions.ts:.*update\|response-actions.ts:.*insert"
```

수동으로 결과를 한 줄씩 보고 각각이 (a) INSERT/UPDATE 본인 행 타게팅, (b) duplicate-detection처럼 이미 적용됨, (c) 의도된 휴지통 뷰 셋 중 하나임을 확인.

이 점검 결과를 PR description에 첨부.

---

## 9. 비범위 (out of scope)

- 영구 삭제 액션 (사용자 결정: 초기화로 충분).
- 어드민 수정 흐름의 변경 이력(diff) 기록 — `lastEditedAt`만 추적, 어떤 답변이 변했는지는 별도 작업.
- 수정 모드 진입 시 응답자 화면과 다른 분기 로직 노출 (사용자 결정: 응답자 흐름 그대로).
- 휴지통 보관 기한·자동 영구삭제 정책.
- 일괄 삭제·일괄 복원 UI (현 시점 미요청).
- 어드민이 응답을 soft delete 한 상태에서 같은 sessionId의 응답자가 같은 설문에 다시 진입했을 때의 unique 제약 충돌 처리 (실제 동선에서 발생 가능성이 낮고, 본 작업의 통계 누수 차단 목표와는 별개 시나리오).

---

## 10. 영향 받는 파일 목록 (요약)

신규 (5):
- `src/components/operations/profiles/profiles-row-actions.tsx`
- `src/actions/profiles-row-actions.ts`
- `src/app/admin/surveys/[id]/operations/profiles/[responseId]/edit/page.tsx`
- `src/app/admin/surveys/[id]/operations/profiles/[responseId]/edit/admin-response-editor.tsx`
- `src/lib/auth/require-survey-ownership.ts` (기존 가드 추출 시)
- `tests/integration/profiles-row-actions.test.ts`

수정 (≈14):
- `src/components/operations/profiles/profiles-table.tsx` — actions 컬럼 추가
- `src/components/operations/profiles/profiles-filter-bar.tsx` — status 드롭다운 항목 추가
- `src/lib/operations/profiles.ts` — `normalizeListArgs` view 파생
- `src/lib/operations/profiles.server.ts` — view 분기, isNull/isNotNull
- `src/lib/operations/aggregate-daily.server.ts`
- `src/lib/operations/daily-stats.server.ts`
- `src/lib/operations/aggregate-status.server.ts`
- `src/lib/operations/response-time.server.ts`
- `src/lib/operations/report-progress.server.ts`
- `src/data/responses.ts` — 6 함수 (+ `getResponseById` 시그니처 확장)
- `src/app/api/surveys/[surveyId]/export/route.ts` — 2 쿼리
- `src/app/admin/surveys/[id]/operations/profiles/page.tsx` — view에 따른 헤더 분기
- `src/db/schema/surveys.ts` — `lastEditedAt` 컬럼 추가
- 신규 마이그레이션 파일 (drizzle 또는 Supabase MCP)

삭제 (4 + hooks):
- `src/actions/response-actions.ts`에서 `deleteResponse`, `clearSurveyResponses`, `clearAllResponses`, `importResponses`
- `src/hooks/queries/use-responses.ts`에서 대응 hook 3개
- `src/actions/index.ts`, `src/hooks/queries/index.ts` re-export 정리
