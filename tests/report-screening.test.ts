import { screenPetition, screenText } from '../src/domain/content-screen';
import { LocalAdapter, Storage } from '../src/data/local';
import type { CivicAi } from '../src/data/ai';
import { demoIds, petitionId, seedPetitions } from '../src/data/seed';

function setup(ai?: CivicAi) {
  const values = new Map<string, string>();
  const storage: Storage = {
    getItem: async (k) => values.get(k) ?? null,
    setItem: async (k, v) => {
      values.set(k, v);
    },
  };
  let id = 0;
  return new LocalAdapter(storage, () => `test-${++id}`, ai);
}

test('the automatic check finds spam, threats, insults and hateful language', () => {
  expect(screenText('Click here for FREE MONEY')).toEqual(['spam']);
  expect(screenText('We will hurt them if this passes')).toEqual(['threats']);
  expect(screenText('Honestly they should die')).toEqual(['threats']);
  expect(screenText('The council are idiots')).toEqual(['harassment']);
  expect(screenText('Immigrants are criminals')).toEqual(['hate']);
  expect(screenText('Buy now, you morons')).toEqual(['harassment', 'spam']);
});

test('the automatic check leaves ordinary civic language alone', () => {
  for (const p of seedPetitions()) expect(screenPetition(p)).toEqual([]);
  expect(
    screenText(
      'Pesticides kill them. The bill should die in committee. We will attack the backlog with ' +
        'fire retardant, skills classes in Scunthorpe, and more women are underrepresented.',
    ),
  ).toEqual([]);
});

const offensive = {
  ...seedPetitions()[0],
  title: 'Get these idiots off our council',
  summary: 'The council members are idiots and everyone should know it right now.',
};

test('a flagged report hides the petition from everyone but its organizers', async () => {
  const a = setup();
  await a.signIn(demoIds.sam);
  const id = await a.execute({ type: 'create', draft: offensive, publish: true });
  if (!id) throw new Error('Missing id');
  await a.signOut();
  await a.signIn(demoIds.jordan);
  expect(await a.execute({ type: 'report', petitionId: id, reason: 'Insulting language.' })).toBe(
    'flagged',
  );
  let s = await a.load();
  expect(s.petitions.some((p) => p.id === id)).toBe(false);
  expect(s.reports[0].screening).toBe('flagged');
  await expect(a.execute({ type: 'save', petitionId: id })).rejects.toThrow('not found');
  await a.signOut();
  await a.signIn(demoIds.sam);
  s = await a.load();
  expect(s.petitions.find((p) => p.id === id)?.hidden).toBe(true);
  expect(s.notifications[0].body).toContain('automatic review flagged possible insults');
});

test('reporting a clean petition, however often, never hides it', async () => {
  const a = setup();
  await a.signIn(demoIds.jordan);
  for (let i = 0; i < 3; i++)
    expect(
      await a.execute({ type: 'report', petitionId: petitionId(1), reason: 'I disagree with it.' }),
    ).toBe('clear');
  const s = await a.load();
  expect(s.reports.every((r) => r.screening === 'clear')).toBe(true);
  expect(s.petitions.find((p) => p.id === petitionId(1))?.hidden).toBeFalsy();
});

test('organizers link an external donation page, on the public record', async () => {
  const a = setup();
  await a.signIn(demoIds.jordan);
  await expect(
    a.execute({ type: 'donationLink', petitionId: petitionId(1), url: 'https://example.org/give' }),
  ).rejects.toThrow('Only the owner');
  await a.signOut();
  await a.signIn(demoIds.maya);
  await expect(
    a.execute({ type: 'donationLink', petitionId: petitionId(1), url: 'http://example.org' }),
  ).rejects.toThrow('HTTPS');
  await a.execute({
    type: 'donationLink',
    petitionId: petitionId(1),
    url: 'https://example.org/give',
  });
  let p = (await a.load()).petitions.find((x) => x.id === petitionId(1))!;
  expect(p.donationUrl).toBe('https://example.org/give');
  expect(p.edits[0].body).toBe('Donation link set to https://example.org/give.');
  await a.execute({ type: 'donationLink', petitionId: petitionId(1), url: '' });
  p = (await a.load()).petitions.find((x) => x.id === petitionId(1))!;
  expect(p.donationUrl).toBeUndefined();
  expect(p.edits[0].body).toBe('Donation link removed.');
});

test('the AI model decides reports, and the rules step in only when it is unreachable', async () => {
  // The model flags a scam the keyword rules miss.
  const flagging: CivicAi = { tags: async () => ['lighting'], screen: async () => ['spam'] };
  let a = setup(flagging);
  await a.signIn(demoIds.jordan);
  expect(
    await a.execute({ type: 'report', petitionId: petitionId(3), reason: 'Looks like a scam.' }),
  ).toBe('flagged');
  expect((await a.load()).petitions.some((p) => p.id === petitionId(3))).toBe(false);
  const offline: CivicAi = {
    tags: () => Promise.reject(new Error('offline')),
    screen: () => Promise.reject(new Error('offline')),
  };
  a = setup(offline);
  await a.signIn(demoIds.sam);
  const id = await a.execute({ type: 'create', draft: offensive, publish: true });
  await a.signOut();
  await a.signIn(demoIds.jordan);
  expect(await a.execute({ type: 'report', petitionId: id!, reason: 'Insulting language.' })).toBe(
    'flagged',
  );
});

test('the AI model tags new, reworded and seed petitions', async () => {
  const seen: string[][] = [];
  const ai: CivicAi = {
    tags: async (p, vocabulary) => {
      seen.push(vocabulary);
      return p.title.includes('garden') ? ['gardens', 'community-garden'] : ['lighting'];
    },
    screen: async () => [],
  };
  const a = setup(ai);
  await a.signIn(demoIds.maya);
  const id = await a.execute({ type: 'create', draft: seedPetitions()[0], publish: true });
  const find = async () => (await a.load()).petitions.find((p) => p.id === id)!;
  expect((await find()).tags).toEqual(['lighting']);
  await a.execute({
    type: 'edit',
    petitionId: id!,
    patch: { title: 'A shared garden for the campus gate' },
    reason: 'New focus.',
  });
  expect((await find()).tags).toEqual(['gardens', 'community-garden']);
  // Tags the model has used become vocabulary for the next petition.
  expect(await a.backfillTags()).toBe(seedPetitions().length);
  expect(seen.at(-1)).toEqual(expect.arrayContaining(['lighting', 'community-garden']));
  expect((await a.load()).petitions.every((p) => p.tags?.length)).toBe(true);
  expect(await a.backfillTags()).toBe(0);
});

test('an unreachable model costs one probe, not a request per petition', async () => {
  let calls = 0;
  const a = setup({
    tags: () => {
      calls++;
      return Promise.reject(new Error('offline'));
    },
    screen: async () => [],
  });
  expect(await a.backfillTags()).toBe(0);
  expect(calls).toBe(1);
});
