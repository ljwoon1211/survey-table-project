import * as z from 'zod';

import { authed } from '@/server/orpc';

import {
  AddContactAttemptInput,
  AttemptResultSchema,
  DeleteContactAttemptInput,
  UpdateContactAttemptInput,
} from '../../domain/contact-attempt';
import * as svc from '../services/contact-attempts.service';

const add = authed
  .input(AddContactAttemptInput)
  .output(AttemptResultSchema)
  .handler(({ input }) => svc.addAttempt(input));

const update = authed
  .input(UpdateContactAttemptInput)
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input }) => {
    await svc.updateAttempt(input);
    return { ok: true as const };
  });

const remove = authed
  .input(DeleteContactAttemptInput)
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input }) => {
    await svc.deleteAttempt(input);
    return { ok: true as const };
  });

export const attempts = {
  add,
  update,
  remove,
};
