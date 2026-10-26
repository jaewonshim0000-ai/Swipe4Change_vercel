/** The real app never offers the demo's fictional places or simulated checks. */
function live<T>(load: () => T): T {
  let mod: T | undefined;
  const before = process.env.EXPO_PUBLIC_BACKEND;
  process.env.EXPO_PUBLIC_BACKEND = 'supabase';
  try {
    jest.isolateModules(() => {
      mod = load();
    });
  } finally {
    process.env.EXPO_PUBLIC_BACKEND = before;
  }
  return mod!;
}

test('live mode treats the fictional sample cities as ordinary unknown places', () => {
  const real = live(
    () => require('../src/data/civic-lookup') as typeof import('../src/data/civic-lookup'),
  );
  expect(real.isSampleCity('Irvine, CA')).toBe(false);
  const demo = require('../src/data/civic-lookup') as typeof import('../src/data/civic-lookup');
  expect(demo.isSampleCity('Irvine, CA')).toBe(true);
});

test('live mode does not offer location verification, which only the demo simulates', () => {
  const real = live(() => require('../src/data/provider') as typeof import('../src/data/provider'));
  expect(real.offeredVerifications).toEqual(['account', 'email', 'community', 'custom']);
  const demo = require('../src/data/provider') as typeof import('../src/data/provider');
  expect(demo.offeredVerifications).toContain('location');
});
