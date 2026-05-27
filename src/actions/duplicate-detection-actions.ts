'use server';

import { headers } from 'next/headers';

import { computeSignals } from '@/lib/duplicate-detection/signals';
import { checkTrackA, checkTrackB } from '@/lib/duplicate-detection/check';
import type { ClientSignals, CheckResult } from '@/lib/duplicate-detection/types';

export async function checkDuplicateOnEntry(input: {
  surveyId: string;
  inviteToken?: string;
  clientSignals: ClientSignals;
}): Promise<CheckResult> {
  const { surveyId, inviteToken, clientSignals } = input;

  // Track A: invite_token 1순위 — headers() 호출 없이 단락
  if (inviteToken) {
    return checkTrackA(surveyId, inviteToken);
  }

  // Track B: 공개/비공개 신호 기반
  const h = await headers();
  const signals = computeSignals(h as unknown as Headers, clientSignals);
  return checkTrackB({ surveyId, signals });
}
