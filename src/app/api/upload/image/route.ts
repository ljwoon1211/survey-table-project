import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

// Cloudflare R2는 S3 호환 API를 사용합니다
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY || "",
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY || "",
  },
});

// WebP로 변환할 이미지 타입 (SVG, GIF 제외 - 애니메이션/벡터 유지)
const CONVERTIBLE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/bmp"];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "파일이 제공되지 않았습니다." }, { status: 400 });
    }

    // 이미지 파일만 허용 (BMP 추가)
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "image/bmp",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "지원하지 않는 파일 형식입니다. JPG, PNG, GIF, WebP, SVG, BMP만 업로드 가능합니다." },
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

    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);
    let contentType = file.type;
    let fileExtension: string;

    // WebP로 변환 (JPEG, PNG, BMP만 - GIF/SVG는 원본 유지)
    if (CONVERTIBLE_TYPES.includes(file.type)) {
      try {
        buffer = await sharp(buffer)
          .webp({ quality: 85 })
          .toBuffer();
        contentType = "image/webp";
        fileExtension = "webp";
      } catch (conversionError) {
        console.error("WebP 변환 실패, 원본 저장:", conversionError);
        // 변환 실패 시 원본 저장
        fileExtension = file.name.split(".").pop() || "jpg";
      }
    } else {
      // GIF, SVG, WebP는 원본 유지
      fileExtension = file.name.split(".").pop() || "jpg";
    }

    // 파일 이름 생성 (타임스탬프 + 랜덤 문자열)
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileName = `images/${timestamp}-${randomString}.${fileExtension}`;

    // R2에 업로드
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
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
