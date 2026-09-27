import { LocalAdapter, STORAGE_KEY, Storage } from '../src/data/local';
import { demoIds, petitionId, seedPetitions } from '../src/data/seed';
import {
  prepareResponseChecks,
  responseChecksFor,
  responseChecksSchema,
} from '../src/domain/response-checks';

function setup() {
  const values = new Map<string, string>();
  const storage: Storage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
  };
  return new LocalAdapter(storage, () => 'response-check-id');
}

test('new and legacy petitions show their requested action until asks are configured', () => {
  const petition = seedPetitions()[1];
  expect(responseChecksFor({ ...petition, responseChecks: undefined })).toEqual([
    { ask: petition.action, status: 'not_reviewed', note: '' },
  ]);
  expect(seedPetitions()[0].responseChecks).toHaveLength(3);
});

test('assessments need distinct asks, a reason, and a verified response from the same petition', () => {
  const petition = seedPetitions()[0];
  const responseId = petition.responses[0].id;
  expect(
    responseChecksSchema.safeParse([
      { ask: 'Publish a lighting plan', status: 'answered', note: '', responseId },
    ]).success,
  ).toBe(false);
  expect(
    responseChecksSchema.safeParse([
      { ask: 'Publish a lighting plan', status: 'not_reviewed', note: '' },
      { ask: 'Publish a lighting plan', status: 'not_reviewed', note: '' },
    ]).success,
  ).toBe(false);
  expect(() =>
    prepareResponseChecks(
      petition,
      [
        {
          ask: 'Publish a lighting plan',
          status: 'unanswered',
          note: 'No plan is in the reply.',
          responseId: 'another-petition',
        },
      ],
      'Maya Chen',
      '2026-09-22T00:00:00Z',
    ),
  ).toThrow(/verified, available/);
  expect(() =>
    prepareResponseChecks(
      { ...petition, responses: [{ ...petition.responses[0], verification: 'unverified' }] },
      [
        {
          ask: 'Publish a lighting plan',
          status: 'unanswered',
          note: 'No plan is in the reply.',
          responseId,
        },
      ],
      'Maya Chen',
      '2026-09-22T00:00:00Z',
    ),
  ).toThrow(/verified, available/);
});

test('only organizers can save a public comparison and its previous version enters edit history', async () => {
  const adapter = setup();
  await adapter.signIn(demoIds.sam);
  await expect(
    adapter.execute({
      type: 'responseChecks',
      petitionId: petitionId(1),
      checks: [{ ask: 'Publish a lighting plan', status: 'not_reviewed', note: '' }],
    }),
  ).rejects.toThrow(/owner or an authorized collaborator/);
  await adapter.signIn(demoIds.maya);
  const before = (await adapter.load()).petitions.find((p) => p.id === petitionId(1))!;
  await adapter.execute({
    type: 'responseChecks',
    petitionId: petitionId(1),
    checks: [
      {
        ask: 'Publish a lighting plan',
        status: 'unanswered',
        note: 'The recorded response contains no plan.',
        responseId: before.responses[0].id,
      },
    ],
  });
  const after = (await adapter.load()).petitions.find((p) => p.id === petitionId(1))!;
  expect(after.responseChecks?.[0].reviewedBy).toBe('Maya Chen');
  expect(after.responseChecks?.[0].status).toBe('unanswered');
  expect(after.edits[0].body).toContain('Previous checks:');
  await adapter.execute({
    type: 'edit',
    petitionId: petitionId(1),
    patch: { action: 'Assess the entire public route and publish a new lighting design.' },
    reason: 'The community expanded the requested route.',
  });
  const revised = (await adapter.load()).petitions.find((p) => p.id === petitionId(1))!;
  expect(revised.responseChecks?.[0]).toMatchObject({
    ask: 'Assess the entire public route and publish a new lighting design.',
    status: 'not_reviewed',
  });
  expect(revised.edits[0].body).toContain('Previous: Publish a lighting plan (unanswered)');
});

test('an existing flagship gains only the new comparison without resetting saved participation', async () => {
  const values = new Map<string, string>();
  const storage: Storage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
  };
  const first = new LocalAdapter(storage, () => 'test-id');
  await first.signIn(demoIds.maya);
  await first.execute({ type: 'save', petitionId: petitionId(3) });
  const stored = JSON.parse(values.get(STORAGE_KEY) ?? '{}') as {
    petitions: { id: string; action: string; responseChecks?: unknown }[];
  };
  const flagship = stored.petitions.find((petition) => petition.id === petitionId(1))!;
  delete flagship.responseChecks;
  flagship.action =
    'Assess the Eastbridge campus-to-bus path and publish a pedestrian-lighting installation plan before the winter evening semester.';
  values.set(STORAGE_KEY, JSON.stringify(stored));
  const restored = new LocalAdapter(storage, () => 'test-id');
  const snapshot = await restored.load();
  expect(
    snapshot.petitions.find((petition) => petition.id === petitionId(1))?.responseChecks,
  ).toHaveLength(3);
  expect(snapshot.saved).toContain(petitionId(3));
});
