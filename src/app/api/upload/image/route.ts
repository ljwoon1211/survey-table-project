import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "파일이 제공되지 않았습니다." }, { status: 400 });
    }

    // 이미지 파일만 허용
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "지원하지 않는 파일 형식입니다. JPG, PNG, GIF, WebP, SVG만 업로드 가능합니다." },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "파일 크기는 10MB 이하여야 합니다." }, { status: 400 });
    }

    // 환경 변수 확인
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET;
    const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;

    if (!bucketName || !publicUrl) {
      console.error("Cloudflare R2 환경 변수가 설정되지 않았습니다.");
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    // 파일 이름 생성 (타임스탬프 + 랜덤 문자열)
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split(".").pop() || "jpg";
    const fileName = `images/${timestamp}-${randomString}.${fileExtension}`;

    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // R2에 업로드
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
    });

    await r2Client.send(command);

    // 공개 URL 반환
    const imageUrl = `${publicUrl}/${fileName}`;
    return NextResponse.json({ url: imageUrl });

  } catch (error) {
    console.error("이미지 업로드 오류:", error);
    return NextResponse.json(
      { error: "이미지 업로드 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
