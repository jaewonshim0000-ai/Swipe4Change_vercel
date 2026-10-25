import { LocalAdapter, Storage } from '../src/data/local';
import { demoIds, seedPetitions } from '../src/data/seed';
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

test('a member can create a community, owns it, and its headcount is not fictional', async () => {
  const { adapter: a } = setup();
  await a.signIn(demoIds.jordan);
  const id = await a.execute({
    type: 'createCommunity',
    name: 'Cedar Commons friends',
    description: 'Neighbors keeping the courts and green space usable all year round.',
    city: 'Costa Mesa, CA',
    topic: 'Public spaces',
  });
  if (typeof id !== 'string') throw new Error('Missing id');
  const s = await a.load();
  const made = s.communities.find((c) => c.id === id)!;
  expect(made.ownerId).toBe(demoIds.jordan);
  expect(made.sampleMembers).toBe(0);
  expect(made.members).toBe(1);
  expect(s.profile?.joined).toContain(id);
  await expect(
    a.execute({
      type: 'createCommunity',
      name: 'cedar commons friends',
      description: 'A duplicate name differing only by letter case should be refused.',
      city: 'Costa Mesa, CA',
      topic: 'Public spaces',
    }),
  ).rejects.toThrow(/already exists/);
  await expect(
    a.execute({
      type: 'createCommunity',
      name: 'No',
      description: 'Too short a name.',
      city: 'Costa Mesa, CA',
      topic: 'Public spaces',
    }),
  ).rejects.toThrow();
});

test('community owners appoint moderators, and only members qualify', async () => {
  const { adapter: a } = setup();
  await a.signIn(demoIds.maya);
  const owned = (await a.load()).communities.find((c) => c.ownerId === demoIds.maya)!;
  // Sam starts as a seeded member; once he leaves he no longer qualifies.
  await a.signIn(demoIds.sam);
  await a.execute({ type: 'join', communityId: owned.id });
  await a.signIn(demoIds.maya);
  await expect(
    a.execute({ type: 'moderator', communityId: owned.id, profileId: demoIds.sam, grant: true }),
  ).rejects.toThrow(/current member/);
  await a.signIn(demoIds.sam);
  await a.execute({ type: 'join', communityId: owned.id });
  await a.signIn(demoIds.maya);
  await a.execute({
    type: 'moderator',
    communityId: owned.id,
    profileId: demoIds.sam,
    grant: true,
  });
  expect((await a.load()).communities.find((c) => c.id === owned.id)!.moderators).toContain(
    demoIds.sam,
  );
  await a.signIn(demoIds.sam);
  expect((await a.load()).notifications.some((n) => n.body.includes('now a moderator'))).toBe(true);
  // A non-owner cannot appoint themselves or anyone else.
  await expect(
    a.execute({ type: 'moderator', communityId: owned.id, profileId: demoIds.jordan, grant: true }),
  ).rejects.toThrow(/owner/);
});

test('a community post can be retracted by its author or a moderator, leaving a tombstone', async () => {
  const { adapter: a } = setup();
  await a.signIn(demoIds.maya);
  const owned = (await a.load()).communities.find((c) => c.ownerId === demoIds.maya)!;
  // Sam is a seeded member of Maya's community.
  await a.signIn(demoIds.sam);
  await a.execute({
    type: 'communityPost',
    communityId: owned.id,
    body: 'A post its author will retract.',
    kind: 'idea',
    space: 'discussion',
    channel: '',
  });
  await a.execute({
    type: 'communityPost',
    communityId: owned.id,
    body: 'A post the owner will retract.',
    kind: 'idea',
    space: 'discussion',
    channel: '',
  });
  const [mine, theirs] = await a.communityPosts(owned.id);
  await a.execute({
    type: 'removeEntry',
    scope: 'communityPost',
    entryId: mine.id,
    communityId: owned.id,
  });
  await a.signIn(demoIds.jordan);
  await expect(
    a.execute({
      type: 'removeEntry',
      scope: 'communityPost',
      entryId: theirs.id,
      communityId: owned.id,
    }),
  ).rejects.toThrow(/author, the community owner, or a moderator/);
  await a.signIn(demoIds.maya);
  await a.execute({
    type: 'removeEntry',
    scope: 'communityPost',
    entryId: theirs.id,
    communityId: owned.id,
  });
  const posts = await a.communityPosts(owned.id);
  // The thread keeps its shape: removal is visible, never a silent gap.
  expect(posts).toHaveLength(2);
  expect(posts[0].body).toBe('This post was removed by its author.');
  expect(posts[1].body).toBe('This post was removed by a moderator.');
  expect(posts.every((p) => p.removed)).toBe(true);
  await a.signIn(demoIds.sam);
  expect((await a.load()).notifications.some((n) => n.body.includes('moderator removed'))).toBe(
    true,
  );
});

