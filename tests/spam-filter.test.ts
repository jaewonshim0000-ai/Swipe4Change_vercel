import type { CivicAi } from '../src/data/ai';
import { LocalAdapter, Storage } from '../src/data/local';
import { demoIds, seedPetitions } from '../src/data/seed';
import { screenText } from '../supabase/functions/_shared/civic-rules';

test('the offline rules catch gibberish, placeholder text and test posts', () => {
  expect(screenText('asdfasdf qwerty fix this')).toEqual(['nonsense']);
  expect(screenText('Lorem ipsum dolor sit amet, consectetur adipiscing elit.')).toEqual([
    'nonsense',
  ]);
  expect(screenText('aaaaaaaaaaa please')).toEqual(['nonsense']);
  expect(screenText('This is a test petition, please ignore')).toEqual(['nonsense']);
  expect(screenText('Buy nowwwwwwww crypto giveaway')).toEqual(['nonsense', 'spam']);
});

test('ordinary civic requests, including blunt ones, pass the offline rules', () => {
  expect(
    screenText(
      'The crosswalk on Pine Street is dangerous. We ask the city to test a raised crossing by June.',
    ),
  ).toEqual([]);
  expect(screenText('The council has ignored this for three years. Fix the streetlights!')).toEqual(
    [],
  );
  expect(screenText('Room 1000 needs ventilation; 30 students share it.')).toEqual([]);
  expect(screenText('Fix the bus shelter!!!!!!!! Please!!')).toEqual([]);
});

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
const clean = seedPetitions()[0];
const spammy = {
  ...clean,
  summary: 'Crypto giveaway! Click here for free money and a promo code.',
};
const find = async (a: LocalAdapter, id: string) =>
  (await a.load()).petitions.find((p) => p.id === id);

test('a flagged petition is held for its organizer and goes public once the wording passes', async () => {
  const a = setup();
  await a.signIn(demoIds.maya);
  const id = (await a.execute({ type: 'create', draft: spammy, publish: true })) as string;
  expect(await find(a, id)).toMatchObject({ status: 'active', hidden: true, heldFor: ['spam'] });
  await a.signIn(demoIds.sam);
  expect(await find(a, id)).toBeUndefined();
  await a.signIn(demoIds.maya);
  await a.execute({
    type: 'edit',
    petitionId: id,
    patch: { summary: clean.summary },
    reason: 'Removed the promotional text.',
  });
  const fixed = await find(a, id);
  expect(fixed?.hidden).toBe(false);
  expect(fixed?.heldFor).toBeUndefined();
  await a.signIn(demoIds.sam);
  expect(await find(a, id)).toBeDefined();
});

test('rewording a public petition into spam takes it out of public view', async () => {
  const a = setup();
  await a.signIn(demoIds.maya);
  const id = (await a.execute({ type: 'create', draft: clean, publish: true })) as string;
  expect((await find(a, id))?.hidden).toBeFalsy();
  await a.execute({
    type: 'edit',
    petitionId: id,
    patch: { summary: spammy.summary },
    reason: 'Added a sponsor message.',
  });
  expect(await find(a, id)).toMatchObject({ hidden: true, heldFor: ['spam'] });
});

test('the AI model decides when it is reachable, and drafts are never checked', async () => {
  const screened: string[] = [];
  const a = setup({
    tags: async () => ['lighting'],
    screen: async (p) => {
      screened.push(p.title);
      return p.title.includes('banana') ? ['nonsense'] : [];
    },
  });
  await a.signIn(demoIds.maya);
  const joke = { ...clean, title: 'Make every banana a mayor of the moon' };
  await a.execute({ type: 'create', draft: joke, publish: false });
  expect(screened).toEqual([]);
  const id = (await a.execute({ type: 'create', draft: joke, publish: true })) as string;
  expect(await find(a, id)).toMatchObject({ hidden: true, heldFor: ['nonsense'] });
  expect(screened).toEqual([joke.title]);
});

test('publishing needs a verified email, but drafts do not', async () => {
  const a = setup();
  await a.signIn(demoIds.jordan);
  await expect(a.execute({ type: 'create', draft: clean, publish: true })).rejects.toThrow(
    /Verify your email/,
  );
  const id = (await a.execute({ type: 'create', draft: clean, publish: false })) as string;
  expect((await find(a, id))?.status).toBe('draft');
  await expect(a.execute({ type: 'publish', petitionId: id })).rejects.toThrow(/Verify your email/);
});
