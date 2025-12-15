/**
 * 이미지 최적화 유틸리티 함수
 * 브라우저에서 이미지를 리사이징하고 압축합니다.
 */

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const QUALITY = 0.85;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxFileSize?: number;
}

/**
 * 이미지 파일을 최적화합니다.
 * @param file 원본 이미지 파일
 * @param options 최적화 옵션
 * @returns 최적화된 Blob
 */
export async function optimizeImage(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<Blob> {
  const {
    maxWidth = MAX_WIDTH,
    maxHeight = MAX_HEIGHT,
    quality = QUALITY,
    maxFileSize = MAX_FILE_SIZE,
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 이미지 크기 계산
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }
        }

        // Canvas 생성 및 이미지 그리기
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Canvas context를 가져올 수 없습니다."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // WebP로 변환 시도, 실패하면 원본 형식 사용
        let mimeType = "image/jpeg";
        if (file.type === "image/png") {
          mimeType = "image/png";
        } else if (file.type === "image/webp") {
          mimeType = "image/webp";
        }

        // JPEG 품질 설정
        let outputQuality = quality;
        if (mimeType === "image/png") {
          // PNG는 quality 파라미터를 지원하지 않으므로 JPEG로 변환
          mimeType = "image/jpeg";
        }

        // Blob으로 변환
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("이미지 최적화에 실패했습니다."));
              return;
            }

            // 파일 크기가 여전히 너무 크면 품질을 낮춰서 재시도
            if (blob.size > maxFileSize && outputQuality > 0.5) {
              outputQuality = Math.max(0.5, outputQuality - 0.1);
              canvas.toBlob(
                (reducedBlob) => {
                  if (!reducedBlob) {
                    reject(new Error("이미지 최적화에 실패했습니다."));
                    return;
                  }
                  resolve(reducedBlob);
                },
                mimeType,
                outputQuality
              );
            } else {
              resolve(blob);
            }
          },
          mimeType,
          outputQuality
        );
      };

      img.onerror = () => {
        reject(new Error("이미지를 로드할 수 없습니다."));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error("파일을 읽을 수 없습니다."));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 이미지 파일 유효성 검사
 * @param file 파일 객체
 * @returns 검증 결과
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp"];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: "지원하지 않는 파일 형식입니다. JPG, PNG, GIF, WebP, SVG, BMP만 업로드 가능합니다.",
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: "파일 크기는 10MB 이하여야 합니다.",
    };
  }

  return { valid: true };
}

/**
 * 이미지 URL을 프록시 URL로 변환합니다.
 * R2 직접 URL을 숨기고 CORS 문제를 해결합니다.
 * @param imageUrl 원본 이미지 URL
 * @returns 프록시 URL 또는 원본 URL (프록시가 필요 없는 경우)
 */
export function getProxiedImageUrl(imageUrl: string | undefined | null): string {
  if (!imageUrl) {
    return "";
  }

  // 이미 프록시 URL인 경우 그대로 반환
  if (imageUrl.includes("/api/image/proxy")) {
    return imageUrl;
  }

  // R2 URL 패턴 감지 (r2.cloudflarestorage.com 포함)
  // R2 URL인 경우 프록시 URL로 변환하여 CORS 문제 해결 및 보안 강화
  const isR2Url = imageUrl.includes("r2.cloudflarestorage.com");

  if (isR2Url) {
    // URL 인코딩하여 프록시 URL 생성
    const encodedUrl = encodeURIComponent(imageUrl);
    return `/api/image/proxy?url=${encodedUrl}`;
  }

  // 외부 URL이거나 프록시가 필요 없는 경우 원본 반환
  return imageUrl;
}

/**
 * HTML 문자열 내부의 이미지 URL을 프록시 URL로 변환합니다.
 * dangerouslySetInnerHTML로 렌더링되는 HTML 내부의 이미지도 프록시를 통해 로드되도록 합니다.
 * @param html HTML 문자열
 * @returns 이미지 URL이 프록시 URL로 변환된 HTML 문자열
 */
export function convertHtmlImageUrlsToProxy(html: string): string {
  if (!html) {
    return html;
  }

  // HTML 내부의 img 태그의 src 속성을 찾아서 변환
  return html.replace(
    /<img([^>]*)\ssrc=["']([^"']+)["']([^>]*)>/gi,
    (match, before, src, after) => {
      const proxiedSrc = getProxiedImageUrl(src);
      return `<img${before} src="${proxiedSrc}"${after}>`;
    }
  );
}
