import { useHostedAuth } from '@clerk/expo/hosted-auth';
import { useState } from 'react';
import { router } from 'expo-router';
import { Button, Notice } from './ui';
export function ClerkLogin({ mode }: { mode?: 'sign-in' | 'sign-up' }) {
  const { startHostedAuth } = useHostedAuth();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function login() {
    setError('');
    setPending(true);
    try {
      const result = await startHostedAuth({
        redirectUrl: 'swipe4change://auth-callback',
        ...(mode ? { mode } : {}),
      });
      if (result.createdSessionId) router.replace('/');
    } catch {
      setError('Sign-in did not finish. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Button
        title={
          pending
            ? 'Signing in…'
            : mode === 'sign-up'
              ? 'Sign up'
              : mode === 'sign-in'
                ? 'Log in'
                : 'Sign in or register securely'
        }
        disabled={pending}
        onPress={() => {
          void login();
        }}
      />
      {!!error && <Notice error text={error} />}
    </>
  );
}
