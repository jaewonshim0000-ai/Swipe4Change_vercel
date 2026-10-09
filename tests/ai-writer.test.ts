import type Anthropic from '@anthropic-ai/sdk';
import { draftWithClaude, MODEL } from '../supabase/functions/_shared/civic-ai';
import { parseLookup } from '../supabase/functions/_shared/lookup';

type Params = {
  model: string;
  system: string;
  messages: { content: string }[];
  output_config: { effort: string };
};
function fakeClaude(output: unknown, stop = 'end_turn') {
  const calls: Params[] = [];
  const client = {
    beta: {
      messages: {
        parse: async (params: Params) => {
          calls.push(params);
          return { stop_reason: stop, parsed_output: output };
        },
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}
const description =
  'theres no light on the path from the bus stop to my school and kids walk there in the dark after practice';

test('the writer turns a plain description into petition fields, within the form limits', async () => {
  const { client, calls } = fakeClaude({
    usable: true,
    title: '  Light the path from the bus stop to school  ',
    summary: 'Students ask for lighting on the dark path between the bus stop and school.',
    problem: 'x'.repeat(6000),
    action: 'Install lighting along the path between the bus stop and the school.',
    topic: 'Safer streets',
    questions: ['How many students use the path?', ' ', 'When does practice end?', 'a', 'b'],
  });
  const draft = await draftWithClaude(client, description, 'Seattle, WA');
  expect(draft).toMatchObject({
    title: 'Light the path from the bus stop to school',
    topic: 'Safer streets',
    questions: ['How many students use the path?', 'When does practice end?', 'a'],
  });
  expect(draft?.problem).toHaveLength(5000);
  const [call] = calls;
  expect(call.model).toBe(MODEL);
  expect(call.output_config.effort).toBe('medium');
  expect(call.messages[0].content).toContain(description);
  expect(call.messages[0].content).toContain('Seattle, WA');
  expect(call.messages[0].content).toContain('Accessibility');
  // The rules that keep it honest are in the instructions every time.
  expect(call.system).toMatch(/Never invent facts, statistics, dates, names/);
  expect(call.system).toMatch(/do not name a recipient/);
  expect(call.system).toMatch(/untrusted data/);
});

test('a description that is not a request for change gets no draft', async () => {
  const { client } = fakeClaude({
    usable: false,
    title: '',
    summary: '',
    problem: '',
    action: '',
    topic: 'Education',
    questions: [],
  });
  expect(await draftWithClaude(client, 'buy cheap followers now at my site', '')).toBeNull();
  const refused = fakeClaude(null, 'refusal');
  await expect(draftWithClaude(refused.client, description, '')).rejects.toThrow(/declined/);
});

test('draft requests are validated before the model is called', () => {
  expect(parseLookup({ task: 'draft', description, city: 'Seattle, WA' })).toEqual({
    task: 'draft',
    description,
    city: 'Seattle, WA',
  });
  expect(parseLookup({ task: 'draft', description })).toEqual({
    task: 'draft',
    description,
    city: '',
  });
  expect(parseLookup({ task: 'draft', description: 'too short' })).toBeNull();
  expect(parseLookup({ task: 'draft', description: 'x'.repeat(3001) })).toBeNull();
  expect(parseLookup({ task: 'draft', description, city: 42 })).toBeNull();
});
