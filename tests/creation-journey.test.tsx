import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import Create from '../app/(tabs)/create';
import { localAdapter } from '../src/data/provider';
import { demoIds } from '../src/data/seed';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ draftId: 'new' }),
  usePathname: () => '/create',
}));

test('the reorganized builder validates each step, previews both surfaces, and publishes only after confirmation', async () => {
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
      <Create />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByLabelText('Petition title')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('Continue'));
  expect(screen.queryByText('Build the case')).toBeNull();
  await fireEvent.changeText(
    screen.getByLabelText('Petition title'),
    'Light the walk from school to the library',
  );
  await fireEvent.changeText(
    screen.getByLabelText('What is the problem?'),
    'Students walk along an unlit path between school and the local library after evening activities.',
  );
  await fireEvent.changeText(
    screen.getByLabelText('What specific action are you asking for?'),
    'Assess the school-to-library path and publish a lighting plan.',
  );
  await fireEvent.changeText(
    screen.getByLabelText('Who has the authority to act?'),
    'Riverton Public Works (fictional)',
  );
  await fireEvent.changeText(
    screen.getByLabelText('Where is it happening? City and state'),
    'Riverton, CA',
  );
  await fireEvent.press(screen.getByLabelText('Continue'));
  await waitFor(() => expect(screen.getByLabelText('One-sentence summary')).toBeTruthy());
  await fireEvent.changeText(
    screen.getByLabelText('One-sentence summary'),
    'Students ask for a lighting plan for the path to the local library.',
  );
  await fireEvent.press(screen.getByLabelText('Continue'));
  await waitFor(() => expect(screen.getByLabelText('Signature goal')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('Continue'));
  await waitFor(() => expect(screen.getByLabelText('Card preview')).toBeTruthy());
  expect(screen.getByText('Prototype writing assistant')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Detail preview'));
  expect(screen.getByText('Why it matters')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Publish petition'));
  expect((await localAdapter.load()).petitions).toHaveLength(12);
  await fireEvent.press(screen.getByLabelText('Confirm'));
  await waitFor(() =>
    expect(router.push).toHaveBeenCalledWith(expect.stringContaining('/petition/')),
  );
  const created = (await localAdapter.load()).petitions.find(
    (p) => p.title === 'Light the walk from school to the library',
  );
  expect(created?.status).toBe('active');
  expect(created?.count).toBe(0);
  await view.unmount();
  client.clear();
});
