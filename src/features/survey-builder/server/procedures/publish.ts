import { ORPCError } from '@orpc/server';

import { isSpssVarNameError } from '@/lib/spss/variable-name-guard';
import { authed } from '@/server/orpc';

import { PublishSurveyInput, SurveyVersionRowSchema } from '../../domain/survey-publish';
import * as svc from '../services/survey-publish.service';

/**
 * 설문 배포 procedure (authed).
 * 단일 트랜잭션으로 기존 published -> superseded, versionNumber=max+1,
 * currentVersionId 갱신을 보장(불변식 C).
 * SpssVarNameError는 BAD_REQUEST + issues 배열로 클라이언트에 전달.
 */
const publishSurvey = authed
  .input(PublishSurveyInput)
  .output(SurveyVersionRowSchema)
  .handler(async ({ input }) => {
    try {
      return await svc.publishSurvey(input);
    } catch (error) {
      if (isSpssVarNameError(error)) {
        throw new ORPCError('BAD_REQUEST', {
          message: error.message,
          data: { issues: error.issues },
        });
      }
      throw error;
    }
  });

export const publish = {
  publish: publishSurvey,
};
