import { seedPetitions } from '../src/data/seed';
import { Petition } from '../src/domain/model';
import { sameRecipient, similarPetitions } from '../src/domain/similar';

const now = Date.now();
const seeds = seedPetitions();
const draft = (title: string, action: string, recipient = '', city = 'Riverton, CA') => ({
  title,
  summary: '',
  problem: '',
  action,
  recipient,
  topic: 'Safer streets' as const,
  city,
});
const titles = (matches: { petition: Petition }[]) => matches.map((m) => m.petition.title);

test('the safer-walk template finds the open lighting petition it duplicates', () => {
  const matches = similarPetitions(
    draft(
      '',
      'Install pedestrian lighting along the route by March 2027',
      'Riverton Public Works (fictional)',
    ),
    seeds,
    now,
  );
  expect(titles(matches)).toEqual(['A brighter walk home starts here']);
  expect(matches[0].reasons).toEqual([
    'Similar request',
    'Same recipient',
    'Also in Riverton, CA',
    'Same topic: Safer streets',
  ]);
});

test('distinct seed petitions do not flag each other', () => {
  // Only the two Eastbridge pedestrian-safety asks to Public Works are related enough to show.
  const flagged = seeds.flatMap((p) =>
    similarPetitions(
      p,
      seeds.filter((x) => x.id !== p.id),
      now,
    ).map((m) => [p.title, m.petition.title].sort().join(' + ')),
  );
  expect([...new Set(flagged)]).toEqual([
    'A brighter walk home starts here + Safer crossings for smaller footsteps',
  ]);
});

test('a duplicate needs the same issue in the same place', () => {
  const elm = {
    ...seeds[0],
    id: 'elm',
    title: 'Fix the streetlights on Elm Street',
    action: 'Repair the broken streetlights on Elm Street',
  };
  const dark = draft('Elm Street is too dark', 'Add lights on Elm Street so it is not dark');
  expect(titles(similarPetitions(dark, [elm], now))).toEqual([elm.title]);
  // Same issue, different street.
  expect(
    similarPetitions(draft('Oak Avenue is too dark', 'Add lights on Oak Avenue'), [elm], now),
  ).toEqual([]);
  // Same street, different city.
  expect(similarPetitions({ ...dark, city: 'Brookside, CA' }, [elm], now)).toEqual([]);
  // Same setting only ("students", "campus") is not the same request.
  expect(
    similarPetitions(
      draft('Campus bikes', 'Pilot a protected bike lane for students on campus'),
      [seeds[0]],
      now,
    ),
  ).toEqual([]);
});

test('closed, hidden and expired petitions are never suggested', () => {
  const template = draft(
    '',
    'Install pedestrian lighting along the route by March 2027',
    'Riverton Public Works (fictional)',
  );
  for (const change of [
    { status: 'closed' as const },
    { hidden: true },
    { deadline: '2020-01-01' },
  ])
    expect(similarPetitions(template, [{ ...seeds[0], ...change }], now)).toEqual([]);
});

test('sameRecipient matches longer names for the same office, not neighbours', () => {
  expect(sameRecipient('Riverton Public Works', 'Riverton Department of Public Works')).toBe(true);
  expect(sameRecipient('Riverton Public Works (fictional)', 'riverton public works')).toBe(true);
  expect(sameRecipient('Riverton Public Works', 'Riverton City Council')).toBe(false);
  expect(sameRecipient('Riverton Public Works', 'Brookside Public Works')).toBe(false);
});
