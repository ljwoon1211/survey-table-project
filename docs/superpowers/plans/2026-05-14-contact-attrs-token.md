# 컨택 attrs 토큰 — 설문 빌더 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메일 변수 토큰 시스템(`{{key}}`)을 설문 빌더로 확장해 컨택별 attrs로 prefill된 설문지가 자동 발송되게 한다.

**Architecture:** 기존 메일 토큰 자산(`getVariableCatalog`, `PopoverVariableMenu`, `extractVariableKeys`)을 재사용. 응답 페이지가 invite token으로 attrs를 로드해 React Context로 주입하고, notice/description/table text 셀은 HTML 렌더 직전에 치환, 단답형/input 셀은 readonly disabled 입력으로 prefill 처리. 익명 접근은 설문 단위 `requireInviteToken` 토글로 차단.

**Tech Stack:** Next.js 16 (App Router), React 19, Drizzle ORM, PostgreSQL (Supabase), Vitest, TipTap 3.x

**Spec:** [docs/superpowers/specs/2026-05-14-contact-attrs-token-design.md](../specs/2026-05-14-contact-attrs-token-design.md)

**커밋 메시지 규칙:** 한국어, `feat:` / `fix:` / `refactor:` 형식, 괄호 금지 (memory: feedback_git_commit_korean.md)

---

## File Structure

### 신규 생성

| 경로 | 책임 |
|---|---|
| `supabase/migrations/0022_contact_attrs_token.sql` | DB 컬럼 추가 |
| `src/lib/survey/substitute-tokens.ts` | `{{key}}` 치환 순수 함수 |
| `tests/unit/survey/substitute-tokens.test.ts` | 단위 테스트 |
| `src/lib/survey/contact-attrs-context.tsx` | 응답 페이지 attrs Context Provider |
| `src/actions/contact-attrs-actions.ts` | 응답 페이지용 attrs lookup server action |
| `src/components/survey-response/invite-required-screen.tsx` | requireInviteToken=true + invite 없음 시 차단 화면 |
| `src/components/survey-builder/variable-button.tsx` | 단일 라인 input 옆에 붙는 변수 메뉴 트리거 버튼 |
| `src/components/survey-builder/token-warning-panel.tsx` | 매칭 안 된 토큰 키 경고 배지 |
| `src/components/operations/contacts/copy-invite-url-button.tsx` | 컨택 상세 페이지의 응답 링크 복사 버튼 |

### 수정

| 경로 | 변경 |
|---|---|
| `src/db/schema/surveys.ts` | `requireInviteToken`, `questions.defaultValueTemplate` 컬럼 추가 |
| `src/db/schema/schema-types.ts` | `TableCell.defaultValueTemplate` 옵셔널 필드 추가 |
| `src/types/survey.ts` | Question/Survey 타입 확장 |
| `src/components/operations/mail-template/variable-catalog.ts` | `purpose: 'mail' \| 'survey'` 옵션 인자 추가 |
| `src/app/survey/[id]/page.tsx` | invite token 로드 분기 + ContactAttrsProvider 감싸기 + 차단 화면 분기 |
| `src/components/survey-response/question-input.tsx` | text 단답형 prefill (readonly) |
| `src/components/survey-builder/notice-question.tsx` (또는 동등 파일) | noticeContent 토큰 치환 적용 |
| `src/components/survey-builder/interactive-table-response.tsx` | text 셀 content 치환 + input 셀 prefill |
| `src/app/survey/[id]/page.tsx` (description 렌더) | description 토큰 치환 적용 (3곳) |
| `src/actions/response-actions.ts` | prefill 응답값 서버 재검증 |
| `src/components/survey-builder/question-edit-modal.tsx` | 단답형 defaultValueTemplate 입력 + table input cell defaultValueTemplate 입력 |
| `src/components/survey-builder/notice-editor.tsx` (또는 noticeContent TipTap 에디터) | mail 측 PopoverVariableMenu 부착 |
| `src/components/survey-builder/cell-content-modal.tsx` (TipTap) | PopoverVariableMenu 부착 |
| `src/components/survey-builder/survey-builder.tsx` (또는 설정 패널) | requireInviteToken 토글 + token-warning-panel 노출 |
| `src/components/operations/contacts/contact-detail-form.tsx` | CopyInviteUrlButton 추가 |

---

## Phase 1: Foundation (data + utility)

### Task 1: DB 마이그레이션 0022 추가

**Files:**
- Create: `supabase/migrations/0022_contact_attrs_token.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- Migration: 0022_contact_attrs_token
-- Purpose: 컨택 attrs 토큰 — 설문 빌더 확장
-- - surveys.require_invite_token boolean (default false) — 익명 접근 차단 토글
-- - questions.default_value_template text (nullable) — 단답형 prefill 템플릿
-- TableCell.defaultValueTemplate 은 JSONB 옵셔널 필드라 마이그레이션 불필요.

BEGIN;

ALTER TABLE "surveys"
  ADD COLUMN "require_invite_token" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "surveys"."require_invite_token" IS
  '컨택 attrs 토큰 사용 시 ?invite= 강제 여부. true면 invite 없는 접근 차단.';

ALTER TABLE "questions"
  ADD COLUMN "default_value_template" text;

COMMENT ON COLUMN "questions"."default_value_template" IS
  '단답형(text) 질문 prefill 템플릿. {{attrs_key}} 토큰 포함 가능. 응답 시점에 attrs로 치환되어 readonly 입력으로 표시.';

COMMIT;

-- ROLLBACK SQL (수동):
-- BEGIN;
-- ALTER TABLE questions DROP COLUMN IF EXISTS default_value_template;
-- ALTER TABLE surveys DROP COLUMN IF EXISTS require_invite_token;
-- COMMIT;
```

- [ ] **Step 2: 마이그레이션 적용**

Run: `pnpm db:migrate`
Expected: `0022_contact_attrs_token` 적용 완료

- [ ] **Step 3: 적용 확인**

Run: `psql $DATABASE_URL -c "\d surveys" | grep -E "require_invite_token|default_value"`
Expected: `require_invite_token | boolean | not null default false` 출력

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/0022_contact_attrs_token.sql
git commit -m "feat: 컨택 attrs 토큰 마이그레이션 0022 추가"
```

---

### Task 2: 스키마 타입 업데이트

**Files:**
- Modify: `src/db/schema/surveys.ts:42-58` (surveys), `src/db/schema/surveys.ts:80-145` (questions)
- Modify: `src/db/schema/schema-types.ts:90-130` (TableCell interface)
- Modify: `src/types/survey.ts` (Question/Survey re-export 타입 확장)

- [ ] **Step 1: surveys 테이블에 requireInviteToken 추가**

`src/db/schema/surveys.ts` 의 surveys 테이블 정의에서 `progressColumns` 다음 줄에 추가:

```ts
  // 진척률 표 표시 컬럼 픽커
  progressColumns: jsonb('progress_columns').$type<ProgressColumnScheme>(),

  // 컨택 attrs 토큰 — invite token 강제 (0022 마이그레이션)
  requireInviteToken: boolean('require_invite_token').default(false).notNull(),

  // 버전 관리
