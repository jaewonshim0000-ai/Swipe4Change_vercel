import { LocalAdapter, Storage } from '../src/data/local';
import { demoIds, seedPetitions } from '../src/data/seed';
import type { Command } from '../src/domain/model';

type PostCommand = Extract<Command, { type: 'communityPost' }>;

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
/** Jordan owns a community; Sam is a plain member of it. */
async function community(a: LocalAdapter) {
  await a.signIn(demoIds.jordan);
  const id = await a.execute({
    type: 'createCommunity',
    name: 'Riverton working group',
    description: 'A fictional community used to exercise the collaboration spaces.',
    city: 'Riverton, CA',
    topic: 'Safer streets',
  });
  if (typeof id !== 'string') throw new Error('Missing id');
  await a.signIn(demoIds.sam);
  await a.execute({ type: 'join', communityId: id });
  return id;
}
const post = (
  communityId: string,
  extra: Pick<PostCommand, 'body' | 'kind'> & Partial<PostCommand>,
): PostCommand => ({
  type: 'communityPost',
  communityId,
  space: 'discussion',
  channel: '',
  ...extra,
});

test('members post to discussion; only moderators speak for the community', async () => {
  const a = setup();
  const id = await community(a);
  await a.execute(
    post(id, { body: 'A question from a member of the community.', kind: 'question' }),
  );
  await expect(
    a.execute(
      post(id, {
        body: 'A member trying to announce something.',
        kind: 'announcement',
        space: 'announcements',
      }),
    ),
  ).rejects.toThrow(/owner and its moderators/);
  await a.signIn(demoIds.jordan);
  await a.execute(
    post(id, {
      body: 'An announcement in the community voice.',
      kind: 'announcement',
      space: 'announcements',
    }),
  );
  const posts = await a.communityPosts(id);
  expect(posts.map((p) => p.space)).toEqual(['discussion', 'announcements']);
});

test('the organizer space is private to the owner and moderators', async () => {
  const a = setup();
  const id = await community(a);
  await a.signIn(demoIds.jordan);
  await a.execute(post(id, { body: 'Private planning note.', kind: 'idea', space: 'organizers' }));
  expect(await a.communityPosts(id)).toHaveLength(1);
  await a.signIn(demoIds.sam);
  expect(await a.communityPosts(id)).toHaveLength(0);
  // Promotion opens the door; nothing else changes.
  await a.signIn(demoIds.jordan);
  await a.execute({ type: 'moderator', communityId: id, profileId: demoIds.sam, grant: true });
  await a.signIn(demoIds.sam);
  expect(await a.communityPosts(id)).toHaveLength(1);
});

test('events need a date', async () => {
  const a = setup();
  const id = await community(a);
  await expect(
    a.execute(post(id, { body: 'An event with no date at all.', kind: 'event' })),
  ).rejects.toThrow(/date/);
  await a.execute(
    post(id, {
      body: 'A fictional community walk.',
      kind: 'event',
      eventAt: '2026-10-04T18:30',
      location: 'Riverton library',
    }),
  );
  expect((await a.communityPosts(id))[0].location).toBe('Riverton library');
});

test('a report reaches moderators without naming the reporter', async () => {
  const a = setup();
  const id = await community(a);
  await a.signIn(demoIds.jordan);
  await a.execute(post(id, { body: 'A post someone takes issue with.', kind: 'idea' }));
  const target = (await a.communityPosts(id))[0];
  await a.signIn(demoIds.sam);
  await expect(a.communityReports(id)).rejects.toThrow(/owner and its moderators/);
  await a.execute({
    type: 'reportPost',
    communityId: id,
    postId: target.id,
    reason: 'This post names a private individual.',
  });
  await expect(
    a.execute({
      type: 'reportPost',
      communityId: id,
      postId: target.id,
      reason: 'Reporting the very same post twice.',
    }),
  ).rejects.toThrow(/already reported/);
  await a.signIn(demoIds.jordan);
  const queue = await a.communityReports(id);
  expect(queue).toHaveLength(1);
  expect(queue[0].status).toBe('open');
  expect(JSON.stringify(queue)).not.toContain(demoIds.sam);
  await a.execute({
    type: 'resolvePostReport',
    communityId: id,
    reportId: queue[0].id,
    action: 'actioned',
  });
  expect((await a.communityReports(id))[0].status).toBe('actioned');
  await expect(
    a.execute({
      type: 'resolvePostReport',
      communityId: id,
      reportId: queue[0].id,
      action: 'dismissed',
    }),
  ).rejects.toThrow(/already reviewed/);
});

