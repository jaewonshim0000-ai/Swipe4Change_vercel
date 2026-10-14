import { z } from 'zod';
import type { Petition, Topic } from './model';

/**
 * Real U.S. federal rules open for public comment, from the Federal Register's public API (no key,
 * open to browsers). The same proposals are on Regulations.gov, where the comment links lead.
 * Only official wording is shown: nothing is summarized, scored or rewritten here.
 */
export interface FederalRule {
  /** Federal Register document number, also the app route id. */
  id: string;
  title: string;
  /** The official abstract, or '' when the agency published none. */
  summary: string;
  agency: string;
  topic: Topic;
  /** YYYY-MM-DD, the last day the agency accepts comments. */
  closesOn: string;
  /** The Regulations.gov comment form; null when the agency takes comments elsewhere. */
  commentUrl: string | null;
  /** The document on the Federal Register. */
  url: string;
}

const fields = [
  'document_number',
  'title',
  'abstract',
  'agencies',
  'comments_close_on',
  'comment_url',
  'html_url',
];

// ponytail: first 200 open proposals (about 190 exist at a time); page if that ever falls short.
export function federalSearchUrl(today: string) {
  const query = new URLSearchParams({
    per_page: '200',
    order: 'newest',
    'conditions[type][]': 'PRORULE',
    'conditions[comment_date][gte]': today,
  });
  for (const field of fields) query.append('fields[]', field);
  return `https://www.federalregister.gov/api/v1/documents.json?${query}`;
}

/** Agencies whose proposals bear on the app's topics, keyed by Federal Register slug. */
const agencyTopics: Record<string, Topic> = {
  'national-highway-traffic-safety-administration': 'Safer streets',
  'federal-highway-administration': 'Safer streets',
  'federal-motor-carrier-safety-administration': 'Safer streets',
  'federal-transit-administration': 'Safer streets',
  'environmental-protection-agency': 'Environment',
  'fish-and-wildlife-service': 'Environment',
  'national-oceanic-and-atmospheric-administration': 'Environment',
  'energy-department': 'Environment',
  'education-department': 'Education',
  'national-park-service': 'Public spaces',
  'forest-service': 'Public spaces',
  'land-management-bureau': 'Public spaces',
  'architectural-and-transportation-barriers-compliance-board': 'Accessibility',
};
const accessibility = /disabilit|accessib/i;
/** Routine technical notices that would bury the proposals people can weigh in on. */
const routine =
  /airworthiness|special conditions|airspace|air plan|air quality plan|approval and promulgation|implementation plans|clean data determination|safety zone|drawbridge|permit program|program revision/i;

const officialHosts = [
  'federalregister.gov',
  'www.federalregister.gov',
  'regulations.gov',
  'www.regulations.gov',
];
function officialUrl(value: string | null | undefined) {
  try {
    const url = new URL(value ?? '');
    if (!officialHosts.includes(url.hostname) || !['https:', 'http:'].includes(url.protocol))
      return null;
    // The API still lists some official links as http; both sites serve https.
    url.protocol = 'https:';
    return url.href;
  } catch {
    return null;
  }
}

const document = z.object({
  document_number: z.string().regex(/^[\w-]+$/),
  title: z.string().min(1),
  abstract: z.string().nullish(),
  agencies: z.array(z.object({ name: z.string().nullish(), slug: z.string().nullish() })),
  comments_close_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  comment_url: z.string().nullish(),
  html_url: z.string(),
});

/** Turns an API response into rules the app shows. Anything malformed or off-topic is dropped. */
export function toFederalRules(json: unknown): FederalRule[] {
  const results = z.object({ results: z.array(z.unknown()) }).safeParse(json);
  if (!results.success) return [];
  return results.data.results.flatMap((raw) => {
    const doc = document.safeParse(raw);
    if (!doc.success || routine.test(doc.data.title)) return [];
    const { data } = doc;
    const url = officialUrl(data.html_url);
    // The most specific agency is listed last (e.g. Transportation Department, then NHTSA).
    const matched = [...data.agencies].reverse().find((a) => a.slug && a.slug in agencyTopics);
    const topic = accessibility.test(data.title)
      ? 'Accessibility'
      : matched?.slug
        ? agencyTopics[matched.slug]
        : undefined;
    if (!url || !topic) return [];
    return [
      {
        id: data.document_number,
        title: data.title.trim(),
        summary: data.abstract?.trim() ?? '',
        agency: (matched ?? data.agencies.at(-1))?.name ?? 'Federal agency',
        topic,
        closesOn: data.comments_close_on,
        commentUrl: officialUrl(data.comment_url),
        url,
      },
    ];
  });
}

/** The viewer's interests first, then whatever closes soonest. */
export function rankFederalRules(rules: FederalRule[], interests: Topic[], topic: Topic | '' = '') {
  const interested = (r: FederalRule) => (interests.includes(r.topic) ? 0 : 1);
  return rules
    .filter((r) => !topic || r.topic === topic)
    .sort((a, b) => interested(a) - interested(b) || a.closesOn.localeCompare(b.closesOn));
}

/** Calendar days from the viewer's local date to the closing date. */
export function daysLeft(closesOn: string, now: number) {
  const today = new Date(now);
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((Date.parse(`${closesOn}T00:00:00Z`) - start) / 86_400_000));
}

export type DeckItem =
  | { kind: 'petition'; id: string; petition: Petition }
  | { kind: 'federal'; id: string; rule: FederalRule };

/** Home's swipe deck: one federal rule after every three petitions, any left over at the end. */
export function withFederalRules(petitions: Petition[], rules: FederalRule[]): DeckItem[] {
  const deck: DeckItem[] = [];
  let next = 0;
  petitions.forEach((petition, i) => {
    deck.push({ kind: 'petition', id: petition.id, petition });
    if ((i + 1) % 3 === 0 && next < rules.length)
      deck.push({ kind: 'federal', id: rules[next].id, rule: rules[next++] });
  });
  for (const rule of rules.slice(next)) deck.push({ kind: 'federal', id: rule.id, rule });
  return deck;
}
