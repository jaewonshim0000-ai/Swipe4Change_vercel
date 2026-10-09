/**
 * Real elected officials for a place, from free public sources:
 *
 *   - US Census geocoder: coordinates → state and congressional district (no key).
 *   - unitedstates/congress-legislators: every current member of Congress with phone and website
 *     (no key, public domain).
 *   - Open States: state legislators for the same coordinates (free key, OPENSTATES_API_KEY).
 *
 * Runs only on servers (the dev API route and the civic-lookup Edge Function): Census sends no
 * CORS headers and the Open States key must stay private. Party is deliberately left out.
 */

export interface Official {
  name: string;
  /** "U.S. Senator", "U.S. Representative", "State Senator", "State Representative" */
  office: string;
  level: 'federal' | 'state';
  /** "WA-7", "WA", "WA Senate District 43" */
  district: string;
  phone?: string;
  email?: string;
  url?: string;
  contactForm?: string;
}

export interface OfficialsResult {
  officials: Official[];
  /** Set when state legislators could not be included, e.g. no Open States key. */
  stateNote?: string;
}

/** What the petition's recipient field says: "Sen. Patty Murray (U.S. Senate, WA)". */
export function officialTitle(o: Official) {
  const prefix: Record<string, string> = {
    'U.S. Senator': 'Sen.',
    'U.S. Representative': 'Rep.',
    'State Senator': 'State Sen.',
    'State Representative': 'State Rep.',
  };
  const body: Record<string, string> = {
    'U.S. Senator': 'U.S. Senate',
    'U.S. Representative': 'U.S. House',
    'State Senator': 'State Senate',
    'State Representative': 'State House',
  };
  return `${prefix[o.office] ?? ''} ${o.name} (${body[o.office] ?? o.office}, ${o.district})`.trim();
}

/** The official a recipient line names, if any. Matches on the full name only. */
export function officialNamed(recipient: string, officials: Official[]) {
  const text = recipient.toLowerCase();
  return officials.find((o) => text.includes(o.name.toLowerCase())) ?? null;
}

type Geographies = Record<string, Record<string, string>[]>;

/** Census coordinates lookup → state abbreviation and congressional district (0 = at large). */
export function districtFromCensus(json: unknown): { state: string; district: number } | null {
  const g = (json as { result?: { geographies?: Geographies } })?.result?.geographies;
  const state = g?.States?.[0]?.STUSAB;
  const cdKey = g && Object.keys(g).find((k) => /Congressional Districts$/.test(k));
  const cd = cdKey ? g[cdKey]?.[0] : undefined;
  const code = cd && Object.entries(cd).find(([k]) => /^CD\d+$/.test(k))?.[1];
  if (!state || !code) return null;
  // "00" is an at-large seat and "98" a non-voting delegate; the dataset files both as district 0.
  const n = Number(code);
  return { state, district: n === 0 || n === 98 ? 0 : n };
}

interface Legislator {
  name: { official_full?: string; first: string; last: string };
  terms: {
    type: 'sen' | 'rep';
    state: string;
    district?: number;
    url?: string;
    phone?: string;
    contact_form?: string;
  }[];
}

export function federalOfficials(
  legislators: unknown,
  state: string,
  district: number,
): Official[] {
  const list = (legislators as Legislator[]).flatMap((l) => {
    const t = l.terms[l.terms.length - 1];
    if (t.state !== state || (t.type === 'rep' && t.district !== district)) return [];
    const senator = t.type === 'sen';
    return [
      {
        name: l.name.official_full ?? `${l.name.first} ${l.name.last}`,
        office: senator ? 'U.S. Senator' : 'U.S. Representative',
        level: 'federal' as const,
        district: senator ? state : `${state}-${district === 0 ? 'AL' : district}`,
        ...(t.phone ? { phone: t.phone } : {}),
        ...(t.url ? { url: t.url } : {}),
        ...(t.contact_form ? { contactForm: t.contact_form } : {}),
      },
    ];
  });
  // Senators first, then the House member.
  return list.sort(
    (a, b) => Number(b.office === 'U.S. Senator') - Number(a.office === 'U.S. Senator'),
  );
}

interface OpenStatesPerson {
  name: string;
  email?: string | null;
  current_role?: { title?: string; org_classification?: string; district?: string } | null;
  jurisdiction?: { name?: string; classification?: string } | null;
  offices?: { voice?: string | null; classification?: string | null }[] | null;
  links?: { url: string }[] | null;
}

export function stateOfficials(json: unknown, state: string): Official[] {
  const people = ((json as { results?: OpenStatesPerson[] })?.results ?? []).filter(
    (p) => p.jurisdiction?.classification === 'state',
  );
  return people
    .map((p) => {
      const upper = p.current_role?.org_classification === 'upper';
      const phone =
        p.offices?.find((o) => o.classification === 'capitol' && o.voice)?.voice ??
        p.offices?.find((o) => o.voice)?.voice;
      return {
        name: p.name,
        office: upper ? 'State Senator' : 'State Representative',
        level: 'state' as const,
        district: `${state} ${upper ? 'Senate' : 'House'} District ${p.current_role?.district ?? '?'}`,
        ...(phone ? { phone } : {}),
        ...(p.email ? { email: p.email } : {}),
        ...(p.links?.[0]?.url ? { url: p.links[0].url } : {}),
      };
    })
    .sort((a, b) => Number(b.office === 'State Senator') - Number(a.office === 'State Senator'));
}

const LEGISLATORS = 'https://unitedstates.github.io/congress-legislators/legislators-current.json';
let legislatorCache: { at: number; data: unknown } | null = null;

async function json(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${new URL(url).host} answered ${response.status}`);
  return response.json();
}

async function legislators() {
  // ponytail: one in-memory copy per server process, refreshed daily; members change rarely.
  if (!legislatorCache || Date.now() - legislatorCache.at > 86400000)
    legislatorCache = { at: Date.now(), data: await json(LEGISLATORS) };
  return legislatorCache.data;
}

/** Federal officials always; state legislators when an Open States key is configured. */
export async function officialsAt(
  lat: number,
  lon: number,
  openStatesKey?: string,
): Promise<OfficialsResult> {
  const census = await json(
    `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=all&format=json`,
  );
  const place = districtFromCensus(census);
  if (!place) throw new Error('No US congressional district covers this location.');
  const federal = federalOfficials(await legislators(), place.state, place.district);
  if (!openStatesKey)
    return {
      officials: federal,
      stateNote: 'Add OPENSTATES_API_KEY to show state legislators.',
    };
  try {
    const people = await json(
      `https://v3.openstates.org/people.geo?lat=${lat}&lng=${lon}&include=offices&include=links`,
      { headers: { 'X-API-KEY': openStatesKey } },
    );
    return { officials: [...federal, ...stateOfficials(people, place.state)] };
  } catch {
    return { officials: federal, stateNote: 'State legislators are unavailable right now.' };
  }
}
