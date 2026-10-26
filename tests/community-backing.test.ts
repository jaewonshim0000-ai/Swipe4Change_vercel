import { LocalAdapter, Storage } from '../src/data/local';
import { communityId, demoIds, petitionId } from '../src/data/seed';
import { backerNames, requirementLabel } from '../src/domain/discovery';
import { packetText } from '../src/domain/packet';
import { backingReached, scorePetition } from '../src/domain/rules';

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
const crossing = petitionId(6);
const irvine = communityId(1);
const vote = (a: LocalAdapter, support: boolean, community = irvine) =>
  a.execute({ type: 'backVote', petitionId: crossing, communityId: community, support });

test('backing needs three yes votes and more yes than no', () => {
  expect(backingReached(2, 0)).toBe(false);
  expect(backingReached(3, 0)).toBe(true);
  expect(backingReached(3, 3)).toBe(false);
  expect(backingReached(4, 3)).toBe(true);
});

test('members vote a community into backing a petition; only totals and your own vote are shared', async () => {
  const a = setup();
  await a.signIn(demoIds.maya);
  let s = await a.load();
  expect(s.petitions.find((p) => p.id === crossing)?.backing).toEqual([
    { communityId: irvine, yes: 2, no: 0 },
  ]);
  // Maya is not a member of Greener together.
  await expect(vote(a, true, communityId(2))).rejects.toThrow('Only members');
  expect(await vote(a, false)).toBeUndefined();
  s = await a.load();
  expect(s.petitions.find((p) => p.id === crossing)?.backing[0]).toMatchObject({ yes: 2, no: 1 });
  expect(s.backingVotes).toEqual([{ petitionId: crossing, communityId: irvine, support: false }]);
  // Changing her vote to yes makes three yes: the community backs it and the vote closes.
  expect(await vote(a, true)).toBe('backed');
  s = await a.load();
  const p = s.petitions.find((x) => x.id === crossing)!;
  expect(p.backing[0]).toMatchObject({ yes: 3, no: 0 });
  expect(p.backing[0].backedAt).toBeTruthy();
  expect(p.endorsements.at(-1)?.body).toBe(
    'Irvine students members voted to back this (3 yes · 0 no).',
  );
  await expect(vote(a, false)).rejects.toThrow('already backs');
  expect(backerNames(p, s.communities)).toEqual(['Irvine students']);
  // Sam organizes the petition: told about it, and sees his own vote only.
  await a.signIn(demoIds.sam);
  s = await a.load();
  expect(s.notifications.some((n) => n.body.includes('Irvine students voted to back'))).toBe(true);
  expect(s.backingVotes).toEqual([{ petitionId: crossing, communityId: irvine, support: true }]);
});

test('backing ranks a petition as your community’s own, labels it, and goes into the packet', async () => {
  const a = setup();
  await a.signIn(demoIds.maya);
  const s = await a.load();
  const flagship = s.petitions.find((p) => p.id === petitionId(1))!;
  const library = s.petitions.find((p) => p.id === petitionId(3))!;
  const member = { ...s.profile!, joined: [irvine] };
  // The library petition belongs to Costa Mesa neighbors; Irvine backing it counts as community.
  expect(scorePetition(library, member).factors.community).toBe(0);
  const backed = { ...library, backing: [{ communityId: irvine, yes: 3, no: 0, backedAt: 'x' }] };
  expect(scorePetition(backed, member).factors.community).toBe(20);
  expect(scorePetition(backed, member).reasons).toContain('Backed by your community');
  // Members-only petitions name the community.
  const membersOnly = s.petitions.find((p) => p.id === crossing)!;
  expect(requirementLabel(membersOnly, s.communities)).toBe('Members of Irvine students only');
  expect(requirementLabel(library, s.communities)).toBe('Account required');
  // The flagship's sample backing predates voting, so the packet names it without a tally.
  expect(packetText(flagship, null, [], s.communities)).toContain(
    'BACKED BY COMMUNITIES\n  · Irvine students\n',
  );
  const voted = packetText(
    { ...backed, backing: [{ communityId: irvine, yes: 5, no: 1, backedAt: 'x' }] },
    null,
    [],
    s.communities,
  );
  expect(voted).toContain('Irvine students — members voted 5 yes · 1 no');
});
