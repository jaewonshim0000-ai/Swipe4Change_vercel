import { z } from 'zod';
import { Petition, ResponseCheck } from './model';

export const responseCheckStatusLabels: Record<ResponseCheck['status'], string> = {
  not_reviewed: 'Not reviewed',
  answered: 'Answer covers this ask',
  partial: 'Answer partly covers this ask',
  unanswered: 'Answer does not address this ask',
};

const checkSchema = z.object({
  ask: z.string().trim().min(12, 'Describe a specific ask in at least 12 characters.').max(240),
  status: z.enum(['not_reviewed', 'answered', 'partial', 'unanswered']),
  note: z.string().trim().max(500),
  responseId: z.string().trim().optional(),
});
export const responseChecksSchema = z
  .array(checkSchema)
  .min(1, 'List at least one ask.')
  .max(3, 'Use no more than three asks.')
  .superRefine((checks, ctx) => {
    if (new Set(checks.map((c) => c.ask.toLowerCase())).size !== checks.length)
      ctx.addIssue({ code: 'custom', message: 'Each ask must be distinct.' });
    checks.forEach((check, index) => {
      if (check.status !== 'not_reviewed' && !check.responseId)
        ctx.addIssue({
          code: 'custom',
          path: [index, 'responseId'],
          message: 'Choose a verified response before assessing an ask.',
        });
      if (check.status !== 'not_reviewed' && check.note.length < 12)
        ctx.addIssue({
          code: 'custom',
          path: [index, 'note'],
          message: 'Explain the assessment in at least 12 characters.',
        });
    });
  });

/** Legacy and new petitions have one visible ask until the organizer breaks it into smaller ones. */
export function responseChecksFor(p: Petition): ResponseCheck[] {
  return p.responseChecks?.length
    ? p.responseChecks
    : [{ ask: p.action, status: 'not_reviewed', note: '' }];
}

export function prepareResponseChecks(
  p: Petition,
  input: ResponseCheck[],
  by: string,
  now: string,
) {
  const checks = responseChecksSchema.parse(input);
  for (const check of checks) {
    if (
      check.status !== 'not_reviewed' &&
      check.responseId &&
      !p.responses.some(
        (response) =>
          response.id === check.responseId &&
          response.verification === 'verified' &&
          !response.removed,
      )
    )
      throw new Error('Choose a verified, available response from this petition.');
  }
  return checks.map((check) => ({
    ...check,
    ...(check.status === 'not_reviewed'
      ? { note: '', responseId: undefined, reviewedAt: undefined, reviewedBy: undefined }
      : { reviewedAt: now, reviewedBy: by }),
  }));
}