```

- [ ] **Step 2: questions 테이블에 defaultValueTemplate 추가**

`src/db/schema/surveys.ts` 의 questions 테이블 정의에서 `placeholder: text('placeholder')` 다음 줄에 추가:

```ts
  // 단답형(text) 타입용
  placeholder: text('placeholder'),

  // 단답형 prefill 템플릿 — 0022 마이그레이션. {{attrs_key}} 포함 가능.
  defaultValueTemplate: text('default_value_template'),

  // SPSS 변수명 관련
```

- [ ] **Step 3: TableCell 타입에 defaultValueTemplate 추가**

`src/db/schema/schema-types.ts` 의 `TableCell` interface 안 (placeholder 근처):

```ts
  placeholder?: string;
  inputMaxLength?: number;
  // input 셀 prefill 템플릿 — {{attrs_key}} 포함 가능.
  defaultValueTemplate?: string;
```

- [ ] **Step 4: TypeScript 컴파일 확인**

Run: `pnpm tsc --noEmit`
Expected: 0 errors (Survey/Question 타입 추론에 신규 필드 자동 반영)

- [ ] **Step 5: 빌더 zustand 스토어가 신규 필드 보존하는지 확인**

Run: `grep -n "defaultValueTemplate\|requireInviteToken" src/stores/survey-store.ts`
- 만약 explicit field copy 가 있으면 추가 (대부분 spread `...survey` 패턴이라 자동 반영)
- 없는 경우 신규 필드는 자동 통과

- [ ] **Step 6: 커밋**

```bash
git add src/db/schema/surveys.ts src/db/schema/schema-types.ts
git commit -m "feat: requireInviteToken과 defaultValueTemplate 스키마 타입 추가"
```

---

### Task 3: substituteTokens 순수 함수 + TDD

**Files:**
- Create: `src/lib/survey/substitute-tokens.ts`
- Test: `tests/unit/survey/substitute-tokens.test.ts`

- [ ] **Step 1: 테스트 디렉터리 생성 + 실패 테스트 작성**

```ts
// tests/unit/survey/substitute-tokens.test.ts
import { describe, expect, it } from 'vitest';
import { substituteTokens } from '@/lib/survey/substitute-tokens';

