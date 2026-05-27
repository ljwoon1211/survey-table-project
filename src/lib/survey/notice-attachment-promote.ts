// 서버 전용 모듈 — 클라이언트에서 import 금지 (R2 SDK 포함)
import * as Sentry from '@sentry/nextjs';

import { getR2PublicUrl } from '@/lib/r2-env';
import {
  NOTICE_ATTACHMENT_PREFIX,
  TMP_NOTICE_ATTACHMENT_PREFIX,
} from '@/lib/upload/attachment-policy';

// moveR2Objects 는 promoteNoticeAttachments 안에서 lazy import.
// (테스트가 vi.doMock 으로 모킹 후 동적 import 하는 패턴을 지원.)

export type PromotableNoticeQuestion = {
  type?: string;
  noticeContent?: string | null;
};

export function isTmpNoticeAttachmentUrl(url: string): boolean {
  return url.startsWith(`${getR2PublicUrl()}/${TMP_NOTICE_ATTACHMENT_PREFIX}`);
}

export function noticeAttachmentTmpToPermanentUrl(url: string): string {
  const publicUrl = getR2PublicUrl();
  return url.replace(
    `${publicUrl}/${TMP_NOTICE_ATTACHMENT_PREFIX}`,
    `${publicUrl}/${NOTICE_ATTACHMENT_PREFIX}`,
  );
}

export function urlToR2Key(url: string): string | null {
  try {
    const u = new URL(url);
    return u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
  } catch {
    return null;
  }
}

/**
 * HTML 안의 `<a data-file-attachment="true">` href 중 tmp/notice-attachment/ prefix 만 추출.
 * 중복 제거된 배열 반환.
 */
export function extractTmpNoticeAttachmentUrlsFromHtml(html: string): string[] {
  if (!html) return [];
  const re = /<a\b[^>]*\bdata-file-attachment="true"[^>]*>/gi;
  const urls = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const tag = match[0];
    const hrefMatch = tag.match(/\bhref="([^"]+)"/i);
    if (!hrefMatch) continue;
    const url = hrefMatch[1];
    if (isTmpNoticeAttachmentUrl(url)) {
      urls.add(url);
    }
  }
  return [...urls];
}

/**
 * 질문 안 모든 noticeContent 의 tmp 첨부 URL 추출 (중복 제거).
 */
export function extractTmpNoticeAttachmentUrlsFromQuestion(
  question: PromotableNoticeQuestion,
): string[] {
  if (!question.noticeContent) return [];
  return extractTmpNoticeAttachmentUrlsFromHtml(question.noticeContent);
}

/**
 * noticeContent HTML 안의 URL 을 mapping 으로 치환. mapping 없는 URL 은 유지.
 * mapping 비어있으면 same reference 반환 (참조 동등성 보존).
 *
 * URL 치환 후 동일 split/join 패스로 `data-key` 의 R2 key 부분 문자열도 함께 변환.
 * (TipTap FileAttachment 의 `data-key` 는 URL 의 pathname 과 1:1 매칭이라 안전.)
 */
export function replaceNoticeAttachmentUrlsInQuestion<
  T extends PromotableNoticeQuestion,
>(question: T, mapping: Map<string, string>): T {
  if (mapping.size === 0) return question;
  if (!question.noticeContent) return question;

  let updated = question.noticeContent;
  for (const [tmp, perm] of mapping) {
    updated = updated.split(tmp).join(perm);
    const tmpKey = urlToR2Key(tmp);
    const permKey = urlToR2Key(perm);
    if (tmpKey && permKey && tmpKey !== permKey) {
      updated = updated.split(tmpKey).join(permKey);
    }
  }
  return { ...question, noticeContent: updated };
}

/**
 * 질문 배열 안 모든 tmp/notice-attachment/ URL 을 영구 prefix 로 promote.
 * survey-image-promote.ts 와 동일 패턴 (R2 move + URL split/join 치환).
 *
 * 실패한 move 는 tmp URL 그대로 — Cloudflare 24h lifecycle 가 청소.
 */
export async function promoteNoticeAttachments<T extends PromotableNoticeQuestion>(
  questions: T[],
): Promise<T[]> {
  const allTmpUrls = new Set<string>();
  for (const q of questions) {
    for (const url of extractTmpNoticeAttachmentUrlsFromQuestion(q)) {
      allTmpUrls.add(url);
    }
  }
  if (allTmpUrls.size === 0) return questions;

  const pairs = [...allTmpUrls]
    .map((url) => {
      const srcKey = urlToR2Key(url);
      if (!srcKey || !srcKey.startsWith(TMP_NOTICE_ATTACHMENT_PREFIX)) return null;
      const dstKey = srcKey.replace(
        TMP_NOTICE_ATTACHMENT_PREFIX,
        NOTICE_ATTACHMENT_PREFIX,
      );
      return { srcKey, dstKey, srcUrl: url };
    })
    .filter(
      (p): p is { srcKey: string; dstKey: string; srcUrl: string } => p !== null,
    );

  if (pairs.length === 0) return questions;

  const { moveR2Objects } = await import('@/lib/image-utils-server');
  const { movedKeys, failed } = await moveR2Objects(
    pairs.map(({ srcKey, dstKey }) => ({ srcKey, dstKey })),
  );

  if (failed.length > 0) {
    Sentry.captureMessage(
      `공지사항 첨부 promote 부분 실패: ${failed.length}개 객체가 tmp 에 잔존`,
      {
        level: 'warning',
        tags: { operation: 'notice_attachment_promote' },
        extra: { failedKeys: failed },
      },
    );
  }

  const movedSrcKeys = new Set(movedKeys.map((m) => m.srcKey));
  const publicUrl = getR2PublicUrl();
  const mapping = new Map<string, string>();
  for (const { srcKey, srcUrl } of pairs) {
    if (movedSrcKeys.has(srcKey)) {
      const dstKey = srcKey.replace(
        TMP_NOTICE_ATTACHMENT_PREFIX,
        NOTICE_ATTACHMENT_PREFIX,
      );
      mapping.set(srcUrl, `${publicUrl}/${dstKey}`);
    }
  }

  return questions.map((q) => replaceNoticeAttachmentUrlsInQuestion(q, mapping));
}
