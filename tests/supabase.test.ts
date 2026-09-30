import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdapter } from '../src/data/supabase';
import { getBackendConfig } from '../src/data/config';
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('../src/data/config', () => ({ getBackendConfig: jest.fn() }));
const rpc = jest.fn();
const invoke = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getBackendConfig).mockReturnValue({
    backend: 'supabase',
    url: 'https://example.supabase.co',
    publicKey: 'sb_publishable_example',
    clerkKey: 'pk_test_example',
  });
  jest
    .mocked(createClient)
    .mockReturnValue({ rpc, functions: { invoke } } as unknown as ReturnType<typeof createClient>);
  rpc.mockResolvedValue({ data: null, error: null });
  invoke.mockResolvedValue({ data: null, error: null });
});
test('passes the live Clerk token callback without persisting a second auth session', async () => {
  const getToken = jest.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('refreshed');
  createSupabaseAdapter(getToken);
  const options = jest.mocked(createClient).mock.calls[0][2];
  expect(options?.auth).toEqual({
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  });
  expect(await options?.accessToken?.()).toBe('first');
  expect(await options?.accessToken?.()).toBe('refreshed');
});
test('uses the snapshot RPC and normalizes legacy notification authors', async () => {
  rpc.mockResolvedValue({ data: { notifications: [{ author: 'LookAware' }] }, error: null });
  const result = await createSupabaseAdapter(async () => null).load();
  expect(rpc).toHaveBeenCalledWith('lookaware_snapshot', {});
  expect(result.notifications[0].author).toBe('Swipe4Change');
});
test('propagates rejected writes for optimistic rollback and never retries them', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'Already signed.' } });
  await expect(
    createSupabaseAdapter(async () => 'token').execute({ type: 'save', petitionId: 'petition' }),
  ).rejects.toThrow('Already signed.');
  expect(rpc).toHaveBeenCalledTimes(1);
});
test('scopes private receipt and moderation reads to the requested resource', async () => {
  const adapter = createSupabaseAdapter(async () => 'token');
  expect(await adapter.receipt('petition')).toBeNull();
  expect(await adapter.requests('petition')).toEqual([]);
  expect(await adapter.communityReports('community')).toEqual([]);
  expect(rpc.mock.calls).toEqual([
    ['signature_receipt', { petition_id: 'petition' }],
    ['lookaware_requests', { petition_id: 'petition' }],
    ['lookaware_community_reports', { community_id: 'community' }],
  ]);
});
test('empty snapshot fails instead of falling back to fictional data', async () => {
  await expect(createSupabaseAdapter(async () => null).load()).rejects.toThrow('No data returned');
});
