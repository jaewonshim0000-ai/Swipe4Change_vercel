import { fixtureSubmission } from './signature-fixture';
import { SwipeDeck } from '../src/components/swipe-deck';
import { router } from 'expo-router';
import React from 'react';
import { AccessibilityInfo, Text, Pressable } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ManagerControl } from '../src/components/entries';
import { localAdapter, useCommand, useSnapshot } from '../src/data/provider';
import { demoIds, seedPetitions, seedProfiles } from '../src/data/seed';
test('manager control is absent for guests and other users', async () => {
  const p = seedPetitions()[0];
  const { rerender } = await render(<ManagerControl petition={p} profile={null} />);
  expect(screen.queryByText('Manage petition')).toBeNull();
  await rerender(<ManagerControl petition={p} profile={seedProfiles()[1]} />);
  expect(screen.queryByText('Manage petition')).toBeNull();
  await rerender(<ManagerControl petition={p} profile={seedProfiles()[0]} />);
  expect(screen.getByText('Manage petition')).toBeTruthy();
});
function Harness() {
  const q = useSnapshot();
  const m = useCommand();
  if (!q.data) return <Text>Loading</Text>;
  const p = q.data.petitions[0];
  return (
    <>
      <Text testID="count">{p.count}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign"
        onPress={() =>
          m.mutate({
            type: 'sign',
            petitionId: p.id,
            identity: 'anonymous',
            submission: fixtureSubmission(p),
          })
        }
      >
        <Text>Sign</Text>
      </Pressable>
      {m.error && <Text>{m.error.message}</Text>}
    </>
  );
}
test('a rejected optimistic signature restores the rendered count', async () => {
  await localAdapter.reset();
  await localAdapter.signIn(demoIds.maya);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const view = await render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('count').props.children).toBe(684));
  localAdapter.simulateFailure();
  await fireEvent.press(screen.getByLabelText('Sign'));
  await waitFor(() => expect(screen.getByText(/connection interrupted/)).toBeTruthy());
  expect(screen.getByTestId('count').props.children).toBe(684);
  expect((await localAdapter.load()).signed).toEqual([]);
  await view.unmount();
  client.clear();
});

test('swiping passes reversibly, supports and learns without signing', async () => {
  const motion = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await localAdapter.reset();
  await localAdapter.signIn(demoIds.maya);
  const snapshot = await localAdapter.load();
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const view = await render(
    <QueryClientProvider client={client}>
      <SwipeDeck petitions={snapshot.petitions} snapshot={snapshot} />
    </QueryClientProvider>,
  );
  expect(screen.getByText('Petition')).toBeTruthy();
  const artwork = () =>
    screen.getByLabelText('Swipe artwork left to pass, right to support or up to read more');
  const event = (pageX: number, pageY = 50) => ({ nativeEvent: { pageX, pageY } });
  await fireEvent(artwork(), 'responderGrant', event(200));
  await fireEvent(artwork(), 'responderRelease', event(30));
  await waitFor(() => expect(screen.getByLabelText('Undo last pass')).toBeTruthy());
  expect(screen.queryByText(snapshot.petitions[0].title)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Undo last pass'));
  expect(screen.getByText(snapshot.petitions[0].title)).toBeTruthy();
  // Right opens the signing sheet. Intent, never a recorded signature.
  await fireEvent(artwork(), 'responderGrant', event(30));
  await fireEvent(artwork(), 'responderRelease', event(200));
  expect(router.push).toHaveBeenCalledWith(`/petition/${snapshot.petitions[0].id}?sign=1`);
  // Up reads more.
  await fireEvent(artwork(), 'responderGrant', event(50, 300));
  await fireEvent(artwork(), 'responderRelease', event(50, 100));
  expect(router.push).toHaveBeenCalledWith(`/petition/${snapshot.petitions[0].id}`);
  expect((await localAdapter.load()).signed).toEqual([]);
  await view.unmount();
  client.clear();
  motion.mockRestore();
});

test('a federal rule in the deck opens its page to comment, with no signing or saving', async () => {
  const motion = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await localAdapter.reset();
  await localAdapter.signOut();
  const snapshot = await localAdapter.load();
  const rule = {
    id: '2026-20251',
    title: 'Bicycle Use in Park Areas',
    summary: 'The National Park Service proposes to update bicycle rules.',
    agency: 'National Park Service',
    topic: 'Public spaces' as const,
    closesOn: '2099-11-02',
    commentUrl: 'https://www.regulations.gov/commenton/NPS-2026-0166-0001',
    url: 'https://www.federalregister.gov/d/2026-20251',
  };
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const view = await render(
    <QueryClientProvider client={client}>
      <SwipeDeck petitions={[]} rules={[rule]} snapshot={snapshot} />
    </QueryClientProvider>,
  );
  expect(screen.getByText(rule.title)).toBeTruthy();
  // Labelled as its own kind, not a petition.
  expect(screen.getByText('Federal rule')).toBeTruthy();
  expect(screen.queryByText('Petition')).toBeNull();
  expect(screen.queryByLabelText('Save')).toBeNull();
  // Guests can comment too: the rule page, not sign-in, comes next.
  await fireEvent.press(screen.getByLabelText('Comment'));
  expect(router.push).toHaveBeenCalledWith('/federal/2026-20251');
  expect(router.push).not.toHaveBeenCalledWith('/(auth)/sign-in');
  await view.unmount();
  client.clear();
  motion.mockRestore();
});
