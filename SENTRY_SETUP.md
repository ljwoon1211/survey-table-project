# Sentry 설정 가이드

이 문서는 Next.js 16 App Router 프로젝트에 Sentry를 설정하는 방법을 설명합니다.

## 개요

Sentry는 프로덕션 환경에서 발생하는 에러를 실시간으로 모니터링하고 분석할 수 있게 해주는 플랫폼입니다.

## 설정 단계

### 1. Sentry 계정 및 프로젝트 생성

1. [Sentry](https://sentry.io)에 가입하거나 로그인합니다.
2. 새 프로젝트를 생성합니다.
   - 플랫폼: **Next.js** 선택
   - 프로젝트 이름 설정

### 2. DSN (Data Source Name) 확인

프로젝트를 생성한 후, Sentry 대시보드에서 DSN을 복사합니다.

```
https://[KEY]@[ORG].ingest.sentry.io/[PROJECT_ID]
```

### 3. 환경 변수 설정

#### 3-1. `.env.local` 파일 생성

프로젝트 루트 디렉토리(`/Users/ljwoon/study/next-study/survey-table-project/`)에 `.env.local` 파일을 생성합니다.

> **참고**: `.env.local` 파일은 `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다. 각 개발자가 로컬에 생성해야 합니다.

#### 3-2. 환경 변수 값 확인 및 추가

`.env.local` 파일에 다음 환경 변수를 추가합니다:

```env
# Sentry DSN (필수 - 에러 모니터링 활성화)
# Sentry 대시보드 > 프로젝트 설정 > Client Keys (DSN)에서 복사
NEXT_PUBLIC_SENTRY_DSN="https://[KEY]@[ORG].ingest.sentry.io/[PROJECT_ID]"

# Sentry 소스맵 업로드용 (선택사항)
# 프로덕션 빌드에서 소스맵을 업로드하여 더 나은 에러 스택 트레이스를 얻을 수 있습니다.

# 조직 슬러그: Sentry 대시보드 URL에서 확인
# 예: https://sentry.io/organizations/[ORG-SLUG]/projects/
SENTRY_ORG="your-org-slug"

# 프로젝트 슬러그: Sentry 대시보드 URL에서 확인
# 예: https://sentry.io/organizations/[ORG]/projects/[PROJECT-SLUG]/
SENTRY_PROJECT="your-project-slug"

# 인증 토큰: 아래 "SENTRY_AUTH_TOKEN 생성 방법" 참고
SENTRY_AUTH_TOKEN="your-auth-token"
```

#### 3-3. 각 환경 변수 값 찾는 방법

**NEXT_PUBLIC_SENTRY_DSN:**
- Sentry 대시보드 > 프로젝트 선택 > **Settings > Client Keys (DSN)**
- DSN 값 복사 (예: `https://abc123@o123456.ingest.sentry.io/789012`)

**SENTRY_ORG:**
- Sentry 대시보드 URL에서 확인
- URL 형식: `https://sentry.io/organizations/[ORG-SLUG]/`
- 예: URL이 `https://sentry.io/organizations/my-company/`라면 `my-company`가 조직 슬러그

**SENTRY_PROJECT:**
- Sentry 대시보드 URL에서 확인
- URL 형식: `https://sentry.io/organizations/[ORG]/projects/[PROJECT-SLUG]/`
- 예: URL이 `https://sentry.io/organizations/my-company/projects/my-nextjs-app/`라면 `my-nextjs-app`이 프로젝트 슬러그

**SENTRY_AUTH_TOKEN:**
- 아래 "SENTRY_AUTH_TOKEN 생성 방법" 참고

#### 3-4. SENTRY_AUTH_TOKEN 생성 방법

1. Sentry 대시보드에서 **Settings > Developer Settings > Auth Tokens**로 이동
2. **Create New Token** 클릭
3. 필요한 권한 선택:
   - `project:releases` (소스맵 업로드용)
   - `org:read` (조직 정보 읽기)
4. 토큰 생성 후 **복사** (⚠️ 한 번만 표시되므로 반드시 복사해두세요)
5. 복사한 토큰을 `.env.local` 파일의 `SENTRY_AUTH_TOKEN` 값에 붙여넣기

> **중요**: 토큰을 생성한 후에는 다시 확인할 수 없으므로, 안전한 곳에 보관하세요.

### 4. 개발 환경에서 테스트

개발 환경에서 Sentry가 정상 작동하는지 테스트합니다:

```bash
pnpm dev
```

브라우저 콘솔에서 Sentry 초기화 메시지를 확인할 수 있습니다.

### 5. 에러 테스트

의도적으로 에러를 발생시켜 Sentry 대시보드에서 수신되는지 확인합니다:

1. 개발 서버 실행 중 브라우저에서 에러 발생 페이지로 이동
2. Sentry 대시보드에서 **Issues** 탭 확인
3. 에러가 수신되었는지 확인

## 환경별 설정

### 개발 환경

개발 환경에서는 모든 에러를 캡처하고 샘플링 비율이 100%입니다. 디버깅에 유용합니다.

### 프로덕션 환경

프로덕션 환경에서는:
- 샘플링 비율이 10%로 설정되어 있습니다 (성능 영향 최소화)
- DSN이 설정되지 않은 경우 자동으로 비활성화됩니다

설정 파일에서 변경할 수 있습니다:
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`

## 소스맵 업로드 (선택사항)

프로덕션 빌드에서 더 나은 에러 스택 트레이스를 얻으려면 소스맵을 업로드할 수 있습니다.

### 소스맵 업로드 설정

1. 환경 변수 설정 (위 참고)
2. 빌드 시 자동으로 소스맵이 업로드됩니다

```bash
pnpm build
```

### 소스맵 업로드 비활성화

소스맵을 업로드하지 않으려면 환경 변수를 설정하지 않으면 됩니다. 빌드는 정상적으로 진행되지만 소스맵은 업로드되지 않습니다.

## 에러 필터링

필요한 경우 특정 에러를 무시하도록 설정할 수 있습니다:

```typescript
// sentry.client.config.ts 또는 sentry.server.config.ts
Sentry.init({
  // ...
  ignoreErrors: [
    // 무시할 에러 메시지
    "NetworkError",
    "Failed to fetch",
  ],
  beforeSend(event, hint) {
    // 커스텀 필터링 로직
    if (event.exception) {
      // 특정 조건에서 이벤트 무시
      return null;
    }
    return event;
  },
});
```

## 개인정보 보호

Sentry에 민감한 정보가 전송되지 않도록 주의하세요:

- 사용자 비밀번호
- API 키
- 개인정보 (주소, 전화번호 등)

`beforeSend` 훅을 사용하여 민감한 데이터를 필터링할 수 있습니다.

## 참고 자료

- [Sentry Next.js 공식 문서](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry DSN 설정 가이드](https://docs.sentry.io/product/sentry-basics/dsn-explainer/)
- [소스맵 업로드 가이드](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#upload-source-maps)
