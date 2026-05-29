import 'server-only';

import { mailRecipients } from '@/db/schema/mail';
import type { MailRecipientStatus } from '@/db/schema/mail';

/**
 * newStatus 기준 역행 가드. webhook(eventType->status)과 reconcile(last_event->status)이
 * 동일한 newStatus에 대해 동일한 allowedPrev를 공유하기 위한 단일 출처.
 */
export const STATUS_ALLOWED_PREV: Partial<Record<MailRecipientStatus, MailRecipientStatus[]>> = {
  sent: ['queued'],
  delivered: ['queued', 'sent'],
  opened: ['queued', 'sent', 'delivered'],
  bounced: ['queued', 'sent', 'delivered', 'opened'],
  complained: ['queued', 'sent', 'delivered', 'opened'],
  failed: ['queued', 'sending', 'sent'],
};

/** prev -> next 전이가 허용되는지(역행/중복이면 false). */
export function canTransition(
  prev: MailRecipientStatus,
  next: MailRecipientStatus,
): boolean {
  return STATUS_ALLOWED_PREV[next]?.includes(prev) ?? false;
}

/** Resend webhook payload type -> 우리 status. 미매핑(delivery_delayed 등)은 null. */
export function mapResendWebhookType(eventType: string): MailRecipientStatus | null {
  switch (eventType) {
    case 'email.sent':
      return 'sent';
    case 'email.delivered':
      return 'delivered';
    case 'email.opened':
      return 'opened';
    case 'email.bounced':
      return 'bounced';
    case 'email.complained':
      return 'complained';
    default:
      return null;
  }
}

/** Resend GetEmail last_event -> 우리 status. 미전달/대기 상태는 null(변동 없음). */
export function mapResendLastEvent(lastEvent: string): MailRecipientStatus | null {
  switch (lastEvent) {
    case 'delivered':
      return 'delivered';
    case 'opened':
    case 'clicked':
      return 'opened';
    case 'bounced':
      return 'bounced';
    case 'complained':
      return 'complained';
    case 'failed':
    case 'canceled':
      return 'failed';
    case 'suppressed':
      return 'bounced';
    default:
      // sent, queued, scheduled, delivery_delayed -> 아직 미전달, 변동 없음
      return null;
  }
}

/** status별 타임스탬프 컬럼 채움. */
export function buildTimestampUpdate(
  status: MailRecipientStatus,
  at: Date,
): Partial<typeof mailRecipients.$inferInsert> {
  switch (status) {
    case 'sent':
      return { sentAt: at };
    case 'delivered':
      return { deliveredAt: at };
    case 'opened':
      return { openedAt: at };
    case 'bounced':
      return { bouncedAt: at };
    case 'complained':
      return { complainedAt: at };
    default:
      return {};
  }
}
