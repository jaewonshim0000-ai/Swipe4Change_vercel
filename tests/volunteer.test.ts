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
  return new LocalAdapter(storage, () => `test-${++id}`);
}
/** Publish a petition owned by Maya and return its id. */
async function publish(a: LocalAdapter) {
  await a.signIn(demoIds.maya);
  const id = await a.execute({ type: 'create', draft: seedPetitions()[0], publish: true });
  if (typeof id !== 'string') throw new Error('Missing id');
  return id;
}

test('an offer of help reaches the organizer and subscribes the volunteer', async () => {
  const a = setup();
  const id = await publish(a);
  await a.signIn(demoIds.sam);
  await a.execute({
    type: 'volunteer',
    petitionId: id,
    roles: ['outreach', 'canvassing'],
    note: 'Free on weekends and I know the neighbourhood.',
  });
  const sam = await a.load();
  expect(sam.volunteering).toEqual([
    {
      petitionId: id,
      roles: ['canvassing', 'outreach'],
      note: 'Free on weekends and I know the neighbourhood.',
    },
  ]);
  expect(sam.petitions.find((p) => p.id === id)?.volunteerCount).toBe(1);
  await a.signIn(demoIds.maya);
  const inbox = (await a.load()).notifications.map((n) => n.body);
  expect(inbox.some((b) => b.includes('offered to help with canvassing, outreach'))).toBe(true);
});

test('only organizers can see who offered to help', async () => {
  const a = setup();
  const id = await publish(a);
  await a.signIn(demoIds.sam);
  await a.execute({ type: 'volunteer', petitionId: id, roles: ['research'], note: '' });
  await expect(a.volunteers(id)).rejects.toThrow(/Only organizers/);
  await a.signIn(demoIds.maya);
  const roster = await a.volunteers(id);
  expect(roster).toHaveLength(1);
  expect(roster[0].name).toBe('Sam Rivera');
  expect(roster[0].roles).toEqual(['research']);
  // The roster carries no account identifier, only what the volunteer chose to offer.
  expect(Object.keys(roster[0]).sort()).toEqual(
    ['date', 'id', 'name', 'note', 'petitionId', 'roles'].sort(),
  );
});

test('a volunteer can revise the offer and step back without asking', async () => {
  const a = setup();
  const id = await publish(a);
  await a.signIn(demoIds.sam);
  await a.execute({ type: 'volunteer', petitionId: id, roles: ['design'], note: 'Posters.' });
  await a.execute({
    type: 'volunteer',
    petitionId: id,
    roles: ['design', 'research'],
    note: 'Posters and sourcing.',
  });
  await a.signIn(demoIds.maya);
  expect(await a.volunteers(id)).toHaveLength(1);
  expect((await a.volunteers(id))[0].roles).toEqual(['design', 'research']);
  await a.signIn(demoIds.sam);
  await a.execute({ type: 'volunteer', petitionId: id, roles: [], note: '' });
  expect((await a.load()).volunteering).toEqual([]);
  await a.signIn(demoIds.maya);
  expect(await a.volunteers(id)).toEqual([]);
  expect(
    (await a.load()).notifications.some((n) => n.body.includes('stepped back from volunteering')),
  ).toBe(true);
  await a.signIn(demoIds.sam);
  await expect(
    a.execute({ type: 'volunteer', petitionId: id, roles: [], note: '' }),
  ).rejects.toThrow(/have not offered/);
});

test('duplicate roles collapse and an over-long note is rejected', async () => {
  const a = setup();
  const id = await publish(a);
  await a.signIn(demoIds.sam);
  await a.execute({
    type: 'volunteer',
    petitionId: id,
    roles: ['outreach', 'outreach', 'design'],
    note: '',
  });
  await a.signIn(demoIds.maya);
  expect((await a.volunteers(id))[0].roles).toEqual(['design', 'outreach']);
  await a.signIn(demoIds.sam);
  await expect(
    a.execute({ type: 'volunteer', petitionId: id, roles: ['design'], note: 'x'.repeat(501) }),
  ).rejects.toThrow(/under 500 characters/);
});

test('volunteers hear about updates without saving or signing', async () => {
  const a = setup();
  const id = await publish(a);
  await a.signIn(demoIds.jordan);
  await a.execute({ type: 'volunteer', petitionId: id, roles: ['research'], note: '' });
  await a.signIn(demoIds.maya);
  await a.execute({ type: 'update', petitionId: id, body: 'Research help needed this week.' });
  await a.signIn(demoIds.jordan);
  const inbox = (await a.load()).notifications.map((n) => n.body);
  expect(inbox.some((b) => b.includes('New update'))).toBe(true);
});

test('a closed petition takes no new offers of help', async () => {
  const a = setup();
  const id = await publish(a);
  await a.execute({ type: 'close', petitionId: id, status: 'successful' });
  await a.signIn(demoIds.sam);
  await expect(
    a.execute({ type: 'volunteer', petitionId: id, roles: ['outreach'], note: '' }),
  ).rejects.toThrow(/not accepting offers/);
});
