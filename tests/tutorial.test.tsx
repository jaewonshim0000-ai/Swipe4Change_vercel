import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import Tutorial from '../app/tutorial';
import { localAdapter } from '../src/data/provider';
import { demoIds } from '../src/data/seed';
import type { ProfileRole } from '../src/domain/model';

const show = async (role: ProfileRole) => {
  await localAdapter.reset();
  await localAdapter.signIn(demoIds.maya);
  await localAdapter.execute({ type: 'onboard', city: 'Riverton, CA', interests: [], role });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  client.setQueryData(['snapshot', 'demo'], await localAdapter.load());
  return render(
    <QueryClientProvider client={client}>
      <Tutorial />
    </QueryClientProvider>,
  );
};

test('the welcome tour follows the role someone chose, and every tour can be skipped', async () => {
  const organizer = await show('organizer');
  expect(screen.getByText('Start with one clear ask')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Next'));
  expect(screen.getByText('Send it to who can say yes')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Next'));
  await fireEvent.press(screen.getByLabelText('Start a petition'));
  expect(router.replace).toHaveBeenLastCalledWith('/(tabs)/create');
  await organizer.unmount();

  await show('supporter');
  expect(screen.getByText('Swipe through causes near you')).toBeTruthy();
  expect(screen.queryByText('Start with one clear ask')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Skip the tour'));
  expect(router.replace).toHaveBeenLastCalledWith('/(tabs)');
});
