import { demoAi } from '../src/data/ai';

declare const global: { __DEV__: boolean; fetch: typeof fetch };

// The demo's AI routes live only on the development server. A published demo (the static Vercel
// site) answered POSTs to them with 405, which the writer showed as "The lookup failed (405)".
test('a published demo explains that AI helpers are off, without sending a request', async () => {
  const dev = global.__DEV__;
  const fetchSpy = jest.fn();
  const realFetch = global.fetch;
  global.__DEV__ = false;
  global.fetch = fetchSpy as unknown as typeof fetch;
  try {
    await expect(
      demoAi.lookup!({ task: 'draft', description: 'The path is dark.', city: 'Irvine, CA' }),
    ).rejects.toThrow(/not available on this demo website/);
    await expect(
      demoAi.screen({ title: 't', summary: 's', problem: 'p', action: 'a', recipient: 'r' }),
    ).rejects.toThrow(/not available on this demo website/);
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    global.__DEV__ = dev;
    global.fetch = realFetch;
  }
});