test('a short report reason is refused', async () => {
  const a = setup();
  const id = await community(a);
  await a.execute(post(id, { body: 'A perfectly ordinary post.', kind: 'idea' }));
  const target = (await a.communityPosts(id))[0];
  await expect(
    a.execute({ type: 'reportPost', communityId: id, postId: target.id, reason: 'bad' }),
  ).rejects.toThrow(/at least 10 characters/);
});

const heard = async (a: LocalAdapter, who: string) => {
  await a.signIn(who);
  return (await a.load()).notifications
    .filter((n) => n.kind === 'community' && !n.body.startsWith('You '))
    .map((n) => n.body);
};

test('members hear the owner’s announcements and events, never members’ events or the organizer room', async () => {
  const a = setup();
  const id = await community(a);
  await a.signIn(demoIds.jordan);
  await a.execute(
    post(id, {
      body: 'Lighting audit results are in. Thank you all.',
      kind: 'announcement',
      space: 'announcements',
    }),
  );
  await a.execute(
    post(id, {
      body: 'Moderators only: prep call before the walk.',
      kind: 'event',
      space: 'organizers',
      eventAt: '2026-10-03T18:30',
      location: 'Online',
    }),
  );
  expect(await heard(a, demoIds.sam)).toEqual([
    'Riverton working group announcement: Lighting audit results are in. Thank you all.',
  ]);
  await a.execute(
    post(id, {
      body: 'A member-run study meetup after class.',
      kind: 'event',
      eventAt: '2026-10-05T18:30',
      location: 'Riverton library',
    }),
  );
  expect(await heard(a, demoIds.jordan)).toEqual([]);
});

test('a new campaign is announced to its community once, when it is first public', async () => {
  const a = setup();
  const draft = seedPetitions()[0];
  await a.signIn(demoIds.sam);
  await a.execute({ type: 'join', communityId: draft.communityId });
  await a.signIn(demoIds.maya);
  // Drafts stay quiet; publishing announces.
  const quiet = (await a.execute({ type: 'create', draft, publish: false })) as string;
  await a.execute({ type: 'publish', petitionId: quiet });
  // Spam is held, so it waits; fixing the wording announces it, and only once.
  const held = (await a.execute({
    type: 'create',
    draft: { ...draft, title: 'Fix the path lights now', summary: 'Crypto giveaway! Click here.' },
    publish: true,
  })) as string;
  expect(await heard(a, demoIds.sam)).toEqual([
    'New campaign in Riverton students: “A brighter walk home starts here”.',
  ]);
  await a.signIn(demoIds.maya);
  await a.execute({
    type: 'edit',
    petitionId: held,
    patch: { summary: draft.summary },
    reason: 'Removed the promotional text.',
  });
  await a.execute({
    type: 'edit',
    petitionId: held,
    patch: { title: 'Fix the path lights before winter' },
    reason: 'Clearer title.',
  });
  expect(await heard(a, demoIds.sam)).toEqual([
    'New campaign in Riverton students: “Fix the path lights now”.',
    'New campaign in Riverton students: “A brighter walk home starts here”.',
  ]);
  // The organizer is never told about their own campaign.
  expect(await heard(a, demoIds.maya)).toEqual([]);
});
