import { prepareSubmission } from './signature-fixture';
import { LocalAdapter, Storage } from '../src/data/local';
import { demoIds, seedPetitions } from '../src/data/seed';
import { changedFields, describeEdit, editPatchSchema } from '../src/domain/rules';
function setup() {
  const values = new Map<string, string>();
  const storage: Storage = {
    getItem: async (k) => values.get(k) ?? null,
    setItem: async (k, v) => {
      values.set(k, v);
    },
  };
  let id = 0;
  return { storage, adapter: new LocalAdapter(storage, () => `test-${++id}`) };
}
async function publish(a: LocalAdapter) {
  await a.signIn(demoIds.maya);
  const id = await a.execute({ type: 'create', draft: seedPetitions()[0], publish: true });
  if (typeof id !== 'string') throw new Error('Missing id');
  return id;
}
const find = async (a: LocalAdapter, id: string) =>
  (await a.load()).petitions.find((p) => p.id === id)!;

test('every editable field of a published petition can be revised, with public history', async () => {
  const { adapter: a } = setup();
  const id = await publish(a);
  await a.execute({
    type: 'edit',
    petitionId: id,
    patch: {
      summary: 'A revised summary that explains the ask in one clear sentence.',
      problem: 'A revised problem statement with enough detail to explain why this matters here.',
      recipient: 'Riverton Transportation Office (fictional)',
      goal: 1500,
      deadline: '2027-12-31',
      evidence: [{ label: 'A second illustrative source', url: 'https://example.org/second' }],
    },
    reason: 'Adding a source and correcting the responsible department',
  });
  const p = await find(a, id);
  expect(p.recipient).toBe('Riverton Transportation Office (fictional)');
  expect(p.goal).toBe(1500);
  expect(p.deadline).toBe('2027-12-31');
  expect(p.evidence).toHaveLength(1);
  expect(p.evidence[0].label).toBe('A second illustrative source');
  // The prior wording survives in public history.
  expect(p.edits[0].body).toContain('Riverton Public Works (fictional)');
  expect(p.edits[0].body).toContain('Recipient:');
  expect(p.edits[0].body).toContain('Adding a source');
});

test('a patch is validated like the creation form and cannot empty a required field', async () => {
  const { adapter: a } = setup();
  const id = await publish(a);
  await expect(
    a.execute({
      type: 'edit',
      petitionId: id,
      patch: { title: 'Too short' },
      reason: 'Shortening',
    }),
  ).rejects.toThrow();
  await expect(
    a.execute({
      type: 'edit',
      petitionId: id,
      patch: { deadline: '2020-01-01' },
      reason: 'Past date',
    }),
  ).rejects.toThrow();
  await expect(
    a.execute({
      type: 'edit',
      petitionId: id,
      patch: { evidence: [{ label: 'Insecure', url: 'http://example.org' }] },
      reason: 'Adding a plain http source',
    }),
  ).rejects.toThrow();
  await expect(
    a.execute({ type: 'edit', petitionId: id, patch: {}, reason: 'No change at all' }),
  ).rejects.toThrow(/at least one field/);
});

test('body fields stay editable after signatures while signing rules lock', async () => {
  const { adapter: a } = setup();
  const id = await publish(a);
  await a.signIn(demoIds.sam);
  await a.execute({
    type: 'sign',
    petitionId: id,
    identity: 'anonymous',
    submission: await prepareSubmission(a, id),
  });
  await a.signIn(demoIds.maya);
  await expect(
    a.execute({
      type: 'edit',
      petitionId: id,
      patch: { identities: ['full_name'] },
      reason: 'Trying to change identity rules after a signature',
    }),
  ).rejects.toThrow(/locked/);
  await a.execute({
    type: 'edit',
    petitionId: id,
    patch: { problem: 'A corrected problem statement, fixing a factual typo about the route.' },
    reason: 'Fixing a typo people pointed out',
  });
  expect((await find(a, id)).problem).toContain('A corrected problem statement');
});

