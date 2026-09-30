import AsyncStorage from '@react-native-async-storage/async-storage';
import { forYou, Signal } from '../src/domain/for-you';
import { petitionTags } from '../src/domain/tags';
import { clearSignals, recordSignal } from '../src/data/signals';
import { petitionId, seedPetitions, seedProfiles } from '../src/data/seed';

const petitions = seedPetitions();
const jordan = seedProfiles()[2];
const now = Date.now();
const base = { profile: jordan, petitions, signed: [], saved: [], volunteering: [] };
const byId = (ranked: ReturnType<typeof forYou>, n: number) =>
  ranked.find((r) => r.petition.id === petitionId(n))!;
const order = (ranked: ReturnType<typeof forYou>) => ranked.map((r) => r.petition.id);

test('hidden tags describe the issue and connect petitions across topics', () => {
  expect(petitionTags(petitions[0])).toEqual(expect.arrayContaining(['lighting', 'transit']));
  // A bench at a bus stop (Accessibility) and a lit path to a bus stop (Safer streets) relate.
  expect(petitions[8].topic).not.toBe(petitions[0].topic);
  expect(petitionTags(petitions[8])).toContain('transit');
});

test('a new account sees the base score only', () => {
  const ranked = forYou(base, [], now);
  expect(ranked.every((r) => r.behavior === 0)).toBe(true);
  expect(order(ranked)).toEqual(order(forYou(base, [], now)));
});

test('signing lifts petitions about the same issues, even in another topic', () => {
  // Petition 12 is Environment; 11 is Safer streets but shares its students and campus tags.
  const ranked = forYou({ ...base, signed: [petitionId(12)] }, [], now);
  expect(byId(ranked, 11).behavior).toBeGreaterThan(5);
  // 10 shares no tag, topic or community with 12, so behaviour leaves it alone.
  expect(byId(ranked, 10).behavior).toBe(0);
  expect(byId(ranked, 11).reasons[0]).toBe('Like “Less waste at lunchtime”, which you signed');
  // Reasons name petitions, never the hidden tags.
  expect(ranked.flatMap((r) => r.reasons).join(' ')).not.toMatch(/topic:|community:|campus/);
});

test('stronger actions count for more than looking', () => {
  const signal = (kind: Signal['kind']): Signal[] => [
    { petitionId: petitionId(12), kind, at: now },
  ];
  const read = byId(forYou(base, signal('detail'), now), 11).behavior;
  const swiped = byId(forYou(base, signal('interested'), now), 11).behavior;
  const signed = byId(forYou({ ...base, signed: [petitionId(12)] }, [], now), 11).behavior;
  expect(read).toBeGreaterThan(0);
  expect(swiped).toBeGreaterThan(read);
  expect(signed).toBeGreaterThan(swiped);
});

test('passing pushes similar petitions down and fades with time', () => {
  const skip = (at: number): Signal[] => [{ petitionId: petitionId(9), kind: 'skip', at }];
  // 4 shares Accessibility and the mobility tag with the skipped bus-bench petition.
  const fresh = byId(forYou(base, skip(now), now), 4).behavior;
  const old = byId(forYou(base, skip(now - 28 * 86400000), now), 4).behavior;
  expect(fresh).toBeLessThan(0);
  expect(old).toBeLessThan(0);
  expect(Math.abs(old)).toBeLessThan(Math.abs(fresh));
});

test('switching personalization off ignores every behavioural signal', () => {
  const off = { ...jordan, useSigningHistory: false };
  const signals: Signal[] = [{ petitionId: petitionId(5), kind: 'interested', at: now }];
  const ranked = forYou({ ...base, profile: off, signed: [petitionId(12)] }, signals, now);
  expect(ranked.every((r) => r.behavior === 0)).toBe(true);
  expect(order(ranked)).toEqual(order(forYou({ ...base, profile: off }, [], now)));
});

test('every fifth card explores beyond an established taste', () => {
  const ranked = forYou({ ...base, signed: [1, 11, 12].map(petitionId) }, [], now);
  expect(ranked[4].reasons[0]).toBe('Something different from your usual');
  expect(Math.abs(ranked[4].behavior)).toBeLessThan(2);
  expect(ranked).toHaveLength(petitions.length);
});

test('activity is stored on the device, respects the opt-out, and can be cleared', async () => {
  const key = 'swipe4change.signals.u1';
  await recordSignal({ id: 'u1' }, 'p1', 'detail');
  await recordSignal({ id: 'u1', useSigningHistory: false }, 'p1', 'dwell');
  const saved = JSON.parse((await AsyncStorage.getItem(key)) ?? '[]') as Signal[];
  expect(saved.map((x) => x.kind)).toEqual(['detail']);
  await clearSignals({ id: 'u1' });
  expect(await AsyncStorage.getItem(key)).toBe('[]');
});
