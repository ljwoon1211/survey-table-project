# Survey Table Project - Claude 참조 문서

## 프로젝트 개요

Next.js 15 기반의 고급 설문조사 빌더 플랫폼. 복잡한 질문 유형, 조건부 로직, 분석 기능을 갖춘 엔터프라이즈급 애플리케이션.

---

## 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Next.js (App Router) | 16.0.7 |
| UI 라이브러리 | React | 19.2.1 |
| 스타일링 | TailwindCSS | 4.0.0 |
| 컴포넌트 | shadcn/ui (Radix UI) | - |
| 상태관리 | Zustand | 5.0.8 |
| 데이터 페칭 | TanStack Query | 5.90.11 |
| 폼 관리 | React Hook Form + Zod | 7.63.0 |
| 테이블 | TanStack Table | 8.21.3 |
| 리치 에디터 | TipTap | 3.13.0 |
| 드래그앤드롭 | @dnd-kit | - |
| ORM | Drizzle ORM | 0.44.7 |
| 데이터베이스 | PostgreSQL (Supabase) | - |
| 파일 저장소 | Cloudflare R2 (S3 호환) | - |
| 언어 | TypeScript (strict) | 5.9.3 |

---

## 프로젝트 구조

```
src/
├── app/                        # Next.js App Router
│   ├── admin/                  # 관리자 인터페이스
│   │   ├── surveys/            # 설문 목록 및 편집
│   │   │   └── [id]/
│   │   │       ├── edit/       # 설문 편집 페이지
│   │   │       └── analytics/  # 설문별 분석
│   │   ├── login/              # 로그인
│   │   └── profile/            # 프로필
│   ├── api/                    # API 라우트
│   │   └── upload/image/       # 이미지 업로드/삭제
│   ├── survey/[id]/            # 공개 설문 응답 페이지
│   ├── create/                 # 설문 생성 페이지
│   └── analytics/              # 분석 대시보드
│
├── components/                 # React 컴포넌트 (116개)
│   ├── survey-builder/         # 설문 생성 컴포넌트 (22개)
│   │   ├── survey-builder.tsx          # 메인 빌더 컨테이너
│   │   ├── sortable-question-list.tsx  # 드래그앤드롭 질문 목록
│   │   ├── question-edit-modal.tsx     # 질문 편집 모달
│   │   ├── group-manager.tsx           # 그룹 관리
│   │   ├── dynamic-table-editor.tsx    # 테이블 질문 에디터
│   │   ├── multi-level-select.tsx      # 다단계 선택
│   │   ├── branch-rule-editor.tsx      # 분기 규칙
│   │   ├── table-validation-editor.tsx # 테이블 검증
│   │   ├── question-condition-editor.tsx # 조건부 표시
│   │   ├── question-library-panel.tsx  # 질문 라이브러리
│   │   └── ...
│   ├── survey-analytics/       # 분석 시각화
│   ├── analytics/              # 차트 및 리포팅
│   ├── ui/                     # shadcn/ui 기반 컴포넌트 (18개)
│   └── providers/              # Context providers
│
├── stores/                     # Zustand 스토어 (5개)
│   ├── survey-store.ts         # 메인 설문 빌더 상태
│   ├── survey-response-store.ts # 테스트/미리보기 응답
│   ├── survey-list-store.ts    # 설문 목록 관리
│   ├── question-library-store.ts # 질문 라이브러리
│   └── index.ts
│
├── hooks/                      # 커스텀 훅 (7개)
│   ├── use-survey-sync.ts      # 설문 데이터 동기화
│   ├── use-library-sync.ts     # 라이브러리 동기화
│   └── ...
│
├── lib/                        # 유틸리티
│   ├── supabase/               # Supabase 클라이언트
│   │   ├── client.ts           # 클라이언트 사이드
│   │   ├── server.ts           # 서버 사이드
│   │   └── middleware.ts       # 인증 미들웨어
│   ├── analytics/              # 분석 로직
│   │   ├── analyzer.ts         # 통계 계산
│   │   ├── cross-tab.ts        # 교차 분석
│   │   ├── filter.ts           # 응답 필터링
│   │   └── types.ts            # 분석 타입
│   ├── s3-client.ts            # Cloudflare R2 클라이언트
│   └── utils.ts                # 공통 유틸리티 (cn())
│
├── utils/                      # 추가 유틸리티
│   ├── survey-url.ts           # URL 생성
│   ├── image-utils.ts          # 이미지 처리
│   ├── image-extractor.ts      # HTML 이미지 추출
│   └── branch-logic.ts         # 분기 로직 평가
│
├── db/schema/                  # Drizzle ORM 스키마
│   ├── index.ts                # 스키마 내보내기
│   └── surveys.ts              # 설문 관련 테이블
│
└── types/                      # TypeScript 타입 정의
    └── survey.ts               # 설문 관련 타입
```

