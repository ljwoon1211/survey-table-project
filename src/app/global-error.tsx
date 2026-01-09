"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    // Sentry에 에러 전송
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body>
        {/* `NextError`는 Next.js 기본 에러 페이지 컴포넌트입니다.
        App Router는 에러에 대한 status code를 노출하지 않으므로,
        일반적인 에러 메시지를 표시하기 위해 0을 전달합니다. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
