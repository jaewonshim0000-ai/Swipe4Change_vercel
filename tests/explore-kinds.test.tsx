import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Feed } from '../src/screens/feed';
import { localAdapter } from '../src/data/provider';
import { demoIds } from '../src/data/seed';

test('Explore keeps federal rules in their own category, apart from petitions', async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      results: [
        {
          document_number: '2026-20251',
          title: 'Bicycle Use in Park Areas',
          abstract: 'The National Park Service proposes to update bicycle rules.',
          agencies: [{ name: 'National Park Service', slug: 'national-park-service' }],
          comments_close_on: '2099-11-02',
          comment_url: 'https://www.regulations.gov/commenton/NPS-2026-0166-0001',
          html_url: 'https://www.federalregister.gov/d/2026-20251',
        },
      ],
    }),
  })) as unknown as typeof fetch;
  await localAdapter.reset();
  await localAdapter.signIn(demoIds.maya);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  client.setQueryData(['snapshot', 'demo'], await localAdapter.load());
  const view = await render(
    <QueryClientProvider client={client}>
      <Feed explore />
    </QueryClientProvider>,
  );
  expect(await screen.findByText('All petitions')).toBeTruthy();
  expect(screen.queryByText('Bicycle Use in Park Areas')).toBeNull();

  await fireEvent.press(screen.getByText('Federal rules'));
  expect(await screen.findByText('Bicycle Use in Park Areas')).toBeTruthy();
  expect(screen.getByText(/Federal rules aren’t petitions/)).toBeTruthy();
  expect(screen.queryByText('All petitions')).toBeNull();

  await fireEvent.press(screen.getByText('Petitions'));
  expect(screen.getByText('All petitions')).toBeTruthy();
  await view.unmount();
  client.clear();
});
