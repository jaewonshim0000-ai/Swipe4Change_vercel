import {
  emptyFilters,
  lastActivity,
  matchesDiscovery,
  matchReason,
  nextMilestone,
} from '../src/domain/discovery';
import { LocalAdapter } from '../src/data/local';
import { demoIds, seedPetitions } from '../src/data/seed';

test('milestones handle exact thresholds and completed goals', () => {
  expect(nextMilestone({ count: 684, goal: 1000 })).toEqual({ target: 750, remaining: 66 });
  expect(nextMilestone({ count: 750, goal: 1000 })).toEqual({ target: 1000, remaining: 250 });
  expect(nextMilestone({ count: 1001, goal: 1000 })).toBeNull();
  expect(nextMilestone({ count: 2, goal: 11 })).toEqual({ target: 3, remaining: 1 });
});

test('search combines community text, location, eligibility, recipient level and deadline filters', async () => {
  const adapter = new LocalAdapter(
    { getItem: async () => null, setItem: async () => {} },
    () => 'test',
  );
  await adapter.signIn(demoIds.maya);
  const s = await adapter.load();
  const p = s.petitions[0];
  const f = {
    ...emptyFilters,
    location: ' RIVERTON ',
    requirement: 'email' as const,
    level: 'city' as const,
    endingSoon: true,
    updated: true,
  };
  expect(matchesDiscovery(p, s, 'riverton students', f, Date.now())).toBe(true);
  expect(matchesDiscovery(p, s, 'bus shelter', f, Date.now())).toBe(true);
  expect(matchesDiscovery(p, s, '', { ...f, requirement: 'community' }, Date.now())).toBe(false);
  expect(matchesDiscovery(p, s, '', { ...f, location: 'Brookside' }, Date.now())).toBe(false);
  expect(matchesDiscovery({ ...p, status: 'draft' }, s, '', emptyFilters, Date.now())).toBe(false);
  expect(matchesDiscovery({ ...p, deadline: '2000-01-01' }, s, '', f, Date.now())).toBe(false);
  expect(
    matchesDiscovery(
      { ...p, updates: p.updates.map((u) => ({ ...u, removed: true })) },
      s,
      '',
      f,
      Date.now(),
    ),
  ).toBe(false);
  expect(matchReason(p, s)).toContain('Near Riverton, CA');
  expect(matchReason(p, s)).toContain('From your community');
});

test('recent activity ignores removed updates and demo response references its delivery', () => {
  const p = seedPetitions()[0];
  expect(
    lastActivity({ ...p, updates: [{ ...p.updates[0], removed: true, date: '2099-01-01' }] }),
  ).toBe(Date.parse(p.createdAt));
  expect(p.responses[0].deliveryId).toBe(p.deliveries[0].id);
  expect(p.deliveries[0].signatureCount).toBeLessThan(p.count);
});
