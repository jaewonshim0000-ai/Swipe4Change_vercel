import {
  analyzeDraft,
  canManage,
  draftSchema,
  optimisticSnapshot,
  publicName,
  rankFeed,
  scorePetition,
  signingError,
  trendingScore,
} from '../src/domain/rules';
import { Draft, Snapshot } from '../src/domain/model';
import { seedPetitions, seedProfiles } from '../src/data/seed';
const petitions = seedPetitions();
const profile = seedProfiles()[0];
const p = petitions[0];
const snapshot: Snapshot = {
  profile,
  petitions,
  communities: [],
  signed: [],
  saved: [],
  ripple: null,
  volunteering: [],
  signatures: [],
  reports: [],
  notifications: [],
  customApprovals: [],
};
describe('transparent ranking', () => {
  test('weights interest, city and membership independently', () => {
    const result = scorePetition(p, profile, Date.parse(p.createdAt));
    expect(result.factors).toEqual({
      interests: 35,
      history: 0,
      location: 30,
      community: 20,
      activity: 10,
      endorsements: 5 * (1 / 3),
    });
    expect(result.score).toBeCloseTo(96.6666);
  });
  test('diversifies repeated topics and communities deterministically', () => {
    const ranked = rankFeed(
      [...petitions, ...petitions.map((p) => ({ ...p, id: `copy-${p.id}` }))],
      profile,
    );
    expect(ranked.slice(0, 3).every((p) => p.topic === ranked[0].topic)).toBe(false);
    expect(rankFeed(petitions, profile).map((p) => p.id)).toEqual(
      rankFeed(petitions, profile).map((p) => p.id),
    );
  });
  test('caps tiny-sample trending spikes', () => {
    expect(trendingScore({ ...p, count: 1, recentSignatures: 100000 })).toBeLessThan(
      trendingScore({ ...p, count: 100, recentSignatures: 30 }),
    );
  });
  test('private drafts never enter feed', () =>
    expect(rankFeed([{ ...p, status: 'draft' }], profile)).toEqual([]));
});
describe('honest simulated AI', () => {
  test('empty inputs produce no invented request or recipient', () => {
    const a = analyzeDraft({});
    expect(a.title).toBe('');
    expect(a.summary).toBe('');
    expect(a.score).toBe(0);
  });
  test('only supplied action, city and recipient enter generated text', () => {
    const a = analyzeDraft({
      action: 'Add a shaded bench',
      recipient: 'Parks department',
      city: 'Sample City',
    });
    expect(a.title).toBe('Add a shaded bench in Sample City');
    expect(a.summary).toBe('We ask Parks department to add a shaded bench in Sample City.');
    expect(a.summary).not.toMatch(/verified|endorsed|\d|official|legal/);
  });
  test('visible rubric adds to 100 without judging truth', () => {
    const a = analyzeDraft(p);
    expect(a.rubric.reduce((n, r) => n + r.points, 0)).toBe(100);
    expect(a.score).toBe(100);
    expect(a.rubric.find((r) => r.label.includes('source'))?.label).toContain('not fact-checked');
  });
});
describe('forms and privacy', () => {
  test('accepts complete draft, rejects dates, empty identity lists, weak custom rules and unsafe URLs', () => {
    expect(draftSchema.safeParse(p).success).toBe(true);
    for (const patch of [
      { identities: [] },
      { deadline: '2027-02-30' },
      { deadline: '2020-01-01' },
      { verification: 'custom', customRule: '' },
      { evidence: [{ label: 'A source', url: 'javascript:alert(1)' }] },
      { goal: 1.5 },
    ])
      expect(draftSchema.safeParse({ ...p, ...patch }).success).toBe(false);
  });
  test('email-verified users can sign anonymously', () =>
    expect(signingError(p, snapshot, 'anonymous')).toBeNull());
  test('verification and visibility combinations are independent', () => {
    for (const identity of p.identities) {
      expect(
        signingError(p, { ...snapshot, profile: { ...profile, emailVerified: false } }, identity),
      ).toMatch(/verified email/);
      expect(signingError({ ...p, verification: 'account' }, snapshot, identity)).toBeNull();
    }
  });
  test('community, location, custom approvals and duplicate prevention', () => {
    expect(
      signingError(
        { ...p, verification: 'community' },
        { ...snapshot, profile: { ...profile, joined: [] } },
        'anonymous',
      ),
    ).toMatch(/Join/);
    expect(signingError({ ...p, verification: 'location' }, snapshot, 'anonymous')).toMatch(
      /Location/,
    );
    expect(signingError({ ...p, verification: 'custom' }, snapshot, 'anonymous')).toMatch(/review/);
    expect(
      signingError(
        { ...p, verification: 'custom' },
        { ...snapshot, customApprovals: [p.id] },
        'anonymous',
      ),
    ).toBeNull();
    expect(signingError(p, { ...snapshot, signed: [p.id] }, 'anonymous')).toMatch(/already signed/);
  });
  test('only selected name appears publicly', () => {
    expect(publicName('Maya Chen', 'anonymous')).toBe('Anonymous supporter');
    expect(publicName('Maya Chen', 'first_name_last_initial')).toBe('Maya C.');
  });
  test('unauthorized users cannot manage', () => {
    expect(canManage(p, null)).toBe(false);
    expect(canManage(p, seedProfiles()[1])).toBe(false);
    expect(canManage(p, profile)).toBe(true);
  });
  test('optimistic changes leave rollback snapshot intact', () => {
    const next = optimisticSnapshot(snapshot, { type: 'sign', petitionId: p.id });
    expect(next.petitions[0].count).toBe(p.count + 1);
    expect(snapshot.petitions[0].count).toBe(p.count);
    expect(snapshot.signed).toEqual([]);
  });
});
export const validDraft: Draft = p;

describe('signing-history personalization', () => {
  test('reserves at most ten points for history and explains the match', () => {
    const result = scorePetition(p, profile, Date.parse(p.createdAt), [p]);
    expect(result.factors.history).toBe(10);
    expect(result.factors.interests).toBe(25);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.reasons).toContain('Related to petitions you signed');
  });
  test('opt-out restores explicit-interest weight and discards history', () => {
    const result = scorePetition(
      p,
      { ...profile, useSigningHistory: false },
      Date.parse(p.createdAt),
      [p],
    );
    expect(result.factors.history).toBe(0);
    expect(result.factors.interests).toBe(35);
  });
  test('expired petitions do not enter discovery', () => {
    expect(rankFeed([{ ...p, deadline: '2000-01-01' }], profile)).toEqual([]);
  });
});
