# 공지사항 파일 첨부 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공지사항(`question.type === 'notice'`) 본문 안에 PDF/HWP/Office 파일을 inline 노드로 박아 응답자가 다운로드받을 수 있게 한다.

**Architecture:** 메일 첨부 시스템(`/api/upload/mail-attachment`)을 mirror — `tmp/notice-attachment/` 임시 prefix + R2 24h lifecycle + publish 시 영구 prefix promote. TipTap inline atom 노드(`fileAttachment`)로 RichTextEditor 안에 박히고, 빌더는 색 아이콘 NodeView, 응답 페이지는 CSS data URI 클립 아이콘. 공유 검증 로직(`ALLOWED_MIME`/`EXT_TO_MIME`/`SAFE_FILENAME_RE` 등)은 신규 `@/lib/upload/attachment-policy.ts`로 추출해 mail-attachment 라우트와 공유.

**Tech Stack:** Next.js 16 App Router, TipTap 3, @aws-sdk/client-s3 (R2), DOMPurify, vitest, Drizzle ORM, TanStack Query, React 19, TailwindCSS 4.

**Spec:** [`docs/superpowers/specs/2026-05-26-notice-file-attachment-design.md`](../specs/2026-05-26-notice-file-attachment-design.md)

---

## 작업 전 사전 점검

- 현재 브랜치 확인: 반드시 `feat/notice-file-attachment` 신규 브랜치에서 작업. main에서 작업 금지.
- 메모리 룰 준수: `feedback_no_worktree.md` (worktree 사용 금지, feature branch만), `feedback_git_commit_korean.md` (`feat: ...` 한국어, () 괄호 없이), `feedback_no_emoji_in_code.md` (코드/주석/UI 텍스트 이모지 금지)
- 빌드 검증 명령: `pnpm tsc --noEmit` + `pnpm vitest run <path>` + `pnpm build` (lint 인프라 깨짐 — `feedback_lint_infra_broken.md`)

```bash
git checkout main
git pull
git checkout -b feat/notice-file-attachment
```

---

## File Structure

**신규 파일 (10개)**
- `src/lib/upload/attachment-policy.ts` — 공유 상수 + 검증 함수
- `src/app/api/upload/notice-attachment/route.ts` — POST/DELETE 라우트
- `src/lib/survey/notice-attachment-promote.ts` — publish 시 tmp → 영구 변환
- `src/components/ui/rich-text-editor/file-attachment-node.ts` — TipTap 노드 정의
- `src/components/ui/rich-text-editor/file-attachment-node-view.tsx` — 빌더 NodeView (색 아이콘)
- `src/components/ui/rich-text-editor/file-attachment-upload-modal.tsx` — 업로드 모달
- `src/components/ui/rich-text-editor/file-attachment-context-toolbar.tsx` — 컨텍스트 툴바
- `tests/unit/lib/upload/attachment-policy.test.ts`
- `tests/unit/survey/notice-attachment-promote.test.ts`
- `tests/unit/rich-text-editor/file-attachment-node.test.ts`

**수정 파일 (8개)**
- `src/app/api/upload/mail-attachment/route.ts` — 상수 추출 import 변경 (기능 변경 없음)
- `src/components/ui/rich-text-editor/extensions.ts` — FileAttachment 등록
- `src/components/ui/rich-text-editor/toolbar.tsx` — Paperclip 버튼 + 컨텍스트 툴바 마운트
- `src/components/ui/rich-text-editor/rich-text-editor.tsx` — onPickFile + 모달 상태
- `src/components/ui/rich-text-editor/types.ts` — Props 확장
- `src/components/survey-builder/notice-renderer.tsx` — `.notice-file-attachment` 클래스 노출 (sanitize 정책상 이미 통과)
- `src/lib/sanitize.ts` — DOMPurify allowlist 확장
- `src/actions/survey-save-actions.ts` — `promoteNoticeAttachments` 호출 추가 (2곳)
- `src/app/globals.css` — `.notice-file-attachment` 스타일
- `tests/unit/lib/sanitize.test.ts` — 신규 attribute 통과 검증 추가

---

## Phase 0 — 공유 상수 추출 (리팩터링, 기능 변경 없음)

### Task 0.1: `attachment-policy.ts` 생성 + mail-attachment route 마이그레이션

**Files:**
- Create: `src/lib/upload/attachment-policy.ts`
- Create: `tests/unit/lib/upload/attachment-policy.test.ts`
- Modify: `src/app/api/upload/mail-attachment/route.ts` (상수·함수 import로 교체)

- [ ] **Step 1: 단위 테스트 작성 (`tests/unit/lib/upload/attachment-policy.test.ts`)**

```typescript
import { describe, expect, it } from 'vitest';

import {
  EXT_TO_MIME,
  getFileExt,
  isAllowedMime,
  MIN_FILE_BYTES,
  resolveAttachmentType,
  SAFE_FILENAME_RE,
  validateFilename,
} from '@/lib/upload/attachment-policy';

describe('isAllowedMime', () => {
  it('PDF 허용', () => expect(isAllowedMime('application/pdf')).toBe(true));
  it('HWP 허용', () => expect(isAllowedMime('application/vnd.hancom.hwp')).toBe(true));
  it('image/* 모두 허용', () => expect(isAllowedMime('image/jpeg')).toBe(true));
  it('exe 차단', () => expect(isAllowedMime('application/x-msdownload')).toBe(false));
  it('빈 문자열 차단', () => expect(isAllowedMime('')).toBe(false));
});

describe('getFileExt', () => {
  it('확장자 소문자 반환', () => expect(getFileExt('Report.PDF')).toBe('pdf'));
  it('점 없으면 빈 문자열', () => expect(getFileExt('readme')).toBe(''));
  it('점으로 끝나면 빈 문자열', () => expect(getFileExt('a.')).toBe(''));
  it('한글 파일명도 처리', () => expect(getFileExt('공문.hwp')).toBe('hwp'));
});

describe('resolveAttachmentType', () => {
  it('확장자 우선 정책 — type 빈 문자열이어도 ext 로 추정', () => {
    expect(resolveAttachmentType('a.hwp', '')).toEqual({ mime: 'application/vnd.hancom.hwp' });
  });
  it('확장자가 허용 목록에 없으면 MIME 으로 폴백', () => {
    expect(resolveAttachmentType('noext', 'application/pdf')).toEqual({
      mime: 'application/pdf',
    });
  });
  it('확장자·MIME 모두 비허용이면 null', () => {
    expect(resolveAttachmentType('a.exe', 'application/x-msdownload')).toBeNull();
  });
});

describe('validateFilename', () => {
  it('정상 파일명 → null', () => expect(validateFilename('협조 공문.pdf')).toBeNull());
  it('빈 문자열 → 에러', () => expect(validateFilename('')).not.toBeNull());
  it('200자 초과 → 에러', () => expect(validateFilename('x'.repeat(201))).not.toBeNull());
  it('path traversal 차단', () => {
    expect(validateFilename('..')).not.toBeNull();
    expect(validateFilename('.')).not.toBeNull();
  });
  it('윈도우 reserved 문자 차단', () => {
    expect(validateFilename('a/b.pdf')).not.toBeNull();
    expect(validateFilename('a\\b.pdf')).not.toBeNull();
    expect(validateFilename('a:b.pdf')).not.toBeNull();
  });
  it('확장자만 있는 파일 차단', () => expect(validateFilename('.pdf')).not.toBeNull());
});

describe('상수', () => {
  it('MIN_FILE_BYTES === 1', () => expect(MIN_FILE_BYTES).toBe(1));
  it('SAFE_FILENAME_RE 한글 통과', () => expect(SAFE_FILENAME_RE.test('한글 파일.pdf')).toBe(true));
  it('EXT_TO_MIME 에 hwp/hwpx 포함', () => {
    expect(EXT_TO_MIME.hwp).toBe('application/vnd.hancom.hwp');
    expect(EXT_TO_MIME.hwpx).toBe('application/vnd.hancom.hwpx');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm vitest run tests/unit/lib/upload/attachment-policy.test.ts`
Expected: 모든 it 블록이 import 실패로 FAIL ("Cannot find module")

- [ ] **Step 3: `src/lib/upload/attachment-policy.ts` 구현**

