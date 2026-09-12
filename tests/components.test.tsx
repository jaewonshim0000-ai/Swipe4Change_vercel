import { fixtureSubmission, fixtureEnvelope } from './signature-fixture';
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
  await localAdapter.execute({ type: 'saveVault', envelope: fixtureEnvelope });
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

test('swiping passes reversibly or opens review without signing', async () => {
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
  const artwork = () => screen.getByLabelText('Swipe artwork left to pass or right to review');
  const event = (pageX: number) => ({ nativeEvent: { pageX, pageY: 50 } });
  await fireEvent(artwork(), 'responderGrant', event(200));
  await fireEvent(artwork(), 'responderRelease', event(30));
  await waitFor(() => expect(screen.getByLabelText('Undo last pass')).toBeTruthy());
  expect(screen.queryByText(snapshot.petitions[0].title)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Undo last pass'));
  expect(screen.getByText(snapshot.petitions[0].title)).toBeTruthy();
  await fireEvent(artwork(), 'responderGrant', event(30));
  await fireEvent(artwork(), 'responderRelease', event(200));
  expect(router.push).toHaveBeenCalledWith(`/petition/${snapshot.petitions[0].id}`);
  expect((await localAdapter.load()).signed).toEqual([]);
  await view.unmount();
  client.clear();
  motion.mockRestore();
});
