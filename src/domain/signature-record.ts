import { z } from 'zod';
import type { Petition } from './model';

/**
 * The exact text a person read when they signed. Stored with their signature so it stays attached
 * to that wording even if the organizer revises the petition later.
 */
export const disclosureSchema = z
  .object({
    petitionId: z.string().min(1),
    title: z.string().min(1).max(500),
    fullText: z.string().min(1).max(50000),
    recipient: z.string().min(1).max(150),
    approximateLocation: z.string().min(1).max(150),
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
    title: p.title,
    fullText: `${p.problem}\n\nRequested action\n${p.action}`,
    recipient: p.recipient,
    approximateLocation: p.city,
    deadline: p.deadline,
    verification: p.verification,
    publicIdentities: p.identities,
    eligibilityRule: p.customRule,
  };
}
/** Field order matters: the server compares the same fields in the same order. */
const disclosureContext = (d: Disclosure) =>
  JSON.stringify([
    d.petitionId,
    d.title,
    d.fullText,
    d.recipient,
    d.approximateLocation,
    d.deadline,
    d.verification,
    d.publicIdentities,
    d.eligibilityRule,
  ]);

/** A handwritten signature as normalized stroke points; `start` begins a new stroke. */
export const pointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  start: z.boolean(),
});
export type SignaturePoint = z.infer<typeof pointSchema>;
export const signatureSchema = z
  .array(pointSchema)
  .min(8, 'Draw your signature before confirming.')
  .max(3000);

export const submissionSchema = z
  .object({
    disclosure: disclosureSchema,
    signature: signatureSchema,
    consent: z.literal(true),
  })
  .strict();
export type SignatureSubmission = z.infer<typeof submissionSchema>;
/** Readable only by the person who signed. Organizers and the public never see it. */
export interface SignatureReceipt {
  id: string;
  petitionId: string;
  disclosure: Disclosure;
  signature: SignaturePoint[];
  signedAt: string;
}
export function validateSubmission(p: Petition, input: unknown): SignatureSubmission {
  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      parsed.error.issues.some((i) => i.path[0] === 'signature')
        ? 'Draw your signature before confirming.'
        : 'Read the full petition and confirm your consent before signing.',
    );
  if (disclosureContext(parsed.data.disclosure) !== disclosureContext(petitionDisclosure(p)))
    throw new Error(
      'The petition changed while you were reviewing it. Reopen the signing form and read the latest text.',
    );
  return parsed.data;
}
