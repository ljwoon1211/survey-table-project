# 조사 대상 단건 편집 — 이메일 발송 현황 + 수정/편집 현황

작성일: 2026-06-08
대상 화면: `/admin/surveys/[id]/operations/contacts/[contactId]` (조사 대상 단건 편집)

## 배경

조사 대상 단건 편집 화면 우측에는 회차 결과 카드 아래로 "이메일 발송 현황 ▾"과
"수정 / 편집 현황 ▾" 두 개의 placeholder 카드("후속 슬라이스")가 비어 있다.
이번 작업에서 두 placeholder를 실제 데이터로 채운다.

- 이메일 발송 현황: 이미 존재하는 `mail_recipients` 데이터를 표시 — 신규 저장 불필요.
- 수정 / 편집 현황: **관리자 응답 수정 audit 이력**. 현재 스키마에 편집 회차별
  audit 로그가 없어 새 테이블과 기록 로직이 필요하다.

## 결정 사항 (브레인스토밍 합의)

1. "수정 / 편집 현황" = 응답 편집 audit 이력 (단순 타임스탬프가 아닌 회차별 이력).
2. 기록 상세도 = **누가 / 언제 / 바뀐 질문**. before→after 전체 diff는 제외.
3. 저장 위치 = **별도 audit 테이블** `response_edit_logs` (metadata JSONB 누적 방식 기각).
4. 편집 범위 = **관리자 수정(`saveAdminEdit`)만**. 응답자 재제출은 제외.
5. 패널 UX = **기본 접힘, 클릭 시 펼침** (native `<details>/<summary>`).

## 핵심 한계 (사전 합의)

- audit는 **테이블 생성 이후 편집부터** 쌓인다 — 과거 편집은 소급 기록되지 않는다.
- 바뀐 질문 label은 **응답 버전 스냅샷 기준**으로 기록 시점에 스냅샷 저장한다 —
  이후 빌더에서 질문 제목을 바꿔도 기록 당시 제목이 보존된다.

## 1. 데이터 모델 — `response_edit_logs`

`survey_responses`와 1:N. 관리자 응답 수정 1회당 행 1개.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK (defaultRandom) | |
| `responseId` | uuid → `survey_responses.id` (ON DELETE CASCADE) | |
| `surveyId` | uuid → `surveys.id` | 조회·권한 필터 |
| `editedBy` | text (nullable) | 수정한 user id (`context.user.id`) |
| `editorEmail` | text (nullable) | 스냅샷 — 계정 삭제돼도 누구였는지 보존 |
| `changedQuestions` | jsonb `Array<{ questionId: string; code: string \| null; title: string }>` | 바뀐 질문 스냅샷 |
| `changedCount` | int notNull | `changedQuestions.length` (정렬/표시 편의) |
| `createdAt` | timestamptz default now() notNull | |

- 인덱스: `idx_response_edit_logs_response (response_id, created_at DESC)`.
- 순환참조 없음(`surveys`/`survey_responses`를 참조만) → Drizzle `.references()` 직접 사용 가능.
- 스키마 파일: `src/db/schema/surveys.ts`에 추가(설문 도메인). JSONB 타입은
  `schema-types.ts`에 `ResponseEditChange` 타입으로 정의 후 `.$type<...>()` 지정.
- 마이그레이션: `pnpm db:generate`로 생성해 `_journal.json`에 등록(수동 SQL silent skip 주의).

## 2. 기록 로직 — `saveAdminEdit` 확장

### `edit.ts` (procedure)
- `authed` 핸들러에서 `context.user`(id, email)를 service 호출 인자로 전달.
  현재는 `input`만 넘기므로 시그니처를 `{ input, context }` 사용으로 확장.

### `response-edit.service.ts`
- `saveAdminEdit(input, editor: { id: string | null; email: string | null })`로 확장.
- 기존 `existing.questionResponses`(JSONB)와 새 `questionResponses`를 **deep diff** →
  변경/추가/삭제된 questionId 집합 추출.
