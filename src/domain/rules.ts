import { z } from 'zod';
import {
  Draft,
  EditPatch,
  EditableField,
  Identity,
  Petition,
  Profile,
  Snapshot,
  editableFields,
  fieldLabels,
  identityModes,
  topics,
  verificationModes,
  volunteerRoles,
  communitySpaces,
  deliveryMethods,
  postKinds,
} from './model';
import { sameCity } from './location';
export const evidenceSchema = z.array(
  z.object({
    label: z.string().trim().min(3),
    url: z
      .string()
      .url()
      .refine((v) => v.startsWith('https://'), 'Use an HTTPS link.'),
  }),
);
/** An organizer's external fundraising page. Empty removes it. */
export const donationUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === '' || (z.string().url().safeParse(v).success && v.startsWith('https://')),
    'Use an HTTPS link to your fundraising page.',
  );
/** Demo photos are stored inline; hosted ones live in the public petition-photos bucket. */
export const photoSchema = z.object({
  url: z
    .string()
    .refine(
      (v) =>
        (v.startsWith('data:image/jpeg;base64,') && v.length <= 700000) ||
        (/^https:\/\/[^/\s]+\/storage\/v1\/object\/public\/petition-photos\/[\w-]+\.jpg$/.test(v) &&
          v.length <= 500),
      'Upload the photo through the app.',
    ),
  alt: z
    .string()
    .trim()
    .min(5, 'Describe the photo in a few words for people using screen readers.')
    .max(200),
});
const draftObject = z.object({
  title: z.string().trim().min(12, 'Use at least 12 characters.').max(120),
  summary: z.string().trim().min(20).max(240),
  problem: z.string().trim().min(30, 'Explain the problem in at least 30 characters.').max(5000),
  action: z.string().trim().min(15).max(1000),
  recipient: z.string().trim().min(3).max(150),
  topic: z.enum(topics),
  city: z.string().trim().min(2).max(100),
  /** Optional: '' is a petition that belongs to no community. */
  communityId: z.string(),
  goal: z.number().int().min(10).max(1000000),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
    .refine(
      (v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
      'Enter a real date.',
    )
    .refine((v) => Date.parse(v) > Date.now(), 'Choose a future date.'),
  evidence: evidenceSchema,
  verification: z.enum(verificationModes),
  identities: z.array(z.enum(identityModes)).min(1, 'Allow at least one public identity mode.'),
  customRule: z.string().max(1000),
});
export const draftSchema = draftObject
  .refine((v) => v.verification !== 'custom' || v.customRule.trim().length >= 15, {
    path: ['customRule'],
    message: 'Describe your eligibility rule in at least 15 characters.',
  })
  .refine((v) => v.verification !== 'community' || v.communityId !== '', {
    path: ['verification'],
    message: 'Community-only signing needs a community. Pick one, or choose who else may sign.',
  });
/**
 * A published petition is revised field by field. Each supplied field is validated with the same
 * rule the creation form uses; the merged result is then checked against `draftSchema` so a patch
 * cannot leave the petition in a state the creation flow would have rejected.
 */
export const editPatchSchema = draftObject
  .pick(Object.fromEntries(editableFields.map((f) => [f, true])) as { [K in EditableField]: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Change at least one field.');
function describeValue(value: unknown): string {
  if (typeof value === 'string') return `“${value}”`;
  if (Array.isArray(value))
    return (
      value
        .map((item) =>
          item && typeof item === 'object' && 'label' in item ? String(item.label) : String(item),
        )
        .join(', ') || 'none'
    );
  return String(value);
}
/** Public, human-readable before/after wording for the edit history. Prior wording is preserved. */
export function describeEdit(before: Draft, after: Draft, changed: EditableField[]) {
  return changed
    .map((f) => `${fieldLabels[f]}: ${describeValue(before[f])} → ${describeValue(after[f])}`)
    .join('. ');
}
/** Which editable fields a patch would actually change. */
export function changedFields(before: Draft, patch: EditPatch): EditableField[] {
  return editableFields.filter(
    (f) => f in patch && JSON.stringify(before[f]) !== JSON.stringify(patch[f]),
  );
}
export const milestones = [25, 50, 75, 100] as const;
/** Milestone percentages a signature count has reached. Progress only; never a policy outcome. */
export const reachedMilestones = (count: number, goal: number) =>
  milestones.filter((n) => goal > 0 && count / goal >= n / 100);
/** The highest milestone newly crossed between two counts, if any. */
export function crossedMilestone(before: number, after: number, goal: number) {
  const had = reachedMilestones(before, goal);
  return reachedMilestones(after, goal)
    .filter((n) => !had.includes(n))
    .pop();
}
/** Trailing window used for "recent" signature velocity, matching the SQL snapshot. */
export const VELOCITY_WINDOW_MS = 7 * 86400000;
export const postSchema = z.string().trim().min(5, 'Write at least 5 characters.').max(2000);
export const communitySchema = z.object({
  name: z.string().trim().min(3, 'Use at least 3 characters.').max(60),
  description: z
    .string()
    .trim()
    .min(20, 'Describe the community in at least 20 characters.')
    .max(280),
  city: z.string().trim().min(2, 'Enter a city and state.').max(100),
  topic: z.enum(topics),
});
/** One schema for every community post. An event additionally needs a date. */
export const communityPostSchema = z
  .object({
    body: postSchema,
    kind: z.enum(postKinds),
    space: z.enum(communitySpaces),
    channel: z.string().trim().max(40),
    eventAt: z.string().trim().optional(),
    location: z.string().trim().max(120).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'event' && (!v.eventAt || Number.isNaN(Date.parse(v.eventAt))))
      ctx.addIssue({ code: 'custom', path: ['eventAt'], message: 'Give the event a date.' });
    // An announcement carries the community's voice, so it only exists where that voice lives.
    if (v.kind === 'announcement' && v.space !== 'announcements')
      ctx.addIssue({
        code: 'custom',
        path: ['space'],
        message: 'Announcements belong in the announcements space.',
      });
  });
/**
 * Recording a delivery. The note is where an organizer says which inbox, meeting or reference
 * number it went to, so a later response can be matched to it.
 */
export const deliverySchema = z.object({
  method: z.enum(deliveryMethods),
  note: z
    .string()
    .trim()
    .min(5, 'Say where it went — an inbox, a meeting, a portal reference.')
    .max(500),
});
/** Reasons are read by moderators, so they need to be specific enough to act on. */
export const reportReasonSchema = z
  .string()
  .trim()
  .min(10, 'Say what is wrong in at least 10 characters.')
  .max(500);
/**
 * An offer of help. Withdrawing is the same command with no roles, so a volunteer can step back
 * without asking the organizer. The note is optional and capped; it is not a contact channel.
 */
export const volunteerSchema = z.object({
  roles: z.array(z.enum(volunteerRoles)).max(volunteerRoles.length),
  note: z.string().trim().max(500, 'Keep the note under 500 characters.'),
});
export function canManage(p: Petition, profile: Profile | null) {
  return !!profile && (p.ownerId === profile.id || p.collaborators.includes(profile.id));
}
export function signingError(
  p: Petition,
  s: Snapshot,
  identity: Identity,
  now = Date.now(),
): string | null {
  if (!s.profile) return 'Sign in to add your voice.';
  if (p.status !== 'active' || Date.parse(p.deadline) < now)
    return 'This petition is no longer accepting signatures.';
  if (s.signed.includes(p.id)) return 'You have already signed this petition.';
  if (!p.identities.includes(identity)) return 'Choose an identity mode allowed by the organizer.';
  if (p.verification === 'email' && !s.profile.emailVerified)
    return 'A verified email is required. Verify it with your authentication provider.';
  if (p.verification === 'community' && !s.profile.joined.includes(p.communityId))
    return 'Join this community before signing.';
  if (p.verification === 'location' && !s.profile.locationApproved)
    return 'Location verification requires an approved attestation. An approximate city alone does not establish eligibility.';
  if (s.profile && p.verification === 'custom' && !s.customApprovals.includes(p.id))
    return 'Request eligibility review below. The organizer must approve it before you sign.';
  return null;
}
/** Presentation state derived from the same rules that reject an invalid signature. */
export function signingStatus(
  p: Petition,
  s: Snapshot,
  identity: Identity,
  now = Date.now(),
): { state: 'eligible' | 'additional' | 'pending' | 'ineligible'; message: string | null } {
  const message = signingError(p, s, identity, now);
  if (!message) return { state: 'eligible', message: null };
  if (
    p.status !== 'active' ||
    Date.parse(p.deadline) < now ||
    s.signed.includes(p.id) ||
    !p.identities.includes(identity)
  )
    return { state: 'ineligible', message };
  if (s.profile && p.verification === 'custom' && !s.customApprovals.includes(p.id))
    return { state: 'pending', message };
  return { state: 'additional', message };
}
export function publicName(name: string, identity: Identity) {
  const words = name.trim().split(/\s+/);
  return identity === 'anonymous'
    ? 'Anonymous supporter'
    : identity === 'full_name'
      ? name
      : `${words[0]}${words.length > 1 ? ` ${words[words.length - 1][0]}.` : ''}`;
}
export function analyzeDraft(d: Partial<Draft>) {
  const rubric = [
    { label: 'A specific requested action', points: 20, met: (d.action?.trim().length ?? 0) >= 15 },
    { label: 'A responsible recipient', points: 15, met: (d.recipient?.trim().length ?? 0) >= 3 },
    { label: 'A clear problem', points: 15, met: (d.problem?.trim().length ?? 0) >= 30 },
    { label: 'An approximate location', points: 10, met: (d.city?.trim().length ?? 0) >= 2 },
    {
      label: 'A future deadline',
      points: 10,
      met: !!d.deadline && Date.parse(d.deadline) > Date.now(),
    },
    {
      label: 'At least one supplied source (not fact-checked)',
      points: 15,
      met: !!d.evidence?.length,
    },
    { label: 'A measurable signature goal', points: 15, met: (d.goal ?? 0) >= 10 },
  ];
  const action = d.action?.trim();
  return {
    score: rubric.reduce((n, r) => n + (r.met ? r.points : 0), 0),
    rubric,
    title: action
      ? `${action.replace(/[.!?]+$/, '')}${d.city ? ` in ${d.city}` : ''}`.slice(0, 120)
      : '',
    summary:
      action && d.recipient
        ? `We ask ${d.recipient.trim()} to ${action.charAt(0).toLowerCase()}${action.slice(1).replace(/[.!?]+$/, '')}${d.city ? ` in ${d.city}` : ''}.`.slice(
            0,
            240,
          )
        : '',
    category:
      d.topic === 'Education'
        ? 'School or campus administration'
        : 'Relevant local public service department',
  };
}
/**
 * A community backs a petition once at least three members vote yes and yes outnumbers no. A
 * fixed floor rather than a share of members: sample headcounts never vote, and a new community
 * of five should be able to decide as well as one of five hundred.
 */
export const backingQuorum = 3;
export const backingReached = (yes: number, no: number) => yes >= backingQuorum && yes > no;
/** Communities that voted to back the petition. */
export const backers = (p: Petition) =>
  p.backing.filter((b) => b.backedAt).map((b) => b.communityId);
/** The explainable base score a new account sees. Behaviour is layered on top in for-you.ts. */
export function scorePetition(p: Petition, profile: Profile | null, now = Date.now()) {
  const own = !!profile?.joined.includes(p.communityId);
  // A petition your community voted to back counts as one of your community's own.
  const backed = !own && backers(p).some((id) => profile?.joined.includes(id));
  const factors = {
    interests: profile?.interests.includes(p.topic) ? 35 : 0,
    location: sameCity(profile?.city, p.city) ? 30 : 0,
    community: own || backed ? 20 : 0,
    activity: 10 * Math.max(0, 1 - (now - Date.parse(p.createdAt)) / (30 * 86400000)),
    endorsements: 5 * Math.min(1, p.endorsements.length / 3),
  };
  return {
    score: Object.values(factors).reduce((a, b) => a + b, 0),
    factors,
    reasons: [
      factors.interests ? 'Matches your interests' : '',
      factors.location ? `Near ${p.city}` : '',
      own ? 'From your community' : backed ? 'Backed by your community' : '',
    ].filter(Boolean),
  };
}
export function trendingScore(p: Petition, now = Date.now()) {
  const freshness = Math.max(0, 1 - (now - Date.parse(p.createdAt)) / (60 * 86400000));
  return (
    (Math.min(50, p.recentSignatures) * 0.5 +
      Math.min(30, p.saves) * 0.2 +
      Math.min(20, p.discussion.length) * 0.2 +
      10 * freshness) *
    Math.min(1, p.count / 20)
  );
}
export function optimisticSnapshot(
  s: Snapshot,
  c: { type: 'save' | 'sign'; petitionId: string },
): Snapshot {
  const saved = s.saved.includes(c.petitionId);
  return {
    ...s,
    saved:
      c.type === 'save'
        ? saved
          ? s.saved.filter((id) => id !== c.petitionId)
          : [...s.saved, c.petitionId]
        : s.saved,
    signed: c.type === 'sign' ? [...s.signed, c.petitionId] : s.signed,
    petitions: s.petitions.map((p) =>
      p.id !== c.petitionId
        ? p
        : {
            ...p,
            count: p.count + (c.type === 'sign' ? 1 : 0),
            saves: p.saves + (c.type === 'save' ? (saved ? -1 : 1) : 0),
          },
    ),
  };
}