```typescript
/**
 * 첨부 파일 업로드 정책 — mail-attachment와 notice-attachment 라우트가 공유한다.
 * - MIME 화이트리스트 (실행 가능 형식 차단, Office/HWP/PDF/ZIP/이미지 허용)
 * - 확장자 우선 정책 (브라우저가 file.type 을 빈 문자열로 보내는 hwp/hwpx 케이스 보강)
 * - 파일명 검증 (path traversal·윈도우 reserved 문자·NUL/CR/LF 차단)
 */

export const MIN_FILE_BYTES = 1;

export const ALLOWED_MIME = new Set<string>([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.hancom.hwp',
  'application/x-hwp',
  'application/haansofthwp',
  'application/hwp',
  'application/vnd.hancom.hwpx',
  'application/haansofthwpx',
  'application/hwp+zip',
  'text/plain',
  'text/csv',
]);

const ALLOWED_IMAGE_PREFIX = 'image/';

export const EXT_TO_MIME: Record<string, string> = {
  hwp: 'application/vnd.hancom.hwp',
  hwpx: 'application/vnd.hancom.hwpx',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pdf: 'application/pdf',
  zip: 'application/zip',
  txt: 'text/plain',
  csv: 'text/csv',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
};

export const SAFE_FILENAME_RE = /^[^\\/:*?"<>|\x00-\x1f]{1,200}$/;

// notice 전용 prefix — mail-attachment 와 키 공간 분리
export const TMP_NOTICE_ATTACHMENT_PREFIX = 'tmp/notice-attachment/';
export const NOTICE_ATTACHMENT_PREFIX = 'notice-attachment/';

export function isAllowedMime(mime: string): boolean {
  if (!mime) return false;
  if (ALLOWED_MIME.has(mime)) return true;
  if (mime.startsWith(ALLOWED_IMAGE_PREFIX)) return true;
  return false;
}

export function getFileExt(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx < 0 || idx === filename.length - 1) return '';
  return filename.slice(idx + 1).toLowerCase();
}

export function resolveAttachmentType(
  filename: string,
  mime: string,
): { mime: string } | null {
  const ext = getFileExt(filename);
  if (ext && ext in EXT_TO_MIME) {
    return { mime: mime && isAllowedMime(mime) ? mime : EXT_TO_MIME[ext] };
  }
  if (mime && isAllowedMime(mime)) {
    return { mime };
  }
  return null;
}

export function validateFilename(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '파일명이 비어있습니다.';
  if (trimmed.length > 200) return '파일명이 너무 깁니다 (최대 200자).';
  if (!SAFE_FILENAME_RE.test(trimmed)) return '파일명에 사용할 수 없는 문자가 있습니다.';
  if (trimmed.startsWith('.') && trimmed.lastIndexOf('.') === 0) {
    return '파일명이 비어있습니다 (확장자만 있음).';
  }
  if (trimmed === '.' || trimmed === '..') {
    return '유효하지 않은 파일명입니다.';
  }
  return null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run tests/unit/lib/upload/attachment-policy.test.ts`
Expected: PASS, 모든 it 블록 통과

- [ ] **Step 5: mail-attachment route 를 새 모듈로 마이그레이션**

`src/app/api/upload/mail-attachment/route.ts` 의 module-scope const(`ALLOWED_MIME`, `EXT_TO_MIME`, `SAFE_FILENAME_RE`, `MIN_FILE_BYTES`) 와 함수(`isAllowedMime`, `getFileExt`, `resolveAttachmentType`, `validateFilename`) 를 모두 삭제하고 import 로 교체:

```typescript
// 파일 상단 import 블록에 추가
import {
  ALLOWED_MIME,
  EXT_TO_MIME,
  getFileExt,
  isAllowedMime,
  MIN_FILE_BYTES,
  resolveAttachmentType,
  SAFE_FILENAME_RE,
  validateFilename,
} from '@/lib/upload/attachment-policy';
```

기존 module-scope 정의 부분(28번~125번 줄 영역)을 모두 제거. POST·DELETE 핸들러 본문은 그대로 유지.

- [ ] **Step 6: mail-attachment 회귀 없음 확인**

Run: `pnpm tsc --noEmit && pnpm vitest run tests/`
Expected: type 에러 0, 기존 테스트 모두 PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/upload/attachment-policy.ts \
        src/app/api/upload/mail-attachment/route.ts \
        tests/unit/lib/upload/attachment-policy.test.ts
git commit -m "refactor: 첨부 업로드 정책 상수·검증을 attachment-policy 모듈로 추출"
```

---

## Phase 1 — Notice 업로드 라우트

### Task 1.1: `/api/upload/notice-attachment` POST/DELETE 라우트

**Files:**
- Create: `src/app/api/upload/notice-attachment/route.ts`

- [ ] **Step 1: 라우트 구현**

`mail-attachment/route.ts` 를 형 삼아 prefix 와 Sentry 태그만 교체. 다음 파일을 새로 작성:

```typescript
import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import * as Sentry from '@sentry/nextjs';

