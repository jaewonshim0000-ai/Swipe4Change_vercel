import type Anthropic from '@anthropic-ai/sdk';
import { MODEL, screenWithClaude, tagWithClaude } from '../supabase/functions/_shared/civic-ai';
import { ReviewStore, runReview } from '../supabase/functions/_shared/review';
import { seedPetitions } from '../src/data/seed';

type Params = {
  model: string;
  system: string;
  messages: { content: string }[];
  output_config: { effort: string };
  fallbacks: string;
  betas: string[];
};
/** A stand-in client that records each request and answers with the given output. */
function fakeClaude(answer: (p: Params) => unknown, stop = 'end_turn') {
  const calls: Params[] = [];
  const client = {
    beta: {
      messages: {
        parse: async (params: Params) => {
          calls.push(params);
          return { stop_reason: stop, parsed_output: answer(params) };
        },
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}
const petition = seedPetitions()[0];

test('tagging sends only the public wording and cleans the model’s tags', async () => {
  const { client, calls } = fakeClaude(() => ({
    tags: ['#Street Lighting', 'transit', 'transit', 'x', 'Bus_Stops'],
  }));
  expect(await tagWithClaude(client, petition, ['lighting', 'transit'])).toEqual([
    'street-lighting',
    'transit',
    'bus-stops',
  ]);
  const [call] = calls;
  expect(call.model).toBe(MODEL);
  expect(call.output_config.effort).toBe('low');
  expect(call.fallbacks).toBe('default');
  expect(call.betas).toContain('server-side-fallback-2026-07-01');
  expect(call.messages[0].content).toContain('<vocabulary>lighting, transit</vocabulary>');
  expect(call.messages[0].content).toContain(petition.problem);
  // Counts, signers and discussion never leave the app.
  expect(call.messages[0].content).not.toContain(String(petition.count));
});

test('a refusal or an empty answer is an error, so callers can fall back', async () => {
  await expect(
    screenWithClaude(fakeClaude(() => null, 'refusal').client, petition),
  ).rejects.toThrow('declined');
  await expect(
    tagWithClaude(fakeClaude(() => ({ tags: [] })).client, petition, []),
  ).rejects.toThrow('no usable tags');
});

const offensive = { ...petition, title: 'Get these idiots off our council' };
function memoryStore() {
  const screened: Record<string, string[]> = {};
  const tagged: Record<string, string[]> = {};
  const checked: Record<string, string[]> = {};
  const store: ReviewStore = {
    queue: async () => ({
      reports: [
        { petitionId: 'clean', petition },
        { petitionId: 'rude', petition: offensive },
      ],
      petitions: [{ id: 'clean', seen: 't0', petition }],
      vocabulary: ['bus-stops'],
    }),
    screened: async (id, hits) => {
      screened[id] = hits;
    },
    tagged: async (id, tags) => {
      tagged[id] = tags;
    },
    // A newly published petition waiting for its check.
    publishQueue: async () => [{ id: 'new', seen: 't0', petition: offensive }],
    checked: async (id, hits) => {
      checked[id] = hits;
    },
  };
  return { store, screened, tagged, checked };
}

test('the review pass settles reports with the model and tags petitions', async () => {
  const { store, screened, tagged, checked } = memoryStore();
  const { client, calls } = fakeClaude((p) =>
    p.system.startsWith('You tag')
      ? { tags: ['lighting'] }
      : // The model catches what keywords would miss: here, a clean-looking petition.
        { categories: p.messages[0].content.includes('idiots') ? [] : ['spam'], reason: 'test' },
  );
  expect(await runReview(store, client)).toEqual({ checked: 1, screened: 2, tagged: 1 });
  expect(checked).toEqual({ new: [] });
  expect(screened).toEqual({ clean: ['spam'], rude: [] });
  expect(tagged).toEqual({ clean: ['lighting'] });
  expect(calls.at(-1)?.messages[0].content).toContain('bus-stops');
});

test('without the model, reports fall back to the rules and tagging waits', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const { store, screened, tagged, checked } = memoryStore();
  const broken = {
    beta: {
      messages: {
        parse: async () => {
          throw new Error('offline');
        },
      },
    },
  } as unknown as Anthropic;
  for (const client of [null, broken]) {
    expect(await runReview(store, client)).toEqual({ checked: 1, screened: 2, tagged: 0 });
    expect(checked).toEqual({ new: ['harassment'] });
    expect(screened).toEqual({ clean: [], rude: ['harassment'] });
    expect(tagged).toEqual({});
  }
});

test('someone waiting to go public is not kept waiting for tagging', async () => {
  const { store, checked, tagged } = memoryStore();
  const { client } = fakeClaude((p) =>
    p.system.startsWith('You tag') ? { tags: ['lighting'] } : { categories: [], reason: 'ok' },
  );
  expect(await runReview(store, client, { tags: false })).toEqual({
    checked: 1,
    screened: 2,
    tagged: 0,
  });
  expect(checked).toEqual({ new: [] });
  expect(tagged).toEqual({});
});
