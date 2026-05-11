// 서버 전용 모듈 — 클라이언트에서 import 금지 (R2 SDK 포함)
import { extractImageUrlsFromHtml } from '@/lib/image-extractor';
import { moveR2Objects } from '@/lib/image-utils-server';
import type { Question } from '@/types/survey';

const getPublicUrl = () => process.env.CLOUDFLARE_R2_PUBLIC_URL ?? '';

/**
 * tmp/survey/ prefix를 가진 URL인지 확인합니다.
 */
export function isTmpSurveyUrl(url: string): boolean {
  return url.startsWith(`${getPublicUrl()}/tmp/survey/`);
}

/**
 * tmp/survey/ URL을 영구 survey/ URL로 변환합니다 (단순 prefix 치환).
 */
export function tmpToPermanentUrl(url: string): string {
  const publicUrl = getPublicUrl();
  return url.replace(`${publicUrl}/tmp/survey/`, `${publicUrl}/survey/`);
}

/**
 * URL에서 R2 key를 추출합니다 (pathname, leading slash 제거).
 */
export function urlToR2Key(url: string): string | null {
  try {
    const u = new URL(url);
    return u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
  } catch {
    return null;
  }
}

/**
 * 단일 질문에서 tmp/survey/ URL을 모두 추출합니다.
 * - description (TipTap HTML)
 * - noticeContent (TipTap HTML)
 * - tableRowsData[].cells[].imageUrl (직접 URL 필드)
 */
export function extractTmpSurveyUrlsFromQuestion(question: Question): string[] {
  const urls: string[] = [];

  if (question.description) {
    urls.push(...extractImageUrlsFromHtml(question.description).filter(isTmpSurveyUrl));
  }
  if (question.noticeContent) {
    urls.push(...extractImageUrlsFromHtml(question.noticeContent).filter(isTmpSurveyUrl));
  }
  if (question.tableRowsData) {
    for (const row of question.tableRowsData) {
      for (const cell of row.cells) {
        if (cell.imageUrl && isTmpSurveyUrl(cell.imageUrl)) {
          urls.push(cell.imageUrl);
        }
      }
    }
  }

  return [...new Set(urls)];
}

/**
 * 질문 객체 안의 모든 tmp/survey/ URL을 영구 URL로 in-place 치환합니다.
 * mapping에 없는 URL은 그대로 유지됩니다.
 */
export function replaceUrlsInQuestion(
  question: Question,
  mapping: Map<string, string>,
): Question {
  if (mapping.size === 0) return question;

  const replaceText = (text: string): string => {
    let updated = text;
    for (const [tmp, perm] of mapping) {
      updated = updated.split(tmp).join(perm);
    }
    return updated;
  };

  return {
    ...question,
    description: question.description ? replaceText(question.description) : question.description,
    noticeContent: question.noticeContent
      ? replaceText(question.noticeContent)
      : question.noticeContent,
    tableRowsData: question.tableRowsData?.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => ({
        ...cell,
        imageUrl:
          cell.imageUrl && mapping.has(cell.imageUrl)
            ? mapping.get(cell.imageUrl)!
            : cell.imageUrl,
      })),
    })),
  };
}

/**
 * 질문 배열 전체의 tmp/survey/ 이미지를 영구 prefix로 promote합니다.
 *
 * 1. 모든 질문에서 tmp/survey/ URL 수집
 * 2. R2 COPY tmp/survey/X → survey/X + DELETE tmp/survey/X
 * 3. 성공한 URL만 질문 배열 내 URL 치환 (description / noticeContent / cell.imageUrl)
 *
 * 실패한 move는 tmp URL 그대로 남음 → Cloudflare 24h lifecycle이 처리.
 *
 * @returns URL이 치환된 questions 배열
 */
export async function promoteSurveyImages(questions: Question[]): Promise<Question[]> {
  // 1. 모든 tmp URL 수집
  const allTmpUrls = new Set<string>();
  for (const q of questions) {
    for (const url of extractTmpSurveyUrlsFromQuestion(q)) {
      allTmpUrls.add(url);
    }
  }
  if (allTmpUrls.size === 0) return questions;

  // 2. R2 move pairs 구성
  const pairs = [...allTmpUrls]
    .map((url) => {
      const srcKey = urlToR2Key(url);
      if (!srcKey || !srcKey.startsWith('tmp/survey/')) return null;
      const dstKey = srcKey.replace('tmp/survey/', 'survey/');
      return { srcKey, dstKey, srcUrl: url };
    })
    .filter(
      (p): p is { srcKey: string; dstKey: string; srcUrl: string } => p !== null,
    );

  if (pairs.length === 0) return questions;

  // 3. R2 move 실행
  const { movedKeys } = await moveR2Objects(
    pairs.map(({ srcKey, dstKey }) => ({ srcKey, dstKey })),
  );

  // 4. 성공한 URL만 mapping 구성
  const movedSrcKeys = new Set(movedKeys.map((m) => m.srcKey));
  const publicUrl = getPublicUrl();
  const mapping = new Map<string, string>();
  for (const { srcKey, srcUrl } of pairs) {
    if (movedSrcKeys.has(srcKey)) {
      const dstKey = srcKey.replace('tmp/survey/', 'survey/');
      const dstUrl = `${publicUrl}/${dstKey}`;
      mapping.set(srcUrl, dstUrl);
    }
  }

  // 5. 질문 배열 전체에서 URL 치환
  return questions.map((q) => replaceUrlsInQuestion(q, mapping));
}
