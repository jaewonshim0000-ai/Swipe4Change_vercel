import { findOffice } from '../src/domain/recipients';
import { signingStatus } from '../src/domain/rules';
import { seedPetitions, seedProfiles } from '../src/data/seed';
import { Snapshot } from '../src/domain/model';

const petitions = seedPetitions();
const profile = seedProfiles()[0];
const snapshot: Snapshot = {
  profile,
  petitions,
  communities: [],
  signed: [],
  saved: [],
  ripple: null,
  volunteering: [],
  signatures: [],
  reports: [],
  notifications: [],
  customApprovals: [],
};

test('every sample petition has a distinct local reason and an office in its own city', () => {
  expect(petitions).toHaveLength(12);
  expect(new Set(petitions.map((p) => p.problem)).size).toBe(petitions.length);
  for (const petition of petitions) {
    expect(petition.problem.length).toBeGreaterThan(100);
    expect(petition.summary.length).toBeGreaterThan(50);
    const office = findOffice(petition.recipient);
    expect(office).toBeDefined();
    if (petition.city.startsWith('Brookside')) expect(office?.name).toContain('Brookside');
  }
  expect(petitions[0].problem).toContain('campus gate');
  expect(petitions[0].deliveries[0].recipient).toBe(petitions[0].recipient);
});

test('the signing review distinguishes missing information, manager review and rejection', () => {
  expect(signingStatus(petitions[0], snapshot, 'anonymous').state).toBe('eligible');
  expect(
    signingStatus(
      petitions[0],
      { ...snapshot, profile: { ...profile, emailVerified: false } },
      'anonymous',
    ).state,
  ).toBe('additional');
  expect(signingStatus(petitions[9], snapshot, 'anonymous').state).toBe('pending');
  expect(signingStatus(petitions[9], { ...snapshot, profile: null }, 'anonymous').state).toBe(
    'additional',
  );
  expect(signingStatus({ ...petitions[0], status: 'closed' }, snapshot, 'anonymous').state).toBe(
    'ineligible',
  );
  expect(
    signingStatus(petitions[0], { ...snapshot, signed: [petitions[0].id] }, 'anonymous').state,
  ).toBe('ineligible');
});
