import { z } from 'zod';
import type { Petition } from './model';
export const qualificationSchema = z
  .object({
    jurisdiction: z.string().trim().min(3).max(150),
    authority: z.string().trim().min(3).max(150),
    measureId: z.string().trim().min(2).max(150),
    officialTitle: z.string().trim().min(3).max(500),
    officialText: z.string().trim().min(30).max(50000),
    sourceUrl: z
      .string()
      .url()
      .refine(
        (v) => v.startsWith('https://'),
        'Use an HTTPS source from the responsible authority.',
      ),
    statutoryRule: z.string().trim().min(10).max(2000),
    statutoryThreshold: z.number().int().min(1).max(100000000),
    circulatorDeclaration: z.string().trim().min(30).max(10000),
    notarization: z.enum(['required', 'not_required']),
  })
  .strict();
export type QualificationDetails = z.infer<typeof qualificationSchema>;
export interface Qualification {
  details: QualificationDetails | null;
  status: 'missing' | 'pending' | 'verified' | 'rejected';
  reviewNote: string;
  affidavitCount: number;
  acceptedAffidavits: number;
}
export const emptyQualification = (): Qualification => ({
  details: null,
  status: 'missing',
  reviewNote: '',
  affidavitCount: 0,
  acceptedAffidavits: 0,
});
export function qualificationChecklist(p: Petition) {
  const q = p.qualification ?? emptyQualification();
  return [
    {
      title: 'Signatory data',
      ready: (p.acceptedSignatures ?? 0) > 0,
      detail: `${p.recordedSignatures ?? 0} encrypted records; ${p.acceptedSignatures ?? 0} accepted after residence and signature review.`,
    },
    {
      title: 'Circulator affidavit',
      ready: q.acceptedAffidavits > 0,
      detail: `${q.affidavitCount} submitted; ${q.acceptedAffidavits} accepted.${q.details ? (q.details.notarization === 'required' ? ' Notarization required.' : 'Organizer supplied a no-notarization rule; authority review required.') : ' Jurisdiction-specific declaration required.'}`,
    },
    {
      title: 'Official title and full text',
      ready: q.status === 'verified',
      detail:
        q.status === 'verified'
          ? 'Authority-reviewed text is preserved on each new signature receipt.'
          : q.details
            ? 'Organizer-supplied text awaits authority review.'
            : 'Official measure text and source have not been supplied.',
    },
    {
      title: 'Statutory signature threshold',
      ready:
        q.status === 'verified' &&
        (p.acceptedSignatures ?? 0) >= (q.details?.statutoryThreshold ?? Infinity),
      detail: q.details
        ? `${p.acceptedSignatures ?? 0} accepted / ${q.details.statutoryThreshold.toLocaleString()} required (${q.status === 'verified' ? 'reviewed requirement' : 'unreviewed organizer submission'}).`
        : 'Exact statutory count and legal source required. The community goal does not substitute for this.',
    },
  ];
}