---

## 데이터베이스 스키마

### 테이블 구조

```
surveys                    # 설문 설정
├── id (UUID)
├── title, description
├── slug                   # URL 슬러그
├── privateToken           # 비공개 접근 토큰
├── settings               # isPublic, allowMultipleResponses, etc.
├── endDate, maxResponses
├── thankYouMessage
└── createdAt, updatedAt

question_groups            # 질문 그룹 (계층 구조)
├── id (UUID)
├── surveyId (FK → surveys)
├── parentGroupId (FK → question_groups, nullable)
├── name, description
├── order, color, collapsed
└── createdAt, updatedAt

questions                  # 개별 질문
├── id (UUID)
├── surveyId (FK → surveys)
├── groupId (FK → question_groups, nullable)
├── type                   # text|textarea|radio|checkbox|select|multiselect|table|notice
├── title, description
├── required, order
├── options (JSONB)        # QuestionOption[]
├── selectLevels (JSONB)   # SelectLevel[] (다단계 선택)
├── tableColumns (JSONB)   # 테이블 열 정의
├── tableRowsData (JSONB)  # 테이블 행 데이터
├── tableValidationRules (JSONB)
├── displayCondition (JSONB) # 조건부 표시
├── imageUrl, videoUrl
├── allowOtherOption
├── noticeContent, requiresAcknowledgment
└── createdAt, updatedAt

survey_responses           # 수집된 응답
├── id (UUID)
├── surveyId (FK → surveys)
├── questionResponses (JSONB)
├── isCompleted
├── startedAt, completedAt
├── userAgent, ipAddress, sessionId
└── createdAt

saved_questions            # 질문 라이브러리
├── id (UUID)
├── questionData (JSONB)   # 전체 질문 설정
├── name, description
├── category               # demographics|satisfaction|nps|feedback|preference|custom
├── tags, usageCount
├── isPreset
└── createdAt, updatedAt

question_categories        # 질문 카테고리
├── id (UUID)
├── name, color, icon, order
└── createdAt
```

### 관계도

```
surveys (1) ─────────┬───── (N) question_groups
                     │              │
                     │              └── parentGroupId (self-reference)
                     │
                     ├───── (N) questions
                     │              │
                     │              └── groupId (optional)
                     │
                     └───── (N) survey_responses

saved_questions (standalone)
question_categories (standalone)
```

---

## 질문 유형

| 타입 | 설명 | 주요 속성 |
|------|------|----------|
| `text` | 단답형 텍스트 | - |
| `textarea` | 장문형 텍스트 | - |
| `radio` | 단일 선택 | options, allowOtherOption |
| `checkbox` | 복수 선택 | options, allowOtherOption |
| `select` | 드롭다운 단일 선택 | options, selectLevels (다단계) |
| `multiselect` | 드롭다운 복수 선택 | options |
| `table` | 매트릭스/그리드 | tableColumns, tableRowsData, tableValidationRules |
| `notice` | 안내문 | noticeContent, requiresAcknowledgment |

### 테이블 질문 셀 타입

- `text`: 텍스트 표시
- `image`: 이미지 표시
- `video`: 비디오 링크
- `checkbox`: 체크박스 입력
- `radio`: 라디오 버튼 입력
- `select`: 드롭다운 입력
- `input`: 텍스트 입력

### 테이블 검증 규칙

- `exclusive-check`: 배타적 선택 (하나만 체크 가능)
- `required-combination`: 필수 조합
- `any-of`: 최소 하나 선택
- `all-of`: 모두 선택 필요
- `none-of`: 선택 불가

---

## 주요 컴포넌트

### 설문 빌더

```typescript
// 메인 빌더 컨테이너
SurveyBuilder
├── SortableQuestionList     // 드래그앤드롭 질문 목록
├── GroupManager             // 그룹 관리 (계층 구조, 팝오버 메뉴)
├── QuestionEditModal        // 질문 편집 모달
│   ├── MultiLevelSelect     // 다단계 선택 설정
│   ├── DynamicTableEditor   // 테이블 질문 에디터
│   ├── NoticeEditor         // 안내문 에디터
│   ├── BranchRuleEditor     // 분기 규칙 설정
│   ├── TableValidationEditor // 테이블 검증 규칙
│   └── QuestionConditionEditor // 조건부 표시 설정
├── QuestionLibraryPanel     // 질문 라이브러리
├── SaveQuestionModal        // 라이브러리에 저장
└── CellContentModal         // 테이블 셀 편집
```

