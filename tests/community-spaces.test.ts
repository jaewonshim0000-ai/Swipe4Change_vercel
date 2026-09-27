import { LocalAdapter, Storage } from '../src/data/local';
import { demoIds } from '../src/data/seed';
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
