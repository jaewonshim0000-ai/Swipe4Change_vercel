import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FederalRuleScreen from '../app/federal/[id]';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: '2026-20251' }),
}));

const rule = {
  document_number: '2026-20251',
  title: 'Big Cypress National Preserve; Off-Road Motor Vehicles',
  abstract: 'The National Park Service proposes to amend off-road vehicle rules.',
  agencies: [{ name: 'National Park Service', slug: 'national-park-service' }],
  comments_close_on: '2026-12-01',
  comment_url: 'http://www.regulations.gov/commenton/NPS-2026-0199-0001',
  html_url: 'https://www.federalregister.gov/documents/2026/10/02/2026-20251/big-cypress',
};

test('a federal rule shows the official summary and leaves the app only after confirmation', async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ results: [rule] }),
  })) as unknown as typeof fetch;
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await render(
    <QueryClientProvider client={client}>
      <FederalRuleScreen />
    </QueryClientProvider>,
  );
  expect(await screen.findByText('Official summary from the Federal Register')).toBeTruthy();
  expect(screen.getByText(rule.abstract)).toBeTruthy();
  await fireEvent.press(screen.getByText('Comment on Regulations.gov'));
  expect(open).not.toHaveBeenCalled();
  expect(screen.getByText('Leave Swipe4Change?')).toBeTruthy();
  await fireEvent.press(screen.getByText('Continue'));
  expect(open).toHaveBeenCalledWith('https://www.regulations.gov/commenton/NPS-2026-0199-0001');
});
