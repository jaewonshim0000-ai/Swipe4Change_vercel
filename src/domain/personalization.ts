import { z } from 'zod';
import { Snapshot, profileRoles } from './model';

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
] as const;
export function badgeProgress(s: Snapshot) {
  const counts = {
    signed: s.signed.length,
    joined: s.profile?.joined.length ?? 0,
    created: s.petitions.filter(
      (p) => p.ownerId === s.profile?.id && !['draft', 'archived'].includes(p.status),
    ).length,
  };
  return badgeDefinitions.map((b) => ({
    ...b,
    earned: s.profile?.badges.includes(b.name) ?? false,
    progress:
      b.kind === 'posts'
        ? s.profile?.badges.includes(b.name)
          ? 1
          : 0
        : Math.min(b.target, counts[b.kind]),
  }));
}
