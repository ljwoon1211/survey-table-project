import { describe, expect, it } from 'vitest';

import { renderMailPreview, type PreviewSample } from '@/lib/mail/render-preview';

const sample: PreviewSample = {
  attrs: { 수행기관: 'KOTRA', 빈값: '' },
  email: 'ljwoon94@gmail.com',
  inviteUrl: 'https://example.com/survey/abc?invite=tok-1',
};

describe('renderMailPreview - invite_link auto anchor', () => {
  it('plain text {{invite_link}} 토큰은 a 태그로 자동 변환 (send 모드)', () => {
    const out = renderMailPreview({
      subject: '제목',
      bodyHtml: '<p>아래 링크: {{invite_link}}</p>',
      fromName: 'sender',
      sample,
      mode: 'send',
    });
    expect(out.bodyHtml).toContain('<a href="https://example.com/survey/abc?invite=tok-1"');
    expect(out.bodyHtml).toContain('>https://example.com/survey/abc?invite=tok-1</a>');
  });

  it('plain text {{invite_link}} 는 preview 모드에서도 a 태그로 변환', () => {
    const out = renderMailPreview({
      subject: '제목',
      bodyHtml: '<p>링크: {{invite_link}}</p>',
      fromName: 'sender',
      sample,
      mode: 'preview',
    });
    expect(out.bodyHtml).toMatch(/<a [^>]*href="https:\/\/example\.com\/survey\/abc\?invite=tok-1"/);
  });

  it('이미 a 태그로 감싸진 {{invite_link}} 는 nested anchor 만들지 않음 (변수 메뉴 케이스)', () => {
    const html = '<p><a href="{{invite_link}}">{{invite_link}}</a></p>';
    const out = renderMailPreview({
      subject: '제목',
      bodyHtml: html,
      fromName: 'sender',
      sample,
      mode: 'send',
    });
    // anchor 두 개(여는 + 닫는)만 — nested 면 4개가 됨
    const openCount = (out.bodyHtml.match(/<a\b/g) ?? []).length;
    const closeCount = (out.bodyHtml.match(/<\/a>/g) ?? []).length;
    expect(openCount).toBe(1);
    expect(closeCount).toBe(1);
    expect(out.bodyHtml).toContain('href="https://example.com/survey/abc?invite=tok-1"');
    expect(out.bodyHtml).toContain('>https://example.com/survey/abc?invite=tok-1</a>');
  });

  it('attrs 토큰은 자동 anchor 변환하지 않음 (invite_link 만 특별 처리)', () => {
    const out = renderMailPreview({
      subject: '제목',
      bodyHtml: '<p>{{수행기관}}</p>',
      fromName: 'sender',
      sample,
      mode: 'send',
    });
    expect(out.bodyHtml).toBe('<p>KOTRA</p>');
  });

  it('missing invite_link 는 send 모드에서 빈 문자열로 치환 — anchor 만들지 않음', () => {
    const out = renderMailPreview({
      subject: '제목',
      bodyHtml: '<p>{{invite_link}}</p>',
      fromName: 'sender',
      sample: { attrs: {}, email: null, inviteUrl: null },
      mode: 'send',
    });
    expect(out.bodyHtml).toBe('<p></p>');
  });

  it('preview 모드의 missing invite_link 는 missing span 유지', () => {
    const out = renderMailPreview({
      subject: '제목',
      bodyHtml: '<p>{{invite_link}}</p>',
      fromName: 'sender',
      sample: { attrs: {}, email: null, inviteUrl: null },
      mode: 'preview',
    });
    expect(out.bodyHtml).toContain('mail-preview-missing');
    expect(out.bodyHtml).not.toContain('<a ');
  });

  it('subject/fromName 의 invite_link 는 plain text 치환 (anchor 변환 안 함)', () => {
    const out = renderMailPreview({
      subject: '[테스트] {{invite_link}}',
      bodyHtml: '<p>본문</p>',
      fromName: '{{invite_link}}',
      sample,
      mode: 'send',
    });
    expect(out.subject).toBe('[테스트] https://example.com/survey/abc?invite=tok-1');
    expect(out.fromName).toBe('https://example.com/survey/abc?invite=tok-1');
  });
});
