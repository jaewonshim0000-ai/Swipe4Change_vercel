import type Anthropic from '@anthropic-ai/sdk';
import {
  findRecipientWithClaude,
  keepSourced,
  MODEL,
} from '../supabase/functions/_shared/civic-ai';
import { parseLookup } from '../supabase/functions/_shared/lookup';
import type { Official } from '../supabase/functions/_shared/officials';

const senator: Official = {
  name: 'Patty Murray',
  office: 'U.S. Senator',
  level: 'federal',
  district: 'WA',
  phone: '202-224-2621',
  contactForm: 'https://www.murray.senate.gov/write-to-patty/',
};
const answer = {
  recipient: 'Seattle Department of Transportation',
  level: 'city',
  reason: 'SDOT maintains streetlights on city streets.',
  officialName: '',
  contact: {
    email: '684-road@seattle.gov',
    phone: '',
    url: 'https://www.seattle.gov/transportation',
  },
  sources: [
    { title: 'SDOT streetlights', url: 'https://www.seattle.gov/transportation/streetlights/' },
    { title: 'Invented page', url: 'https://example.com/made-up' },
  ],
};
const question = {
  title: 'Light the path',
  problem: 'The path to the bus stop is dark.',
  action: 'Install pedestrian lighting on the path.',
  city: 'Seattle, WA',
};

test('suggestions keep only sources the search returned, and need one unless an official is named', () => {
  const kept = keepSourced(answer, ['https://www.seattle.gov/transportation/streetlights'], []);
  expect(kept?.sources).toEqual([answer.sources[0]]);
  expect(kept?.contact).toEqual({
    email: '684-road@seattle.gov',
    url: 'https://www.seattle.gov/transportation',
  });
  expect(keepSourced(answer, ['https://example.org/other'], [])).toBeNull();
  // A listed official needs no search source, and their real contact details replace the model's.
  const official = keepSourced(
    { ...answer, recipient: 'Senator Murray', officialName: 'patty murray', sources: [] },
    [],
    [senator],
  );
  expect(official).toMatchObject({
    recipient: 'Sen. Patty Murray (U.S. Senate, WA)',
    level: 'federal',
    contact: { phone: '202-224-2621', url: 'https://www.murray.senate.gov/write-to-patty/' },
    official: senator,
  });
});

test('lookup requests are validated before any outside service is called', () => {
  expect(parseLookup({ task: 'officials', lat: 47.6, lon: -122.3 })).toEqual({
    task: 'officials',
    lat: 47.6,
    lon: -122.3,
  });
  expect(parseLookup({ task: 'officials', lat: 200, lon: 0 })).toBeNull();
  expect(parseLookup({ task: 'officials' })).toBeNull();
  expect(parseLookup({ task: 'recipient', question })).toEqual({ task: 'recipient', question });
  expect(
    parseLookup({ task: 'recipient', question: { ...question, problem: '', action: 'x' } }),
  ).toBeNull();
  expect(
    parseLookup({ task: 'recipient', question: { ...question, title: 'x'.repeat(201) } }),
  ).toBeNull();
  expect(parseLookup({ task: 'delete everything' })).toBeNull();
  expect(parseLookup(null)).toBeNull();
});

test('the finder searches the web, resumes paused turns and returns the reported recipient', async () => {
  const calls: Anthropic.Beta.MessageCreateParams[] = [];
  const replies = [
    {
      stop_reason: 'pause_turn',
      content: [
        {
          type: 'web_search_tool_result',
          tool_use_id: 's1',
          content: [{ type: 'web_search_result', url: answer.sources[0].url, title: 'SDOT' }],
        },
      ],
    },
    {
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 't1', name: 'report_recipient', input: answer }],
    },
  ];
  const client = {
    beta: {
      messages: {
        create: async (params: Anthropic.Beta.MessageCreateParams) => {
          calls.push({ ...params, messages: [...params.messages] });
          return replies.shift();
        },
      },
    },
  } as unknown as Anthropic;
  const found = await findRecipientWithClaude(client, question, [senator]);
  expect(found?.recipient).toBe('Seattle Department of Transportation');
  expect(found?.sources.map((s) => s.title)).toEqual(['SDOT streetlights']);
  expect(calls).toHaveLength(2);
  expect(calls[0].model).toBe(MODEL);
  expect(JSON.stringify(calls[0].tools)).toContain('web_search_20260209');
  // Only the draft's public wording and the officials' names are sent.
  expect(JSON.stringify(calls[0].messages)).toContain('Patty Murray');
  expect(JSON.stringify(calls[0].messages)).not.toContain('202-224-2621');
  // The paused turn is sent back unchanged, with no extra prompt.
  expect(calls[1].messages).toHaveLength(2);
  expect(calls[1].messages[1].role).toBe('assistant');
});

test('a refusal from the model is an error, not an empty suggestion', async () => {
  const client = {
    beta: { messages: { create: async () => ({ stop_reason: 'refusal', content: [] }) } },
  } as unknown as Anthropic;
  await expect(findRecipientWithClaude(client, question, [])).rejects.toThrow(/declined/);
});
