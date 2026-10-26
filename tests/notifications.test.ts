import { prepareSubmission } from './signature-fixture';
import { LocalAdapter, Storage } from '../src/data/local';
import { communityId, demoIds, seedPetitions } from '../src/data/seed';

import { crossedMilestone, reachedMilestones } from '../src/domain/rules';
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
/** Publish a signable petition owned by Maya and return its id. */
async function publish(a: LocalAdapter) {
  await a.signIn(demoIds.maya);
  const id = await a.execute({ type: 'create', draft: seedPetitions()[0], publish: true });
  if (typeof id !== 'string') throw new Error('Missing id');
  return id;
}
const bodies = async (a: LocalAdapter) => (await a.load()).notifications.map((n) => n.body);

test('organizers are told about signatures, discussion, community backing and eligibility requests', async () => {
  const { adapter: a } = setup();
  const id = await publish(a);
  await a.signIn(demoIds.sam);
  await a.execute({
    type: 'sign',
    petitionId: id,
    identity: 'anonymous',
    submission: await prepareSubmission(a, id),
  });
  await a.execute({
    type: 'discussion',
    petitionId: id,
    body: 'Where does the route start?',
    kind: 'question',
  });
  // Three Irvine students members vote yes, so the community backs it.
  for (const voter of [demoIds.maya, demoIds.sam, demoIds.jordan]) {
    await a.signIn(voter);
    await a.execute({
      type: 'backVote',
      petitionId: id,
      communityId: communityId(1),
      support: true,
    });
  }
  await a.signIn(demoIds.maya);
  const maya = await bodies(a);
  expect(maya.some((b) => b.includes('Anonymous supporter signed'))).toBe(true);
  expect(maya.some((b) => b.includes('posted a question'))).toBe(true);
  expect(maya.some((b) => b.includes('Irvine students voted to back'))).toBe(true);
  // An anonymous signer's real name never reaches the organizer.
  expect(maya.some((b) => b.includes('Sam Rivera') && b.includes('signed'))).toBe(false);
});

test('signers and savers are told about updates, edits, responses and closure', async () => {
  const { adapter: a } = setup();
  const id = await publish(a);
  await a.signIn(demoIds.sam);
  await a.execute({
    type: 'sign',
    petitionId: id,
    identity: 'anonymous',
    submission: await prepareSubmission(a, id),
  });
  await a.signIn(demoIds.jordan);
  await a.execute({ type: 'save', petitionId: id });
  await a.signIn(demoIds.maya);
  await a.execute({ type: 'update', petitionId: id, body: 'The lighting audit is scheduled.' });
  await a.execute({
    type: 'edit',
    petitionId: id,
    patch: { summary: 'A revised one-sentence summary of what this petition asks for.' },
    reason: 'Tightening the summary after feedback',
  });
  await a.execute({
    type: 'response',
    petitionId: id,
    body: 'We have received the request and will review it.',
    organization: 'Irvine Public Works (fictional)',
  });
  await a.execute({ type: 'close', petitionId: id, status: 'successful' });
  for (const who of [demoIds.sam, demoIds.jordan]) {
    await a.signIn(who);
    const got = await bodies(a);
    expect(got.some((b) => b.includes('New update'))).toBe(true);
    expect(got.some((b) => b.includes('was revised by the organizer'))).toBe(true);
    expect(got.some((b) => b.includes('unverified response'))).toBe(true);
    expect(got.some((b) => b.includes('marked successful'))).toBe(true);
  }
  // Saving is a real subscription: Jordan never signed.
  expect((await a.load()).signed).not.toContain(id);
});

test('unsaving stops the updates', async () => {
  const { adapter: a } = setup();
  const id = await publish(a);
  await a.signIn(demoIds.jordan);
  await a.execute({ type: 'save', petitionId: id });
  await a.execute({ type: 'save', petitionId: id });
  expect((await a.load()).saved).not.toContain(id);
  const before = (await bodies(a)).length;
  await a.signIn(demoIds.maya);
  await a.execute({ type: 'update', petitionId: id, body: 'An update nobody saved it for.' });
  await a.signIn(demoIds.jordan);
  expect((await bodies(a)).length).toBe(before);
});

test('an eligibility request reaches the organizer and its decision reaches the requester', async () => {
  const { adapter: a } = setup();
  await a.signIn(demoIds.maya);
  const id = await a.execute({
    type: 'create',
    draft: {
      ...seedPetitions()[0],
      verification: 'custom',
      customRule: 'Regular users of this fictional public facility may request review.',
    },
    publish: true,
  });
  if (typeof id !== 'string') throw new Error('Missing id');
  await a.signIn(demoIds.jordan);
  await a.execute({
    type: 'requestEligibility',
    petitionId: id,
    statement: 'I walk this route daily.',
  });
  await a.signIn(demoIds.maya);
  expect((await bodies(a)).some((b) => b.includes('requested eligibility review'))).toBe(true);
  const [request] = await a.requests(id);
  await a.execute({
    type: 'reviewEligibility',
    petitionId: id,
    requestId: request.id,
    approved: true,
  });
  await a.signIn(demoIds.jordan);
  expect((await bodies(a)).some((b) => b.includes('approved your eligibility'))).toBe(true);
  expect((await a.load()).customApprovals).toContain(id);
});

test('crossing a signature milestone notifies the organizer and everyone following', async () => {
  const { adapter: a } = setup();
  await a.signIn(demoIds.maya);
  // A goal of 10 with no fictional baseline: the third real signature crosses 25%.
  const id = await a.execute({
    type: 'create',
    draft: { ...seedPetitions()[0], goal: 10, verification: 'account' },
    publish: true,
  });
  if (typeof id !== 'string') throw new Error('Missing id');
  for (const who of [demoIds.sam, demoIds.jordan]) {
    await a.signIn(who);
    await a.execute({
      type: 'sign',
      petitionId: id,
      identity: 'anonymous',
      submission: await prepareSubmission(a, id),
    });
    expect((await bodies(a)).some((b) => b.includes('reached'))).toBe(false);
  }
  await a.signIn(demoIds.maya);
  await a.execute({
    type: 'sign',
    petitionId: id,
    identity: 'anonymous',
    submission: await prepareSubmission(a, id),
  });
  // The organizer who signed third and everyone already following all hear about it.
  expect((await bodies(a)).some((b) => b.includes('reached 25%'))).toBe(true);
  for (const who of [demoIds.sam, demoIds.jordan]) {
    await a.signIn(who);
    expect((await bodies(a)).some((b) => b.includes('reached 25%'))).toBe(true);
  }
});

test('milestone helpers report progress only when a threshold is newly crossed', () => {
  expect(reachedMilestones(5, 10)).toEqual([25, 50]);
  expect(reachedMilestones(0, 10)).toEqual([]);
  expect(crossedMilestone(2, 5, 10)).toBe(50);
  expect(crossedMilestone(5, 6, 10)).toBeUndefined();
  expect(crossedMilestone(0, 10, 10)).toBe(100);
  expect(reachedMilestones(1, 0)).toEqual([]);
});
