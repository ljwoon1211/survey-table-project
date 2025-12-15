import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

// Cloudflare R2는 S3 호환 API를 사용합니다
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY || "",
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY || "",
  },
});

/**
 * 이미지 프록시 API
 * R2 이미지를 인증된 요청으로 프록시하여 CORS 문제를 해결하고 보안을 강화합니다.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const imageUrl = searchParams.get("url");

    if (!imageUrl) {
      return NextResponse.json({ error: "이미지 URL이 제공되지 않았습니다." }, { status: 400 });
    }

    // R2 공개 URL인지 확인
    const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;
    if (!publicUrl) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    // 보안: 우리 R2 URL만 프록시 허용
    if (!imageUrl.startsWith(publicUrl)) {
      return NextResponse.json({ error: "허용되지 않은 이미지 URL입니다." }, { status: 403 });
    }

    // URL에서 파일 경로 추출
    // 예: https://xxx.r2.cloudflarestorage.com/images/file.webp
    // -> images/file.webp
    const urlObj = new URL(imageUrl);
    const pathname = urlObj.pathname;
    const key = pathname.startsWith("/") ? pathname.substring(1) : pathname;

    const bucketName = process.env.CLOUDFLARE_R2_BUCKET;
    if (!bucketName) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    // S3Client를 사용하여 인증된 요청으로 이미지 가져오기
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await r2Client.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "이미지를 가져올 수 없습니다." }, { status: 404 });
    }

    // 스트림을 ArrayBuffer로 변환
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    const imageBuffer = Buffer.concat(chunks);

    // Content-Type 가져오기 (기본값: image/webp)
    const contentType = response.ContentType || "image/webp";

    // 적절한 헤더와 함께 이미지 반환
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable", // 1년 캐시
        "Access-Control-Allow-Origin": "*", // CORS 허용
        "Access-Control-Allow-Methods": "GET",
      },
    });
  } catch (error) {
    console.error("이미지 프록시 오류:", error);
    return NextResponse.json(
      { error: "이미지 프록시 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

