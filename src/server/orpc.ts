import { ORPCError, os } from '@orpc/server';

import type { ORPCContext } from './context';

/** 모든 procedure의 뿌리. 컨텍스트 타입만 박는다. */
export const base = os.$context<ORPCContext>();

/** 응답자(공개) 베이스 — 인증 불필요. */
export const pub = base;

/**
 * 관리자 베이스 — supabase 세션 필수.
 * 통과하면 context.user가 non-null로 좁혀진다.
 */
export const authed = base.use(({ context, next }) => {
  if (!context.user) {
    throw new ORPCError('UNAUTHORIZED', { message: '인증이 필요합니다.' });
  }
  return next({ context: { user: context.user } });
});
