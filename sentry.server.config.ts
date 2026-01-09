import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Environment 설정
  environment: process.env.NODE_ENV,

  // 개인정보 보호: 민감한 데이터 필터링
  beforeSend(event, hint) {
    // 개발 환경에서는 모든 에러 캡처
    if (process.env.NODE_ENV === "development") {
      return event;
    }

    // 프로덕션 환경에서만 캡처 (DSN이 설정된 경우)
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
      return null;
    }

    return event;
  },

  // 서버 사이드 에러 필터링
  ignoreErrors: [
    // 무시할 에러 타입
  ],
});
