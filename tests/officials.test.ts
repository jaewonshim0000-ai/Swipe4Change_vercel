import {
  districtFromCensus,
  federalOfficials,
  officialNamed,
  officialTitle,
  stateOfficials,
} from '../supabase/functions/_shared/officials';

// Trimmed real responses (Census, congress-legislators, Open States v3 people.geo).
const census = (cd: string, state = 'WA') => ({
  result: {
    geographies: {
      States: [{ STUSAB: state, NAME: 'Washington' }],
      '120th Congressional Districts': [{ NAME: 'Congressional District 7', CD120: cd }],
      '2026 State Legislative Districts - Upper': [{ NAME: 'Legislative (Senate) District 43' }],
    },
  },
});
const legislators = [
  {
    name: { first: 'Patty', last: 'Murray', official_full: 'Patty Murray' },
    terms: [
      {
        type: 'sen',
        state: 'WA',
        url: 'https://www.murray.senate.gov',
        phone: '202-224-2621',
        contact_form: 'https://www.murray.senate.gov/write-to-patty/',
      },
    ],
  },
  {
    name: { first: 'Pramila', last: 'Jayapal', official_full: 'Pramila Jayapal' },
    terms: [
      { type: 'rep', state: 'WA', district: 1 },
      {
        type: 'rep',
        state: 'WA',
        district: 7,
        url: 'https://jayapal.house.gov',
        phone: '202-225-3106',
      },
    ],
  },
  { name: { first: 'Other', last: 'Member' }, terms: [{ type: 'rep', state: 'WA', district: 9 }] },
  {
    name: { first: 'Harriet', last: 'Hageman' },
    terms: [{ type: 'rep', state: 'WY', district: 0 }],
  },
];

test('Census coordinates resolve to a state and congressional district', () => {
  expect(districtFromCensus(census('07'))).toEqual({ state: 'WA', district: 7 });
  expect(districtFromCensus(census('00', 'WY'))).toEqual({ state: 'WY', district: 0 });
  expect(districtFromCensus(census('98', 'DC'))).toEqual({ state: 'DC', district: 0 });
  expect(districtFromCensus({ result: { geographies: {} } })).toBeNull();
  expect(districtFromCensus(null)).toBeNull();
});

test('federal officials are the state’s senators and the district’s current House member', () => {
  const found = federalOfficials(legislators, 'WA', 7);
  expect(found.map((o) => [o.office, o.name, o.district])).toEqual([
    ['U.S. Senator', 'Patty Murray', 'WA'],
    ['U.S. Representative', 'Pramila Jayapal', 'WA-7'],
  ]);
  expect(found[0].contactForm).toBe('https://www.murray.senate.gov/write-to-patty/');
  expect(found[1]).not.toHaveProperty('contactForm');
  expect(federalOfficials(legislators, 'WY', 0)[0].district).toBe('WY-AL');
  expect(officialTitle(found[1])).toBe('Rep. Pramila Jayapal (U.S. House, WA-7)');
});

test('state legislators come from Open States without party or federal duplicates', () => {
  const found = stateOfficials(
    {
      results: [
        {
          name: 'Nicole Macri',
          party: 'Democratic',
          email: 'nicole.macri@leg.wa.gov',
          current_role: { title: 'Representative', org_classification: 'lower', district: '43' },
          jurisdiction: { classification: 'state' },
          offices: [
            { classification: 'district', voice: null },
            { classification: 'capitol', voice: '360-786-7826' },
          ],
          links: [{ url: 'https://housedemocrats.wa.gov/macri/' }],
        },
        {
          name: 'Jamie Pedersen',
          current_role: { org_classification: 'upper', district: '43' },
          jurisdiction: { classification: 'state' },
        },
        {
          name: 'Patty Murray',
          current_role: { org_classification: 'upper' },
          jurisdiction: { classification: 'country' },
        },
      ],
    },
    'WA',
  );
  expect(found.map((o) => [o.office, o.name, o.district])).toEqual([
    ['State Senator', 'Jamie Pedersen', 'WA Senate District 43'],
    ['State Representative', 'Nicole Macri', 'WA House District 43'],
  ]);
  expect(found[1]).toMatchObject({ phone: '360-786-7826', email: 'nicole.macri@leg.wa.gov' });
  expect(JSON.stringify(found)).not.toContain('Democratic');
  expect(officialTitle(found[0])).toBe(
    'State Sen. Jamie Pedersen (State Senate, WA Senate District 43)',
  );
});

test('a recipient line is matched to the official it names', () => {
  const officials = federalOfficials(legislators, 'WA', 7);
  expect(officialNamed('Rep. Pramila Jayapal (U.S. House, WA-7)', officials)?.office).toBe(
    'U.S. Representative',
  );
  expect(officialNamed('Seattle Department of Transportation', officials)).toBeNull();
});
