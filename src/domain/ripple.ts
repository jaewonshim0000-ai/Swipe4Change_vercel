import type { Ripple } from './model';

/** One signature that arrived through someone's share link. Never leaves the data layer. */
export interface Referral {
  petitionId: string;
  signerId: string;
  referrerId: string;
}

/**
 * Everyone downstream of one person, per petition. `direct` signed through their link; `further`
 * signed through the links of those people, and so on down the chain. Mirrors the recursive query
 * in the ripple migration.
 */
export function rippleOf(userId: string, referrals: Referral[]): Ripple['petitions'] {
  const byPetition = new Map<string, Referral[]>();
  for (const r of referrals)
    byPetition.set(r.petitionId, [...(byPetition.get(r.petitionId) ?? []), r]);
  const result: Ripple['petitions'] = [];
  for (const [petitionId, rows] of byPetition) {
    // A signer can withdraw and re-sign through someone they brought in, so the graph can loop.
    // Visiting each person once keeps the count finite and never credits you for yourself.
    const seen = new Set([userId]);
    let frontier = [userId];
    let depth = 0;
    let direct = 0;
    let further = 0;
    while (frontier.length) {
      depth++;
      const next = rows
        .filter((r) => frontier.includes(r.referrerId) && !seen.has(r.signerId))
        .map((r) => r.signerId);
      for (const id of next) seen.add(id);
      if (depth === 1) direct = next.length;
      else further += next.length;
      frontier = next;
    }
    if (direct) result.push({ petitionId, direct, further });
  }
  return result;
}

/** Totals across every petition, for the profile header and share prompts. */
export const rippleTotal = (ripple: Ripple | null) =>
  (ripple?.petitions ?? []).reduce((n, p) => n + p.direct + p.further, 0);
