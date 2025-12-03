This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 데이터베이스 설정 (Supabase + Drizzle ORM)

### 1. Supabase 프로젝트 생성

1. [Supabase](https://supabase.com)에서 새 프로젝트를 생성합니다.
2. 프로젝트 대시보드에서 **Settings > Database > Connection string**으로 이동합니다.
3. **URI** 탭에서 연결 문자열을 복사합니다.

### 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가합니다:

```env
# Supabase 연결 정보
# Transaction mode (일반 쿼리용 - port 6543)
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Session mode (마이그레이션용 - port 5432)
DATABASE_URL_DIRECT="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
```

> ⚠️ `[PASSWORD]`는 Supabase 프로젝트 생성 시 설정한 데이터베이스 비밀번호입니다.

### 3. 데이터베이스 마이그레이션

```bash
# 마이그레이션 파일 생성
pnpm db:generate

# 데이터베이스에 스키마 적용 (개발용 - 직접 push)
pnpm db:push

# 또는 마이그레이션 실행 (프로덕션용)
pnpm db:migrate

# Drizzle Studio로 데이터 확인
pnpm db:studio
```

### 4. 사용 가능한 DB 스크립트

| 명령어             | 설명                                       |
| ------------------ | ------------------------------------------ |
| `pnpm db:generate` | 스키마 변경사항으로 마이그레이션 파일 생성 |
| `pnpm db:migrate`  | 마이그레이션 실행                          |
| `pnpm db:push`     | 스키마를 DB에 직접 적용 (개발용)           |
| `pnpm db:studio`   | Drizzle Studio 실행 (DB GUI)               |

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