test('topic and community cannot be retargeted through a patch', async () => {
  const { adapter: a } = setup();
  const id = await publish(a);
  const before = await find(a, id);
  await a
    .execute({
      type: 'edit',
      petitionId: id,
      // Unknown keys are stripped by the schema rather than silently applied.
      patch: { topic: 'Environment', communityId: 'other' } as never,
      reason: 'Attempting to retarget the audience',
    })
    .catch(() => undefined);
  const after = await find(a, id);
  expect(after.topic).toBe(before.topic);
  expect(after.communityId).toBe(before.communityId);
});

test('a signer can withdraw, freeing them to sign again', async () => {
  const { adapter: a } = setup();
  const id = await publish(a);
  await a.signIn(demoIds.sam);
  await a.execute({
    type: 'sign',
    petitionId: id,
    identity: 'full_name',
    submission: await prepareSubmission(a, id),
  });
  const signed = await find(a, id);
  expect((await a.load()).signed).toContain(id);
  expect(await a.receipt(id)).not.toBeNull();
  await a.execute({ type: 'withdraw', petitionId: id });
  const after = await find(a, id);
  expect((await a.load()).signed).not.toContain(id);
  expect(after.count).toBe(signed.count - 1);
  expect((await a.load()).signatures.filter((x) => x.petitionId === id)).toHaveLength(0);
  // The private signatory record goes with it.
  expect(await a.receipt(id)).toBeNull();
  await expect(a.execute({ type: 'withdraw', petitionId: id })).rejects.toThrow(/have not signed/);
  await a.execute({
    type: 'sign',
    petitionId: id,
    identity: 'anonymous',
    submission: await prepareSubmission(a, id),
  });
  expect((await a.load()).signed).toContain(id);
});

test('withdrawal never drops the count below the fictional seed baseline', async () => {
  const { adapter: a } = setup();
  const seeded = (await a.load()).petitions.find((p) => p.verification === 'account')!;
  await a.signIn(demoIds.sam);
  await a.signIn(demoIds.jordan);
  await a.execute({
    type: 'sign',
    petitionId: seeded.id,
    identity: 'anonymous',
    submission: await prepareSubmission(a, seeded.id),
  });
  await a.execute({ type: 'withdraw', petitionId: seeded.id });
  expect((await find(a, seeded.id)).count).toBe(seeded.sampleCount);
});

test('trending velocity is a rolling window, not a lifetime tally', async () => {
  const { adapter: a } = setup();
  const id = await publish(a);
  const fresh = await find(a, id);
  expect(fresh.sampleVelocity).toBe(0);
  expect(fresh.recentSignatures).toBe(0);
  await a.signIn(demoIds.sam);
  await a.execute({
    type: 'sign',
    petitionId: id,
    identity: 'anonymous',
    submission: await prepareSubmission(a, id),
  });
  expect((await find(a, id)).recentSignatures).toBe(1);
  // A signature older than the window stops counting toward velocity but still counts as support.
  jest.useFakeTimers().setSystemTime(Date.now() + 8 * 86400000);
  try {
    const later = await find(a, id);
    expect(later.recentSignatures).toBe(0);
    expect(later.count).toBe(1);
  } finally {
    jest.useRealTimers();
  }
});

test('edit helpers report only real changes and preserve prior wording', () => {
  const draft = seedPetitions()[0];
  expect(changedFields(draft, { title: draft.title })).toEqual([]);
  expect(changedFields(draft, { goal: draft.goal + 1 })).toEqual(['goal']);
  expect(changedFields(draft, { evidence: [] })).toEqual(['evidence']);
  const next = { ...draft, recipient: 'A different office (fictional)' };
  expect(describeEdit(draft, next, ['recipient'])).toContain(draft.recipient);
  expect(describeEdit(draft, next, ['recipient'])).toContain('A different office (fictional)');
  expect(editPatchSchema.safeParse({ topic: 'Environment' }).success).toBe(false);
});
