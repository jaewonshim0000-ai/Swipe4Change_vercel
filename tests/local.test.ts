import { prepareSubmission, fixtureSubmission } from './signature-fixture';
import { LocalAdapter, STORAGE_KEY, Storage, localRippleCode } from '../src/data/local';
import { demoIds, petitionId, seedPetitions } from '../src/data/seed';
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
test('create, publish, sign anonymously, persist, manage and discuss end to end', async () => {
  const { adapter: a, storage } = setup();
  await a.signIn(demoIds.maya);
  await a.execute({
    type: 'onboard',
    city: 'Irvine, CA',
    interests: ['Education', 'Environment', 'Safer streets'],
  });
  const id = await a.execute({ type: 'create', draft: seedPetitions()[0], publish: false });
  expect(typeof id).toBe('string');
  if (!id) throw new Error('Missing id');
  await a.execute({ type: 'publish', petitionId: id });
  await a.signOut();
  await a.signIn(demoIds.sam);
  await a.execute({
    type: 'sign',
    petitionId: id,
    identity: 'anonymous',
    submission: await prepareSubmission(a, id),
  });
  let s = await a.load();
  expect(s.signed).toContain(id);
  expect(s.signatures[0]).toEqual({
    id: expect.any(String),
    petitionId: id,
    displayName: 'Anonymous supporter',
    identity: 'anonymous',
  });
  expect(JSON.stringify(s.signatures)).not.toContain(demoIds.sam);
  await a.execute({
    type: 'discussion',
    petitionId: id,
    body: 'Could this include the bus stop?',
    kind: 'question',
  });
  await expect(
    a.execute({ type: 'update', petitionId: id, body: 'Unauthorized update' }),
  ).rejects.toThrow(/owner/);
  await a.signIn(demoIds.maya);
  await a.execute({
    type: 'update',
    petitionId: id,
    body: 'We have shared the proposal with neighbors.',
  });
  s = await new LocalAdapter(storage, () => 'new').load();
  expect(s.petitions.find((p) => p.id === id)?.count).toBe(1);
  expect(s.petitions.find((p) => p.id === id)?.updates).toHaveLength(1);
});
test('concurrent duplicate signatures result in exactly one record', async () => {
  const { adapter: a } = setup();
  await a.signIn(demoIds.maya);
  const command = {
    type: 'sign' as const,
    petitionId: petitionId(1),
    identity: 'anonymous' as const,
    submission: await prepareSubmission(a, petitionId(1)),
  };
  const results = await Promise.allSettled([a.execute(command), a.execute(command)]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect((await a.load()).signatures).toHaveLength(1);
});
test('rejected writes leave persisted data intact', async () => {
  const { adapter: a } = setup();
  await a.signIn(demoIds.maya);
  const before = await a.load();
  a.simulateFailure();
  await expect(
    a.execute({
      type: 'sign',
      petitionId: petitionId(1),
      identity: 'anonymous',
      submission: await prepareSubmission(a, petitionId(1)),
    }),
  ).rejects.toThrow(/interrupted/);
  expect(await a.load()).toEqual(before);
  await a.execute({ type: 'save', petitionId: petitionId(1) });
  expect((await a.load()).saved).toContain(petitionId(1));
});
test('eligibility review, immutable rules and unverified responses', async () => {
  const { adapter: a } = setup();
  await a.signIn(demoIds.maya);
  const id = petitionId(10);
  await a.execute({
    type: 'requestEligibility',
    petitionId: id,
    statement: 'I regularly use these courts.',
  });
  await expect(
    a.execute({
      type: 'sign',
      petitionId: id,
      identity: 'anonymous',
      submission: await prepareSubmission(a, id),
    }),
  ).rejects.toThrow(/review/);
  await a.signIn(demoIds.sam);
  const [request] = await a.requests(id);
  expect(request).not.toHaveProperty('userId');
  await a.execute({
    type: 'reviewEligibility',
    petitionId: id,
    requestId: request.id,
    approved: true,
  });
  await a.execute({
    type: 'response',
    petitionId: id,
    body: 'A supplied response from the organizer.',
    organization: 'Example office',
  });
  expect((await a.load()).petitions.find((p) => p.id === id)?.responses[0].verification).toBe(
    'unverified',
  );
  await a.signIn(demoIds.maya);
  await a.execute({
    type: 'sign',
    petitionId: id,
    identity: 'anonymous',
    submission: await prepareSubmission(a, id),
  });
  await a.signIn(demoIds.sam);
  await expect(
    a.execute({
      type: 'edit',
      petitionId: id,
      patch: { verification: 'account' },
      reason: 'Changing our eligibility rule',
    }),
  ).rejects.toThrow(/locked/);
});

test('incomplete drafts survive reload, remain private, update in place and disappear after publishing', async () => {
  const { adapter: a, storage } = setup();
  const id = '99000000-0000-4000-8000-000000000001';
  await a.signIn(demoIds.maya);
  await a.execute({
    type: 'saveDraft',
    id,
    step: 0,
    draft: { ...seedPetitions()[0], title: '', problem: '' },
  });
  const reloaded = new LocalAdapter(storage, () => 'next');
  expect((await reloaded.load()).drafts?.[0].draft.title).toBe('');
  await a.signIn(demoIds.sam);
  expect((await a.load()).drafts).toEqual([]);
  await expect(
    a.execute({ type: 'saveDraft', id, step: 0, draft: seedPetitions()[0] }),
  ).rejects.toThrow(/private/);
  await expect(a.execute({ type: 'deleteDraft', id })).rejects.toThrow(/private/);
  await a.signIn(demoIds.maya);
  await a.execute({ type: 'saveDraft', id, step: 2, draft: seedPetitions()[0] });
  expect((await a.load()).drafts).toHaveLength(1);
  await a.execute({ type: 'create', draft: seedPetitions()[0], publish: true, draftId: id });
  expect((await a.load()).drafts).toEqual([]);
});

test('profile edits are validated and do not mutate prior public signatures', async () => {
  const { adapter: a } = setup();
  await a.signIn(demoIds.maya);
  await a.execute({
    type: 'sign',
    petitionId: petitionId(1),
    identity: 'full_name',
    submission: await prepareSubmission(a, petitionId(1)),
  });
  const before = (await a.load()).signatures;
  await a.execute({
    type: 'profile',
    name: 'Maya C',
    bio: 'Safer routes for everyone.',
    useSigningHistory: false,
  });
  expect((await a.load()).profile?.bio).toBe('Safer routes for everyone.');
  expect((await a.load()).profile?.useSigningHistory).toBe(false);
  expect((await a.load()).signatures).toEqual(before);
  await expect(
    a.execute({
      type: 'profile',
      name: '',
      bio: '',
      useSigningHistory: true,
    }),
  ).rejects.toThrow();
});

test('participation awards are earned by saved actions', async () => {
  const { adapter: a } = setup();
  // Maya starts in one community; a second earns Community builder.
  await a.signIn(demoIds.maya);
  expect((await a.load()).profile?.badges).not.toContain('Community builder');
  await a.execute({ type: 'join', communityId: (await a.load()).communities[1].id });
  expect((await a.load()).profile?.badges).toContain('Community builder');
  // Publishing needs a verified email, which Jordan's sample account lacks; Sam publishes.
  await a.signIn(demoIds.sam);
  const id = await a.execute({ type: 'create', draft: seedPetitions()[0], publish: true });
  expect((await a.load()).profile?.badges).toContain('Change starter');
  await a.signIn(demoIds.jordan);
  await a.execute({
    type: 'discussion',
    petitionId: id!,
    body: 'Here is an idea for this route.',
    kind: 'idea',
  });
  expect((await a.load()).profile?.badges).toContain('Conversation starter');
});

test('each badge is announced once, and some are earned through other people', async () => {
  const { adapter: a } = setup();
  await a.signIn(demoIds.maya);
  // Maya already follows one petition; two more saves earn Keeping watch.
  for (const n of [3, 4]) await a.execute({ type: 'save', petitionId: petitionId(n) });
  await a.execute({ type: 'save', petitionId: petitionId(5) });
  const badgeNews = async () =>
    (await a.load()).notifications.filter((n) => n.kind === 'badge').map((n) => n.body);
  expect(await badgeNews()).toEqual([
    'You earned the Keeping watch badge. See all your badges in Profile.',
  ]);
  const shade = (await a.load()).petitions.find((p) => p.id === petitionId(2))!;
  await a.execute({
    type: 'sign',
    petitionId: shade.id,
    identity: 'anonymous',
    submission: fixtureSubmission(shade),
  });
  expect(await badgeNews()).toHaveLength(2);
  expect((await a.load()).profile?.badges).toContain('First voice');
  // Sam signing through Maya's link earns Maya Ripple maker, though Maya did nothing.
  await a.signIn(demoIds.sam);
  await a.execute({
    type: 'sign',
    petitionId: shade.id,
    identity: 'anonymous',
    submission: fixtureSubmission(shade),
    via: localRippleCode(demoIds.maya),
  });
  await a.signIn(demoIds.maya);
  expect((await a.load()).profile?.badges).toContain('Ripple maker');
  expect((await badgeNews())[0]).toBe(
    'You earned the Ripple maker badge. See all your badges in Profile.',
  );
});

test('a signature needs a drawing and consent, matches the text read, and stays private', async () => {
  const { adapter: a } = setup();
  await a.signIn(demoIds.sam);
  const id = petitionId(1);
  const p = (await a.load()).petitions.find((p) => p.id === id)!;
  const submission = fixtureSubmission(p);
  const sign = (s: unknown) =>
    a.execute({
      type: 'sign',
      petitionId: id,
      identity: 'anonymous',
      submission: s as typeof submission,
    });
  await expect(
    sign({ ...submission, signature: submission.signature.slice(0, 3) }),
  ).rejects.toThrow(/Draw your signature/);
  await expect(sign({ ...submission, consent: false })).rejects.toThrow(/consent/);
  await expect(
    sign({ ...submission, disclosure: { ...submission.disclosure, title: 'Stale title' } }),
  ).rejects.toThrow(/changed/);
  expect((await a.load()).signed).toEqual([]);
  expect(await a.receipt(id)).toBeNull();
  await sign(submission);
  const original = await a.receipt(id);
  expect(original?.disclosure).toEqual(submission.disclosure);
  expect(original?.signature).toEqual(submission.signature);
  // The drawing never appears in anything another account can read.
  expect(JSON.stringify(await a.load())).not.toContain('"start":true');
  await a.signIn(demoIds.maya);
  expect(await a.receipt(id)).toBeNull();
  await a.execute({
    type: 'edit',
    petitionId: id,
    patch: { action: 'Install safer crossing signals on this route.' },
    reason: 'Clarifying the requested equipment',
  });
  await a.signIn(demoIds.sam);
  expect(await a.receipt(id)).toEqual(original);
  await a.execute({ type: 'withdraw', petitionId: id });
  expect(await a.receipt(id)).toBeNull();
  await a.signOut();
  await expect(a.receipt(id)).rejects.toThrow(/Sign in/);
});

test('older demo locations migrate to Orange County without resetting user work', async () => {
  const { adapter, storage } = setup();
  await adapter.signIn(demoIds.maya);
  const created = await adapter.execute({
    type: 'create',
    draft: seedPetitions()[0],
    publish: false,
  });
  const raw = await storage.getItem(STORAGE_KEY);
  if (!raw) throw new Error('Missing saved demo');
  const old = JSON.parse(
    raw.replaceAll('Irvine', 'Riverton').replaceAll('Costa Mesa', 'Brookside'),
  );
  delete old.locationRevision;
  await storage.setItem(STORAGE_KEY, JSON.stringify(old));
  const restored = await new LocalAdapter(storage, () => 'new').load();
  expect(restored.profile?.city).toBe('Irvine, CA');
  expect(restored.communities[0].name).toBe('Irvine students');
  expect(restored.petitions.find((p) => p.id === petitionId(1))?.city).toBe('Irvine, CA');
  // User-created content is not overwritten by a sample catalog migration.
  expect(restored.petitions.find((p) => p.id === created)?.city).toBe('Riverton, CA');
  expect(restored.saved).toContain(petitionId(2));
  expect(restored.profile?.id).toBe(demoIds.maya);
});

test('Anish demo account is added to existing saves and keeps profile edits after reopening', async () => {
  const { adapter, storage } = setup();
  await adapter.signIn(demoIds.maya);
  const raw = await storage.getItem(STORAGE_KEY);
  if (!raw) throw new Error('Missing saved demo');
  const old = JSON.parse(raw) as { profiles: { id: string }[] };
  old.profiles = old.profiles.filter((p) => p.id !== demoIds.anish);
  await storage.setItem(STORAGE_KEY, JSON.stringify(old));
  const reopened = new LocalAdapter(storage, () => 'new');
  await reopened.signIn(demoIds.anish);
  expect((await reopened.load()).profile).toMatchObject({
    id: demoIds.anish,
    name: 'Anish Madishetty',
    city: 'Irvine, CA',
    onboarded: true,
  });
  await reopened.execute({
    type: 'profile',
    name: 'Anish Madishetty',
    bio: 'My demo profile',
    useSigningHistory: false,
  });
  expect((await new LocalAdapter(storage, () => 'new').load()).profile?.bio).toBe(
    'My demo profile',
  );
});
