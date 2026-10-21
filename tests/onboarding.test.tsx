import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import Onboarding from '../app/onboarding';
import { localAdapter } from '../src/data/provider';
import { demoIds } from '../src/data/seed';
import { toast } from '../src/components/kit';

jest.mock('../src/components/kit', () => ({
  ...jest.requireActual('../src/components/kit'),
  toast: jest.fn(),
}));

const consent = 'I’m 13 or older and agree to the Terms and Privacy Policy';

test('onboarding asks for a real name and the age and terms agreement before finishing', async () => {
  await localAdapter.reset();
  await localAdapter.signIn(demoIds.jordan);
  // A new live account starts with the placeholder until the person names themselves.
  await localAdapter.execute({
    type: 'profile',
    name: 'Community member',
    bio: '',
    useSigningHistory: true,
  });
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  // The app reaches onboarding with the account already loaded.
  client.setQueryData(['snapshot', 'demo'], await localAdapter.load());
  await render(
    <QueryClientProvider client={client}>
      <Onboarding />
    </QueryClientProvider>,
  );
  // A new account first says how it wants to take part; that only picks its welcome tour.
  await fireEvent.press(await screen.findByLabelText(/^Organizer\./));
  await fireEvent.press(screen.getByLabelText('Continue as organizer'));
  const name = await screen.findByLabelText('Your name');
  expect(name.props.value).toBe('');
  // The name is public wherever the person writes, so the hint must not promise otherwise.
  expect(screen.getByText(/petitions, updates and posts you write/)).toBeTruthy();
  const topics = ['Safer streets', 'Environment', 'Education'];
  for (const topic of topics)
    if (!screen.getByLabelText(topic).props.accessibilityState.checked)
      await fireEvent.press(screen.getByLabelText(topic));
  await fireEvent.changeText(name, 'Jordan Lee');
  await fireEvent.press(screen.getByLabelText('Find my community'));
  // Without the agreement nothing is saved, and the person is told why.
  expect(toast).toHaveBeenCalledWith(expect.stringMatching(/13 or older/));
  expect((await localAdapter.load()).profile!.name).toBe('Community member');
  expect(router.replace).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByLabelText(consent));
  await fireEvent.press(screen.getByLabelText('Find my community'));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/tutorial'));
  const profile = (await localAdapter.load()).profile!;
  expect(profile.name).toBe('Jordan Lee');
  expect(profile.interests).toEqual(expect.arrayContaining(topics));
  expect(profile.role).toBe('organizer');
});
