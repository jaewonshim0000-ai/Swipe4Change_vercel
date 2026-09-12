import { qualificationFixture } from './qualification-fixture';
import { qualificationChecklist } from '../src/domain/qualification';
import { prepareSubmission, fixtureSubmission, fixtureEnvelope } from './signature-fixture';
import { LocalAdapter, Storage } from '../src/data/local';
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
    city: 'Riverton, CA',
    interests: ['Education', 'Environment', 'Safer streets'],
  });
  const id = await a.execute({ type: 'create', draft: seedPetitions()[0], publish: false });
  expect(typeof id).toBe('string');
  if (!id) throw new Error('Missing id');
  await a.execute({ type: 'publish', petitionId: id });
  await a.execute({
    type: 'qualification',
    petitionId: id,
    details: qualificationFixture,
    reason: 'Fictional source requirements supplied',
  });
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
    id: 'test-3',
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
    a.execute({ type: 'sign', petitionId: petitionId(1), identity: 'anonymous' }),
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
  await expect(a.execute({ type: 'sign', petitionId: id, identity: 'anonymous' })).rejects.toThrow(
    /review/,
  );
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
  const p = (await a.load()).petitions.find((p) => p.id === id)!;
  await expect(
    a.execute({
      type: 'edit',
      petitionId: id,
      title: p.title,
      action: p.action,
      reason: 'Changing our eligibility rule',
      verification: 'account',
      identities: p.identities,
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
    avatar: 'sun',
    accent: 'ocean',
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
      avatar: 'sun',
      accent: 'ocean',
      useSigningHistory: true,
    }),
  ).rejects.toThrow();
});

test('participation awards are earned by saved actions', async () => {
  const { adapter: a } = setup();
  await a.signIn(demoIds.jordan);
  const communities = (await a.load()).communities;
  for (const c of communities.slice(0, 2)) await a.execute({ type: 'join', communityId: c.id });
  expect((await a.load()).profile?.badges).toContain('Community builder');
  const id = await a.execute({ type: 'create', draft: seedPetitions()[0], publish: true });
  expect((await a.load()).profile?.badges).toContain('Change starter');
  await a.execute({
    type: 'discussion',
    petitionId: id!,
    body: 'Here is an idea for this route.',
    kind: 'idea',
  });
  expect((await a.load()).profile?.badges).toContain('Conversation starter');
});

test('encrypted vault is account-scoped and never appears in a snapshot', async () => {
  const { adapter: a } = setup();
  await expect(a.vault()).rejects.toThrow(/Sign in/);
  await a.signIn(demoIds.maya);
  const envelope = { version: 1 as const, ciphertext: 'A'.repeat(100) };
  await a.execute({ type: 'saveVault', envelope });
  expect(await a.vault()).toEqual(envelope);
  expect(JSON.stringify(await a.load())).not.toContain(envelope.ciphertext);
  await a.signIn(demoIds.sam);
  expect(await a.vault()).toBeNull();
  await a.execute({ type: 'deleteVault' });
  await a.signIn(demoIds.maya);
  expect(await a.vault()).toEqual(envelope);
  await a.execute({ type: 'deleteVault' });
  expect(await a.vault()).toBeNull();
});