import { requireAuth } from '@/lib/auth';
import { MAX_ATTACHMENT_FILE_BYTES } from '@/lib/mail/constants';
import {
  getFileExt,
  MIN_FILE_BYTES,
  resolveAttachmentType,
  TMP_NOTICE_ATTACHMENT_PREFIX,
  validateFilename,
} from '@/lib/upload/attachment-policy';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY || '',
  },
});

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const bucketName = process.env.CLOUDFLARE_R2_BUCKET;
  if (!bucketName) {
    const error = new Error('Cloudflare R2 환경 변수가 설정되지 않았습니다.');
    console.error(error.message);
    Sentry.captureException(error, { tags: { operation: 'notice_attachment_upload' } });
    return NextResponse.json({ error: '서버 설정 오류 (R2 미구성)' }, { status: 500 });
  }

  let file: File;
  let resolvedMime: string;
  let key: string;

  try {
    const formData = await request.formData();
    const fileEntry = formData.get('file');
    if (fileEntry === null) {
      return NextResponse.json({ error: '파일이 제공되지 않았습니다.' }, { status: 400 });
    }
    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: 'file 필드는 파일이어야 합니다.' },
        { status: 400 },
      );
    }
    file = fileEntry;

    if (file.size < MIN_FILE_BYTES) {
      return NextResponse.json({ error: '빈 파일은 업로드할 수 없습니다.' }, { status: 400 });
    }
    if (file.size > MAX_ATTACHMENT_FILE_BYTES) {
      return NextResponse.json(
        {
          error: `파일 크기는 ${Math.round(MAX_ATTACHMENT_FILE_BYTES / 1024 / 1024)}MB 이하여야 합니다.`,
        },
        { status: 400 },
      );
    }

    const filenameError = validateFilename(file.name);
    if (filenameError) {
      return NextResponse.json({ error: filenameError }, { status: 400 });
    }

    const resolved = resolveAttachmentType(file.name, file.type);
    if (!resolved) {
      return NextResponse.json(
        { error: `지원하지 않는 파일 형식입니다 (${file.type || '알 수 없음'}).` },
        { status: 400 },
      );
    }
    resolvedMime = resolved.mime;

    const ext = getFileExt(file.name);
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || 'bin';
    key = `${TMP_NOTICE_ATTACHMENT_PREFIX}${randomUUID()}.${safeExt}`;
  } catch (error) {
    console.error('공지사항 첨부 업로드 — 입력 파싱 실패:', error);
    Sentry.captureException(error, {
      tags: { operation: 'notice_attachment_upload', phase: 'parse' },
    });
    return NextResponse.json(
      { error: '요청을 처리할 수 없습니다 (form data 파싱 실패).' },
      { status: 400 },
    );
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch (error) {
    console.error('공지사항 첨부 업로드 — 파일 read 실패:', error);
    Sentry.captureException(error, {
      tags: { operation: 'notice_attachment_upload', phase: 'read' },
      extra: { filename: file.name, size: file.size },
    });
    return NextResponse.json({ error: '파일을 읽을 수 없습니다.' }, { status: 400 });
  }

  if (buffer.byteLength !== file.size) {
    Sentry.captureMessage('공지사항 첨부 size mismatch', {
      level: 'warning',
      tags: { operation: 'notice_attachment_upload' },
      extra: { declared: file.size, actual: buffer.byteLength, filename: file.name },
    });
    return NextResponse.json(
      { error: '파일 크기가 일치하지 않습니다. 다시 시도해 주세요.' },
      { status: 400 },
    );
  }

  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: resolvedMime,
        ContentLength: buffer.byteLength,
      }),
    );
  } catch (error) {
    console.error('공지사항 첨부 업로드 — R2 PUT 실패:', error);
    Sentry.captureException(error, {
      tags: { operation: 'notice_attachment_upload', phase: 'put' },
      extra: { key, filename: file.name, size: file.size },
    });
    return NextResponse.json(
      { error: '저장소 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 502 },
    );
  }

  try {
    await r2Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
  } catch (error) {
    console.error('공지사항 첨부 업로드 — R2 HEAD 실패:', error);
    Sentry.captureException(error, {
      tags: { operation: 'notice_attachment_upload', phase: 'verify' },
      extra: { key, filename: file.name },
    });
    r2Client
      .send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }))
      .catch(() => undefined);
    return NextResponse.json(
      { error: '저장 검증에 실패했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 502 },
    );
  }

  const publicUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;

  return NextResponse.json({
    key,
    url: publicUrl,
    filename: file.name,
    size: file.size,
    mime: resolvedMime,
  });
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const bucketName = process.env.CLOUDFLARE_R2_BUCKET;
  if (!bucketName) {
    return NextResponse.json({ error: '서버 설정 오류 (R2 미구성)' }, { status: 500 });
  }

  let key: string;
  try {
    const body = (await request.json().catch(() => null)) as { key?: unknown } | null;
    if (!body || typeof body.key !== 'string') {
      return NextResponse.json(
        { error: 'JSON body 에 key 필드가 필요합니다.' },
        { status: 400 },
      );
    }
    if (!body.key.startsWith(TMP_NOTICE_ATTACHMENT_PREFIX)) {
      return NextResponse.json(
        { error: 'tmp/notice-attachment/ prefix 만 삭제 가능합니다.' },
        { status: 400 },
      );
    }
    if (body.key.includes('..') || body.key.includes('//')) {
      return NextResponse.json({ error: '유효하지 않은 key 입니다.' }, { status: 400 });
    }
    key = body.key;
  } catch (error) {
    console.error('공지사항 첨부 삭제 — 입력 파싱 실패:', error);
    Sentry.captureException(error, {
      tags: { operation: 'notice_attachment_delete', phase: 'parse' },
    });
    return NextResponse.json({ error: '요청을 처리할 수 없습니다.' }, { status: 400 });
  }

  try {
    await r2Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('공지사항 첨부 삭제 — R2 DELETE 실패:', error);
    Sentry.captureException(error, {
      tags: { operation: 'notice_attachment_delete', phase: 'delete' },
      extra: { key },
    });
    return NextResponse.json(
      { error: '저장소 삭제에 실패했습니다.' },
      { status: 502 },
    );
  }
}
```

mail-attachment 와의 차이점:
- prefix 가 `TMP_NOTICE_ATTACHMENT_PREFIX` 로 교체됨
- Sentry 태그가 `notice_attachment_*` 로 교체됨
- 응답 JSON 에 `url` 필드 포함 (mail은 key만 반환, notice는 클라이언트가 즉시 노드 href 로 박을 수 있어야 함)
- DELETE 의 prefix 가드 메시지가 `tmp/notice-attachment/` 로 교체됨

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 빌드 확인**

Run: `pnpm build`
Expected: 성공, `/api/upload/notice-attachment` 라우트가 build manifest 에 등장

- [ ] **Step 4: Commit**

```bash
git add src/app/api/upload/notice-attachment/route.ts
git commit -m "feat: 공지사항 첨부 업로드 라우트 추가"
```

---

## Phase 2 — TipTap 노드 + Sanitize 확장

### Task 2.1: Sanitize allowlist 확장 + 테스트

**Files:**
- Modify: `src/lib/sanitize.ts`
- Modify: `tests/unit/lib/sanitize.test.ts`

- [ ] **Step 1: 기존 sanitize 테스트 파일에 신규 케이스 추가**

`tests/unit/lib/sanitize.test.ts` 의 마지막에 추가:

```typescript
describe('파일 첨부 노드 — sanitize allowlist', () => {
  it('a[data-file-attachment] 의 6개 attribute 모두 통과', () => {
    const input =
      '<p><a data-file-attachment="true" data-key="tmp/notice-attachment/abc.pdf" ' +
      'data-filename="협조공문.pdf" data-size="240000" data-mime="application/pdf" ' +
      'href="https://cdn.test/tmp/notice-attachment/abc.pdf" download="협조공문.pdf" ' +
      'target="_blank" rel="noopener noreferrer" class="notice-file-attachment">협조 공문</a></p>';
    const out = sanitizeRichHtml(input);
    expect(out).toContain('data-file-attachment="true"');
    expect(out).toContain('data-key="tmp/notice-attachment/abc.pdf"');
    expect(out).toContain('data-filename="협조공문.pdf"');
    expect(out).toContain('data-size="240000"');
    expect(out).toContain('data-mime="application/pdf"');
    expect(out).toContain('download="협조공문.pdf"');
    expect(out).toContain('class="notice-file-attachment"');
  });

  it('href javascript: 스킴 차단', () => {
    const input = '<a data-file-attachment="true" href="javascript:alert(1)">x</a>';
    const out = sanitizeRichHtml(input);
    expect(out).not.toContain('javascript:');
  });

  it('onclick 같은 이벤트 핸들러 차단', () => {
    const input = '<a data-file-attachment="true" onclick="alert(1)" href="#">x</a>';
    const out = sanitizeRichHtml(input);
    expect(out).not.toContain('onclick');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm vitest run tests/unit/lib/sanitize.test.ts`
Expected: 새 케이스 3개 모두 FAIL (`data-file-attachment` 등이 출력에 없음 — 현재 allowlist 미포함)

- [ ] **Step 3: `src/lib/sanitize.ts` 의 `ALLOWED_ATTR` 확장**

13~19 줄 영역의 `ALLOWED_ATTR` 배열에 다음 6개 추가:

```typescript
ALLOWED_ATTR: [
  'href', 'target', 'rel',
  'src', 'alt', 'width', 'height',
  'style',
  'class',
  'colspan', 'rowspan', 'colwidth',
  // notice file attachment node
  'data-file-attachment',
  'data-key',
  'data-filename',
  'data-size',
  'data-mime',
  'download',
],
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run tests/unit/lib/sanitize.test.ts`
Expected: PASS, javascript:/onclick 차단도 통과

- [ ] **Step 5: Commit**

```bash
git add src/lib/sanitize.ts tests/unit/lib/sanitize.test.ts
git commit -m "feat: sanitize allowlist에 파일 첨부 attribute 6종 추가"
```

### Task 2.2: TipTap `FileAttachment` 노드 schema

**Files:**
- Create: `src/components/ui/rich-text-editor/file-attachment-node.ts`
- Create: `tests/unit/rich-text-editor/file-attachment-node.test.ts`

- [ ] **Step 1: 단위 테스트 작성**

```typescript
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';

import { FileAttachment } from '@/components/ui/rich-text-editor/file-attachment-node';

function createEditor(content: string) {
  return new Editor({
    extensions: [StarterKit.configure({ heading: false }), FileAttachment],
    content,
  });
}

describe('FileAttachment node', () => {
  it('parseHTML: <a data-file-attachment="true"> 를 노드로 파싱', () => {
    const editor = createEditor(
      '<p><a data-file-attachment="true" data-key="tmp/notice-attachment/abc.pdf" ' +
        'data-filename="협조공문.pdf" data-size="240000" data-mime="application/pdf" ' +
        'href="https://cdn.test/tmp/notice-attachment/abc.pdf">협조 공문</a></p>',
    );
    const json = editor.getJSON();
    const para = json.content?.[0];
    const node = para?.content?.[0];
    expect(node?.type).toBe('fileAttachment');
    expect(node?.attrs?.key).toBe('tmp/notice-attachment/abc.pdf');
    expect(node?.attrs?.filename).toBe('협조공문.pdf');
    expect(node?.attrs?.size).toBe('240000');
    expect(node?.attrs?.mime).toBe('application/pdf');
    expect(node?.attrs?.url).toBe('https://cdn.test/tmp/notice-attachment/abc.pdf');
    expect(node?.attrs?.label).toBe('협조 공문');
    editor.destroy();
  });

  it('renderHTML: 6개 attr 모두 직렬화', () => {
    const editor = createEditor('');
    editor
      .chain()
      .insertContent({
        type: 'fileAttachment',
        attrs: {
          key: 'notice-attachment/x.pdf',
          url: 'https://cdn.test/notice-attachment/x.pdf',
          filename: '공문.pdf',
          label: '협조 공문',
          size: 1234,
          mime: 'application/pdf',
        },
      })
      .run();
    const html = editor.getHTML();
    expect(html).toContain('data-file-attachment="true"');
    expect(html).toContain('data-key="notice-attachment/x.pdf"');
    expect(html).toContain('data-filename="공문.pdf"');
    expect(html).toContain('data-size="1234"');
    expect(html).toContain('data-mime="application/pdf"');
    expect(html).toContain('href="https://cdn.test/notice-attachment/x.pdf"');
    expect(html).toContain('download="공문.pdf"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('class="notice-file-attachment"');
    expect(html).toContain('>협조 공문<');
    editor.destroy();
  });

  it('label 비어있으면 filename 으로 표시', () => {
    const editor = createEditor('');
    editor
      .chain()
      .insertContent({
        type: 'fileAttachment',
        attrs: {
          key: 'notice-attachment/x.pdf',
          url: 'https://cdn.test/notice-attachment/x.pdf',
          filename: '공문.pdf',
          label: '',
          size: 1234,
          mime: 'application/pdf',
        },
      })
      .run();
    expect(editor.getHTML()).toContain('>공문.pdf<');
    editor.destroy();
  });

  it('parseHTML ↔ renderHTML round-trip lossless', () => {
    const original =
      '<p><a data-file-attachment="true" data-key="notice-attachment/x.pdf" ' +
      'data-filename="공문.pdf" data-size="1234" data-mime="application/pdf" ' +
      'href="https://cdn.test/notice-attachment/x.pdf" download="공문.pdf" ' +
      'target="_blank" rel="noopener noreferrer" class="notice-file-attachment">협조 공문</a></p>';
    const editor = createEditor(original);
    const out = editor.getHTML();
    // attr 순서가 다를 수 있으므로 개별 검증
    for (const fragment of [
      'data-file-attachment="true"',
      'data-key="notice-attachment/x.pdf"',
      'data-filename="공문.pdf"',
      'data-size="1234"',
      'data-mime="application/pdf"',
      'href="https://cdn.test/notice-attachment/x.pdf"',
      'download="공문.pdf"',
      '>협조 공문<',
    ]) {
      expect(out).toContain(fragment);
    }
    editor.destroy();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm vitest run tests/unit/rich-text-editor/file-attachment-node.test.ts`
Expected: import 실패로 FAIL

- [ ] **Step 3: 노드 구현 (NodeView 없는 minimum)**

```typescript
import { mergeAttributes, Node } from '@tiptap/core';

export interface FileAttachmentAttrs {
  key: string | null;
  url: string | null;
  filename: string | null;
  label: string;
  size: number | string | null;
  mime: string | null;
}

export const FileAttachment = Node.create({
  name: 'fileAttachment',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      key: { default: null },
      url: { default: null },
      filename: { default: null },
      label: { default: '' },
      size: { default: null },
      mime: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-file-attachment="true"]',
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          return {
            key: el.getAttribute('data-key') ?? null,
            url: el.getAttribute('href') ?? null,
            filename: el.getAttribute('data-filename') ?? null,
            label: el.textContent ?? '',
            size: el.getAttribute('data-size') ?? null,
            mime: el.getAttribute('data-mime') ?? null,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const attrs = node.attrs as FileAttachmentAttrs;
    const label = attrs.label || attrs.filename || '첨부 파일';
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-file-attachment': 'true',
        'data-key': attrs.key ?? '',
        'data-filename': attrs.filename ?? '',
        'data-size': attrs.size ?? '',
        'data-mime': attrs.mime ?? '',
        href: attrs.url ?? '#',
        download: attrs.filename ?? '',
        target: '_blank',
        rel: 'noopener noreferrer',
        class: 'notice-file-attachment',
      }),
      label,
    ];
  },
});
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run tests/unit/rich-text-editor/file-attachment-node.test.ts`
Expected: 4개 it 블록 모두 PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/rich-text-editor/file-attachment-node.ts \
        tests/unit/rich-text-editor/file-attachment-node.test.ts
git commit -m "feat: TipTap 파일 첨부 노드 schema 추가"
```

### Task 2.3: `createUnifiedExtensions` 에 등록 + 회귀 확인

**Files:**
- Modify: `src/components/ui/rich-text-editor/extensions.ts`

- [ ] **Step 1: extensions.ts 의 import 와 배열에 추가**

상단 import 블록에 추가:
```typescript
import { FileAttachment } from './file-attachment-node';
```

`createUnifiedExtensions` 의 return 배열 마지막에 추가:
```typescript
return [
  StarterKit.configure({ /* 기존 */ }),
  Underline,
  // ... 기존 extension 모두 유지 ...
  VarTokenExtension,
  TableAlignDecoration,
  FileAttachment,
];
```

- [ ] **Step 2: 회귀 테스트**

Run: `pnpm vitest run tests/unit/rich-text-editor/`
Expected: 기존 + 신규 모두 PASS

Run: `pnpm tsc --noEmit`
Expected: 에러 0

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/rich-text-editor/extensions.ts
git commit -m "feat: 파일 첨부 노드를 통합 extension 배열에 등록"
```

---

## Phase 3 — Publish Promote

### Task 3.1: `notice-attachment-promote.ts` 모듈

**Files:**
- Create: `src/lib/survey/notice-attachment-promote.ts`
- Create: `tests/unit/survey/notice-attachment-promote.test.ts`

- [ ] **Step 1: 단위 테스트 작성**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  extractTmpNoticeAttachmentUrlsFromHtml,
  isTmpNoticeAttachmentUrl,
  noticeAttachmentTmpToPermanentUrl,
  replaceNoticeAttachmentUrlsInQuestion,
} from '@/lib/survey/notice-attachment-promote';

describe('isTmpNoticeAttachmentUrl', () => {
  beforeEach(() => {
    process.env.CLOUDFLARE_R2_PUBLIC_URL = 'https://cdn.test';
  });
  afterEach(() => {
    delete process.env.CLOUDFLARE_R2_PUBLIC_URL;
  });

  it('tmp/notice-attachment/ prefix 는 true', () => {
    expect(isTmpNoticeAttachmentUrl('https://cdn.test/tmp/notice-attachment/x.pdf')).toBe(true);
  });
  it('영구 prefix 는 false', () => {
    expect(isTmpNoticeAttachmentUrl('https://cdn.test/notice-attachment/x.pdf')).toBe(false);
  });
  it('tmp/mail-attachment 는 false', () => {
    expect(isTmpNoticeAttachmentUrl('https://cdn.test/tmp/mail-attachment/x.pdf')).toBe(false);
  });
  it('tmp/survey 는 false', () => {
    expect(isTmpNoticeAttachmentUrl('https://cdn.test/tmp/survey/x.webp')).toBe(false);
  });
});

describe('noticeAttachmentTmpToPermanentUrl', () => {
  beforeEach(() => {
    process.env.CLOUDFLARE_R2_PUBLIC_URL = 'https://cdn.test';
  });
  afterEach(() => {
    delete process.env.CLOUDFLARE_R2_PUBLIC_URL;
  });

  it('tmp/notice-attachment/ → notice-attachment/', () => {
    expect(
      noticeAttachmentTmpToPermanentUrl('https://cdn.test/tmp/notice-attachment/x.pdf'),
    ).toBe('https://cdn.test/notice-attachment/x.pdf');
  });
});

describe('extractTmpNoticeAttachmentUrlsFromHtml', () => {
  beforeEach(() => {
    process.env.CLOUDFLARE_R2_PUBLIC_URL = 'https://cdn.test';
  });
  afterEach(() => {
    delete process.env.CLOUDFLARE_R2_PUBLIC_URL;
  });

  it('a[data-file-attachment] 의 href 만 추출', () => {
    const html =
      '<p><a data-file-attachment="true" href="https://cdn.test/tmp/notice-attachment/a.pdf">A</a>' +
      '<a href="https://example.com/page">B (일반 링크)</a>' +
      '<img src="https://cdn.test/tmp/survey/x.webp" />' +
      '</p>';
    expect(extractTmpNoticeAttachmentUrlsFromHtml(html)).toEqual([
      'https://cdn.test/tmp/notice-attachment/a.pdf',
    ]);
  });

  it('중복 제거', () => {
    const html =
      '<a data-file-attachment="true" href="https://cdn.test/tmp/notice-attachment/a.pdf">A</a>' +
      '<a data-file-attachment="true" href="https://cdn.test/tmp/notice-attachment/a.pdf">A2</a>';
    expect(extractTmpNoticeAttachmentUrlsFromHtml(html)).toEqual([
      'https://cdn.test/tmp/notice-attachment/a.pdf',
    ]);
  });

  it('영구 prefix 는 제외', () => {
    const html =
      '<a data-file-attachment="true" href="https://cdn.test/notice-attachment/a.pdf">A</a>';
    expect(extractTmpNoticeAttachmentUrlsFromHtml(html)).toEqual([]);
  });

  it('빈 HTML 은 빈 배열', () => {
    expect(extractTmpNoticeAttachmentUrlsFromHtml('')).toEqual([]);
  });
});

describe('replaceNoticeAttachmentUrlsInQuestion', () => {
  it('mapping 의 URL 만 치환, 그 외는 유지', () => {
    const mapping = new Map([
      [
        'https://cdn.test/tmp/notice-attachment/a.pdf',
        'https://cdn.test/notice-attachment/a.pdf',
      ],
    ]);
    const q = {
      noticeContent:
        '<a data-file-attachment="true" data-key="tmp/notice-attachment/a.pdf" ' +
        'href="https://cdn.test/tmp/notice-attachment/a.pdf">A</a>',
    };
    const out = replaceNoticeAttachmentUrlsInQuestion(q, mapping);
    // href URL 치환 확인
    expect(out.noticeContent).toContain('href="https://cdn.test/notice-attachment/a.pdf"');
    expect(out.noticeContent).not.toContain('tmp/notice-attachment/a.pdf');
  });

  it('noticeContent 없는 질문 그대로 반환', () => {
    const q = { noticeContent: null };
    const mapping = new Map([['x', 'y']]);
    expect(replaceNoticeAttachmentUrlsInQuestion(q, mapping)).toEqual(q);
  });

  it('mapping 비었으면 same reference', () => {
    const q = { noticeContent: '<a>x</a>' };
    expect(replaceNoticeAttachmentUrlsInQuestion(q, new Map())).toBe(q);
  });
});

describe('promoteNoticeAttachments', () => {
  beforeEach(() => {
    process.env.CLOUDFLARE_R2_PUBLIC_URL = 'https://cdn.test';
  });
  afterEach(() => {
    delete process.env.CLOUDFLARE_R2_PUBLIC_URL;
    vi.restoreAllMocks();
  });

  it('R2 move 성공 시 모든 tmp URL 영구 URL 치환', async () => {
    vi.doMock('@/lib/image-utils-server', () => ({
      moveR2Objects: vi.fn(async (pairs: Array<{ srcKey: string; dstKey: string }>) => ({
        movedKeys: pairs.map((p) => ({ srcKey: p.srcKey, dstKey: p.dstKey })),
        failed: [],
      })),
    }));
    const { promoteNoticeAttachments } = await import(
      '@/lib/survey/notice-attachment-promote'
    );

    const questions = [
      {
        type: 'notice',
        noticeContent:
          '<a data-file-attachment="true" data-key="tmp/notice-attachment/a.pdf" ' +
          'href="https://cdn.test/tmp/notice-attachment/a.pdf">A</a>',
      },
    ];
    const out = await promoteNoticeAttachments(questions);
    expect(out[0].noticeContent).toContain('https://cdn.test/notice-attachment/a.pdf');
    expect(out[0].noticeContent).not.toContain('tmp/notice-attachment/a.pdf');
  });

  it('tmp URL 없으면 same reference', async () => {
    const { promoteNoticeAttachments } = await import(
      '@/lib/survey/notice-attachment-promote'
    );
    const questions = [{ type: 'notice', noticeContent: '<p>그냥 본문</p>' }];
    const out = await promoteNoticeAttachments(questions);
    expect(out).toBe(questions);
  });

  it('R2 move 부분 실패 시 성공한 것만 치환', async () => {
    vi.doMock('@/lib/image-utils-server', () => ({
      moveR2Objects: vi.fn(async (pairs: Array<{ srcKey: string; dstKey: string }>) => ({
        movedKeys: [{ srcKey: pairs[0].srcKey, dstKey: pairs[0].dstKey }],
        failed: [pairs[1]?.srcKey].filter(Boolean) as string[],
      })),
    }));
    const { promoteNoticeAttachments } = await import(
      '@/lib/survey/notice-attachment-promote'
    );
    const questions = [
      {
        type: 'notice',
        noticeContent:
          '<a data-file-attachment="true" href="https://cdn.test/tmp/notice-attachment/a.pdf">A</a>' +
          '<a data-file-attachment="true" href="https://cdn.test/tmp/notice-attachment/b.pdf">B</a>',
      },
    ];
    const out = await promoteNoticeAttachments(questions);
    // 하나만 치환됨 (R2 mock 의 movedKeys 첫 번째)
    expect(out[0].noticeContent).toMatch(/notice-attachment\/[ab]\.pdf/);
    // 실패한 것은 tmp 그대로
    expect(out[0].noticeContent).toContain('tmp/notice-attachment/');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm vitest run tests/unit/survey/notice-attachment-promote.test.ts`
Expected: 모든 it 블록 FAIL (모듈 없음)

- [ ] **Step 3: `notice-attachment-promote.ts` 구현**

```typescript
// 서버 전용 모듈 — 클라이언트에서 import 금지 (R2 SDK 포함)
import * as Sentry from '@sentry/nextjs';

import { moveR2Objects } from '@/lib/image-utils-server';
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

/**
 * noticeContent HTML 안의 URL 을 mapping 으로 치환. mapping 없는 URL 은 유지.
 * mapping 비어있으면 same reference 반환 (참조 동등성 보존).
 */
export function replaceNoticeAttachmentUrlsInQuestion<
  T extends PromotableNoticeQuestion,
>(question: T, mapping: Map<string, string>): T {
  if (mapping.size === 0) return question;
  if (!question.noticeContent) return question;

  let updated = question.noticeContent;
  for (const [tmp, perm] of mapping) {
    updated = updated.split(tmp).join(perm);
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
```

→ 주의: `replaceNoticeAttachmentUrlsInQuestion` 의 split/join 패턴은 `data-key` 와 `href` 양쪽에 있는 URL/key 를 모두 치환한다 — `data-key` 에는 R2 key (예: `tmp/notice-attachment/x.pdf`) 가 들어 있는데, 이는 URL 의 부분 문자열로 포함되므로 동일 split/join 패스에서 함께 변환된다. 즉 `tmp/notice-attachment/x.pdf` 라는 부분 문자열이 영구 prefix 로 바뀐다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run tests/unit/survey/notice-attachment-promote.test.ts`
Expected: 모든 it 블록 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/survey/notice-attachment-promote.ts \
        tests/unit/survey/notice-attachment-promote.test.ts
git commit -m "feat: 공지사항 첨부 promote 모듈 추가"
```

### Task 3.2: `survey-save-actions.ts` 에 promote 호출 추가

**Files:**
- Modify: `src/actions/survey-save-actions.ts`

- [ ] **Step 1: import 추가**

상단 import 블록에서 `promoteSurveyImages` import 바로 아래에 추가:

```typescript
import { promoteSurveyImages } from '@/lib/survey/survey-image-promote';
import { promoteNoticeAttachments } from '@/lib/survey/notice-attachment-promote';
```

- [ ] **Step 2: 첫 번째 promote 호출 (line 170 부근, questionChanges.upserted 처리)**

기존:
```typescript
const promotedQuestions = await promoteSurveyImages(questionChanges.upserted);
```

다음으로 변경 — 이미지 promote 후 결과를 첨부 promote 에 다시 통과:
```typescript
const promotedQuestions = await promoteNoticeAttachments(
  await promoteSurveyImages(questionChanges.upserted),
);
```

- [ ] **Step 3: 두 번째 promote 호출 (line 452 부근, snapshot publish 흐름)**

동일한 패턴으로 교체:

기존:
```typescript
const promotedQuestions = await promoteSurveyImages(surveyData.questions);
```

→
```typescript
const promotedQuestions = await promoteNoticeAttachments(
  await promoteSurveyImages(surveyData.questions),
);
```

- [ ] **Step 4: 타입 체크 + 회귀 테스트**

Run: `pnpm tsc --noEmit && pnpm vitest run tests/`
Expected: 에러 0, 기존 모든 테스트 PASS

- [ ] **Step 5: Commit**

```bash
git add src/actions/survey-save-actions.ts
git commit -m "feat: publish 흐름에 공지사항 첨부 promote 호출 추가"
```

---

## Phase 4 — Builder UI 컴포넌트

### Task 4.1: `globals.css` 에 `.notice-file-attachment` 스타일 추가

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: CSS 추가**

`globals.css` 의 맨 아래에 다음 블록 추가 (다른 컴포넌트 스타일 인접 위치 따라가도 됨):

```css
/* 공지사항 파일 첨부 — 응답 페이지·미리보기 시각 (lucide Paperclip data URI) */
.notice-file-attachment {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  padding-left: 2.25rem;
  background-color: #f3f4f6;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.83l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48'/></svg>");
  background-repeat: no-repeat;
  background-position: 0.625rem center;
  background-size: 1rem 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  color: #374151;
  text-decoration: none;
  font-size: 0.875rem;
  cursor: pointer;
}
.notice-file-attachment:hover {
  background-color: #e5e7eb;
}
```

- [ ] **Step 2: 빌드 확인**

Run: `pnpm build`
Expected: 성공, CSS 통과

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: 공지사항 첨부 버튼 응답 페이지 스타일 추가"
```

### Task 4.2: `FileAttachmentNodeView` React 컴포넌트 (빌더 시각)

**Files:**
- Modify: `src/components/ui/rich-text-editor/file-attachment-node.ts` (NodeView 등록)
- Create: `src/components/ui/rich-text-editor/file-attachment-node-view.tsx`

- [ ] **Step 1: `file-attachment-node-view.tsx` 작성**

```typescript
'use client';

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import {
  FileArchive,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';

function pickIcon(mime: string | null) {
  if (!mime) return { Icon: FileText, color: 'text-gray-500' };
  if (mime === 'application/pdf') return { Icon: FileText, color: 'text-red-600' };
  if (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel'
  ) {
    return { Icon: FileSpreadsheet, color: 'text-green-600' };
  }
  if (
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    mime === 'application/hwp+zip'
  ) {
    return { Icon: FileArchive, color: 'text-gray-600' };
  }
  if (mime.startsWith('application/vnd.hancom.hwp') || mime.startsWith('application/x-hwp') || mime === 'application/hwp' || mime === 'application/haansofthwp' || mime === 'application/haansofthwpx') {
    return { Icon: FileText, color: 'text-purple-600' };
  }
  if (mime.startsWith('application/vnd.openxmlformats-officedocument.wordprocessingml') || mime === 'application/msword') {
    return { Icon: FileText, color: 'text-blue-600' };
  }
  if (mime.startsWith('application/vnd.openxmlformats-officedocument.presentationml') || mime === 'application/vnd.ms-powerpoint') {
    return { Icon: FileText, color: 'text-orange-600' };
  }
  return { Icon: FileText, color: 'text-gray-500' };
}

function formatSize(size: number | string | null): string {
  if (size == null) return '';
  const n = typeof size === 'string' ? parseInt(size, 10) : size;
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function FileAttachmentNodeView({ node, selected }: NodeViewProps) {
  const { label, filename, size, mime } = node.attrs as {
    label: string;
    filename: string | null;
    size: number | string | null;
    mime: string | null;
  };
  const { Icon, color } = pickIcon(mime);
  const sizeText = formatSize(size);

  return (
    <NodeViewWrapper
      as="span"
      className={`inline-flex max-w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 align-top shadow-sm ${
        selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
      }`}
      data-drag-handle
    >
      <Icon className={`h-5 w-5 flex-shrink-0 ${color}`} aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-gray-800">
          {label || filename || '첨부 파일'}
        </span>
        {(filename || sizeText) && (
          <span className="truncate text-xs text-gray-500">
            {[filename, sizeText].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
    </NodeViewWrapper>
  );
}
```

- [ ] **Step 2: 노드 schema 에 NodeView 등록**

`file-attachment-node.ts` 상단에 import 추가:
```typescript
import { ReactNodeViewRenderer } from '@tiptap/react';

import { FileAttachmentNodeView } from './file-attachment-node-view';
```

`Node.create({ ... })` 안에 추가:
```typescript
  addNodeView() {
    return ReactNodeViewRenderer(FileAttachmentNodeView);
  },
```

- [ ] **Step 3: 기존 노드 schema 테스트 회귀 확인**

Run: `pnpm vitest run tests/unit/rich-text-editor/file-attachment-node.test.ts`
Expected: PASS (parseHTML / renderHTML / round-trip — NodeView 는 DOM 환경 없이도 schema 만 검증)

- [ ] **Step 4: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 0

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/rich-text-editor/file-attachment-node-view.tsx \
        src/components/ui/rich-text-editor/file-attachment-node.ts
git commit -m "feat: 파일 첨부 노드의 빌더 NodeView 추가"
```

### Task 4.3: `FileAttachmentUploadModal` 컴포넌트

**Files:**
- Create: `src/components/ui/rich-text-editor/file-attachment-upload-modal.tsx`

- [ ] **Step 1: 모달 컴포넌트 작성**

```typescript
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { AlertCircle, Loader2, Paperclip, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MAX_ATTACHMENT_FILE_BYTES } from '@/lib/mail/constants';

interface UploadResult {
  key: string;
  url: string;
  filename: string;
  size: number;
  mime: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onUploaded: (result: UploadResult, label: string) => void;
}

const ACCEPT =
  'application/pdf,application/zip,application/msword,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-excel,' +
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
  'application/vnd.ms-powerpoint,' +
  'application/vnd.openxmlformats-officedocument.presentationml.presentation,' +
  'application/vnd.hancom.hwp,application/x-hwp,application/hwp+zip,' +
  'application/vnd.hancom.hwpx,application/haansofthwp,application/haansofthwpx,application/hwp,' +
  'text/plain,text/csv,image/*';

export function FileAttachmentUploadModal({ open, onClose, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  useEffect(() => {
    if (!open) {
      xhrRef.current?.abort();
      xhrRef.current = null;
      setFile(null);
      setLabel('');
      setProgress(0);
      setError(null);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  useEffect(() => {
    return () => {
      xhrRef.current?.abort();
      xhrRef.current = null;
    };
  }, []);

  const handleSelect = useCallback((picked: File) => {
    if (picked.size === 0) {
      setError('빈 파일은 업로드할 수 없습니다.');
      return;
    }
    if (picked.size > MAX_ATTACHMENT_FILE_BYTES) {
      setError(
        `파일 크기는 ${Math.round(MAX_ATTACHMENT_FILE_BYTES / 1024 / 1024)}MB 이하여야 합니다.`,
      );
      return;
    }
    setFile(picked);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const picked = e.dataTransfer.files[0];
      if (picked) handleSelect(picked);
    },
    [handleSelect],
  );

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);

    const fd = new FormData();
    fd.append('file', file);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    try {
      const result = await new Promise<UploadResult>((resolve, reject) => {
        const onProgress = (e: ProgressEvent) => {
          if (e.lengthComputable) {
            setProgress((e.loaded / e.total) * 100);
          }
        };
        xhr.upload.addEventListener('progress', onProgress);

        xhr.addEventListener('load', () => {
          try {
            if (xhr.status === 200) {
              resolve(JSON.parse(xhr.responseText) as UploadResult);
            } else {
              let msg = '업로드에 실패했습니다.';
              try {
                const err = JSON.parse(xhr.responseText);
                if (err?.error) msg = err.error;
              } catch {
                // 비-JSON 응답은 기본 메시지 사용
              }
              reject(new Error(msg));
            }
          } catch {
            reject(new Error('서버 응답을 처리할 수 없습니다.'));
          }
        });
        xhr.addEventListener('error', () =>
          reject(new Error('네트워크 오류가 발생했습니다.')),
        );
        xhr.addEventListener('abort', () =>
          reject(new Error('업로드가 취소되었습니다.')),
        );
        xhr.open('POST', '/api/upload/notice-attachment');
        xhr.send(fd);
      });

      xhrRef.current = null;
      onUploaded(result, label.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 중 오류가 발생했습니다.');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  }, [file, label, onClose, onUploaded]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">파일 첨부</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!file && !uploading && (
          <div
            className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-blue-400"
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (picked) handleSelect(picked);
              }}
            />
            <Paperclip className="mx-auto mb-2 h-7 w-7 text-gray-400" aria-hidden />
            <p className="text-sm text-gray-600">
              파일을 드래그하거나 클릭하여 선택하세요
            </p>
            <p className="mt-1 text-xs text-gray-500">
              PDF / HWP / Office / ZIP / 이미지 (최대{' '}
              {Math.round(MAX_ATTACHMENT_FILE_BYTES / 1024 / 1024)}MB)
            </p>
          </div>
        )}

        {file && !uploading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
                {file.name}
              </span>
              <span className="ml-3 text-xs text-gray-500">
                {(file.size / 1024).toFixed(0)} KB
              </span>
            </div>
            <div>
              <Label className="mb-1 block text-sm" htmlFor="notice-attachment-label">
                표시 라벨 (선택 — 비워두면 파일명)
              </Label>
              <Input
                id="notice-attachment-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="예: 협조 공문"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={handleUpload} className="flex-1">
                업로드
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setLabel('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                취소
              </Button>
            </div>
          </div>
        )}

        {uploading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">업로드 중...</span>
              <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                xhrRef.current?.abort();
                xhrRef.current = null;
              }}
              className="w-full"
              disabled={progress >= 100}
            >
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              업로드 취소
            </Button>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
              {file && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUpload}
                  className="mt-2"
                >
                  다시 시도
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 0

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/rich-text-editor/file-attachment-upload-modal.tsx
git commit -m "feat: 공지사항 파일 첨부 업로드 모달 컴포넌트 추가"
```

### Task 4.4: `FileAttachmentContextToolbar` 컴포넌트

**Files:**
- Create: `src/components/ui/rich-text-editor/file-attachment-context-toolbar.tsx`

- [ ] **Step 1: 컨텍스트 툴바 작성**

```typescript
'use client';

import { useEffect, useState } from 'react';

import { useEditorState, type Editor } from '@tiptap/react';
import { RefreshCw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TMP_NOTICE_ATTACHMENT_PREFIX } from '@/lib/upload/attachment-policy';

import { ToolBtn } from './toolbar-primitives';

interface Props {
  editor: Editor;
  onReplace: () => void;
}

const FILE_ATTACHMENT = 'fileAttachment';

async function deleteTmpKey(key: string | null) {
  if (!key) return;
  if (!key.startsWith(TMP_NOTICE_ATTACHMENT_PREFIX)) return;
  try {
    await fetch('/api/upload/notice-attachment', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key }),
    });
  } catch {
    // best-effort — R2 lifecycle 가 24h 안에 청소함
  }
}

export function FileAttachmentContextToolbar({ editor, onReplace }: Props) {
  const s = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor || !editor.isActive(FILE_ATTACHMENT)) {
        return { active: false, label: '', key: null as string | null };
      }
      const attrs = editor.getAttributes(FILE_ATTACHMENT);
      return {
        active: true,
        label: (attrs.label as string) ?? '',
        key: (attrs.key as string | null) ?? null,
      };
    },
  });

  // editor 측 label 변화를 input draft 로 동기화 (다른 첨부 클릭 시 input 초기화)
  const [draft, setDraft] = useState(s.label);
  useEffect(() => {
    setDraft(s.label);
    // 노드 선택이 바뀌면 draft 도 새 값으로
  }, [s.key, s.label]);

  if (!s.active) return null;

  return (
    <div className="flex w-full flex-wrap items-center gap-2 border-t border-gray-200 pt-2 mt-1">
      <Label className="text-xs font-medium text-gray-500" htmlFor="notice-attachment-label-edit">
        라벨
      </Label>
      <Input
        id="notice-attachment-label-edit"
        className="h-8 flex-1 min-w-[8rem] text-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== s.label) {
            editor.chain().focus().updateAttributes(FILE_ATTACHMENT, { label: draft }).run();
          }
        }}
      />
      <ToolBtn onClick={onReplace} title="파일 교체">
        <RefreshCw className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        onClick={() => {
          const key = s.key;
          editor.chain().focus().deleteSelection().run();
          void deleteTmpKey(key);
        }}
        title="첨부 삭제"
      >
        <Trash2 className="h-4 w-4" />
      </ToolBtn>
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 0

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/rich-text-editor/file-attachment-context-toolbar.tsx
git commit -m "feat: 공지사항 파일 첨부 컨텍스트 툴바 추가"
```

### Task 4.5: `Toolbar` 에 Paperclip 버튼 + 컨텍스트 툴바 마운트

**Files:**
- Modify: `src/components/ui/rich-text-editor/toolbar.tsx`

- [ ] **Step 1: import 추가**

```typescript
import { Paperclip } from 'lucide-react';

import { FileAttachmentContextToolbar } from './file-attachment-context-toolbar';
```

- [ ] **Step 2: Props 인터페이스 확장**

```typescript
interface Props {
  editor: Editor;
  variableCatalog?: VariableDef[];
  onPickImage: () => void;
  onPickLink: () => void;
  onPickFile?: () => void;
  onReplaceFile?: () => void;
}
```

- [ ] **Step 3: 함수 시그니처 확장 + selector 에 fileAttachmentActive 추가**

```typescript
export function Toolbar({ editor, variableCatalog, onPickImage, onPickLink, onPickFile, onReplaceFile }: Props) {
  const s = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) {
        return {
          bold: false, italic: false, underline: false, strike: false,
          bulletList: false, orderedList: false,
          alignLeft: true, alignCenter: false, alignRight: false, alignJustify: false,
          canUndo: false, canRedo: false,
          imageActive: false, tableActive: false, fileAttachmentActive: false,
        };
      }
      return {
        // ... 기존 필드 모두 유지 ...
        imageActive: editor.isActive('imageResize'),
        tableActive: findTableAtSelection(editor.state) !== null,
        fileAttachmentActive: editor.isActive('fileAttachment'),
      };
    },
  });
```

- [ ] **Step 4: 툴바 JSX 에 Paperclip 버튼 추가 (이미지/링크/테이블 영역 안)**

기존 122-124번 줄 영역:
```typescript
<ToolBtn onClick={onPickImage} title="이미지"><ImageIcon className="h-4 w-4" /></ToolBtn>
<ToolBtn onClick={onPickLink} title="링크"><LinkIcon className="h-4 w-4" /></ToolBtn>
<TableInsertMenu editor={editor} />
```

다음으로 변경:
```typescript
<ToolBtn onClick={onPickImage} title="이미지"><ImageIcon className="h-4 w-4" /></ToolBtn>
<ToolBtn onClick={onPickLink} title="링크"><LinkIcon className="h-4 w-4" /></ToolBtn>
{onPickFile && (
  <ToolBtn onClick={onPickFile} title="파일 첨부">
    <Paperclip className="h-4 w-4" />
  </ToolBtn>
)}
<TableInsertMenu editor={editor} />
```

- [ ] **Step 5: 컨텍스트 툴바 마운트 (이미지/테이블 인접)**

기존 164-165번 줄:
```typescript
{s.imageActive && <ImageContextToolbar editor={editor} />}
{s.tableActive && <TableContextToolbar editor={editor} />}
```

다음으로 변경:
```typescript
{s.imageActive && <ImageContextToolbar editor={editor} />}
{s.tableActive && <TableContextToolbar editor={editor} />}
{s.fileAttachmentActive && onReplaceFile && (
  <FileAttachmentContextToolbar editor={editor} onReplace={onReplaceFile} />
)}
```

- [ ] **Step 6: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 0

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/rich-text-editor/toolbar.tsx
git commit -m "feat: 툴바에 파일 첨부 버튼·컨텍스트 툴바 마운트"
```

---

## Phase 5 — RichTextEditor 통합

### Task 5.1: `RichTextEditor` 에 모달 상태 + onPickFile 추가

**Files:**
- Modify: `src/components/ui/rich-text-editor/rich-text-editor.tsx`
- Modify: `src/components/ui/rich-text-editor/types.ts` (해당 prop 없는 경우 추가 — 현재는 미사용)

- [ ] **Step 1: types.ts 확인**

`src/components/ui/rich-text-editor/types.ts` 를 열어 `RichTextEditorProps` 에 첨부 관련 옵션 추가가 필요한지 검토. 현재 plan에서는 첨부 진입점을 `kind === 'survey'` 일 때 자동으로 활성화하므로 props 추가 없이도 동작 — 확인만 하고 변경 없을 수 있음.

- [ ] **Step 2: rich-text-editor.tsx 의 import 추가**

```typescript
import { FileAttachmentUploadModal } from './file-attachment-upload-modal';
```

- [ ] **Step 3: 상태 추가**

`useEditor` 위쪽:
```typescript
const [showFileModal, setShowFileModal] = useState(false);
const [replacingFile, setReplacingFile] = useState(false);
```

- [ ] **Step 4: 핸들러 정의 (return 직전 위치)**

```typescript
const onPickFile = () => setShowFileModal(true);
const onReplaceFile = () => {
  if (!editor || !editor.isActive('fileAttachment')) return;
  setReplacingFile(true);
  setShowFileModal(true);
};

const handleFileUploaded = (
  result: { key: string; url: string; filename: string; size: number; mime: string },
  label: string,
) => {
  if (!editor || editor.isDestroyed) return;

  if (replacingFile && editor.isActive('fileAttachment')) {
    const prev = editor.getAttributes('fileAttachment') as { key?: string | null };
    const prevKey = prev?.key ?? null;
    editor
      .chain()
      .focus()
      .updateAttributes('fileAttachment', {
        key: result.key,
        url: result.url,
        filename: result.filename,
        label: label || result.filename,
        size: result.size,
        mime: result.mime,
      })
      .run();
    if (prevKey && prevKey.startsWith('tmp/notice-attachment/')) {
      void fetch('/api/upload/notice-attachment', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: prevKey }),
      }).catch(() => undefined);
    }
  } else {
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'fileAttachment',
        attrs: {
          key: result.key,
          url: result.url,
          filename: result.filename,
          label: label || result.filename,
          size: result.size,
          mime: result.mime,
        },
      })
      .run();
  }
  setReplacingFile(false);
};
```

- [ ] **Step 5: Toolbar props 와 Modal JSX 결합**

`Toolbar` JSX 의 props 영역:
```typescript
<Toolbar
  editor={editor}
  variableCatalog={variableCatalog}
  onPickImage={onPickImage}
  onPickLink={onPickLink}
  onPickFile={kind === 'survey' ? onPickFile : undefined}
  onReplaceFile={kind === 'survey' ? onReplaceFile : undefined}
/>
```

`ImageUploadModal` 바로 아래에 Modal 추가:
```typescript
<FileAttachmentUploadModal
  open={showFileModal}
  onClose={() => {
    setShowFileModal(false);
    setReplacingFile(false);
  }}
  onUploaded={(result, label) => {
    setShowFileModal(false);
    handleFileUploaded(result, label);
  }}
/>
```

- [ ] **Step 6: 타입 체크 + 빌드**

Run: `pnpm tsc --noEmit && pnpm build`
Expected: 에러 0, 빌드 성공

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/rich-text-editor/rich-text-editor.tsx
git commit -m "feat: RichTextEditor에 파일 첨부 모달·핸들러 결선"
```

### Task 5.2: 응답 페이지 sanitize 노출 확인

**Files:**
- Modify: `src/components/survey-builder/notice-renderer.tsx` (변경 없을 가능성 — sanitize 가 알아서 통과)

- [ ] **Step 1: notice-renderer.tsx 확인**

`sanitizeRichHtml` 가 이미 `data-file-attachment` 등을 통과시키도록 Phase 2.1 에서 확장됐다. 추가 코드 변경 없음.

다만 `.notice-file-attachment` 의 시각 룰이 prose 의 `<a>` 스타일과 충돌할 수 있으므로, notice-renderer 의 prose className 영역에 다음 한 줄 추가:

```typescript
className="prose prose-sm max-w-none overflow-x-auto rounded-lg border border-blue-100 bg-blue-50/40 p-6 [&_img]:inline-block [&_img]:align-top [&_p]:min-h-[1.6em] [&_table]:my-4 [&_table]:!w-auto [&_table]:table-auto [&_table]:border-collapse [&_table]:border [&_table]:border-gray-300 [&_table_p]:m-0 [&_table_td]:box-border [&_table_td]:overflow-hidden [&_table_td]:border [&_table_td]:border-gray-300 [&_table_td]:px-3 [&_table_td]:py-2 [&_table_td]:align-top [&_table_th]:box-border [&_table_th]:overflow-hidden [&_table_th]:border [&_table_th]:border-gray-300 [&_table_th]:bg-transparent [&_table_th]:px-3 [&_table_th]:py-2 [&_table_th]:align-top [&_table_th]:font-normal [&_a.notice-file-attachment]:no-underline [&_a.notice-file-attachment]:text-gray-700"
```

(기존 className 끝에 `[&_a.notice-file-attachment]:no-underline [&_a.notice-file-attachment]:text-gray-700` 만 덧붙임 — prose 의 `<a>` 기본 색·밑줄이 첨부 박스 시각을 덮어쓰지 못하게)

- [ ] **Step 2: 빌드 확인**

Run: `pnpm build`
Expected: 성공

- [ ] **Step 3: Commit**

```bash
git add src/components/survey-builder/notice-renderer.tsx
git commit -m "feat: 응답 페이지 notice prose에서 첨부 버튼 스타일 보존"
```

---

## Phase 6 — 통합 검증

### Task 6.1: 통합 테스트 — publish 흐름

**Files:**
- Create: `tests/integration/publish-with-notice-attachment.test.ts`

- [ ] **Step 1: 통합 테스트 작성**

기존 통합 테스트의 setup 패턴 (예: `tests/integration/option-text-migration.test.ts`) 을 참고해서 작성. 이 테스트는 실제 DB 가 필요하지 않고 promote 모듈과 questions 배열 사이 결합만 검증하므로 단위 테스트와 유사한 구조로 가능.

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { promoteNoticeAttachments } from '@/lib/survey/notice-attachment-promote';
import { promoteSurveyImages } from '@/lib/survey/survey-image-promote';

describe('publish 통합 — survey 이미지 + notice 첨부 동시 처리', () => {
  beforeEach(() => {
    process.env.CLOUDFLARE_R2_PUBLIC_URL = 'https://cdn.test';
  });
  afterEach(() => {
    delete process.env.CLOUDFLARE_R2_PUBLIC_URL;
    vi.restoreAllMocks();
  });

  it('이미지 promote 후 첨부 promote 직렬 — noticeContent 안 양쪽 모두 영구 prefix 로', async () => {
    vi.doMock('@/lib/image-utils-server', () => ({
      moveR2Objects: vi.fn(async (pairs: Array<{ srcKey: string; dstKey: string }>) => ({
        movedKeys: pairs.map((p) => ({ srcKey: p.srcKey, dstKey: p.dstKey })),
        failed: [],
      })),
    }));
    const { promoteSurveyImages: promoteImages } = await import(
      '@/lib/survey/survey-image-promote'
    );
    const { promoteNoticeAttachments: promoteAttachments } = await import(
      '@/lib/survey/notice-attachment-promote'
    );

    const draftQuestions = [
      {
        type: 'notice',
        noticeContent:
          '<p>이미지: <img src="https://cdn.test/tmp/survey/img1.webp" /></p>' +
          '<p>첨부: <a data-file-attachment="true" ' +
          'href="https://cdn.test/tmp/notice-attachment/x.pdf" ' +
          'data-key="tmp/notice-attachment/x.pdf">공문</a></p>',
      },
    ];

    const promoted = await promoteAttachments(await promoteImages(draftQuestions));
    const html = promoted[0].noticeContent ?? '';
    expect(html).toContain('https://cdn.test/survey/img1.webp');
    expect(html).toContain('https://cdn.test/notice-attachment/x.pdf');
    expect(html).not.toContain('tmp/survey/');
    expect(html).not.toContain('tmp/notice-attachment/');
  });
});
```

- [ ] **Step 2: 테스트 실행**

Run: `pnpm vitest run tests/integration/publish-with-notice-attachment.test.ts`
Expected: PASS

- [ ] **Step 3: 전체 회귀 확인**

Run: `pnpm tsc --noEmit && pnpm vitest run tests/ && pnpm build`
Expected: 에러 0, 모든 테스트 PASS, 빌드 성공

- [ ] **Step 4: Commit**

```bash
git add tests/integration/publish-with-notice-attachment.test.ts
git commit -m "test: 공지사항 첨부 publish 통합 테스트 추가"
```

### Task 6.2: 수동 검증 (브라우저)

**Files:** 없음 (개발 서버 + 브라우저 작업)

- [ ] **Step 1: 개발 서버 실행**

```bash
pnpm dev
```

Expected: `http://localhost:3000` 에서 동작

- [ ] **Step 2: 공지사항 첨부 시나리오 검증**

다음 순서로 확인:

1. `/admin/surveys` → 임의 설문 편집 → 질문 추가 → 공지사항 타입 선택
2. 본문 작성: "본 평가 협조 공문은 아래에서 다운로드 받으세요."
3. 툴바 `Paperclip` 클릭 → 모달 등장 → PDF 파일 드래그 → 라벨 "협조 공문" 입력 → 업로드
4. 본문 안에 빨간 PDF 아이콘 + "협조 공문" 노드 등장 — `Files` (NodeView) 시각 확인
5. 노드 클릭 → 컨텍스트 툴바에서 라벨을 "참고 공문"으로 변경 → blur → 노드 라벨 변경 반영
6. 컨텍스트 툴바 `RefreshCw` 클릭 → 모달 재오픈 → 다른 파일(예: xlsx) 업로드 → 아이콘 초록 엑셀로 변경, 이전 `tmp/` 키는 DELETE 호출
7. 저장 → 페이지 새로고침 → 노드 그대로 유지
8. 미리보기 모드 → 응답자 화면에서 회색 박스 + 클립 + 라벨 + 파일명 표시 확인
9. 설문 발행 후 `/survey/<slug>?invite=...` 진입 → 첨부 클릭 → 원본 파일명으로 다운로드 됨
10. R2 dashboard 확인 — `notice-attachment/` 객체 존재, `tmp/notice-attachment/` 비어 있음

- [ ] **Step 3: 에러 경로 검증**

다음 케이스 확인:

| 시나리오 | 기대 동작 |
|---|---|
| 16MB 파일 업로드 시도 | "파일 크기는 15MB 이하여야 합니다" 표시 |
| `.exe` 업로드 시도 | "지원하지 않는 파일 형식" 표시 |
| 빈 파일 업로드 | "빈 파일은 업로드할 수 없습니다" 표시 |
| 업로드 도중 모달 닫기 | XHR abort, R2 정리 |
| 컨텍스트 툴바 삭제 | 노드 사라짐, `tmp/` 키 DELETE 호출 (네트워크 탭에서 확인) |

- [ ] **Step 4: 콘솔/네트워크 회귀 확인**

`/admin/surveys/<id>/edit` 페이지에서 콘솔 에러·warning 없는지 확인. 기존 이미지 업로드·테이블·링크 기능 정상 동작 확인.

- [ ] **Step 5: PR 작성**

```bash
git push -u origin feat/notice-file-attachment
gh pr create --title "feat: 공지사항 파일 첨부 다운로드 기능" --body "$(cat <<'EOF'
## Summary
- TipTap inline atom 노드 `fileAttachment` 추가 — 공지사항 본문 안에 PDF/HWP/Office/ZIP/이미지 첨부 자유 배치
- `/api/upload/notice-attachment` 신규 라우트 (mail-attachment 패턴 mirror, 공유 정책 모듈 `@/lib/upload/attachment-policy.ts` 추출 리팩터링 포함)
- publish 시 `tmp/notice-attachment/` → `notice-attachment/` promote (이미지 promote와 직렬)
- 빌더는 MIME별 색 아이콘 NodeView, 응답 페이지는 lucide Paperclip SVG data URI

Spec: docs/superpowers/specs/2026-05-26-notice-file-attachment-design.md
Plan: docs/superpowers/plans/2026-05-26-notice-file-attachment.md

## Test plan
- [ ] `pnpm tsc --noEmit` 통과
- [ ] `pnpm vitest run tests/` 전체 PASS
- [ ] `pnpm build` 성공
- [ ] 빌더에서 PDF/HWP/XLSX 업로드 → 노드 시각 확인
- [ ] 컨텍스트 툴바 라벨 편집·교체·삭제 동작
- [ ] 발행 후 응답 페이지 다운로드 — 원본 파일명 보존
- [ ] R2 dashboard 에서 영구·tmp prefix 분리 확인
EOF
)"
```

→ PR 생성 후 URL 을 사용자에게 반환.

---

## Self-Review 체크리스트

### 1. Spec coverage

| Spec 요구사항 | Task |
|---|---|
| TipTap inline atom 노드 | Task 2.2, 2.3 |
| 6필드 attrs (key/url/filename/label/size/mime) | Task 2.2 |
| 사용자 지정 라벨 + filename fallback | Task 2.2, 4.3 |
| 무제한 다중 첨부 | TipTap inline node 특성으로 자동 충족 |
| mail-attachment 정책 재사용 | Task 0.1, 1.1 |
| R2 public URL 접근 | Task 1.1 (응답 JSON 에 `url` 포함) |
| `tmp/notice-attachment/` → `notice-attachment/` promote | Task 3.1, 3.2 |
| sanitize allowlist 6종 확장 | Task 2.1 |
| 별도 업로드 라우트 (인증·MIME·HEAD 검증·Sentry) | Task 1.1 |
| 5층 cleanup (L1 모달 X, L2 교체, L3 삭제, L4 promote, L5 lifecycle) | Task 4.3 (L1), 5.1 (L2), 4.4 (L3), 3.2 (L4), 인프라 (L5) |
| 빌더 MIME별 색 아이콘 NodeView | Task 4.2 |
| 응답 페이지 CSS data URI 회색 클립 | Task 4.1, 5.2 |
| 컨텍스트 툴바 (라벨 편집·교체·삭제) | Task 4.4, 4.5, 5.1 |
| 단위 테스트 (node·sanitize·policy·promote) | Task 0.1, 2.1, 2.2, 3.1 |
| 통합 테스트 (publish) | Task 6.1 |
| 수동 검증 시나리오 | Task 6.2 |

### 2. Placeholder scan

- "TBD" / "TODO" / "추후" / "later" 검색 결과: 없음 ✓
- 모든 코드 step 에 실제 코드 박혀 있음 ✓
- 테스트는 실제 expect 와 함께 작성됨 ✓

### 3. Type consistency

- 노드 attrs 6개: `key`, `url`, `filename`, `label`, `size`, `mime` — Task 2.2, 4.2, 4.3, 4.4, 5.1 모두 일관 ✓
- 상수 이름: `TMP_NOTICE_ATTACHMENT_PREFIX`, `NOTICE_ATTACHMENT_PREFIX`, `MAX_ATTACHMENT_FILE_BYTES` — Task 0.1, 1.1, 3.1, 4.3 모두 일관 ✓
- API 응답 JSON: `{ key, url, filename, size, mime }` — Task 1.1 (서버), 4.3 (클라이언트 UploadResult), 5.1 (handleFileUploaded) 모두 일관 ✓
- 노드 이름: `fileAttachment` — Task 2.2, 4.4, 5.1 모두 일관 ✓

### 4. Ambiguity check

- `replaceNoticeAttachmentUrlsInQuestion` 의 split/join 이 `data-key` 까지 함께 변환하는 점을 Task 3.1 의 구현 직후 주석으로 명시 — 의도임을 확인 ✓
- mail-attachment route 리팩터링 (Task 0.1) 후 기존 통합 테스트가 어디에 있는지 — `tests/unit/mail-template/mail-image-promote.test.ts` 등 회귀 확인 명시 ✓
