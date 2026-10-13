import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';
import { SwipeDeck, swipeIntent } from '../src/components/swipe-deck';
import { localAdapter } from '../src/data/provider';
import { demoIds } from '../src/data/seed';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

test('a long drag commits the way it went', () => {
  expect(swipeIntent(120, 0)).toBe('support');
  expect(swipeIntent(-120, 10)).toBe('pass');
  expect(swipeIntent(10, -100)).toBe('learn');
});

test('a short, quick flick commits too, but a slow nudge springs back', () => {
  expect(swipeIntent(45, 0, 0.9)).toBe('support');
  expect(swipeIntent(-45, 0, -0.9)).toBe('pass');
  expect(swipeIntent(5, -45, 0, -0.9)).toBe('learn');
  expect(swipeIntent(45, 0, 0.2)).toBeNull();
  expect(swipeIntent(10, 5)).toBeNull();
});

test('a flick against the drag, or a sideways flick up, does not commit', () => {
  expect(swipeIntent(45, 0, -0.9)).toBeNull();
  expect(swipeIntent(-45, 0, 0.9)).toBeNull();
  expect(swipeIntent(80, -45, 0, -0.9)).toBeNull();
});

test('the deck ticks once per crossing, springs back from a slow drag and takes a flick', async () => {
  const motion = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await localAdapter.reset();
  await localAdapter.signIn(demoIds.maya);
  const snapshot = await localAdapter.load();
  const first = snapshot.petitions[0];
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const view = await render(
    <QueryClientProvider client={client}>
      <SwipeDeck petitions={snapshot.petitions} snapshot={snapshot} />
    </QueryClientProvider>,
  );
  const card = () => screen.getByLabelText(/signatures, \d+ days left\.$/);
  const at = (kind: string, pageX: number, timestamp: number) =>
    fireEvent(card(), kind, { nativeEvent: { pageX, pageY: 50, timestamp } });
  jest.mocked(router.push).mockClear();

  // Crossing the sign line ticks once; staying past it does not tick again.
  await at('responderGrant', 0, 1000);
  await at('responderMove', 60, 1100);
  expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  await at('responderMove', 120, 1200);
  await at('responderMove', 140, 1300);
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  // Drifting back and pausing before letting go: no flick, so nothing happens.
  await at('responderMove', 50, 1400);
  await at('responderRelease', 50, 1600);
  expect(router.push).not.toHaveBeenCalled();
  expect(screen.getByText(first.title)).toBeTruthy();

  // A quick short flick right opens the signing sheet, with its own tick.
  await at('responderGrant', 0, 2000);
  await at('responderMove', 40, 2010);
  await at('responderRelease', 45, 2020);
  expect(router.push).toHaveBeenCalledWith(`/petition/${first.id}?sign=1`);
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);
  expect((await localAdapter.load()).signed).toEqual([]);

  await view.unmount();
  client.clear();
  motion.mockRestore();
});
