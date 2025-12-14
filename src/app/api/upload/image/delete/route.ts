import { NextRequest, NextResponse } from "next/server";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Cloudflare R2는 S3 호환 API를 사용합니다
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY || "",
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY || "",
  },
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls } = body;

    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json({ error: "이미지 URL 배열이 필요합니다." }, { status: 400 });
    }

    // 환경 변수 확인
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET;
    if (!bucketName) {
      console.error("Cloudflare R2 환경 변수가 설정되지 않았습니다.");
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;
    if (!publicUrl) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const deletedUrls: string[] = [];
    const failedUrls: string[] = [];

    // 각 이미지 URL에서 파일 경로 추출 및 삭제
    for (const url of urls) {
      try {
        // R2 공개 URL인지 확인
        if (!url.includes(publicUrl)) {
          // 외부 URL이거나 우리 R2 URL이 아닌 경우 건너뛰기
          continue;
        }

        // URL에서 파일 경로 추출
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const key = pathname.startsWith("/") ? pathname.substring(1) : pathname;

        // R2에서 삭제
        const command = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        });

        await r2Client.send(command);
        deletedUrls.push(url);
      } catch (error) {
        console.error(`이미지 삭제 실패 (${url}):`, error);
        failedUrls.push(url);
      }
    }

    return NextResponse.json({
      success: true,
      deleted: deletedUrls.length,
      failed: failedUrls.length,
      deletedUrls,
      failedUrls,
    });

  } catch (error) {
    console.error("이미지 삭제 오류:", error);
    return NextResponse.json(
      { error: "이미지 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