test('signature receipts require consent, reject stale disclosure, and stay private and immutable across edits', async () => {
  const { adapter: a } = setup();
  await a.signIn(demoIds.sam);
  const id = petitionId(1);
  const p = (await a.load()).petitions.find((p) => p.id === id)!;
  const submission = fixtureSubmission(p);
  await expect(a.execute({ type: 'sign', petitionId: id, identity: 'anonymous' })).rejects.toThrow(
    /full petition/,
  );
  await expect(
    a.execute({ type: 'sign', petitionId: id, identity: 'anonymous', submission }),
  ).rejects.toThrow(/vault/);
  await a.execute({ type: 'saveVault', envelope: fixtureEnvelope });
  await expect(
    a.execute({
      type: 'sign',
      petitionId: id,
      identity: 'anonymous',
      submission: { ...submission, disclosure: { ...submission.disclosure, title: 'Stale title' } },
    }),
  ).rejects.toThrow(/changed/);
  expect((await a.load()).signed).toEqual([]);
  expect(await a.receipt(id)).toBeNull();
  await a.execute({ type: 'sign', petitionId: id, identity: 'anonymous', submission });
  const original = await a.receipt(id);
  expect(original?.disclosure).toEqual(submission.disclosure);
  expect(original?.status).toBe('pending');
  expect((await a.load()).petitions.find((p) => p.id === id)?.acceptedSignatures).toBe(0);
  expect(JSON.stringify(await a.load())).not.toContain(fixtureEnvelope.ciphertext);
  await a.signIn(demoIds.maya);
  expect(await a.receipt(id)).toBeNull();
  await a.execute({
    type: 'edit',
    petitionId: id,
    title: p.title,
    action: 'Install safer crossing signals on this route.',
    reason: 'Clarifying the requested equipment',
    verification: p.verification,
    identities: p.identities,
  });
  await a.signIn(demoIds.sam);
  await a.execute({ type: 'deleteVault' });
  expect(await a.receipt(id)).toEqual(original);
  await a.signOut();
  await expect(a.receipt(id)).rejects.toThrow(/Sign in/);
});

test('legal setup and affidavit are validated, history-preserving and cannot be self-approved', async () => {
  const { adapter: a } = setup();
  await a.signIn(demoIds.maya);
  const id = await a.execute({ type: 'create', draft: seedPetitions()[0], publish: true });
  if (!id) throw new Error('Missing created petition');
  await expect(
    a.execute({
      type: 'sign',
      petitionId: id,
      identity: 'anonymous',
      submission: fixtureSubmission(seedPetitions()[0]),
    }),
  ).rejects.toThrow(/configure all four/);
  await a.execute({
    type: 'qualification',
    petitionId: id,
    details: qualificationFixture,
    reason: 'Supplied fictional source requirements',
  });
  let p = (await a.load()).petitions.find((p) => p.id === id)!;
  expect(p.qualification?.status).toBe('pending');
  expect(p.edits).toHaveLength(1);
  await a.signIn(demoIds.sam);
  await expect(
    a.execute({
      type: 'qualification',
      petitionId: id,
      details: qualificationFixture,
      reason: 'Not authorized',
    }),
  ).rejects.toThrow(/permission/);
  const submission = await prepareSubmission(a, id);
  expect(submission.disclosure.fullText).toBe(qualificationFixture.officialText);
  await a.execute({ type: 'sign', petitionId: id, identity: 'anonymous', submission });
  const receipt = (await a.receipt(id))!;
  await a.signIn(demoIds.maya);
  await expect(
    a.execute({
      type: 'qualification',
      petitionId: id,
      details: { ...qualificationFixture, statutoryThreshold: 1 },
      reason: 'Change to make it easier',
    }),
  ).rejects.toThrow(/locked/);
  await a.execute({ type: 'saveVault', envelope: fixtureEnvelope });
  const affidavit = {
    id: 'a1000000-0000-4000-8000-000000000001',
    petitionId: id,
    signatureIds: [receipt.id],
    declaration: qualificationFixture.circulatorDeclaration,
    witnessed: true as const,
    notarizationProvided: true,
    envelope: fixtureEnvelope,
  };
  await expect(
    a.execute({
      type: 'affidavit',
      petitionId: id,
      submission: { ...affidavit, notarizationProvided: false },
    }),
  ).rejects.toThrow(/notarized/);
  await expect(
    a.execute({
      type: 'affidavit',
      petitionId: id,
      submission: { ...affidavit, signatureIds: ['unrelated-id'] },
    }),
  ).rejects.toThrow(/only signatures/);
  await a.execute({ type: 'affidavit', petitionId: id, submission: affidavit });
  expect((await a.affidavits(id))[0].status).toBe('pending');
  p = (await a.load()).petitions.find((p) => p.id === id)!;
  expect(p.qualification?.affidavitCount).toBe(1);
  expect(p.qualification?.acceptedAffidavits).toBe(0);
  expect(qualificationChecklist(p).every((item) => !item.ready)).toBe(true);
  expect(JSON.stringify(await a.load())).not.toContain(fixtureEnvelope.ciphertext);
  await a.signIn(demoIds.sam);
  expect(await a.affidavits(id)).toEqual([]);
});
