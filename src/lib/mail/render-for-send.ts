import 'server-only';

import { renderMailPreview, type PreviewResult, type PreviewSample } from './render-preview';

interface Input {
  surveyId: string;
  subject: string;
  bodyHtml: string;
  fromName: string;
  /** 첫 컨택 attrs 기반 — inviteUrl 은 무시하고 sandbox 로 강제 치환. */
  sample: PreviewSample | null;
}

/**
 * 테스트 발송용 변수 치환. 미리보기와 다른 두 가지:
 *   1. mode: 'send' → missing/empty 강조 span 대신 빈 문자열로 치환.
 *   2. invite_link 는 sandbox 토큰으로 강제 치환 → 진짜 inviteToken 누출/오발송 방지.
 *      ?invite=__test__ 는 유효 token 이 아니므로 응답 페이지가 익명 폴백으로 처리.
 */
export function renderForTestSend(input: Input): PreviewResult {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
  const sandboxInvite = `${baseUrl}/survey/${input.surveyId}?invite=__test__`;

  const sandboxSample: PreviewSample = input.sample
    ? { attrs: input.sample.attrs, email: input.sample.email, inviteUrl: sandboxInvite }
    : { attrs: {}, email: null, inviteUrl: sandboxInvite };

  return renderMailPreview({
    subject: input.subject,
    bodyHtml: input.bodyHtml,
    fromName: input.fromName,
    sample: sandboxSample,
    mode: 'send',
  });
}
