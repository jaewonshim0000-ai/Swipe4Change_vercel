/**
 * Approximate location is always stored as "City, ST". Only the city and state are kept: never
 * coordinates, a street address or a postcode.
 */
export interface Place {
  /** "Seattle, WA" */
  city: string;
  /** Shown under the name in search results, e.g. the county or "Fictional sample city". */
  detail: string;
  /** The city centre, used only to look up its districts; never a person's position. */
  lat?: number;
  lon?: number;
}

const states: Record<string, string> = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  'District of Columbia': 'DC',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Puerto Rico': 'PR',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
};
// Longest first, so "West Virginia" is replaced before "Virginia".
const stateNames = Object.keys(states).sort((a, b) => b.length - a.length);

/** "St. Louis, Missouri" → "st louis mo", so differently written cities compare equal. */
export function normalizeCity(text: string) {
  let s = ` ${text.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim()}`;
  for (const name of stateNames)
    if (s.endsWith(` ${name.toLowerCase()}`)) {
      s = `${s.slice(0, -name.length)}${states[name].toLowerCase()}`;
      break;
    }
  return s.trim();
}

export function sameCity(a?: string | null, b?: string | null) {
  return !!a && !!b && !!normalizeCity(a) && normalizeCity(a) === normalizeCity(b);
}

/** One result from the Open-Meteo city search. */
export interface SearchResult {
  name: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
  latitude?: number;
  longitude?: number;
}

export function cityFromSearch(r: SearchResult): Place | null {
  const st = r.admin1 && states[r.admin1];
  if (r.country_code !== 'US' || !st) return null;
  return {
    city: `${r.name}, ${st}`,
    detail: [r.admin2, r.admin1].filter(Boolean).join(' · '),
    ...(r.latitude !== undefined && r.longitude !== undefined
      ? { lat: r.latitude, lon: r.longitude }
      : {}),
  };
}

/** An OpenStreetMap Nominatim reverse lookup, reduced to "City, ST". */
export function cityFromReverse(json: {
  address?: Record<string, string | undefined>;
}): string | null {
  const a = json.address ?? {};
  const name = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality;
  const st = a['ISO3166-2-lvl4']?.match(/^US-([A-Z]{2})$/)?.[1];
  return name && st ? `${name}, ${st}` : null;
}

/** The demo's fictional towns, offered in the picker so the sample data stays reachable. */
export const sampleCities: Place[] = [
  { city: 'Riverton, CA', detail: 'Fictional sample city' },
  { city: 'Brookside, CA', detail: 'Fictional sample city' },
];