- 바뀐 questionId가 **0개면 audit 행을 만들지 않는다**(값 변화 없는 저장은 기록 제외).
- label 매핑: `existing.versionId`의 `survey_versions.snapshot`에서 questionId →
  `{ code, title }` 조회. 스냅샷에 없으면(versionId null 등) `code: null`,
  `title: questionId` 폴백.
- audit insert는 기존 응답 갱신과 **같은 트랜잭션** 안에서 수행.
- 기존 "spread 금지, 명시적 set" 패턴 유지.

### diff 유틸
- `src/lib/operations/` 또는 service 인접에 순수 함수
  `diffQuestionResponses(prev, next): string[]` (바뀐 questionId 목록) 분리 — 단위 테스트 대상.
- 값 비교는 deep-equal로 한다(questionResponses 값이 객체/배열이라 키 순서에
  의존하는 JSON.stringify 비교는 거짓 변경을 낼 수 있으므로 사용하지 않는다).

## 3. 조회 (RSC, `contacts.server.ts`)

### `getMailRecipientsForTarget(contactTargetId)`
- `mail_recipients` ⨝ `mail_campaigns`(title, runNumber), `created_at DESC`.
- 반환 행: `{ campaignTitle, runNumber, status, sentAt, deliveredAt, openedAt, bouncedAt, errorReason }`.

### `getResponseEditLogs(responseId | null)`
- `responseId`가 null이면 빈 배열 즉시 반환.
- `response_edit_logs` where responseId, `created_at DESC`.
- 반환 행: `{ id, editorEmail, changedQuestions, changedCount, createdAt }`.

### page.tsx prefetch
- `getContactDetailById` 결과의 `contact.id`/`contact.responseId`로 두 조회를 병렬 수행.
- `ContactDetailForm`에 `mailHistory`, `editLogs` prop으로 주입(lazy 불필요 — 데이터량 작음).

## 4. UI — placeholder 2개 교체

위치: `contact-detail-form.tsx`의 후속 슬라이스 placeholder 2개 블록.
신규 모드(`isEdit === false`)에서는 두 카드 모두 미표시(현 회차 카드와 동일).

### `ContactMailHistoryCard` (신규 컴포넌트)
- 헤더(`<summary>`): `이메일 발송 현황 (N건) · 최신 [status badge]`.
  발송 0건이면 `이메일 발송 현황 (0건)`만.
- 본문: 캠페인별 행 — `회차/제목`, `RecipientStatusBadge`(기존 공유 컴포넌트 재사용),
  발송/전달/열람/반송 시각. 0건이면 "발송 내역이 없습니다".

### `ContactEditHistoryCard` (신규 컴포넌트)
- 헤더(`<summary>`): `수정 / 편집 현황 (N건)`.
- 본문 행: `{editorEmail 또는 '관리자'} · {createdAt} · {바뀐 질문 요약}`.
  - 바뀐 질문 요약: 코드/제목 앞 2~3개 + "외 N개" 형태.
  - responseId 없음(미응답 대상): "매칭된 응답이 없습니다".
  - responseId 있고 0건: "수정 이력이 없습니다".
- collapsible: native `<details>/<summary>` 경량 구현 (외부 의존 없음).

## 5. 테스트

- `response-edit.service` (tests/integration, mock 패턴):
  - 관리자 수정 시 `response_edit_logs` 행 생성 + `changedQuestions` 정확성.
  - 값 변화 없는 저장 → audit 행 미생성.
- `diffQuestionResponses` 단위 테스트: 변경/추가/삭제 케이스.
- `RecipientStatusBadge`는 기존 테스트 유지(재사용).

## 영향 범위 요약

신규: 마이그레이션 1, 스키마 타입 1, 조회 함수 2, diff 유틸 1, UI 컴포넌트 2, 테스트 2.
수정: `edit.ts`(context 전달), `response-edit.service.ts`(audit 기록),
`contact-detail-form.tsx`(placeholder 교체 + prop), `[contactId]/page.tsx`(prefetch),
`schema-types.ts`(JSONB 타입), `surveys.ts`(테이블 정의).
