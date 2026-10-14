import { fireEvent, render, screen } from '@testing-library/react-native';
import { SignatureTrend } from '../src/components/signature-trend';
import { prepareSubmission } from './signature-fixture';
import { LocalAdapter, Storage, localRippleCode } from '../src/data/local';
import { demoIds, seedPetitions } from '../src/data/seed';
import { countTrend, trendDays, trendSummary } from '../src/domain/trend';

const DAY = 86400000;
const now = Date.parse('2026-10-11T12:00:00Z');
const ago = (days: number) => new Date(now - days * DAY).toISOString();

test('countTrend buckets by 24-hour days and drops anything outside the fortnight', () => {
  expect(
    countTrend(
      [
        { signedAt: ago(0.1), source: 'link' },
        { signedAt: ago(0.9), source: 'link' },
        { signedAt: ago(1.2), source: 'other' },
        { signedAt: ago(13.9), source: 'community' },
        { signedAt: ago(14.1), source: 'community' },
        { signedAt: ago(-1), source: 'other' },
        { source: 'other' },
      ],
      now,
    ),
  ).toEqual([
    { daysAgo: 0, source: 'link', count: 2 },
    { daysAgo: 1, source: 'other', count: 1 },
    { daysAgo: 13, source: 'community', count: 1 },
  ]);
});

test('trendDays fills empty days oldest first, and the summary compares weeks', () => {
  const days = trendDays([
    { daysAgo: 0, source: 'link', count: 2 },
    { daysAgo: 0, source: 'other', count: 1 },
    { daysAgo: 9, source: 'community', count: 4 },
  ]);
  expect(days).toHaveLength(14);
  expect(days[0].daysAgo).toBe(13);
  expect(days[13]).toEqual({ daysAgo: 0, link: 2, community: 0, other: 1, total: 3 });
  expect(trendSummary(days)).toEqual({
    thisWeek: 3,
    lastWeek: 4,
    bySource: { link: 2, community: 4, other: 1 },
  });
});

test('the local trend is organizer-only and sorts each signature into one source', async () => {
  const values = new Map<string, string>();
  const storage: Storage = {
    getItem: async (k) => values.get(k) ?? null,
    setItem: async (k, v) => {
      values.set(k, v);
    },
  };
  let n = 0;
  const a = new LocalAdapter(storage, () => `test-${++n}`);
  const sign = async (who: string, via?: string) => {
    await a.signIn(who);
    await a.execute({
      type: 'sign',
      petitionId: id,
      identity: 'anonymous',
      submission: await prepareSubmission(a, id),
      ...(via ? { via } : {}),
    });
  };
  await a.signIn(demoIds.maya);
  const id = (await a.execute({
    type: 'create',
    draft: { ...seedPetitions()[0], verification: 'account' },
    publish: true,
  })) as string;
  // Maya belongs to the petition's community, Sam follows her link (a link beats his membership),
  // and Jordan, after leaving the community, finds it himself.
  await sign(demoIds.maya);
  await sign(demoIds.sam, localRippleCode(demoIds.maya));
  await a.signIn(demoIds.jordan);
  await a.execute({ type: 'join', communityId: seedPetitions()[0].communityId });
  await sign(demoIds.jordan);
  await expect(a.signatureTrend(id)).rejects.toThrow('Only organizers');
  await a.signIn(demoIds.maya);
  const trend = await a.signatureTrend(id);
  expect(trend).toHaveLength(3);
  expect(trend).toEqual(
    expect.arrayContaining([
      { daysAgo: 0, source: 'community', count: 1 },
      { daysAgo: 0, source: 'link', count: 1 },
      { daysAgo: 0, source: 'other', count: 1 },
    ]),
  );
  expect(JSON.stringify(trend)).not.toContain(demoIds.sam);
  expect(await a.signatureTrend(id, Date.now() + 15 * DAY)).toEqual([]);
});

test('the chart reads out the fortnight, and a tapped day gives its breakdown', async () => {
  const counts = [
    { daysAgo: 0, source: 'link' as const, count: 2 },
    { daysAgo: 0, source: 'other' as const, count: 1 },
    { daysAgo: 9, source: 'community' as const, count: 4 },
  ];
  await render(<SignatureTrend counts={counts} sampleCount={684} now={now} />);
  expect(screen.getByText('3 this week · 4 the week before')).toBeTruthy();
  expect(screen.getByText('Share links 2')).toBeTruthy();
  expect(screen.getByText(/684 fictional sample signatures have no dates/)).toBeTruthy();
  await fireEvent.press(
    screen.getByLabelText('Today: 3 signatures, 2 share links · 1 everyone else'),
  );
  expect(screen.getByText('Today · 3 signatures — 2 share links · 1 everyone else')).toBeTruthy();
  await render(<SignatureTrend counts={[]} sampleCount={0} now={now} />);
  expect(screen.getByText(/No real signatures in the last two weeks yet/)).toBeTruthy();
});
