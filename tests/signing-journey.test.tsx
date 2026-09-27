import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SignatureConsent } from '../src/components/signature-consent';
import { localAdapter } from '../src/data/provider';
import { demoIds } from '../src/data/seed';
import { fixtureEnvelope } from './signature-fixture';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (effect: () => void) => {
    jest.requireActual('react').useEffect(effect, [effect]);
  },
}));
// Cryptography has separate real encryption tests; this suite covers consent and mutation behavior.
jest.mock('../src/security/signature-vault', () => ({
  decryptSignatory: async () => ({
    printedName: 'Maya Chen',
    residenceAddress: 'Sample address',
    jurisdiction: 'Sample jurisdiction',
    signature: {},
  }),
  encryptReceipt: async () => ({ version: 1, ciphertext: 'A'.repeat(100) }),
}));
jest.mock('../src/components/signature-pad', () => ({ SignaturePad: () => null }));

test('signing requires review, eligibility, exact identity preview and unchecked consent; failed writes never show a receipt', async () => {
  await localAdapter.reset();
  await localAdapter.signIn(demoIds.maya);
  await localAdapter.execute({ type: 'saveVault', envelope: fixtureEnvelope });
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
        onCancel={() => {}}
        onRecorded={recorded}
      />
    </QueryClientProvider>,
  );
  expect(screen.getByText('Review the requirements')).toBeTruthy();
  expect(screen.queryByLabelText('Confirm my signature')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Continue'));
  expect(screen.getByText('Eligible under the configured rule')).toBeTruthy();
  expect(screen.getByLabelText('Continue').props.accessibilityState.disabled).toBe(true);
  await waitFor(() => expect(screen.getByLabelText('Vault recovery key')).toBeTruthy());
  await fireEvent.changeText(screen.getByLabelText('Vault recovery key'), 'test-recovery-key');
  await fireEvent.press(screen.getByLabelText('Unlock my signature for review'));
  await waitFor(() =>
    expect(screen.getByLabelText('Continue').props.accessibilityState.disabled).toBe(false),
  );
  await fireEvent.press(screen.getByLabelText('Continue'));
  expect(screen.getByText('Maya Chen')).toBeTruthy();
  expect(screen.getByText('Maya C.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Maya C.'));
  await fireEvent.press(screen.getByLabelText('Continue'));
  expect(screen.getByLabelText('Confirm my signature').props.accessibilityState.disabled).toBe(
    true,
  );
  expect(screen.getByText('Maya C.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('checkbox'));
  localAdapter.simulateFailure();
  await fireEvent.press(screen.getByLabelText('Confirm my signature'));
  await waitFor(() => expect(screen.getByText(/connection interrupted/)).toBeTruthy());
  expect(recorded).not.toHaveBeenCalled();
  expect((await localAdapter.load()).signed).toEqual([]);
  await fireEvent.press(screen.getByLabelText('Confirm my signature'));
  await waitFor(() => expect(recorded).toHaveBeenCalledTimes(1));
  const confirmed = await localAdapter.load();
  expect(confirmed.signed).toContain(s.petitions[0].id);
  expect(
    confirmed.signatures.find((signature) => signature.petitionId === s.petitions[0].id)
      ?.displayName,
  ).toBe('Maya C.');
  await view.unmount();
  client.clear();
});
