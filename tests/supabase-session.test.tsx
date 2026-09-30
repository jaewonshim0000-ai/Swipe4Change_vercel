import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '@clerk/expo';
import { useQuery } from '@tanstack/react-query';
import { Providers, useBackend } from '../src/data/provider';
import { getBackendConfig } from '../src/data/config';
import { createSupabaseAdapter } from '../src/data/supabase';

jest.mock('../src/data/config', () => ({ getBackendConfig: jest.fn() }));
jest.mock('../src/data/supabase', () => ({ createSupabaseAdapter: jest.fn() }));
const auth = jest.mocked(useAuth);
const getToken = jest.fn(async () => 'token');
function session(userId: string | null, isLoaded = true) {
  auth.mockReturnValue({
    userId,
    sessionId: userId,
    isLoaded,
    getToken,
    signOut: jest.fn(),
  } as unknown as ReturnType<typeof useAuth>);
}
function PrivateRead() {
  const { sessionKey } = useBackend();
  // Deliberately use an unscoped key, as existing manager routes do.
  const result = useQuery({
    queryKey: ['requests', 'petition'],
    queryFn: async () => `${sessionKey} private request`,
    staleTime: Infinity,
  });
  return <Text>{result.data ?? 'Loading private data'}</Text>;
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(getBackendConfig).mockReturnValue({
    backend: 'supabase',
    url: 'https://example.supabase.co',
    publicKey: 'sb_publishable_example',
    clerkKey: 'pk_test_example',
  });
  jest.mocked(createSupabaseAdapter).mockClear();
});
test('waits for Clerk hydration before constructing the adapter or mounting queries', async () => {
  session(null, false);
  const view = await render(
    <Providers>
      <PrivateRead />
    </Providers>,
  );
  expect(screen.getByLabelText('Loading your account')).toBeTruthy();
  expect(createSupabaseAdapter).not.toHaveBeenCalled();
  await view.unmount();
});
test('account switching discards cached private reads even with the same query key', async () => {
  session('alice');
  const view = await render(
    <Providers>
      <PrivateRead />
    </Providers>,
  );
  await waitFor(() => expect(screen.getByText('alice private request')).toBeTruthy());
  session('bob');
  await view.rerender(
    <Providers>
      <PrivateRead />
    </Providers>,
  );
  expect(screen.queryByText('alice private request')).toBeNull();
  await waitFor(() => expect(screen.getByText('bob private request')).toBeTruthy());
  session(null);
  await view.rerender(
    <Providers>
      <PrivateRead />
    </Providers>,
  );
  expect(screen.queryByText('bob private request')).toBeNull();
  await waitFor(() => expect(screen.getByText('guest private request')).toBeTruthy());
  await view.unmount();
});
test('invalid setup shows an actionable message without mounting authentication', async () => {
  jest.mocked(getBackendConfig).mockImplementation(() => {
    throw new Error('Set your public key.');
  });
  const view = await render(
    <Providers>
      <PrivateRead />
    </Providers>,
  );
  expect(screen.getByText('Set your public key.')).toBeTruthy();
  expect(createSupabaseAdapter).not.toHaveBeenCalled();
  await view.unmount();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});
