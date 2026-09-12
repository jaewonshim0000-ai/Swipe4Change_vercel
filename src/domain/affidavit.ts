import { z } from 'zod';
import { envelopeSchema, signatorySchema } from './signatory';
export const affidavitContextSchema = z
  .object({
    id: z.string().uuid(),
    petitionId: z.string().min(1),
    signatureIds: z
      .array(z.string().min(1))
      .min(1)
      .max(200)
      .refine((ids) => new Set(ids).size === ids.length, 'Select each signature only once.'),
    declaration: z.string().min(30).max(10000),
    witnessed: z.literal(true),
    notarizationProvided: z.boolean(),
  })
  .strict();
export const affidavitSubmissionSchema = affidavitContextSchema.extend({
  envelope: envelopeSchema,
});
export type AffidavitContext = z.infer<typeof affidavitContextSchema>;
export type AffidavitSubmission = z.infer<typeof affidavitSubmissionSchema>;
export const affidavitPayloadSchema = z
  .object({
    context: affidavitContextSchema,
    signatory: signatorySchema,
    sheetReference: z.string().trim().min(3).max(200),
    notaryReference: z.string().trim().max(1000),
    signedAt: z.string().datetime(),
  })
  .strict()
  .refine(
    (v) => !v.context.notarizationProvided || v.notaryReference.length >= 3,
    'Enter the notarized document reference.',
  );
export type AffidavitPayload = z.infer<typeof affidavitPayloadSchema>;
export interface Affidavit extends AffidavitSubmission {
  status: 'pending' | 'accepted' | 'rejected';
  reviewNote: string;
  submittedAt: string;
}
export function affidavitContext(value: AffidavitContext) {
  return JSON.stringify([
    value.id,
    value.petitionId,
    value.signatureIds,
    value.declaration,
    value.witnessed,
    value.notarizationProvided,
  ]);
}
