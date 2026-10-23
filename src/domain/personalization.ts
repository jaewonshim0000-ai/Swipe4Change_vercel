import { z } from 'zod';
import { Snapshot, profileRoles } from './model';
import { rippleTotal } from './ripple';

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  bio: z.string().trim().max(280),
  useSigningHistory: z.boolean(),
  role: z.enum(profileRoles).optional(),
});
/** A profile picture: a small metadata-free JPEG data URL (src/data/photos.ts), or null to remove. */
export const avatarSchema = z
  .string()
  .max(200000, 'That picture is too large. Try another one.')
  .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/, 'That picture could not be used.')
  .nullable();
export const badgeDefinitions = [
  { name: 'First voice', description: 'Confirm your first signature.', target: 1, kind: 'signed' },
  { name: 'Showing up', description: 'Sign five different petitions.', target: 5, kind: 'signed' },
  { name: 'Community builder', description: 'Join two communities.', target: 2, kind: 'joined' },
  {
    name: 'Change starter',
    description: 'Publish your first petition.',
    target: 1,
    kind: 'created',
  },
  {
    name: 'Conversation starter',
    description: 'Contribute to a petition discussion.',
    target: 1,
    kind: 'posts',
  },
  {
    name: 'Steady voice',
    description: 'Sign ten different petitions.',
    target: 10,
    kind: 'signed',
  },
  {
    name: 'Wide lens',
    description: 'Sign petitions in three different topics.',
    target: 3,
    kind: 'topics',
  },
  {
    name: 'Keeping watch',
    description: 'Save three petitions to follow their updates.',
    target: 3,
    kind: 'saved',
  },
  {
    name: 'Helping hand',
    description: 'Offer to help on a petition.',
    target: 1,
    kind: 'volunteered',
  },
  {
    name: 'Ripple maker',
    description: 'Someone signs a petition through your share link.',
    target: 1,
    kind: 'ripple',
  },
  {
    name: 'Goal getter',
    description: 'A petition you started reaches its signature goal.',
    target: 1,
    kind: 'goals',
  },
] as const;
/** What each badge counts, always taken from records rather than a client-supplied counter. */
export type BadgeCounts = Record<(typeof badgeDefinitions)[number]['kind'], number>;
/** Every badge these counts qualify for. */
export const qualifiedBadges = (counts: BadgeCounts): string[] =>
  badgeDefinitions.filter((b) => counts[b.kind] >= b.target).map((b) => b.name);
export function badgeProgress(s: Snapshot) {
  const started = s.petitions.filter(
    (p) => p.ownerId === s.profile?.id && !['draft', 'archived'].includes(p.status),
  );
  const counts: BadgeCounts = {
    signed: s.signed.length,
    topics: new Set(s.petitions.filter((p) => s.signed.includes(p.id)).map((p) => p.topic)).size,
    joined: s.profile?.joined.length ?? 0,
    created: started.length,
    // Posts are not in the snapshot, so the badge itself is the record.
    posts: s.profile?.badges.includes('Conversation starter') ? 1 : 0,
    ripple: rippleTotal(s.ripple),
    saved: s.saved.length,
    volunteered: s.volunteering.length,
    goals: started.filter((p) => p.goal > 0 && p.count >= p.goal).length,
  };
  return badgeDefinitions.map((b) => ({
    ...b,
    earned: s.profile?.badges.includes(b.name) ?? false,
    progress: Math.min(b.target, counts[b.kind]),
  }));
}
