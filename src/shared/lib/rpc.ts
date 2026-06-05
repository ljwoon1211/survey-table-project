import type { RouterClient } from '@orpc/server';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';

import type { router } from '@/server/router';

const link = new RPCLink({
  url: () => {
    if (typeof window === 'undefined') {
      throw new Error(
        'RPCLink는 클라이언트 전용입니다. RSC는 server/client.ts의 $client를 씁니다.',
      );
    }
    return `${window.location.origin}/api/rpc`;
  },
});

/**
 * isomorphic 클라이언트.
 * - 서버(RSC): globalThis.$client(createRouterClient) 사용 -> HTTP 없음
 * - 브라우저: RPCLink로 /api/rpc 호출
 */
export const client: RouterClient<typeof router> =
  (globalThis.$client as RouterClient<typeof router> | undefined) ??
  createORPCClient(link);

/** TanStack Query 통합: orpc.health.check.queryOptions() 등 */
export const orpc = createTanstackQueryUtils(client);
