import { qualificationSchema } from './qualification';
import { z } from 'zod';
import type { Petition } from './model';
import { envelopeSchema, signatorySchema } from './signatory';

/** Ordered fields are also the authenticated encryption context. Never reconstruct from current petition data when opening an old receipt. */
export const disclosureSchema = z
  .object({
    petitionId: z.string().min(1),
    title: z.string().min(1).max(500),
    fullText: z.string().min(1).max(50000),
    recipient: z.string().min(1).max(150),
    approximateLocation: z.string().min(1).max(150),
    qualification: qualificationSchema.nullable().optional(),
    deadline: z.string(),
    verification: z.string(),
    publicIdentities: z.array(z.string()),
    eligibilityRule: z.string(),
  })
  .strict();
export type Disclosure = z.infer<typeof disclosureSchema>;
export function petitionDisclosure(p: Petition): Disclosure {
  return {
    petitionId: p.id,
    title: p.qualification?.details?.officialTitle ?? p.title,
    fullText:
      p.qualification?.details?.officialText ?? `${p.problem}\n\nRequested action\n${p.action}`,
    recipient: p.recipient,
    approximateLocation: p.qualification?.details?.jurisdiction ?? p.city,
    qualification: p.qualification?.details ?? null,
    deadline: p.deadline,
    verification: p.verification,
    publicIdentities: p.identities,
    eligibilityRule: p.customRule,
  };
}
export function disclosureContext(d: Disclosure) {
  return JSON.stringify([
    d.petitionId,
    d.title,
    d.fullText,
    d.recipient,
    d.approximateLocation,
    d.deadline,
    d.verification,
    d.publicIdentities,
    d.eligibilityRule,
    ...(d.qualification === undefined
      ? []
      : [
          d.qualification
            ? [
                d.qualification.jurisdiction,
                d.qualification.authority,
                d.qualification.measureId,
                d.qualification.officialTitle,
                d.qualification.officialText,
                d.qualification.sourceUrl,
                d.qualification.statutoryRule,
                d.qualification.statutoryThreshold,
                d.qualification.circulatorDeclaration,
                d.qualification.notarization,
              ]
            : null,
        ]),
  ]);
}
export const submissionSchema = z
  .object({
    disclosure: disclosureSchema,
    envelope: envelopeSchema,
    consent: z.literal(true),
  })
  .strict();
export type SignatureSubmission = z.infer<typeof submissionSchema>;
export const receiptPayloadSchema = z
  .object({
    disclosure: disclosureSchema,
    signatory: signatorySchema,
    confirmedAt: z.string().datetime(),
  })
  .strict();
export type ReceiptPayload = z.infer<typeof receiptPayloadSchema>;
export interface SignatureReceipt extends SignatureSubmission {
  id: string;
  petitionId: string;
  submittedAt: string;
  status: 'pending' | 'accepted' | 'rejected';
  reviewNote: string;
}
export function validateSubmission(p: Petition, input: unknown): SignatureSubmission {
  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      'Review the full petition and provide your encrypted signatory record before confirming.',
    );
  if (disclosureContext(parsed.data.disclosure) !== disclosureContext(petitionDisclosure(p)))
    throw new Error(
      'The petition changed while you were reviewing it. Reopen the signing form and read the latest text.',
    );
  return parsed.data;
}
