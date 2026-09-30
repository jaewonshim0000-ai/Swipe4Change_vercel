import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SignatureConsent } from '../src/components/signature-consent';
import { localAdapter } from '../src/data/provider';
import { demoIds } from '../src/data/seed';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
// Drawing is a gesture; the test stands in for it with a button that supplies a finished stroke.
jest.mock('../src/components/signature-pad', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text } = jest.requireActual('react-native');
  const { fixtureSignature } = jest.requireActual('./signature-fixture');
  return {
    SignaturePad: ({ onChange }: { onChange: (value: unknown) => void }) =>
      React.createElement(
        Pressable,
        { accessibilityLabel: 'Draw signature', onPress: () => onChange(fixtureSignature) },
        React.createElement(Text, null, 'Draw'),
      ),
  };
});

test('signing walks through the text, an exact identity preview, a drawn signature and unchecked consent; failed writes never confirm', async () => {
  await localAdapter.reset();
  await localAdapter.signIn(demoIds.maya);
  const s = await localAdapter.load();
  const recorded = jest.fn();
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const view = await render(
    <QueryClientProvider client={client}>
      <SignatureConsent
        petition={s.petitions[0]}
        snapshot={s}
        onClose={() => {}}
        onRecorded={recorded}
      />
    </QueryClientProvider>,
  );
  const next = () => screen.getByTestId('sign-next');
  expect(screen.getByText('Read the full request')).toBeTruthy();
  expect(screen.getByText(/Eligible/)).toBeTruthy();
  await fireEvent.press(next());
  expect(screen.getByText('Appears as “Maya Chen”')).toBeTruthy();
  await fireEvent.press(screen.getByText('Appears as “Maya C.”'));
  await fireEvent.press(next());
  expect(next().props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(screen.getByRole('checkbox'));
  // Consent alone is not a signature.
  expect(next().props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(screen.getByLabelText('Draw signature'));
  expect(next().props.accessibilityState.disabled).toBe(false);
  localAdapter.simulateFailure();
  await fireEvent.press(next());
  await waitFor(() => expect(screen.getByText(/connection interrupted/)).toBeTruthy());
  expect(recorded).not.toHaveBeenCalled();
  expect(screen.queryByText('You added your voice.')).toBeNull();
  expect((await localAdapter.load()).signed).toEqual([]);
  await fireEvent.press(next());
  await waitFor(() => expect(recorded).toHaveBeenCalledTimes(1));
  expect(screen.getByText('You added your voice.')).toBeTruthy();
  const confirmed = await localAdapter.load();
  expect(confirmed.signed).toContain(s.petitions[0].id);
  expect(
    confirmed.signatures.find((signature) => signature.petitionId === s.petitions[0].id)
      ?.displayName,
  ).toBe('Maya C.');
  expect((await localAdapter.receipt(s.petitions[0].id))?.signature).toHaveLength(10);
  await view.unmount();
  client.clear();
});
