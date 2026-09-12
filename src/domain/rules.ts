import { z } from 'zod';
import {
  Draft,
  Identity,
  Petition,
  Profile,
  Snapshot,
  identityModes,
  topics,
  verificationModes,
} from './model';
export const evidenceSchema = z.array(
  z.object({
    label: z.string().trim().min(3),
    url: z
      .string()
      .url()
      .refine((v) => v.startsWith('https://'), 'Use an HTTPS link.'),
  }),
);
export const draftSchema = z
  .object({
    title: z.string().trim().min(12, 'Use at least 12 characters.').max(120),
    summary: z.string().trim().min(20).max(240),
    problem: z.string().trim().min(30, 'Explain the problem in at least 30 characters.').max(5000),
    action: z.string().trim().min(15).max(1000),
    recipient: z.string().trim().min(3).max(150),
    topic: z.enum(topics),
    city: z.string().trim().min(2).max(100),
    communityId: z.string().min(1),
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
  })
  .refine((v) => v.verification !== 'custom' || v.customRule.trim().length >= 15, {
    path: ['customRule'],
    message: 'Describe your eligibility rule in at least 15 characters.',
  });
export const postSchema = z.string().trim().min(5, 'Write at least 5 characters.').max(2000);
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
    return 'Location approval is required. This demo does not collect addresses; use the approved Sam account.';
  if (p.verification === 'custom' && !s.customApprovals.includes(p.id))
    return 'Request eligibility review below. The organizer must approve it before you sign.';
  if (!p.qualification?.details)
    return 'The organizer must configure all four legal requirements before signatures can be recorded.';
  return null;
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
export function scorePetition(
  p: Petition,
  profile: Profile | null,
  now = Date.now(),
  history: Petition[] = [],
) {
  const historyMatch =
    profile?.useSigningHistory !== false && history.length > 0
      ? history.filter((item) => item.topic === p.topic).length / history.length
      : 0;
  const factors = {
    interests:
      (profile?.interests.includes(p.topic) ? 35 : 0) *
      (history.length && profile?.useSigningHistory !== false ? 5 / 7 : 1),
    history: 10 * historyMatch,
    location: profile?.city.toLowerCase() === p.city.toLowerCase() ? 30 : 0,
    community: profile?.joined.includes(p.communityId) ? 20 : 0,
    activity: 10 * Math.max(0, 1 - (now - Date.parse(p.createdAt)) / (30 * 86400000)),
    endorsements: 5 * Math.min(1, p.endorsements.length / 3),
  };
  return {
    score: Object.values(factors).reduce((a, b) => a + b, 0),
    factors,
    reasons: [
      factors.interests ? 'Matches your interests' : '',
      factors.history ? 'Related to petitions you signed' : '',
      factors.location ? `Near ${p.city}` : '',
      factors.community ? 'From your community' : '',
      factors.endorsements ? 'Community endorsed' : '',
    ].filter(Boolean),
  };
}
export function rankFeed(
  petitions: Petition[],
  profile: Profile | null,
  now = Date.now(),
  signedIds: string[] = [],
) {
  const history = petitions.filter((p) => signedIds.includes(p.id));
  const remaining = petitions
    .filter((p) => p.status === 'active' && Date.parse(p.deadline) >= now)
    .sort(
      (a, b) =>
        scorePetition(b, profile, now, history).score -
          scorePetition(a, profile, now, history).score || a.id.localeCompare(b.id),
    );
  const result: Petition[] = [];
  while (remaining.length) {
    const last = result.slice(-2);
    let next = remaining.findIndex(
      (p) =>
        last.length < 2 ||
        (last.some((q) => q.topic !== p.topic) &&
          last.some((q) => q.communityId !== p.communityId)),
    );
    if (next < 0) next = 0;
    result.push(remaining.splice(next, 1)[0]);
  }
  return result;
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
