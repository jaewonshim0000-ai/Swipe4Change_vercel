import { useHostedAuth } from '@clerk/expo/hosted-auth';
import { useState } from 'react';
import { Button, Notice } from './ui';
export function ClerkLogin() {
  const { startHostedAuth } = useHostedAuth();
  const [error, setError] = useState('');
  return (
    <>
      <Button
        title="Sign in or register securely"
        onPress={() => {
          void startHostedAuth({ redirectUrl: 'swipe4change://auth-callback' }).catch(() =>
            setError('Sign-in did not finish. Check your connection and try again.'),
          );
        }}
      />
      {!!error && <Notice error text={error} />}
    </>
  );
}