describe('substituteTokens', () => {
  it('단순 키 치환', () => {
    expect(substituteTokens('안녕 {{name}}', { name: '홍길동' })).toBe('안녕 홍길동');
  });

  it('한글 키 치환', () => {
    expect(substituteTokens('{{전시회명}} 안내', { 전시회명: 'AKEI 2026' })).toBe(
      'AKEI 2026 안내',
    );
  });

  it('동일 키 다회 치환', () => {
    expect(substituteTokens('{{x}} {{x}}', { x: 'A' })).toBe('A A');
  });

  it('미해결 키는 빈 문자열로', () => {
    expect(substituteTokens('A {{missing}} B', {})).toBe('A  B');
  });

  it('값이 빈 문자열이면 빈 문자열로 치환', () => {
    expect(substituteTokens('A{{x}}B', { x: '' })).toBe('AB');
  });

  it('템플릿 자체가 빈 문자열이면 빈 문자열', () => {
    expect(substituteTokens('', { x: 'A' })).toBe('');
  });

  it('attrs가 빈 객체여도 안전', () => {
    expect(substituteTokens('A{{x}}B', {})).toBe('AB');
  });

  it('키 좌우 공백 trim', () => {
    expect(substituteTokens('{{ name }}', { name: '홍길동' })).toBe('홍길동');
  });

  it('HTML 안의 토큰 치환 — 태그 깨지지 않음', () => {
    const input = '<p>전시회: <strong>{{전시회명}}</strong></p>';
    expect(substituteTokens(input, { 전시회명: 'AKEI' })).toBe(
      '<p>전시회: <strong>AKEI</strong></p>',
    );
  });

  it('치환값에 HTML 들어있어도 escape 안 함 (호출자 책임)', () => {
    expect(substituteTokens('{{x}}', { x: '<script>' })).toBe('<script>');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm vitest run tests/unit/survey/substitute-tokens.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: substituteTokens 구현**

```ts
// src/lib/survey/substitute-tokens.ts
/**
 * 템플릿 안의 {{key}} 토큰을 attrs[key] 값으로 치환.
 * 메일 시스템의 {{var}} 치환과 동일한 syntax로, 응답 페이지 본문(notice/description/table cell)과
 * 단답형 prefill 평가에 공통 사용된다.
 *
 * - 미해결 키는 빈 문자열로 치환 (메일 mode='send'와 동일 — 운영자에게 발송 결과 깨짐 방지)
 * - 키 좌우 공백 자동 trim ({{ name }} == {{name}})
 * - escape 없음 — HTML 컨텍스트에서 attrs 값에 사용자 입력이 들어갈 가능성 있으면 호출자가 sanitize
 */
export function substituteTokens(template: string, attrs: Record<string, string>): string {
  if (!template) return '';
  return template.replace(/\{\{([^}]+)\}\}/g, (_, rawKey) => {
    const key = rawKey.trim();
    return attrs[key] ?? '';
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run tests/unit/survey/substitute-tokens.test.ts`
Expected: 9 passed

- [ ] **Step 5: 커밋**

```bash
git add src/lib/survey/substitute-tokens.ts tests/unit/survey/substitute-tokens.test.ts
git commit -m "feat: substituteTokens 순수 함수 추가"
```

---

## Phase 2: 응답 페이지 attrs 인프라

### Task 4: attrs lookup server action + Context Provider

**Files:**
- Create: `src/actions/contact-attrs-actions.ts`
- Create: `src/lib/survey/contact-attrs-context.tsx`

- [ ] **Step 1: server action 작성**

```ts
// src/actions/contact-attrs-actions.ts
'use server';

import { eq, and } from 'drizzle-orm';

import { db } from '@/db';
import { contactTargets } from '@/db/schema/contacts';

/**
 * inviteToken 으로 attrs 조회. 무효 토큰이면 null 반환 (silent fallback).
 * - lookup_contact_by_invite_token RPC 와 동일한 매칭 정책 (surveyId + inviteToken)
 * - 응답 도중 새로고침 시 매번 fresh 로드 — 운영자가 attrs 수정하면 다음 진입에 반영
 */
export async function lookupContactAttrs(
  surveyId: string,
  inviteToken: string,
): Promise<Record<string, string> | null> {
  if (!inviteToken) return null;

  const [row] = await db
    .select({ attrs: contactTargets.attrs })
    .from(contactTargets)
    .where(
      and(
        eq(contactTargets.surveyId, surveyId),
        eq(contactTargets.inviteToken, inviteToken),
      ),
    )
    .limit(1);

  return row?.attrs ?? null;
}
```

- [ ] **Step 2: Context Provider 작성**

```tsx
// src/lib/survey/contact-attrs-context.tsx
'use client';

import { createContext, useContext, type ReactNode } from 'react';

const ContactAttrsContext = createContext<Record<string, string>>({});

export function ContactAttrsProvider({
  attrs,
  children,
}: {
  attrs: Record<string, string>;
  children: ReactNode;
}) {
  return (
    <ContactAttrsContext.Provider value={attrs}>{children}</ContactAttrsContext.Provider>
  );
}

/**
 * 응답 페이지 컴포넌트가 prefill/치환에 사용할 attrs.
 * Provider 밖에서 호출하면 빈 Record 반환 — 빌더 미리보기·레거시 안전.
 */
export function useContactAttrs(): Record<string, string> {
  return useContext(ContactAttrsContext);
}
```

- [ ] **Step 3: 빠른 smoke 확인 — TypeScript 컴파일**

Run: `pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: 커밋**

```bash
git add src/actions/contact-attrs-actions.ts src/lib/survey/contact-attrs-context.tsx
git commit -m "feat: 응답 페이지 attrs lookup action과 Context Provider 추가"
```

---

### Task 5: requireInviteToken 차단 화면 + 응답 페이지 분기

**Files:**
- Create: `src/components/survey-response/invite-required-screen.tsx`
- Modify: `src/app/survey/[id]/page.tsx` (97~196 — invite 처리 영역)

- [ ] **Step 1: 차단 화면 컴포넌트 작성**

```tsx
// src/components/survey-response/invite-required-screen.tsx
'use client';

import { Lock } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

export function InviteRequiredScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="mx-auto max-w-md">
        <CardContent className="p-8 text-center">
          <Lock className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            초대 링크가 필요합니다
          </h2>
          <p className="text-gray-600">
            이 설문은 초대된 응답자만 응답할 수 있습니다. 받으신 메일/메시지의 링크로
            다시 접속해주세요.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: 응답 페이지에 attrs 로드 + 차단 분기 추가**

`src/app/survey/[id]/page.tsx` 변경. 기존 `useEffect(loadSurvey, [identifier])` 안의 `setLoadedSurvey(result.survey)` 분기 다음에 attrs 로드 + requireInviteToken 검사 추가.

신규 state 선언 영역 (113번 라인 근처):

```tsx
  const [loadedSurvey, setLoadedSurvey] = useState<Survey | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // attrs 토큰 prefill — invite 매칭 시 contact_targets.attrs 로드
  const [contactAttrs, setContactAttrs] = useState<Record<string, string>>({});
  // requireInviteToken=true 설문에 invite 없이 접근 시 차단
  const [showInviteRequired, setShowInviteRequired] = useState(false);
```

`loadSurvey` 함수 안 `setLoadedSurvey(result.survey); setVersionId(...)` 직후에 추가:

```tsx
        } else {
          setLoadedSurvey(result.survey);
          setVersionId(result.versionId);

          // requireInviteToken 체크 + attrs 로드
          if (result.survey.settings.requireInviteToken && !inviteToken) {
            setShowInviteRequired(true);
          } else if (inviteToken) {
            const attrs = await lookupContactAttrs(surveyId, inviteToken);
            if (attrs) {
              setContactAttrs(attrs);
            } else if (result.survey.settings.requireInviteToken) {
              // 토큰 무효 + requireInviteToken → 차단
              setShowInviteRequired(true);
            }
            // 토큰 무효 + requireInviteToken=false → 기존 amber alert (inviteIsInvalid)
            // 만 노출. attrs 는 빈 Record 유지.
          }
        }
```

import 추가 (page.tsx 상단):

```tsx
import { lookupContactAttrs } from '@/actions/contact-attrs-actions';
import { ContactAttrsProvider } from '@/lib/survey/contact-attrs-context';
import { InviteRequiredScreen } from '@/components/survey-response/invite-required-screen';
```

- [ ] **Step 3: 차단 화면 렌더 분기 추가 (loading/error 직후)**

기존 `if (loadError || !loadedSurvey)` 블록 위에 추가:

```tsx
  // 차단 화면 — requireInviteToken=true 인데 invite 없거나 무효
  if (showInviteRequired) {
    return <InviteRequiredScreen />;
  }
```

- [ ] **Step 4: 메인 렌더를 ContactAttrsProvider 로 감싸기**

`return (<div className="min-h-screen bg-gray-50">` 의 가장 바깥을 변경:

```tsx
  return (
    <ContactAttrsProvider attrs={contactAttrs}>
      <div className="min-h-screen bg-gray-50">
        {/* ... 기존 컨텐츠 ... */}
      </div>
    </ContactAttrsProvider>
  );
```

- [ ] **Step 5: Survey 타입에 requireInviteToken 노출 확인**

Run: `grep -n "requireInviteToken" src/types/survey.ts`
- 없으면 src/types/survey.ts 의 `SurveySettings` 타입 (또는 동등)에 추가:

```ts
export interface SurveySettings {
  // ... 기존 필드 ...
  requireInviteToken?: boolean;
}
```

- [ ] **Step 6: TypeScript + lint 확인**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: 0 errors

- [ ] **Step 7: 커밋**

```bash
git add src/components/survey-response/invite-required-screen.tsx src/app/survey/[id]/page.tsx src/types/survey.ts
git commit -m "feat: requireInviteToken 차단 화면과 attrs 로드 분기 추가"
```

---

## Phase 3: 응답 페이지 토큰 치환 (display)

### Task 6: notice/description/table text 셀 토큰 치환

**Files:**
- Modify: `src/app/survey/[id]/page.tsx` (description 렌더 3곳: TableStepView 모바일/데스크톱, GroupStepItem)
- Modify: `src/components/survey-response/question-input.tsx` (NoticeQuestion 호출 — 57라인 근처)
- Modify: `src/components/survey-builder/interactive-table-response.tsx` (text 셀 content 렌더)

- [ ] **Step 1: page.tsx description 렌더 3곳에 치환 적용**

각 `dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(q.description) }}` 호출을 변경:

```tsx
// import 추가
import { useContactAttrs } from '@/lib/survey/contact-attrs-context';
import { substituteTokens } from '@/lib/survey/substitute-tokens';

// TableStepView, GroupStepItem 컴포넌트 시작부에 hook 추가
const attrs = useContactAttrs();

// description 렌더 변경 (모든 dangerouslySetInnerHTML 호출 직전)
const descriptionHtml = useMemo(
  () => sanitizeRichHtml(substituteTokens(q.description ?? '', attrs)),
  [q.description, attrs],
);

// JSX 사용
<div
  className="prose ..."
  dangerouslySetInnerHTML={{ __html: descriptionHtml }}
/>
```

3곳 모두 동일 패턴 적용:
- `TableStepView` 모바일 분기 (970번 라인 근처)
- `TableStepView` 데스크톱 분기 (1014번 라인 근처)
- `GroupStepItem` (1156번 라인 근처)

각 컴포넌트 함수 시작부에 `const attrs = useContactAttrs();` + `const descriptionHtml = useMemo(...)` 한 번씩.

- [ ] **Step 2: question-input.tsx 의 NoticeQuestion 호출 변경**

`src/components/survey-response/question-input.tsx:57` 근처:

```tsx
// 변경 전
content={question.noticeContent || ''}

// 변경 후
content={substituteTokens(question.noticeContent || '', attrs)}
```

- 컴포넌트 함수 시작부에 `const attrs = useContactAttrs();` 추가
- import 추가:

```tsx
import { useContactAttrs } from '@/lib/survey/contact-attrs-context';
import { substituteTokens } from '@/lib/survey/substitute-tokens';
```

- [ ] **Step 3: interactive-table-response.tsx text 셀 렌더 변경**

text 셀 렌더 위치를 찾는다 (cell.type === 'text' 분기):

Run: `grep -n "cell.type === 'text'\|cell\.content" src/components/survey-builder/interactive-table-response.tsx | head -10`

해당 위치의 `cell.content` 또는 `dangerouslySetInnerHTML={{ __html: cell.content }}` 같은 패턴을 다음과 같이 변경:

```tsx
// 컴포넌트 시작부
const attrs = useContactAttrs();

// 셀 content 렌더 직전 (각 셀별)
const renderedContent = substituteTokens(cell.content ?? '', attrs);

// 사용 — HTML이면 sanitize 후 dangerouslySetInnerHTML, plain text 면 그대로
```

- [ ] **Step 4: 빌더 미리보기 세이프티 — Provider 없이도 동작 확인**

`useContactAttrs()` 는 Provider 밖에서 빈 Record를 반환하므로 빌더 미리보기에서 토큰은 빈 문자열로 치환됨. 추가 작업 불필요.

- [ ] **Step 5: 수동 검증 — dev 서버에서 확인**

```bash
pnpm dev
# 브라우저에서 invite token 있는 컨택의 응답 URL 접근
# notice/description/table text 셀의 {{전시회명}} 같은 토큰이 attrs 값으로 치환되는지 확인
```

기대: 토큰 자리에 attrs 값 표시. invite 없으면 빈 자리.

- [ ] **Step 6: lint + typecheck**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: 0 errors

- [ ] **Step 7: 커밋**

```bash
git add src/app/survey/[id]/page.tsx src/components/survey-response/question-input.tsx src/components/survey-builder/interactive-table-response.tsx
git commit -m "feat: 응답 페이지 notice/description/table 셀 토큰 치환 적용"
```

---

## Phase 4: 응답 페이지 prefill (input + 보안)

### Task 7: 단답형 + table input 셀 prefill (readonly)

**Files:**
- Modify: `src/components/survey-response/question-input.tsx:68-76` (text case)
- Modify: `src/components/survey-builder/interactive-table-response.tsx` (input cell 렌더)

- [ ] **Step 1: text case 단답형 prefill 처리**

`src/components/survey-response/question-input.tsx` 의 `case 'text'` 변경 (68-76):

```tsx
case 'text': {
  const template = question.defaultValueTemplate ?? '';
  const isPrefilled = template.trim().length > 0;
  const prefilledValue = isPrefilled ? substituteTokens(template, attrs) : '';
  const inputValue = isPrefilled ? prefilledValue : (typeof value === 'string' ? value : '');

  // prefill 인 경우 mount 시 한 번만 onChange로 응답값에 주입 (수동 입력 없이도 답변으로 저장)
  useEffect(() => {
    if (isPrefilled && value !== prefilledValue) {
      onChange(prefilledValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPrefilled, prefilledValue]);

  return (
    <Input
      placeholder={question.placeholder || '답변을 입력하세요...'}
      value={inputValue}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-base"
      disabled={isPrefilled}
      data-prefilled={isPrefilled || undefined}
    />
  );
}
```

> **주의**: question-input.tsx 의 함수형 컴포넌트가 useEffect를 사용 가능한지 확인. 만약 switch가 컴포넌트 내부 직접 분기라면 OK. 외부 호출 분기 함수면 별도 컴포넌트로 분리해야 한다.
>
> 분리 필요 시: `<TextResponseInput question={...} value={...} onChange={...} attrs={attrs} />` 컴포넌트 추출.

- [ ] **Step 2: TextResponseInput 분리가 필요하면 컴포넌트 추출**

`question-input.tsx` 의 case 'text' 가 함수 본체에서 hook을 못 쓰는 구조면(렌더 함수가 아닌 헬퍼면) 신규 컴포넌트로 분리:

```tsx
// 동일 파일 하단에 추가
function TextResponseInput({
  question,
  value,
  onChange,
  attrs,
}: {
  question: Question;
  value: unknown;
  onChange: (v: unknown) => void;
  attrs: Record<string, string>;
}) {
  const template = question.defaultValueTemplate ?? '';
  const isPrefilled = template.trim().length > 0;
  const prefilledValue = isPrefilled ? substituteTokens(template, attrs) : '';
  const inputValue = isPrefilled ? prefilledValue : (typeof value === 'string' ? value : '');

  useEffect(() => {
    if (isPrefilled && value !== prefilledValue) {
      onChange(prefilledValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPrefilled, prefilledValue]);

  return (
    <Input
      placeholder={question.placeholder || '답변을 입력하세요...'}
      value={inputValue}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-base"
      disabled={isPrefilled}
      data-prefilled={isPrefilled || undefined}
    />
  );
}
```

case 'text' 에서 호출:

```tsx
case 'text':
  return <TextResponseInput question={question} value={value} onChange={onChange} attrs={attrs} />;
```

- [ ] **Step 3: table input 셀 prefill 처리**

`src/components/survey-builder/interactive-table-response.tsx` 의 input 셀 렌더 분기 (`cell.type === 'input'` 위치) 를 같은 패턴으로 변경:

```tsx
// input 셀 렌더 함수에서
const template = cell.defaultValueTemplate ?? '';
const isPrefilled = template.trim().length > 0;
const prefilledValue = isPrefilled ? substituteTokens(template, attrs) : '';
const cellValue = isPrefilled ? prefilledValue : currentValue;

useEffect(() => {
  if (isPrefilled && currentValue !== prefilledValue) {
    onCellChange(rowId, columnId, prefilledValue);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isPrefilled, prefilledValue]);

<input
  type="text"
  value={cellValue}
  onChange={(e) => onCellChange(rowId, columnId, e.target.value)}
  disabled={isPrefilled}
  className={isPrefilled ? 'bg-muted cursor-not-allowed ...' : '...'}
/>
```

> 정확한 변수명/함수명은 interactive-table-response.tsx 안의 input cell 렌더링 코드를 grep으로 찾아 일치시킬 것:
> `grep -n "cell.type === 'input'\|onCellChange\|InteractiveTableResponse" src/components/survey-builder/interactive-table-response.tsx`

- [ ] **Step 4: 수동 검증 — dev 서버**

```bash
pnpm dev
# 빌더에서 단답형 질문에 defaultValueTemplate="{{전시회명}}" 저장
# invite token 있는 컨택의 응답 URL 접근
# 단답형 입력이 disabled + 전시회명 값으로 채워져 보이는지 확인
# 응답 제출 후 분석 페이지에서 응답값에 전시회명이 들어갔는지 확인
```

- [ ] **Step 5: lint + typecheck**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: 0 errors

- [ ] **Step 6: 커밋**

```bash
git add src/components/survey-response/question-input.tsx src/components/survey-builder/interactive-table-response.tsx
git commit -m "feat: 단답형과 table input 셀 prefill 적용"
```

---

### Task 8: 응답 제출 서버 prefill 재검증

**Files:**
- Modify: `src/actions/response-actions.ts` (completeResponse 함수)

- [ ] **Step 1: completeResponse 안에 prefill 검증 로직 추가**

`src/actions/response-actions.ts` 의 `completeResponse` 함수에서 questionResponses 저장 직전에 추가:

```ts
// 의도: defaultValueTemplate 가 설정된 단답형 질문의 응답값은
// contact_targets.attrs[해당 키] 값과 일치해야 함. 클라이언트가 disabled 입력을 우회 조작하면 차단.
// 일반 질문(template 없음)은 검증 없음 — 기존 동작 유지.

const responseRow = await db
  .select({ contactTargetId: surveyResponses.contactTargetId, surveyId: surveyResponses.surveyId })
  .from(surveyResponses)
  .where(eq(surveyResponses.id, responseId))
  .limit(1);

const contactTargetId = responseRow[0]?.contactTargetId;
if (contactTargetId) {
  // attrs 로드
  const [target] = await db
    .select({ attrs: contactTargets.attrs })
    .from(contactTargets)
    .where(eq(contactTargets.id, contactTargetId))
    .limit(1);
  const attrs = target?.attrs ?? {};

  // prefill 질문 로드
  const prefillQuestions = await db
    .select({ id: questions.id, template: questions.defaultValueTemplate })
    .from(questions)
    .where(
      and(
        eq(questions.surveyId, responseRow[0].surveyId),
        isNotNull(questions.defaultValueTemplate),
      ),
    );

  // 검증 결과를 별도 객체에 누적해 input 객체 직접 mutation 회피
  const validatedResponses = { ...(input.questionResponses as Record<string, unknown>) };
  for (const q of prefillQuestions) {
    if (!q.template?.trim()) continue;
    const expected = substituteTokens(q.template, attrs);
    const submitted = validatedResponses[q.id];
    if (typeof submitted === 'string' && submitted !== expected) {
      // 조작 의심 — 서버에서 expected 값으로 강제 덮어씀 (silent — 사용자에겐 정상 동작으로 보임)
      validatedResponses[q.id] = expected;
    }
  }
  // 이후 db.update(surveyResponses).set({ questionResponses: validatedResponses, ... }) 사용
}
```

import 추가:

```ts
import { isNotNull, and, eq } from 'drizzle-orm';
import { questions } from '@/db/schema/surveys';
import { contactTargets } from '@/db/schema/contacts';
import { substituteTokens } from '@/lib/survey/substitute-tokens';
```

> 정확한 위치: `completeResponse` 함수 안에서 `db.update(surveyResponses).set({...})` 호출 직전. 함수 시그니처와 import 위치는 response-actions.ts 안의 기존 패턴 따름.

- [ ] **Step 2: 단위 테스트로 검증 동작 확인**

```ts
// tests/integration/contact-attrs-prefill-validation.test.ts
import { describe, it, expect } from 'vitest';
// 통합 테스트 — DB 필요. 기존 통합 테스트 패턴 따름 (tests/integration/unsubscribe-no-get-mutation.test.ts 참고)

describe('completeResponse prefill 재검증', () => {
  it('조작된 prefill 응답값은 attrs 기준값으로 강제 덮어씀', async () => {
    // 1. survey + question(defaultValueTemplate='{{X}}') 생성
    // 2. contact_target attrs={X: 'EXPECTED'}
    // 3. response INSERT (contactTargetId 매칭)
    // 4. completeResponse({ ..., questionResponses: { [qId]: 'TAMPERED' } })
    // 5. DB에서 questionResponses[qId] === 'EXPECTED' 확인
  });

  it('일반 질문(template 없음) 응답값은 그대로 저장', async () => {
    // template 없는 text 질문은 검증 skip
  });

  it('contactTargetId 없는 응답(익명)은 검증 skip', async () => {
    // attrs 매칭 자체가 안 되니 검증 무의미
  });
});
```

> 통합 테스트 인프라가 복잡하다면 이 task의 step 2는 skip 가능 (수동 검증으로 대체). 단, step 3 수동 검증은 필수.

- [ ] **Step 3: 수동 검증 — DevTools로 조작 시도**

```bash
pnpm dev
# 1. 빌더에서 단답형에 defaultValueTemplate='{{전시회명}}' 저장
# 2. invite token 응답 페이지 접속
# 3. DevTools console 에서 disabled 속성 제거 후 입력값 변경
# 4. 응답 제출
# 5. DB의 survey_responses.questionResponses 확인 → attrs.전시회명 값으로 저장됐어야 함
```

- [ ] **Step 4: lint + typecheck**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: 0 errors

- [ ] **Step 5: 커밋**

```bash
git add src/actions/response-actions.ts tests/integration/contact-attrs-prefill-validation.test.ts
git commit -m "feat: prefill 응답값 서버 재검증 추가"
```

---

## Phase 5: 빌더 UX

### Task 9: getVariableCatalog purpose 옵션 추가

**Files:**
- Modify: `src/components/operations/mail-template/variable-catalog.ts:17-55`

- [ ] **Step 1: 옵션 인자 추가 + system 그룹 조건부 노출**

```ts
// src/components/operations/mail-template/variable-catalog.ts 변경
export const getVariableCatalog = cache(
  async (
    surveyId: string,
    options?: { purpose?: 'mail' | 'survey' },
  ): Promise<VariableDef[]> => {
    const purpose = options?.purpose ?? 'mail';

    const system: VariableDef[] =
      purpose === 'mail'
        ? [
            {
              key: 'invite_link',
              label: '응답 페이지 링크',
              category: 'system',
              description: '컨택별 inviteToken 으로 자동 빌드',
            },
          ]
        : [];

    const survey = await getSurveyById(surveyId);
    let attrsKeys: VariableDef[] = [];
    if (survey?.contactColumns?.columns) {
      attrsKeys = survey.contactColumns.columns
        .filter((c) => c.source.startsWith('attrs.'))
        .map((c) => ({
          key: c.source.slice(6),
          label: c.label,
          category: 'attrs' as const,
        }));
    }

    if (attrsKeys.length === 0) {
      const [sample] = await db
        .select({ attrs: contactTargets.attrs })
        .from(contactTargets)
        .where(eq(contactTargets.surveyId, surveyId))
        .limit(1);
      if (sample) {
        attrsKeys = Object.keys(sample.attrs).map((k) => ({
          key: k,
          label: k,
          category: 'attrs' as const,
        }));
      }
    }

    return [...attrsKeys, ...system];
  },
);
```

- [ ] **Step 2: 호환성 확인 — 기존 mail 호출부 무영향**

Run: `grep -rn "getVariableCatalog" src/ --include="*.ts" --include="*.tsx"`

기존 두 호출부 (`new/page.tsx:12`, `[mid]/edit/page.tsx:18`) 가 `getVariableCatalog(surveyId)` 단일 인자로 호출 중. options 미지정 시 기본 'mail' → 동작 동일.

- [ ] **Step 3: TypeScript 컴파일 확인**

Run: `pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: 커밋**

```bash
git add src/components/operations/mail-template/variable-catalog.ts
git commit -m "feat: getVariableCatalog에 purpose 옵션 추가"
```

---

### Task 10: VariableButton 컴포넌트 — 단일 라인 입력용

**Files:**
- Create: `src/components/survey-builder/variable-button.tsx`

- [ ] **Step 1: VariableButton 작성**

```tsx
// src/components/survey-builder/variable-button.tsx
'use client';

import { Variable } from 'lucide-react';

import { PopoverVariableMenu } from '@/components/operations/mail-template/popover-variable-menu';
import type { VariableDef } from '@/components/operations/mail-template/variable-catalog';

/**
 * 단일 라인 input 옆에 부착하는 변수 메뉴 트리거.
 * 클릭 시 PopoverVariableMenu 가 떠서 키 선택 → 커서 위치에 {{key}} 삽입.
 *
 * - input의 selectionStart/End를 사용해 커서 위치에 삽입 (단순 append 가 아님)
 * - 컴포넌트 내부에서 PopoverVariableMenu 재사용 (메일/설문 동일 UI)
 */
interface Props {
  catalog: VariableDef[];
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  onChange: (newValue: string) => void;
}

export function VariableButton({ catalog, inputRef, onChange }: Props) {
  const insertAtCursor = (key: string) => {
    const el = inputRef.current;
    if (!el) return;
    const token = `{{${key}}}`;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    onChange(next);
    // 커서를 토큰 끝으로 이동 — 다음 tick (state 반영 후)
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return <PopoverVariableMenu catalog={catalog} onPick={insertAtCursor} />;
}
```

- [ ] **Step 2: TypeScript 컴파일 확인**

Run: `pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: 커밋**

```bash
git add src/components/survey-builder/variable-button.tsx
git commit -m "feat: VariableButton 컴포넌트 추가"
```

---

### Task 11: 단답형 + table input 셀 defaultValueTemplate 빌더 UI

**Files:**
- Modify: `src/components/survey-builder/question-edit-modal.tsx` (단답형 편집 분기)
- Modify: `src/components/survey-builder/cell-edit-modal.tsx` (또는 동등 파일 — table input 셀 편집)

- [ ] **Step 1: 단답형 편집 분기에 defaultValueTemplate 입력 추가**

`question-edit-modal.tsx` 안에서 `question.type === 'text'` 분기를 찾아(`grep -n "type === 'text'\|단답형" src/components/survey-builder/question-edit-modal.tsx`), placeholder 입력 다음에 추가:

```tsx
import { useRef } from 'react';
import { VariableButton } from './variable-button';
import type { VariableDef } from '@/components/operations/mail-template/variable-catalog';

// props에 catalog: VariableDef[] 받음 (상위에서 getVariableCatalog로 fetch)
// 또는 상위 컴포넌트에서 useEffect+useState로 fetch

const templateRef = useRef<HTMLInputElement>(null);

<div className="space-y-2">
  <Label htmlFor="defaultValueTemplate">
    응답값 prefill (선택)
    <span className="ml-1 text-xs text-gray-500">
      변수 토큰 사용 시 응답자에게 readonly로 표시됩니다
    </span>
  </Label>
  <div className="flex items-center gap-2">
    <Input
      id="defaultValueTemplate"
      ref={templateRef}
      value={question.defaultValueTemplate ?? ''}
      onChange={(e) =>
        onUpdate({ defaultValueTemplate: e.target.value || null })
      }
      placeholder="예: {{전시회명}}"
      className="flex-1"
    />
    <VariableButton
      catalog={catalog}
      inputRef={templateRef}
      onChange={(v) => onUpdate({ defaultValueTemplate: v || null })}
    />
  </div>
</div>
```

- [ ] **Step 2: 카탈로그 fetch — 모달 상위에서**

`survey-builder.tsx` 또는 `question-edit-modal.tsx` 진입 시 `getVariableCatalog(surveyId, { purpose: 'survey' })` 한 번 호출 후 prop으로 전달. 캐시되므로 매 모달 오픈마다 호출해도 OK.

```tsx
// survey-builder.tsx 같은 상위에서
const [catalog, setCatalog] = useState<VariableDef[]>([]);
useEffect(() => {
  getVariableCatalog(surveyId, { purpose: 'survey' }).then(setCatalog);
}, [surveyId]);

// QuestionEditModal에 catalog prop 전달
```

- [ ] **Step 3: table input 셀에도 동일 패턴 적용**

`cell-edit-modal.tsx` (또는 input cell 편집 UI 위치를 grep으로 찾음:
`grep -rn "cell.type === 'input'\|placeholder.*cell" src/components/survey-builder --include="*.tsx" | head -10`)
의 input 셀 편집 영역에 defaultValueTemplate 필드 추가:

```tsx
<div className="space-y-2">
  <Label>응답값 prefill (선택)</Label>
  <div className="flex items-center gap-2">
    <Input
      ref={templateRef}
      value={cell.defaultValueTemplate ?? ''}
      onChange={(e) => onCellUpdate({ defaultValueTemplate: e.target.value || undefined })}
      placeholder="예: {{전시회명}}"
      className="flex-1"
    />
    <VariableButton
      catalog={catalog}
      inputRef={templateRef}
      onChange={(v) => onCellUpdate({ defaultValueTemplate: v || undefined })}
    />
  </div>
</div>
```

- [ ] **Step 4: 빌더 dev 검증**

```bash
pnpm dev
# 빌더에서 단답형 추가 → defaultValueTemplate 옆 변수 버튼 클릭
# 카탈로그(attrs 키만) 노출 확인 → 클릭 시 input에 {{key}} 삽입
# 저장 후 다시 모달 열어 값 보존 확인
```

- [ ] **Step 5: lint + typecheck**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: 0 errors

- [ ] **Step 6: 커밋**

```bash
git add src/components/survey-builder/question-edit-modal.tsx src/components/survey-builder/cell-edit-modal.tsx src/components/survey-builder/survey-builder.tsx
git commit -m "feat: 단답형과 table input 셀 prefill 빌더 UI 추가"
```

---

### Task 12: description / notice / table cell content 빌더 변수 메뉴

**Files:**
- Modify: `src/components/survey-builder/question-edit-modal.tsx` (description 입력 — 모든 질문 공통)
- Modify: notice editor TipTap 툴바 (정확한 파일은 `grep -n "noticeContent" src/components/survey-builder` 로 확인)
- Modify: cell content TipTap 툴바 (정확한 파일은 `grep -n "TipTap\|EditorContent" src/components/survey-builder` 로 확인)

- [ ] **Step 1: description 입력 옆에 VariableButton 부착**

description 입력 (textarea 또는 contenteditable) 위치를 grep으로 찾기:

```bash
grep -n "description" src/components/survey-builder/question-edit-modal.tsx | head -10
```

textarea 라면:

```tsx
const descriptionRef = useRef<HTMLTextAreaElement>(null);

<div className="flex items-start gap-2">
  <textarea
    ref={descriptionRef}
    value={question.description ?? ''}
    onChange={(e) => onUpdate({ description: e.target.value })}
    className="flex-1 ..."
    placeholder="설명 (선택사항). {{전시회명}} 같은 변수 토큰 사용 가능."
  />
  <VariableButton
    catalog={catalog}
    inputRef={descriptionRef}
    onChange={(v) => onUpdate({ description: v })}
  />
</div>
```

만약 description이 TipTap rich text editor 라면 Step 2 패턴 사용.

- [ ] **Step 2: notice editor TipTap 에 변수 메뉴 추가**

notice TipTap 에디터 툴바에 메일 측 PopoverVariableMenu 그대로 부착:

```tsx
import { PopoverVariableMenu } from '@/components/operations/mail-template/popover-variable-menu';

// 툴바 JSX 에 추가
<PopoverVariableMenu
  catalog={catalog}
  onPick={(key) => editor.chain().focus().insertContent(`{{${key}}}`).run()}
/>
```

`mailVarTokenPlugin` 도 부착해서 amber 데코레이션 동일하게:

```tsx
import { mailVarTokenPlugin } from '@/components/operations/mail-template/mail-var-token-plugin';

const editor = useEditor({
  extensions: [
    // ... 기존 extensions
  ],
  editorProps: {
    // ...
  },
  // 또는 extensions 안의 ProseMirror plugin 추가 패턴 (메일 에디터 패턴 참고)
});
```

> 정확한 부착 방식은 메일 에디터 ([mail-template-editor.tsx](../../../src/components/operations/mail-template/mail-template-editor.tsx)) 의 plugin 등록 패턴을 그대로 mirror.

- [ ] **Step 3: table cell content TipTap 동일 처리**

cell-content-modal.tsx (또는 동등) 의 TipTap 에디터에 동일 패턴 적용.

- [ ] **Step 4: dev 검증**

```bash
pnpm dev
# 빌더에서 notice 본문에 변수 버튼 → {{전시회명}} 삽입 → amber 데코레이션 확인
# description 에서도 동일 동작 확인
# table text 셀 내부에서도 동일 동작 확인
```

- [ ] **Step 5: lint + typecheck**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: 0 errors

- [ ] **Step 6: 커밋**

```bash
git add src/components/survey-builder/
git commit -m "feat: description과 notice TipTap 에디터에 변수 메뉴 부착"
```

---

### Task 13: 토큰 검증 경고 패널 + requireInviteToken 토글

**Files:**
- Create: `src/components/survey-builder/token-warning-panel.tsx`
- Modify: `src/components/survey-builder/survey-builder.tsx` (또는 설정 패널 위치)

- [ ] **Step 1: TokenWarningPanel 작성**

```tsx
// src/components/survey-builder/token-warning-panel.tsx
'use client';

import { useMemo } from 'react';

import { AlertTriangle } from 'lucide-react';

import { extractVariableKeys } from '@/lib/mail/variable-extractor';
import type { Question } from '@/types/survey';
import type { VariableDef } from '@/components/operations/mail-template/variable-catalog';

interface Props {
  questions: Question[];
  catalog: VariableDef[];
}

/**
 * 본문에 사용된 토큰 키 중 contact_columns 카탈로그에 없는 키 경고.
 * - hard error 아님 — 발송 시 빈 문자열로 치환되므로 동작은 가능
 * - 사용자가 의도적으로 빈 값 처리할 수도 있어 발행은 차단하지 않음
 */
export function TokenWarningPanel({ questions, catalog }: Props) {
  const knownKeys = useMemo(
    () => new Set(catalog.filter((v) => v.category === 'attrs').map((v) => v.key)),
    [catalog],
  );

  const usedKeys = useMemo(() => {
    const sources: string[] = [];
    for (const q of questions) {
      if (q.description) sources.push(q.description);
      if (q.noticeContent) sources.push(q.noticeContent);
      if (q.defaultValueTemplate) sources.push(q.defaultValueTemplate);
      if (q.tableRowsData) {
        for (const row of q.tableRowsData) {
          for (const cell of row.cells) {
            if (cell.content) sources.push(cell.content);
            if (cell.defaultValueTemplate) sources.push(cell.defaultValueTemplate);
          }
        }
      }
    }
    return extractVariableKeys(...sources);
  }, [questions]);

  const unknown = usedKeys.filter((k) => !knownKeys.has(k));

  if (unknown.length === 0) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="font-medium">컨택 컬럼에 없는 토큰 {unknown.length}개</div>
        <div className="mt-1 font-mono text-xs">
          {unknown.map((k) => `{{${k}}}`).join(', ')}
        </div>
        <div className="mt-1 text-xs">발송 시 빈 값으로 치환됩니다.</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: requireInviteToken 토글 추가**

`survey-builder.tsx` (또는 설정 패널 컴포넌트) 의 설정 영역에 추가:

```tsx
import { Switch } from '@/components/ui/switch';

<div className="flex items-start justify-between gap-4 py-3">
  <div>
    <Label htmlFor="requireInviteToken" className="font-medium">
      초대 링크 필수
    </Label>
    <p className="mt-1 text-xs text-gray-500">
      켜면 ?invite= 토큰 없이는 응답할 수 없습니다. 컨택리스트로 발송한 응답만 받고 싶을 때 사용하세요.
    </p>
  </div>
  <Switch
    id="requireInviteToken"
    checked={survey.settings.requireInviteToken ?? false}
    onCheckedChange={(checked) =>
      onUpdateSettings({ requireInviteToken: checked })
    }
  />
</div>
```

- [ ] **Step 3: TokenWarningPanel을 빌더 사이드 패널 또는 설정 영역에 노출**

`survey-builder.tsx` 의 사이드 영역에 추가:

```tsx
<TokenWarningPanel questions={questions} catalog={catalog} />
```

- [ ] **Step 4: dev 검증**

```bash
pnpm dev
# 빌더에서 noticeContent에 {{알수없는키}} 입력 → 경고 패널 노출 확인
# requireInviteToken 토글 on → 저장 → invite 없는 URL로 응답 페이지 접근 → 차단 화면 확인
```

- [ ] **Step 5: lint + typecheck**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: 0 errors

- [ ] **Step 6: 커밋**

```bash
git add src/components/survey-builder/token-warning-panel.tsx src/components/survey-builder/survey-builder.tsx
git commit -m "feat: 토큰 경고 패널과 requireInviteToken 토글 추가"
```

---

## Phase 6: 운영 콘솔

### Task 14: 컨택 상세 페이지 invite URL 복사 버튼

**Files:**
- Create: `src/components/operations/contacts/copy-invite-url-button.tsx`
- Modify: `src/components/operations/contacts/contact-detail-form.tsx`

- [ ] **Step 1: CopyInviteUrlButton 작성**

```tsx
// src/components/operations/contacts/copy-invite-url-button.tsx
'use client';

import { useState } from 'react';

import { Copy, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface Props {
  surveyId: string;
  inviteToken: string;
}

export function CopyInviteUrlButton({ surveyId, inviteToken }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/survey/${surveyId}?invite=${inviteToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      // 폴백 — prompt
      window.prompt('아래 링크를 복사하세요', url);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="gap-2">
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? '복사됨' : '응답 링크 복사'}
    </Button>
  );
}
```

- [ ] **Step 2: 컨택 상세 폼에 버튼 추가**

`contact-detail-form.tsx` 의 적절한 위치(예: 컨택 정보 카드 영역)에 삽입:

```tsx
import { CopyInviteUrlButton } from './copy-invite-url-button';

// 적절한 위치 (예: 컨택 메타데이터 영역)
<CopyInviteUrlButton surveyId={surveyId} inviteToken={contact.inviteToken} />
```

- [ ] **Step 3: dev 검증**

```bash
pnpm dev
# /admin/surveys/{id}/operations/contacts/{contactId} 진입
# "응답 링크 복사" 버튼 클릭 → 클립보드에 URL 복사 확인
# 새 탭에서 paste → 응답 페이지 정상 진입 + attrs prefill 동작 확인
```

- [ ] **Step 4: lint + typecheck**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: 0 errors

- [ ] **Step 5: 커밋**

```bash
git add src/components/operations/contacts/copy-invite-url-button.tsx src/components/operations/contacts/contact-detail-form.tsx
git commit -m "feat: 컨택 상세 페이지 응답 링크 복사 버튼 추가"
```

---

## 통합 검증 (전체 플로우)

### Task 15: end-to-end 수동 검증

- [ ] **Step 1: 시나리오 검증 — 정상 흐름**

1. 빌더에서 새 설문 생성
2. 컨택리스트 → 컬럼 스킴에 "전시회명", "개최일자", "수행기관" 등록
3. 엑셀 업로드 (3개 컬럼 + email)
4. 빌더에서 notice 추가 → 본문에 "전시회: {{전시회명}}, 개최: {{개최일자}}" 입력
5. 단답형 추가 → defaultValueTemplate="{{수행기관}}"
6. 메일 템플릿 만들고 캠페인 발송
7. 받은 메일에서 invite 링크 클릭
8. 응답 페이지에서 토큰이 컨택별 값으로 치환 + 단답형이 readonly로 채워짐 확인
9. 응답 제출 → 분석 페이지에서 prefill 값이 응답값으로 보임

- [ ] **Step 2: 시나리오 검증 — 익명 차단**

1. 빌더에서 requireInviteToken 토글 on → 저장
2. invite 없이 설문 URL 직접 접근
3. "초대 링크가 필요합니다" 차단 화면 확인

- [ ] **Step 3: 시나리오 검증 — 무효 토큰**

1. requireInviteToken=true 설문에 `?invite=invalid-uuid` 접근 → 차단 화면
2. requireInviteToken=false 설문에 `?invite=invalid-uuid` 접근 → amber alert + 빈 토큰 치환

- [ ] **Step 4: 시나리오 검증 — 조작 시도**

1. invite token 응답 페이지에서 DevTools로 disabled 단답형 입력 활성화
2. 임의 값 입력 후 제출
3. DB에서 응답값이 attrs 기준값으로 강제 덮어쓰기됐는지 확인

- [ ] **Step 5: 시나리오 검증 — 빌더 미리보기**

1. 빌더 미리보기 모드 진입
2. 토큰이 빈 문자열로 치환되거나(샘플 컨택 미선택 시) 첫 컨택 attrs로 치환되는지 확인
   - 샘플 셀렉터 구현은 본 plan 범위 밖이므로 빈 문자열 동작만 확인

- [ ] **Step 6: 통합 PR 또는 배포**

```bash
# 모든 task 완료 후 한 PR로 정리
git log --oneline | head -20
gh pr create --title "feat: 컨택 attrs 토큰 설문 빌더 확장" --body "$(cat <<'EOF'
## Summary
- 메일 변수 토큰 시스템(`{{key}}`)을 설문 빌더로 확장
- 응답 페이지가 invite token으로 attrs 로드 → notice/description/table cell text 치환
- 단답형/table input 셀에 prefill (readonly) 적용
- requireInviteToken 토글로 익명 차단

## Spec
docs/superpowers/specs/2026-05-14-contact-attrs-token-design.md

## Test plan
- [ ] 빌더에서 토큰 삽입·표시·경고 동작
- [ ] 응답 페이지 prefill + readonly 동작
- [ ] requireInviteToken 차단 동작
- [ ] DevTools 조작 시도 → 서버 재검증으로 차단
- [ ] 메일 캠페인 발송 → 응답 페이지 prefill 통합 동작

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 알려진 한계 / 후속 작업

스펙의 "알려진 한계" 섹션 그대로 — 본 plan 범위 밖:
- radio/checkbox/select prefill (별도 디자인 필요)
- questions.title 토큰 적용 (의도적 제외)
- attrs 변경 audit log
- 빌더 미리보기에 샘플 컨택 셀렉터 (스펙 §빌더 UX 3.3 — 본 plan 에서는 빈 문자열 폴백만)
