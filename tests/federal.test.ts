import {
  daysLeft,
  federalSearchUrl,
  rankFederalRules,
  toFederalRules,
} from '../src/domain/federal';

const agency = (name: string, slug: string | null) => ({ name, slug });
const item = (overrides: Record<string, unknown>) => ({
  document_number: '2026-20001',
  title: 'Rear Seat Belt Reminder System',
  abstract: '  NHTSA proposes to require a rear seat belt reminder.  ',
  agencies: [
    agency('Transportation Department', 'transportation-department'),
    agency(
      'National Highway Traffic Safety Administration',
      'national-highway-traffic-safety-administration',
    ),
  ],
  comments_close_on: '2026-11-20',
  comment_url: 'https://www.regulations.gov/commenton/NHTSA-2026-0001-0001',
  html_url: 'https://www.federalregister.gov/documents/2026/10/01/2026-20001/rear-seat-belt',
  ...overrides,
});

test('maps the most specific agency to an app topic and keeps the official wording', () => {
  const [rule] = toFederalRules({ results: [item({})] });
  expect(rule).toEqual({
    id: '2026-20001',
    title: 'Rear Seat Belt Reminder System',
    summary: 'NHTSA proposes to require a rear seat belt reminder.',
    agency: 'National Highway Traffic Safety Administration',
    topic: 'Safer streets',
    closesOn: '2026-11-20',
    commentUrl: 'https://www.regulations.gov/commenton/NHTSA-2026-0001-0001',
    url: 'https://www.federalregister.gov/documents/2026/10/01/2026-20001/rear-seat-belt',
  });
});

test('keeps rules from agencies that match a topic and drops routine or unrelated ones', () => {
  const rules = toFederalRules({
    results: [
      item({
        document_number: 'a',
        agencies: [agency('Environmental Protection Agency', 'environmental-protection-agency')],
        title: 'Lead Pipe Replacement',
      }),
      item({
        document_number: 'b',
        agencies: [
          agency('Interior Department', 'interior-department'),
          agency('National Park Service', 'national-park-service'),
        ],
        title: 'Big Cypress National Preserve; Off-Road Vehicles',
      }),
      item({
        document_number: 'c',
        agencies: [agency('Justice Department', 'justice-department')],
        title: 'Accessibility of Web Content for People With Disabilities',
      }),
      item({
        document_number: 'd',
        agencies: [agency('Federal Aviation Administration', 'federal-aviation-administration')],
        title: 'Airworthiness Directives; Airbus SAS Airplanes',
      }),
      item({
        document_number: 'e',
        agencies: [agency('Environmental Protection Agency', 'environmental-protection-agency')],
        title: 'Air Plan Approval; Kentucky; Maintenance Plan',
      }),
      item({
        document_number: 'f',
        agencies: [
          agency('Securities and Exchange Commission', 'securities-and-exchange-commission'),
        ],
        title: 'Crypto Custody Rules',
      }),
      item({
        document_number: 'g',
        agencies: [agency('Unlisted office', null)],
        title: 'Something',
      }),
    ],
  });
  expect(rules.map((r) => [r.id, r.topic])).toEqual([
    ['a', 'Environment'],
    ['b', 'Public spaces'],
    ['c', 'Accessibility'],
  ]);
});

test('drops malformed items and links that do not point at the official sites', () => {
  const rules = toFederalRules({
    results: [
      item({ document_number: 'no-date', comments_close_on: null }),
      item({ document_number: 'bad-link', html_url: 'https://federalregister.gov.example.com/x' }),
      item({ document_number: 'ftp-link', html_url: 'ftp://www.federalregister.gov/x' }),
      item({ document_number: 'off-site-comment', comment_url: 'https://sec.gov/comments' }),
      item({ document_number: 'no-abstract', abstract: null, comment_url: null }),
      { title: 'missing everything' },
    ],
  });
  expect(rules.map((r) => r.id)).toEqual(['off-site-comment', 'no-abstract']);
  expect(rules[0].commentUrl).toBeNull();
  expect(rules[1].summary).toBe('');
  // The API still lists Regulations.gov comment links as http; they open over https.
  const [upgraded] = toFederalRules({
    results: [item({ comment_url: 'http://www.regulations.gov/commenton/NPS-2026-0199-0001' })],
  });
  expect(upgraded.commentUrl).toBe('https://www.regulations.gov/commenton/NPS-2026-0199-0001');
  expect(
    toFederalRules({ results: [item({ comment_url: 'http://example.com/x' })] })[0].commentUrl,
  ).toBeNull();
  expect(toFederalRules({ error: 'down' })).toEqual([]);
  expect(toFederalRules(null)).toEqual([]);
});

test('ranks the viewer’s interests first, then the soonest deadline, and filters by topic', () => {
  const rules = toFederalRules({
    results: [
      item({ document_number: 'late-street', comments_close_on: '2026-12-30' }),
      item({
        document_number: 'soon-park',
        agencies: [agency('National Park Service', 'national-park-service')],
        comments_close_on: '2026-10-15',
      }),
      item({ document_number: 'soon-street', comments_close_on: '2026-10-20' }),
    ],
  });
  expect(rankFederalRules(rules, ['Safer streets']).map((r) => r.id)).toEqual([
    'soon-street',
    'late-street',
    'soon-park',
  ]);
  expect(rankFederalRules(rules, [], 'Public spaces').map((r) => r.id)).toEqual(['soon-park']);
});

test('counts whole days left until comments close', () => {
  expect(daysLeft('2026-10-20', Date.parse('2026-10-08T12:00:00Z'))).toBe(12);
  expect(daysLeft('2026-10-01', Date.parse('2026-10-08T12:00:00Z'))).toBe(0);
  // Late evening is still today where the person is, even when it is already tomorrow in UTC.
  expect(daysLeft('2026-10-09', new Date(2026, 9, 8, 23, 30).getTime())).toBe(1);
  expect(daysLeft('2026-10-09', new Date(2026, 9, 9, 0, 30).getTime())).toBe(0);
});

test('asks the Federal Register only for proposed rules still open for comment', () => {
  const url = new URL(federalSearchUrl('2026-10-08'));
  expect(url.origin).toBe('https://www.federalregister.gov');
  expect(url.searchParams.get('conditions[type][]')).toBe('PRORULE');
  expect(url.searchParams.get('conditions[comment_date][gte]')).toBe('2026-10-08');
  expect(url.searchParams.getAll('fields[]')).toContain('comment_url');
});