### 설문 응답

```typescript
// 응답 페이지
SurveyResponsePage
├── InteractiveTableResponse // 테이블 응답 입력
├── RadioResponse            // 라디오 응답
├── CheckboxResponse         // 체크박스 응답
├── SelectResponse           // 드롭다운 응답
└── TextResponse             // 텍스트 응답
```

---

## Zustand 스토어

### survey-store.ts

```typescript
interface SurveyStore {
  // 설문 데이터
  survey: Survey | null;
  questions: Question[];
  groups: QuestionGroup[];

  // UI 상태
  selectedQuestionId: string | null;
  isPreviewMode: boolean;
  isTestMode: boolean;

  // 액션
  setSurvey: (survey: Survey) => void;
  addQuestion: (question: Question) => void;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  deleteQuestion: (id: string) => void;
  reorderQuestions: (startIndex: number, endIndex: number) => void;

  // 그룹 관리
  addGroup: (group: QuestionGroup) => void;
  updateGroup: (id: string, updates: Partial<QuestionGroup>) => void;
  deleteGroup: (id: string) => void;
}
```

### question-library-store.ts

```typescript
interface QuestionLibraryStore {
  savedQuestions: SavedQuestion[];
  categories: QuestionCategory[];

  saveQuestion: (question: Question, metadata: SavedQuestionMetadata) => void;
  loadQuestion: (id: string) => Question;
  deleteQuestion: (id: string) => void;
}
```

---

## API 엔드포인트

### 이미지 업로드

```typescript
// POST /api/upload/image
// Request: FormData { file: File }
// Response: { url: string }
// 지원 형식: JPG, PNG, GIF, WebP, SVG
// 최대 크기: 10MB

// DELETE /api/upload/image/delete
// Request: { url: string }
// Response: { success: boolean }
```

---

## 개발 스크립트

```bash
pnpm dev              # 개발 서버 (Turbopack)
pnpm build            # 프로덕션 빌드
pnpm start            # 프로덕션 서버
pnpm lint             # ESLint 검사
pnpm db:generate      # 마이그레이션 생성
pnpm db:migrate       # 마이그레이션 실행
pnpm db:push          # 스키마 푸시
pnpm db:studio        # Drizzle Studio
```

---

## 주요 경로 별칭

```typescript
// tsconfig.json
"@/*" → "./src/*"

// 사용 예시
import { cn } from "@/lib/utils";
import { useSurveyStore } from "@/stores/survey-store";
import { Button } from "@/components/ui/button";
```

---

## 환경 변수

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

---

## 코드 컨벤션

### 파일 명명

- 컴포넌트: `kebab-case.tsx` (예: `question-edit-modal.tsx`)
- 스토어: `kebab-case.ts` (예: `survey-store.ts`)
- 유틸리티: `kebab-case.ts` (예: `branch-logic.ts`)
- 타입: `kebab-case.ts` (예: `survey.ts`)

### 컴포넌트 구조

```typescript
// 1. 임포트
import { useState } from "react";
import { useSurveyStore } from "@/stores/survey-store";
import { Button } from "@/components/ui/button";

// 2. 타입 정의
interface Props {
  questionId: string;
  onSave: (data: QuestionData) => void;
}

// 3. 컴포넌트
export function QuestionEditor({ questionId, onSave }: Props) {
  // hooks
  const { questions, updateQuestion } = useSurveyStore();
  const [isEditing, setIsEditing] = useState(false);

  // handlers
  const handleSave = () => {
    // ...
  };

  // render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

---

## 주의사항

1. **타입 안전성**: Drizzle ORM과 TypeScript strict 모드 사용. JSONB 컬럼에도 타입 주석 적용.

2. **상태 관리**: Zustand 스토어와 TanStack Query를 함께 사용. 서버 상태는 Query, 클라이언트 상태는 Zustand.

3. **이미지 업로드**: Cloudflare R2 사용. 파일 타입 및 크기 검증 필수.

4. **조건부 로직**: `displayCondition`과 `branchRules`는 JSONB로 저장. `branch-logic.ts` 유틸리티로 평가.

5. **테이블 질문**: 복잡한 구조. `tableColumns`, `tableRowsData`, `tableValidationRules` 3개 JSONB 필드 사용.

6. **다단계 선택**: `selectLevels` 배열로 3단계까지 지원. 각 레벨은 부모 선택에 따라 동적 로딩.
