import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useHostedAuth } from '@clerk/expo/hosted-auth';
import { ClerkLogin } from '../src/components/clerk-login';

jest.mock('@clerk/expo/hosted-auth', () => ({ useHostedAuth: jest.fn() }));
const startHostedAuth = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useHostedAuth).mockReturnValue({ startHostedAuth });
});

test('uses the registered callback and navigates only after a session is activated', async () => {
  startHostedAuth.mockResolvedValue({ createdSessionId: 'session-test' });
  await render(<ClerkLogin />);
  await fireEvent.press(screen.getByText('Sign in or register securely'));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  expect(startHostedAuth).toHaveBeenCalledWith({ redirectUrl: 'swipe4change://auth-callback' });
});

test('cancelling the browser does not navigate or claim successful authentication', async () => {
  startHostedAuth.mockResolvedValue({ createdSessionId: null });
  await render(<ClerkLogin />);
  await fireEvent.press(screen.getByText('Sign in or register securely'));
  await waitFor(() => expect(screen.getByText('Sign in or register securely')).toBeTruthy());
  expect(router.replace).not.toHaveBeenCalled();
});

test('disables repeated attempts while pending and clears the error on retry', async () => {
  startHostedAuth.mockRejectedValueOnce(new Error('Network unavailable'));
  await render(<ClerkLogin />);
  await fireEvent.press(screen.getByText('Sign in or register securely'));
  const message = 'Sign-in did not finish. Check your connection and try again.';
  await waitFor(() => expect(screen.getByText(message)).toBeTruthy());
  let finish!: (value: { createdSessionId: null }) => void;
  startHostedAuth.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await fireEvent.press(screen.getByText('Sign in or register securely'));
  expect(screen.queryByText(message)).toBeNull();
  expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
  await fireEvent.press(screen.getByText('Signing in…'));
  expect(startHostedAuth).toHaveBeenCalledTimes(2);
  await act(async () => finish({ createdSessionId: null }));
});
