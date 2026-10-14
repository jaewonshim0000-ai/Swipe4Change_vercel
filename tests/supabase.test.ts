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
test('deleting an account removes the owner’s photos, then the account records', async () => {
  const order: string[] = [];
  const remove = jest.fn(async () => {
    order.push('photos');
    return { data: [], error: null };
  });
  jest.mocked(createClient).mockReturnValue({
    rpc,
    functions: { invoke },
    storage: { from: () => ({ remove }) },
  } as unknown as ReturnType<typeof createClient>);
  const photo = (name: string) => ({
    url: `https://example.supabase.co/storage/v1/object/public/petition-photos/${name}`,
    alt: 'A dark path',
  });
  rpc.mockImplementation(async (name: string, args: unknown) => {
    if (name === 'lookaware_snapshot')
      return {
        data: {
          profile: { id: 'me' },
          notifications: [],
          petitions: [
            { id: 'a', ownerId: 'me', photo: photo('mine.jpg') },
            { id: 'b', ownerId: 'someone', photo: photo('theirs.jpg') },
            { id: 'c', ownerId: 'me' },
          ],
        },
        error: null,
      };
    order.push(`${name} ${JSON.stringify(args)}`);
    return { data: null, error: null };
  });
  await createSupabaseAdapter(async () => 'token').deleteAccount();
  expect(remove).toHaveBeenCalledWith(['mine.jpg']);
  expect(order).toEqual(['photos', 'lookaware_command {"command":{"type":"delete_account"}}']);
});
test('a photo that cannot be removed stops the deletion before any record is touched', async () => {
  jest.mocked(createClient).mockReturnValue({
    rpc,
    functions: { invoke },
    storage: {
      from: () => ({ remove: async () => ({ data: null, error: { message: 'offline' } }) }),
    },
  } as unknown as ReturnType<typeof createClient>);
  rpc.mockResolvedValue({
    data: {
      profile: { id: 'me' },
      notifications: [],
      petitions: [
        {
          id: 'a',
          ownerId: 'me',
          photo: { url: 'https://x.supabase.co/storage/v1/object/public/petition-photos/m.jpg' },
        },
      ],
    },
    error: null,
  });
  await expect(createSupabaseAdapter(async () => 'token').deleteAccount()).rejects.toThrow(
    /photos could not be removed/,
  );
  expect(rpc).not.toHaveBeenCalledWith('lookaware_command', expect.anything());
});
