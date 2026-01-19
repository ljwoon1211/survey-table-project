import type { Question } from '@/types/survey';

/**
 * 질문에서 사용된 모든 이미지 URL을 추출합니다.
 * @param question 질문 객체
 * @returns 이미지 URL 배열
 */
export function extractImageUrlsFromQuestion(question: Question): string[] {
  const imageUrls: string[] = [];

  // 1. description에서 이미지 URL 추출 (TipTap HTML)
  if (question.description) {
    const urls = extractImageUrlsFromHtml(question.description);
    imageUrls.push(...urls);
  }

  // 2. noticeContent에서 이미지 URL 추출 (TipTap HTML)
  if (question.noticeContent) {
    const urls = extractImageUrlsFromHtml(question.noticeContent);
    imageUrls.push(...urls);
  }

  // 3. 테이블 셀에서 이미지 URL 추출
  if (question.tableRowsData) {
    for (const row of question.tableRowsData) {
      for (const cell of row.cells) {
        if (cell.imageUrl) {
          imageUrls.push(cell.imageUrl);
        }
      }
    }
  }

  // 중복 제거
  return [...new Set(imageUrls)];
}

/**
 * HTML 문자열에서 이미지 URL을 추출합니다.
 * @param html HTML 문자열
 * @returns 이미지 URL 배열 (원본 URL로 변환됨)
 */
export function extractImageUrlsFromHtml(html: string): string[] {
  const imageUrls: string[] = [];

  // img 태그에서 src 속성 추출
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const url = match[1];
    // data URL은 제외 (base64 등)
    if (url && !url.startsWith('data:')) {
      // 프록시 URL인 경우 원본 URL로 변환
      const originalUrl = extractOriginalUrlFromProxy(url);
      if (originalUrl) {
        imageUrls.push(originalUrl);
      } else {
        imageUrls.push(url);
      }
    }
  }

  return imageUrls;
}

/**
 * 설문의 모든 질문에서 사용된 이미지 URL을 추출합니다.
 * @param questions 질문 배열
 * @returns 이미지 URL 배열
 */
export function extractImageUrlsFromQuestions(questions: Question[]): string[] {
  const allImageUrls: string[] = [];

  for (const question of questions) {
    const urls = extractImageUrlsFromQuestion(question);
    allImageUrls.push(...urls);
  }

  // 중복 제거
  return [...new Set(allImageUrls)];
}

/**
 * 프록시 URL에서 원본 이미지 URL을 추출합니다.
 * @param proxyUrl 프록시 URL (예: "/api/image/proxy?url=...")
 * @returns 원본 이미지 URL 또는 null
 */
export function extractOriginalUrlFromProxy(proxyUrl: string): string | null {
  try {
    // 프록시 URL인지 확인
    if (!proxyUrl.includes('/api/image/proxy')) {
      return null;
    }

    // URL 파라미터에서 원본 URL 추출
    const urlParts = proxyUrl.split('?');
    if (urlParts.length < 2) {
      return null;
    }

    const params = new URLSearchParams(urlParts[1]);
    const originalUrl = params.get('url');

    if (originalUrl) {
      return decodeURIComponent(originalUrl);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Cloudflare R2 URL에서 파일 경로를 추출합니다.
 * @param url 이미지 URL
 * @returns 파일 경로 (예: "images/1234567890-abc123.jpg")
 */
export function extractFilePathFromR2Url(url: string): string | null {
  try {
    // URL에서 파일 경로 추출
    // 예: https://pub-xxx.r2.dev/images/1234567890-abc123.jpg
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // 맨 앞의 "/" 제거
    return pathname.startsWith('/') ? pathname.substring(1) : pathname;
  } catch {
    return null;
  }
}
