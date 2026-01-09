import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Enable Session Replay (optional)
  integrations: [
    // Sentry.replayIntegration()를 활성화하려면 주석 해제
    // Sentry.replayIntegration({
    //   maskAllText: true,
    //   blockAllMedia: true,
    // }),
  ],

  // Session Replay 샘플링 비율 (위에서 활성화한 경우)
  // replaysSessionSampleRate: 0.1,
  // replaysOnErrorSampleRate: 1.0,

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

  // 브라우저 전용 설정
  ignoreErrors: [
    // 브라우저 확장 프로그램 에러 무시
    "top.GLOBALS",
    "originalCreateNotification",
    "canvas.contentDocument",
    "MyApp_RemoveAllHighlights",
    "atomicFindClose",
    // 네트워크 에러 중 일부 무시
    "NetworkError",
    "Failed to fetch",
  ],
});
