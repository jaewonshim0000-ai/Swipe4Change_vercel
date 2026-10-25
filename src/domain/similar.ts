import { Draft, Petition } from './model';
import { sameCity } from './location';
import { petitionTags } from './tags';

/**
 * Tags that say where a petition is or who it affects ("campus", "students"), not what it asks
 * for. Two petitions sharing only these are usually different requests, so they never match.
 */
const settingTags = new Set([
  'students',
  'schools',
  'campus',
  'families',
  'seniors',
  'evenings',
  'study',
  'parks',
  'recreation',
  'libraries',
  'maintenance',
]);
/** Words every request uses, which say nothing about which request it is. */
const common = new Set(
  'the and for with from that this our your their more make keep add install create near along around after before every need needs new safer better plan publish pilot check fix ca'.split(
    ' ',
  ),
);
const words = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .replace(/\(fictional\)/g, '')
      .match(/[a-z0-9]+/g)
      ?.filter((w) => w.length >= 3 && !common.has(w)) ?? [],
  );

/** "Irvine Public Works" and "Irvine Department of Public Works" name the same office. */
export function sameRecipient(a: string, b: string) {
  const x = words(a);
  const y = words(b);
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared >= 2 && shared / Math.min(x.size, y.size) >= 0.75;
}

export interface SimilarPetition {
  petition: Petition;
  /** Plain reasons shown to the creator. Hidden tags themselves are never shown. */
  reasons: string[];
}

/**
 * Open petitions that probably ask for the same change as this draft, best match first, so a
 * creator can join one instead of splitting supporters across near-duplicates.
 *
 * A candidate must be in the same city or addressed to the same office, and share at least one
 * issue tag (lighting, crossings, transit…). Score: 2 per shared issue tag, 1 per shared word in
 * the title and action (place names like "Eastbridge" or "Elm" count; city names and filler do
 * not), 1 for the same recipient, 1 for the same topic. 5 or more is shown. Deterministic and
 * explainable, like the feed ranking; calibrated so the distinct seed petitions rarely match.
 */
export function similarPetitions(
  draft: Pick<Draft, 'title' | 'summary' | 'problem' | 'action' | 'recipient' | 'topic' | 'city'>,
  petitions: Petition[],
  now: number,
  limit = 3,
): SimilarPetition[] {
  const issues = new Set(petitionTags(draft).filter((t) => !settingTags.has(t)));
  if (!issues.size) return [];
  const mine = words(`${draft.title} ${draft.action}`);
  return petitions
    .filter((p) => p.status === 'active' && !p.hidden && Date.parse(p.deadline) > now)
    .flatMap((p) => {
      const recipient = !!draft.recipient.trim() && sameRecipient(draft.recipient, p.recipient);
      const place = sameCity(draft.city, p.city);
      if (!place && !recipient) return [];
      const issue = petitionTags(p).filter((t) => issues.has(t)).length;
      if (!issue) return [];
      const cities = words(`${draft.city} ${p.city}`);
      const shared = [...words(`${p.title} ${p.action}`)].filter(
        (w) => mine.has(w) && !cities.has(w),
      ).length;
      const topic = draft.topic === p.topic;
      const score = issue * 2 + shared + (recipient ? 1 : 0) + (topic ? 1 : 0);
      if (score < 5) return [];
      const reasons = [
        'Similar request',
        ...(recipient ? ['Same recipient'] : []),
        ...(place ? [`Also in ${p.city}`] : []),
        ...(topic ? [`Same topic: ${p.topic}`] : []),
      ];
      return [{ petition: p, reasons, score }];
    })
    .sort((a, b) => b.score - a.score || b.petition.count - a.petition.count)
    .slice(0, limit)
    .map(({ petition, reasons }) => ({ petition, reasons }));
}
