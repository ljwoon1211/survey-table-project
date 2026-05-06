import 'server-only';
import { cache } from 'react';

import { and, asc, desc, eq, ilike, or, sql, type AnyColumn, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import { contactTargets, contactUploads, surveys } from '@/db/schema';
import type { ContactColumnScheme } from '@/db/schema/schema-types';

import {
  attrsSortKey,
  maskBizNumber,
  maskEmail,
  type ContactsSortDir,
  type ContactsSortKey,
  type NormalizedContactListArgs,
} from './contacts';

export type ListContactsArgs = NormalizedContactListArgs & {
  surveyId: string;
  pageSize: number;
};

export interface ContactsRow {
  id: string;
  resid: number;
  groupValue: string | null;
  emailMasked: string;
  bizMasked: string;
  /** attrs 통째 (마스킹 안 됨 — UI 에서 컬럼별로 마스킹 적용) */
  attrs: Record<string, string>;
  /** 최신 attempt result_code (없으면 null) */
  latestResultCode: string | null;
  latestAttemptNo: number | null;
  respondedAt: Date | null;
  inviteToken: string;
  createdAt: Date;
}

export interface ListContactsResult {
  rows: ContactsRow[];
  total: number;
  page: number;
}

function orderExpr(col: AnyColumn | SQL, direction: ContactsSortDir): SQL {
  return direction === 'asc'
    ? sql`${col} ASC NULLS LAST`
    : sql`${col} DESC NULLS LAST`;
}

/**
 * 컨택리스트 메인 어댑터.
 *
 * 핵심:
 * - contact_targets 베이스 + 최신 contact_attempts (correlated subquery) 조인
 * - 검색 (qfield='all'/'resid'/'email'/'group'/'biz') + resultCode 필터
 * - page 클램프 (profiles.server.ts 패턴)
 * - PII 마스킹 (email/biz)
 *
 * 인덱스: idx_contact_attempts_target (contact_target_id, attempt_no DESC) INCLUDE (result_code)
 *   덕분에 latestResultCode subquery 가 index-only scan 으로 동작.
 */
export async function listContactsForSurvey(
  args: ListContactsArgs,
): Promise<ListContactsResult> {
  const { surveyId, page, pageSize, q, qfield, resultCode, sort, dir } = args;

  // 최신 회차의 result_code / attempt_no — 같은 subquery 모양을 SELECT/WHERE 양쪽에서 사용.
  // PG planner 가 동일 correlated subquery 를 dedupe 하며, idx_contact_attempts_target
  // (contact_target_id, attempt_no DESC) INCLUDE (result_code) 가 index-only scan 보장.
  const latestResultCodeExpr = sql<string | null>`(
    SELECT result_code FROM contact_attempts
    WHERE contact_target_id = ${contactTargets.id}
    ORDER BY attempt_no DESC LIMIT 1
  )`;
  const latestAttemptNoExpr = sql<number | null>`(
    SELECT attempt_no FROM contact_attempts
    WHERE contact_target_id = ${contactTargets.id}
    ORDER BY attempt_no DESC LIMIT 1
  )`;

  const whereParts: SQL[] = [eq(contactTargets.surveyId, surveyId)];

  const trimmed = q.normalize('NFC').trim();
  if (trimmed.length > 0) {
    if (qfield === 'resid') {
      const n = parseInt(trimmed, 10);
      whereParts.push(Number.isFinite(n) && n > 0 ? eq(contactTargets.resid, n) : sql`false`);
    } else {
      const escaped = trimmed
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      const pattern = `%${escaped}%`;

      if (qfield === 'email') {
        whereParts.push(ilike(contactTargets.email, pattern));
      } else if (qfield === 'biz') {
        whereParts.push(ilike(contactTargets.bizNumber, pattern));
      } else if (qfield === 'group') {
        whereParts.push(ilike(contactTargets.groupValue, pattern));
      } else {
        // all
        const orClause = or(
          ilike(contactTargets.email, pattern),
          ilike(contactTargets.bizNumber, pattern),
          ilike(contactTargets.groupValue, pattern),
        );
        if (orClause) whereParts.push(orClause);
      }
    }
  }

  if (resultCode !== 'all') {
    whereParts.push(sql`${latestResultCodeExpr} = ${resultCode}`);
  }

  const whereClause = and(...whereParts)!;

  // 카운트
  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(contactTargets)
    .where(whereClause);
  const total = countRow?.total ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const offset = (clampedPage - 1) * pageSize;

  // 정렬 컬럼 — 시스템 키는 fixed 매핑, attrs.<key> 는 JSONB 추출
  const SYSTEM_SORT_MAP = {
    resid: contactTargets.resid,
    respondedAt: contactTargets.respondedAt,
    createdAt: contactTargets.createdAt,
    email: contactTargets.email,
    group: contactTargets.groupValue,
  } as const;

  const attrsKey = attrsSortKey(sort);
  const orderCol: AnyColumn | SQL = attrsKey
    ? sql`${contactTargets.attrs} ->> ${attrsKey}`
    : SYSTEM_SORT_MAP[sort as keyof typeof SYSTEM_SORT_MAP];

  const dataRows = await db
    .select({
      id: contactTargets.id,
      resid: contactTargets.resid,
      groupValue: contactTargets.groupValue,
      email: contactTargets.email,
      bizNumber: contactTargets.bizNumber,
      attrs: contactTargets.attrs,
      respondedAt: contactTargets.respondedAt,
      inviteToken: contactTargets.inviteToken,
      createdAt: contactTargets.createdAt,
      latestResultCode: latestResultCodeExpr.as('latest_result_code'),
      latestAttemptNo: latestAttemptNoExpr.as('latest_attempt_no'),
    })
    .from(contactTargets)
    .where(whereClause)
    .orderBy(orderExpr(orderCol, dir), asc(contactTargets.id))
    .limit(pageSize)
    .offset(offset);

  const rows: ContactsRow[] = dataRows.map((r) => ({
    id: r.id,
    resid: r.resid,
    groupValue: r.groupValue,
    emailMasked: maskEmail(r.email),
    bizMasked: maskBizNumber(r.bizNumber),
    attrs: (r.attrs ?? {}) as Record<string, string>,
    latestResultCode: r.latestResultCode,
    latestAttemptNo: r.latestAttemptNo,
    respondedAt: r.respondedAt,
    inviteToken: r.inviteToken,
    createdAt: r.createdAt,
  }));

  return { rows, total, page: clampedPage };
}

export interface ContactUploadRow {
  id: string;
  filename: string;
  uploadedRows: number;
  mergedRows: number;
  errorRows: number;
  createdAt: Date;
}

export async function listContactUploads(surveyId: string): Promise<ContactUploadRow[]> {
  const rows = await db
    .select({
      id: contactUploads.id,
      filename: contactUploads.filename,
      uploadedRows: contactUploads.uploadedRows,
      mergedRows: contactUploads.mergedRows,
      errorRows: contactUploads.errorRows,
      createdAt: contactUploads.createdAt,
    })
    .from(contactUploads)
    .where(eq(contactUploads.surveyId, surveyId))
    .orderBy(desc(contactUploads.createdAt));
  return rows;
}

/**
 * surveys.contact_columns 캐시 (RSC pass 내 dedupe).
 * NULL 이면 null 반환 — 호출자가 디폴트 스킴 생성.
 */
export const getContactColumnScheme = cache(
  async (surveyId: string): Promise<ContactColumnScheme | null> => {
    const [row] = await db
      .select({ contactColumns: surveys.contactColumns })
      .from(surveys)
      .where(eq(surveys.id, surveyId))
      .limit(1);
    return (row?.contactColumns as ContactColumnScheme | null) ?? null;
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 컨택 단건 편집 (slice 3 detail page) — 0016 마이그레이션 활용
// ─────────────────────────────────────────────────────────────────────────────

import { contactAttempts } from '@/db/schema';
import {
  CONTACT_METHOD_LABEL,
  DEFAULT_RESULT_CODES,
  type ContactMethod,
  type ContactResultCode,
} from '@/db/schema/schema-types';

export interface ContactDetailRow {
  id: string;
  surveyId: string;
  resid: number;
  groupValue: string | null;
  email: string | null;
  bizNumber: string | null;
  attrs: Record<string, string>;
  memo: string | null;
  contactMethod: ContactMethod | null;
  inviteToken: string;
  respondedAt: Date | null;
  responseId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactAttemptRow {
  id: string;
  attemptNo: number;
  resultCode: string;
  note: string | null;
  createdAt: Date;
}

export interface ContactDetailResult {
  contact: ContactDetailRow;
  attempts: ContactAttemptRow[];
}

/**
 * 컨택 단건 편집 페이지용 — 컨택 본체 + 회차 이력 (최근순).
 * 본인 survey 의 컨택만 조회 (surveyId guard 호출자가 책임).
 */
export async function getContactDetailById(
  id: string,
): Promise<ContactDetailResult | null> {
  const [contact] = await db
    .select({
      id: contactTargets.id,
      surveyId: contactTargets.surveyId,
      resid: contactTargets.resid,
      groupValue: contactTargets.groupValue,
      email: contactTargets.email,
      bizNumber: contactTargets.bizNumber,
      attrs: contactTargets.attrs,
      memo: contactTargets.memo,
      contactMethod: contactTargets.contactMethod,
      inviteToken: contactTargets.inviteToken,
      respondedAt: contactTargets.respondedAt,
      responseId: contactTargets.responseId,
      createdAt: contactTargets.createdAt,
      updatedAt: contactTargets.updatedAt,
    })
    .from(contactTargets)
    .where(eq(contactTargets.id, id))
    .limit(1);

  if (!contact) return null;

  const attempts = await db
    .select({
      id: contactAttempts.id,
      attemptNo: contactAttempts.attemptNo,
      resultCode: contactAttempts.resultCode,
      note: contactAttempts.note,
      createdAt: contactAttempts.createdAt,
    })
    .from(contactAttempts)
    .where(eq(contactAttempts.contactTargetId, id))
    .orderBy(desc(contactAttempts.attemptNo));

  return {
    contact: {
      ...contact,
      attrs: (contact.attrs ?? {}) as Record<string, string>,
      contactMethod: contact.contactMethod as ContactMethod | null,
    },
    attempts,
  };
}

/**
 * 결과코드 조회 — surveys.contact_result_codes 가 NULL 이면 DEFAULT_RESULT_CODES 반환.
 * RSC dedupe 위해 React.cache 적용.
 */
export const getContactResultCodes = cache(
  async (surveyId: string): Promise<ContactResultCode[]> => {
    const [row] = await db
      .select({ codes: surveys.contactResultCodes })
      .from(surveys)
      .where(eq(surveys.id, surveyId))
      .limit(1);
    const codes = (row?.codes as ContactResultCode[] | null) ?? null;
    return codes ?? DEFAULT_RESULT_CODES;
  },
);

export { CONTACT_METHOD_LABEL };
