import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AlgorithmPreferences } from '../src/components/algorithm-preferences';
import { localAdapter, useSnapshot } from '../src/data/provider';
import { demoIds } from '../src/data/seed';
import Communities from '../app/(tabs)/communities';
import { topics } from '../src/domain/model';

function Harness() {
  const q = useSnapshot();
  return q.data ? <AlgorithmPreferences profile={q.data.profile} /> : null;
}
async function setup() {
  await localAdapter.reset();
  await localAdapter.signIn(demoIds.maya);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  client.setQueryData(['snapshot', 'demo'], await localAdapter.load());
  const view = await render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
  await fireEvent.press(screen.getByLabelText('Algorithm preferences'));
  return { client, view };
}

test('preferences persist through the data layer and reopen with the saved values', async () => {
  const { client, view } = await setup();
  const before = (await localAdapter.load()).profile!;
  await fireEvent.press(screen.getByText('Clear interests'));
  await fireEvent.press(screen.getByLabelText('Personalize using my activity'));
  await fireEvent.press(screen.getByText('Save preferences'));
  await waitFor(() => expect(screen.queryByText('Save preferences')).toBeNull());
  const saved = (await localAdapter.load()).profile!;
  expect(saved.interests).toEqual([]);
  expect(saved.useSigningHistory).toBe(!(before.useSigningHistory !== false));
  expect(saved.city).toBe(before.city);
  expect(saved.name).toBe(before.name);
  await fireEvent.press(screen.getByLabelText('Algorithm preferences'));
  expect(
    screen.getByLabelText('Personalize using my activity').props.accessibilityState.checked,
  ).toBe(saved.useSigningHistory);
  await view.unmount();
  client.clear();
});

test('cancel discards edits and reopening starts from the profile', async () => {
  const { client, view } = await setup();
  const before = (await localAdapter.load()).profile!;
  await fireEvent.press(screen.getByLabelText('Personalize using my activity'));
  await fireEvent.press(screen.getByText('Cancel'));
  await fireEvent.press(screen.getByLabelText('Algorithm preferences'));
  expect(
    screen.getByLabelText('Personalize using my activity').props.accessibilityState.checked,
  ).toBe(before.useSigningHistory !== false);
  expect((await localAdapter.load()).profile).toEqual(before);
  await view.unmount();
  client.clear();
});

test('failed saves keep the popup open with an error and allow retry', async () => {
  const { client, view } = await setup();
  await fireEvent.press(screen.getByText('Clear interests'));
  const execute = jest
    .spyOn(localAdapter, 'execute')
    .mockRejectedValueOnce(new Error('Offline. Try again.'));
  await fireEvent.press(screen.getByText('Save preferences'));
  expect(await screen.findByText('Offline. Try again.')).toBeTruthy();
  expect(screen.getByText('Save preferences')).toBeTruthy();
  execute.mockRestore();
  await fireEvent.press(screen.getByText('Save preferences'));
  await waitFor(() => expect(screen.queryByText('Save preferences')).toBeNull());
  await view.unmount();
  client.clear();
});

test('an incomplete topic selection is rejected before saving', async () => {
  const { client, view } = await setup();
  const before = (await localAdapter.load()).profile!;
  await fireEvent.press(screen.getByText('Clear interests'));
  await fireEvent.press(screen.getByText(topics[0]));
  await fireEvent.press(screen.getByText('Save preferences'));
  expect(
    screen.getByText('Choose at least three interests, or clear them to explore all topics.'),
  ).toBeTruthy();
  expect((await localAdapter.load()).profile).toEqual(before);
  await view.unmount();
  client.clear();
});

test('Communities opens the shared preferences popup', async () => {
  await localAdapter.reset();
  await localAdapter.signIn(demoIds.maya);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  client.setQueryData(['snapshot', 'demo'], await localAdapter.load());
  const view = await render(
    <QueryClientProvider client={client}>
      <Communities />
    </QueryClientProvider>,
  );
  await fireEvent.press(screen.getByLabelText('Algorithm preferences'));
  expect(screen.getByText('Save preferences')).toBeTruthy();
  await fireEvent.press(screen.getByText('Cancel'));
  expect(screen.queryByText('Save preferences')).toBeNull();
  await view.unmount();
  client.clear();
});
