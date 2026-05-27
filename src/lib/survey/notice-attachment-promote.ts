// 서버 전용 모듈 — 클라이언트에서 import 금지 (R2 SDK 포함)
import * as Sentry from '@sentry/nextjs';

import { deleteR2ObjectsByKey, moveR2Objects } from '@/lib/image-utils-server';
import { getR2PublicUrl } from '@/lib/r2-env';
import {
  NOTICE_ATTACHMENT_PREFIX,
  TMP_NOTICE_ATTACHMENT_PREFIX,
} from '@/lib/upload/attachment-policy';

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

const ATTACHMENT_TAG_RE = /<a\b[^>]*\bdata-file-attachment="true"[^>]*>/gi;
const DATA_KEY_ATTR_RE = /\bdata-key="([^"]+)"/i;

/**
 * HTML 안 `<a data-file-attachment="true">` 의 data-key 추출 (prefix 무관).
 * tmp/notice-attachment/ + notice-attachment/ 양쪽 모두 포함, 중복 제거.
 */
function extractAllAttachmentKeysFromHtml(html: string): string[] {
  if (!html) return [];
  const keys = new Set<string>();
  let match: RegExpExecArray | null;
  ATTACHMENT_TAG_RE.lastIndex = 0;
  while ((match = ATTACHMENT_TAG_RE.exec(html)) !== null) {
    const tag = match[0];
    const m = tag.match(DATA_KEY_ATTR_RE);
    if (m && m[1]) {
      keys.add(m[1]);
    }
  }
  return [...keys];
}

/**
 * 영구 prefix(notice-attachment/) 의 첨부 키만 추출 (tmp 제외).
 * orphan diff 비교 / deletion path R2 cleanup 용도.
 */
export function extractPermanentAttachmentKeysFromHtml(html: string): string[] {
  return extractAllAttachmentKeysFromHtml(html).filter(
    (k) =>
      k.startsWith(NOTICE_ATTACHMENT_PREFIX) &&
      !k.startsWith(TMP_NOTICE_ATTACHMENT_PREFIX),
  );
}

/**
 * 질문 배열에서 영구 첨부 키 모두 추출 (중복 제거).
 * deletion 흐름이나 orphan diff 비교용.
 */
export function extractPermanentAttachmentKeysFromQuestions(
  questions: PromotableNoticeQuestion[],
): string[] {
  const all = new Set<string>();
  for (const q of questions) {
    if (!q.noticeContent) continue;
    for (const k of extractPermanentAttachmentKeysFromHtml(q.noticeContent)) {
      all.add(k);
    }
  }
  return [...all];
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
 *
 * `options.previousQuestions` 전달 시: 이전 영구 첨부 키 중 새 publish 영구 키에
 * 없는 것은 orphan 으로 간주하고 R2 에서 DELETE. cleanup 실패는 Sentry 경고로
 * 흡수해 publish 자체는 진행.
 */
export async function promoteNoticeAttachments<T extends PromotableNoticeQuestion>(
  questions: T[],
  options?: { previousQuestions?: PromotableNoticeQuestion[] },
): Promise<T[]> {
  const allTmpUrls = new Set<string>();
  for (const q of questions) {
    for (const url of extractTmpNoticeAttachmentUrlsFromQuestion(q)) {
      allTmpUrls.add(url);
    }
  }

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

  let result = questions;

  if (pairs.length > 0) {
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

    result = questions.map((q) => replaceNoticeAttachmentUrlsInQuestion(q, mapping));
  }

  // orphan cleanup: 이전 영구 키 중 새 publish 영구 키에 없는 것 DELETE
  if (options?.previousQuestions && options.previousQuestions.length > 0) {
    const previousPermanent = new Set(
      extractPermanentAttachmentKeysFromQuestions(options.previousQuestions),
    );
    const currentPermanent = new Set(
      extractPermanentAttachmentKeysFromQuestions(result),
    );
    const orphans = [...previousPermanent].filter((k) => !currentPermanent.has(k));

    if (orphans.length > 0) {
      try {
        await deleteR2ObjectsByKey(orphans);
      } catch (err) {
        Sentry.captureMessage(
          `공지사항 첨부 orphan 영구 키 cleanup 실패: ${orphans.length}개`,
          {
            level: 'warning',
            tags: { operation: 'notice_attachment_promote', phase: 'orphan_cleanup' },
            extra: { orphans, error: String(err) },
          },
        );
      }
    }
  }

  return result;
}