test('discussion posts are removable by author or organizer; updates only by the organizer', async () => {
  const { adapter: a } = setup();
  const id = await publish(a);
  await a.execute({ type: 'update', petitionId: id, body: 'An organizer update to retract.' });
  await a.signIn(demoIds.sam);
  await a.execute({
    type: 'discussion',
    petitionId: id,
    body: 'A question the organizer will remove.',
    kind: 'question',
  });
  const withPosts = await find(a, id);
  await expect(
    a.execute({
      type: 'removeEntry',
      scope: 'update',
      entryId: withPosts.updates[0].id,
      petitionId: id,
    }),
  ).rejects.toThrow(/cannot remove/);
  await a.signIn(demoIds.maya);
  await a.execute({
    type: 'removeEntry',
    scope: 'discussion',
    entryId: withPosts.discussion[0].id,
    petitionId: id,
  });
  await a.execute({
    type: 'removeEntry',
    scope: 'update',
    entryId: withPosts.updates[0].id,
    petitionId: id,
  });
  const after = await find(a, id);
  expect(after.discussion[0].body).toBe('This post was removed by a moderator.');
  expect(after.updates[0].body).toBe('This post was removed by its author.');
  await expect(
    a.execute({
      type: 'removeEntry',
      scope: 'update',
      entryId: after.updates[0].id,
      petitionId: id,
    }),
  ).rejects.toThrow(/already removed/);
  await a.signIn(demoIds.sam);
  expect(
    (await a.load()).notifications.some((n) => n.body.includes('organizer removed your post')),
  ).toBe(true);
});

test('archiving requires a public close first and is owner-only', async () => {
  const { adapter: a } = setup();
  const id = await publish(a);
  await a.execute({ type: 'collaborator', petitionId: id, profileId: demoIds.sam });
  await expect(a.execute({ type: 'close', petitionId: id, status: 'archived' })).rejects.toThrow(
    /Close or mark this petition successful/,
  );
  await a.execute({ type: 'close', petitionId: id, status: 'closed' });
  await a.signIn(demoIds.sam);
  await expect(a.execute({ type: 'close', petitionId: id, status: 'archived' })).rejects.toThrow(
    /Only the owner/,
  );
  await a.signIn(demoIds.maya);
  await a.execute({ type: 'close', petitionId: id, status: 'archived' });
  expect((await a.load()).petitions.some((p) => p.id === id)).toBe(false);
});

test('a reporter can withdraw their own report and nobody else can', async () => {
  const { adapter: a } = setup();
  const id = await publish(a);
  await a.signIn(demoIds.sam);
  await a.execute({ type: 'report', petitionId: id, reason: 'This looks like a duplicate.' });
  const [report] = (await a.load()).reports;
  expect(report.status).toBe('submitted');
  await a.signIn(demoIds.jordan);
  await expect(a.execute({ type: 'withdrawReport', reportId: report.id })).rejects.toThrow(
    /not found/,
  );
  await a.signIn(demoIds.sam);
  await a.execute({ type: 'withdrawReport', reportId: report.id });
  expect((await a.load()).reports).toHaveLength(0);
});
