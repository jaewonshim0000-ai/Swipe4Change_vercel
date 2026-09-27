import { prepareSubmission } from './signature-fixture';
import { LocalAdapter, Storage, localRippleCode } from '../src/data/local';
import { demoIds, seedPetitions } from '../src/data/seed';
import { rippleOf, rippleTotal } from '../src/domain/ripple';

function setup() {
  const values = new Map<string, string>();
  const storage: Storage = {
    getItem: async (k) => values.get(k) ?? null,
    setItem: async (k, v) => {
      values.set(k, v);
    },
  };
  let id = 0;
  return new LocalAdapter(storage, () => `test-${++id}`);
}
/** Maya publishes an open petition and signs it herself. */
async function started(a: LocalAdapter) {
  await a.signIn(demoIds.maya);
  const id = await a.execute({
    type: 'create',
    draft: { ...seedPetitions()[0], verification: 'account' },
    publish: true,
  });
  if (typeof id !== 'string') throw new Error('Missing id');
  await sign(a, demoIds.maya, id);
  return id;
}
async function sign(a: LocalAdapter, who: string, petitionId: string, via?: string) {
  await a.signIn(who);
  await a.execute({
    type: 'sign',
    petitionId,
    identity: 'full_name',
    submission: await prepareSubmission(a, petitionId),
    ...(via ? { via } : {}),
  });
}
const code = (who: string) => localRippleCode(who);

test('rippleOf counts direct and further signers once, and never you', () => {
  const r = (signerId: string, referrerId: string, petitionId = 'p') => ({
    petitionId,
    signerId,
    referrerId,
  });
  expect(rippleOf('me', [r('a', 'me'), r('b', 'me'), r('c', 'a'), r('d', 'c')])).toEqual([
    { petitionId: 'p', direct: 2, further: 2 },
  ]);
  // A loop from a withdraw-and-re-sign does not count you or run forever.
  expect(rippleOf('me', [r('a', 'me'), r('me', 'a')])).toEqual([
    { petitionId: 'p', direct: 1, further: 0 },
  ]);
  // Another petition's chain is a separate ripple; a petition you did not spread is absent.
  expect(rippleOf('me', [r('a', 'me', 'x'), r('b', 'z', 'y')])).toEqual([
    { petitionId: 'x', direct: 1, further: 0 },
  ]);
  expect(rippleTotal({ code: 'c', petitions: [{ petitionId: 'x', direct: 2, further: 3 }] })).toBe(
    5,
  );
});

test('signing through a link grows the sharer’s ripple, and the next link grows it further', async () => {
  const a = setup();
  const id = await started(a);
  await sign(a, demoIds.sam, id, code(demoIds.maya));
  await sign(a, demoIds.jordan, id, code(demoIds.sam));
  await a.signIn(demoIds.maya);
  const maya = await a.load();
  expect(maya.ripple?.code).toBe(code(demoIds.maya));
  expect(maya.ripple?.petitions).toEqual([{ petitionId: id, direct: 1, further: 1 }]);
  expect(maya.petitions.find((p) => p.id === id)?.viaShares).toBe(2);
  // The sharer learns that someone signed, never who.
  const note = maya.notifications.find((n) => n.kind === 'ripple');
  expect(note?.body).toContain('1 person has signed it because of you');
  expect(note?.body).not.toContain('Sam');
  await a.signIn(demoIds.sam);
  expect((await a.load()).ripple?.petitions).toEqual([{ petitionId: id, direct: 1, further: 0 }]);
});

test('a link only credits someone who signed, never yourself, and a bad code never blocks signing', async () => {
  const a = setup();
  const id = await started(a);
  // Sam has not signed, so his link credits nobody.
  await sign(a, demoIds.jordan, id, code(demoIds.sam));
  await a.signIn(demoIds.sam);
  expect((await a.load()).ripple?.petitions).toEqual([]);
  await sign(a, demoIds.sam, id, code(demoIds.sam));
  expect((await a.load()).signed).toContain(id);
  expect((await a.load()).ripple?.petitions).toEqual([]);
  expect((await a.load()).petitions.find((p) => p.id === id)?.viaShares).toBe(0);
});

test('an unknown code is ignored and the signature still counts', async () => {
  const a = setup();
  const id = await started(a);
  await sign(a, demoIds.sam, id, 'not-a-real-code');
  expect((await a.load()).signed).toContain(id);
  await a.signIn(demoIds.maya);
  expect((await a.load()).ripple?.petitions).toEqual([]);
});

test('withdrawing a signature takes it out of the ripple it was part of', async () => {
  const a = setup();
  const id = await started(a);
  await sign(a, demoIds.sam, id, code(demoIds.maya));
  await a.execute({ type: 'withdraw', petitionId: id });
  await a.signIn(demoIds.maya);
  const maya = await a.load();
  expect(maya.ripple?.petitions).toEqual([]);
  expect(maya.petitions.find((p) => p.id === id)?.viaShares).toBe(0);
});

test('a guest has no ripple', async () => {
  const a = setup();
  expect((await a.load()).ripple).toBeNull();
});
