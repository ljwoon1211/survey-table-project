'use client';

import { useEffect } from 'react';

import * as Sentry from '@sentry/nextjs';
import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry에 에러 전송
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <CardTitle>오류가 발생했습니다</CardTitle>
          </div>
          <CardDescription>
            예상치 못한 문제가 발생했습니다. 잠시 후 다시 시도해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
              <p className="font-mono text-sm break-all text-red-800">{error.message}</p>
              {error.digest && <p className="mt-2 text-xs text-red-600">오류 ID: {error.digest}</p>}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button onClick={reset} variant="default" className="flex-1">
            다시 시도
          </Button>
          <Button onClick={() => (window.location.href = '/')} variant="outline" className="flex-1">
            홈으로 이동
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
