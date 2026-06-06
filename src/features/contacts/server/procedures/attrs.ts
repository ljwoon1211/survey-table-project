import { pub } from '@/server/orpc';

import { ContactAttrsOutput, LookupContactAttrsInput } from '../../domain/contact-attrs';
import * as svc from '../services/contact-attrs.service';

/**
 * inviteToken 으로 contact attrs 조회(pub). 익명 응답자도 호출 가능.
 * 무효 토큰이면 service 가 null 반환 — 호출부가 익명 폴백 처리.
 */
const lookup = pub
  .input(LookupContactAttrsInput)
  .output(ContactAttrsOutput)
  .handler(({ input }) => svc.lookupContactAttrs(input));

export const attrs = {
  lookup,
};
