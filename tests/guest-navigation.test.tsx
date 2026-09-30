import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Index from '../app/index';
import { AuthButtons } from '../src/components/auth-buttons';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{href}</Text>;
  },
}));
jest.mock('../src/data/provider', () => ({
  isDemo: false,
  useBackend: () => ({ sessionKey: 'guest' }),
  useSnapshot: () => ({ isPending: true }),
}));

test('guests enter discovery even while profile data is loading', async () => {
  await render(<Index />);
  expect(screen.getByText('/(tabs)')).toBeTruthy();
});

test('login and signup buttons open their respective flows', async () => {
  await render(<AuthButtons />);
  await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
  expect(router.push).toHaveBeenLastCalledWith('/(auth)/sign-in');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign up' }));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: '/(auth)/sign-in',
    params: { mode: 'sign-up' },
  });
});
