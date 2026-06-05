import { OpenAPIHandler } from '@orpc/openapi/fetch';

import { router } from './router';

export const openapiHandler = new OpenAPIHandler(router);

/** /api/v1 외부 노출 여부. 기본 비활성(env로만 켬). */
export function isPublicApiEnabled(): boolean {
  return process.env['ENABLE_PUBLIC_API'] === 'true';
}
