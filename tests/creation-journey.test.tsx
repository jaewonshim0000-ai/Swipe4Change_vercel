import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import Create from '../app/(tabs)/create';
import { localAdapter } from '../src/data/provider';
import { demoIds, seedPetitions } from '../src/data/seed';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ draftId: 'new' }),
  usePathname: () => '/create',
}));
// Desktop keeps the four-step builder; phones ask one question per screen.
let mockWide = true;
jest.mock('../src/components/responsive', () => ({
  ...jest.requireActual('../src/components/responsive'),
  useResponsiveLayout: () => ({ wide: mockWide }),
}));

test('the reorganized builder validates each step, previews both surfaces, and publishes only after confirmation', async () => {
  mockWide = true;
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
    screen.getByLabelText('The exact change you’re asking for'),
    'Assess the school-to-library path and publish a lighting plan.',
  );
  await fireEvent.changeText(
    screen.getByLabelText('Who can make this change?'),
    'Riverton Public Works (fictional)',
  );
  // A new draft starts in the creator's own city, chosen through the city picker.
  expect(screen.getByLabelText('Where is it happening?: Riverton, CA. Change')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Continue'));
  await waitFor(() => expect(screen.getByLabelText('The problem')).toBeTruthy());
  await fireEvent.changeText(
    screen.getByLabelText('The problem'),
    'Students walk along an unlit path between school and the local library after evening activities.',
  );
  await fireEvent.changeText(
    screen.getByLabelText('One-sentence summary'),
    'Students ask for a lighting plan for the path to the local library.',
  );
  await fireEvent.press(screen.getByLabelText('Continue'));
  await waitFor(() => expect(screen.getByLabelText('Signature goal')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('Continue'));
  await waitFor(() => expect(screen.getByLabelText('Card preview')).toBeTruthy());
  expect(screen.getByText('Writing check · local rules')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Page preview'));
  expect(screen.getByText('Why it matters')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Publish petition'));
  expect((await localAdapter.load()).petitions).toHaveLength(seedPetitions().length);
  await fireEvent.press(screen.getByLabelText('Publish'));
  await waitFor(() => expect(screen.getByText('Published · Change starter earned')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('View your petition'));
  expect(router.push).toHaveBeenCalledWith(expect.stringContaining('/petition/'));
  const created = (await localAdapter.load()).petitions.find(
    (p) => p.title === 'Light the walk from school to the library',
  );
  expect(created?.status).toBe('active');
  expect(created?.count).toBe(0);
  await view.unmount();
  client.clear();
});

test('on phones the builder asks one question per screen, reviews every answer and publishes', async () => {
  mockWide = false;
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
  await waitFor(() => expect(screen.getByLabelText(/^Write it myself/)).toBeTruthy());
  await fireEvent.press(screen.getByLabelText(/^Write it myself/));
  // An empty answer does not move on.
  await fireEvent.press(screen.getByLabelText('Next'));
  await waitFor(() => expect(screen.getByText('Question 1 of 12')).toBeTruthy());
  const answer = async (label: string, text: string) => {
    await fireEvent.changeText(screen.getByLabelText(label), text);
    await fireEvent.press(screen.getByLabelText('Next'));
  };
  await answer('Petition title', 'Light the walk from school to the library');
  await waitFor(() => expect(screen.getByText('Question 2 of 12')).toBeTruthy());
  await answer(
    'The problem',
    'Students walk along an unlit path between school and the local library after evening activities.',
  );
  await waitFor(() =>
    expect(screen.getByLabelText('The exact change you’re asking for')).toBeTruthy(),
  );
  await answer(
    'The exact change you’re asking for',
    'Assess the school-to-library path and publish a lighting plan.',
  );
  // Place, topic and community keep the demo's defaults.
  for (const n of [4, 5, 6]) {
    await waitFor(() => expect(screen.getByText(`Question ${n} of 12`)).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Next'));
  }
  await waitFor(() => expect(screen.getByLabelText('Who can make this change?')).toBeTruthy());
  await answer('Who can make this change?', 'Riverton Public Works (fictional)');
  // With a recipient known, the summary question offers a suggestion built from the answers.
  await waitFor(() => expect(screen.getByLabelText('One-sentence summary')).toBeTruthy());
  expect(screen.getByText('Suggested summary, built from your own fields')).toBeTruthy();
  await answer(
    'One-sentence summary',
    'Students ask for a lighting plan for the path to the local library.',
  );
  for (const n of [9, 10, 11]) {
    await waitFor(() => expect(screen.getByText(`Question ${n} of 12`)).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Next'));
  }
  await waitFor(() => expect(screen.getByText('Question 12 of 12')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('Review'));
  await waitFor(() => expect(screen.getByLabelText('Card preview')).toBeTruthy());
  expect(screen.getByText('Writing check · local rules')).toBeTruthy();
  // Editing one answer comes straight back to the review.
  await fireEvent.press(screen.getByLabelText('Edit: What should we call your petition?'));
  await waitFor(() => expect(screen.getByLabelText('Back to review')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('Back to review'));
  await waitFor(() => expect(screen.getByLabelText('Publish petition')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('Page preview'));
  expect(screen.getByText('Why it matters')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Publish petition'));
  await fireEvent.press(screen.getByLabelText('Publish'));
  await waitFor(() => expect(screen.getByText('Published · Change starter earned')).toBeTruthy());
  const created = (await localAdapter.load()).petitions.find(
    (p) => p.title === 'Light the walk from school to the library',
  );
  expect(created?.status).toBe('active');
  await view.unmount();
  client.clear();
});
