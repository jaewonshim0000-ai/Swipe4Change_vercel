import { SignatureReceipt, validateSubmission } from '../domain/signature-record';
import { Referral, rippleOf } from '../domain/ripple';
import {
  Adapter,
  Command,
  Community,
  EligibilityRequest,
  Entry,
  Petition,
  Profile,
  PublicSignature,
  Report,
  Snapshot,
  SavedDraft,
  Volunteer,
  CommunityPost,
  PostReport,
  fieldLabels,
  moderatorOnlyKinds,
  ruleFields,
} from '../domain/model';
import {
  VELOCITY_WINDOW_MS,
  canManage,
  changedFields,
  communitySchema,
  crossedMilestone,
  describeEdit,
  draftSchema,
  editPatchSchema,
  postSchema,
  deliverySchema,
  donationUrlSchema,
  photoSchema,
  publicName,
  reportReasonSchema,
  signingError,
  communityPostSchema,
  volunteerSchema,
  backingReached,
} from '../domain/rules';
import { profileSchema } from '../domain/personalization';
import { screenLabels, screenPetition } from '../domain/content-screen';
import {
  PetitionText,
  ScreenCategory,
  petitionBody,
  starterTags,
} from '../../supabase/functions/_shared/civic-rules';
import type { CivicAi } from './ai';
import type { LookupRequest } from '../../supabase/functions/_shared/lookup';
import { fromBase64, stripJpegMetadata } from '../domain/jpeg';
import { z } from 'zod';
import {
  demoIds,
  petitionId,
  seedCommunities,
  seedPetitions,
  seedProfiles,
  seedVotes,
} from './seed';
export interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
interface PrivateSignature extends PublicSignature {
  userId: string;
  /** Optional so demo data saved before rolling velocity simply reads as outside the window. */
  signedAt?: string;
}
interface PrivateRequest extends EligibilityRequest {
  userId: string;
}
interface LocalState {
  receipts?: (SignatureReceipt & { userId: string })[];
  /** Who brought whom, keyed by the signature it credits. Private: only counts leave this file. */
  referrals?: { signatureId: string; referrerId: string }[];
  drafts?: (SavedDraft & { userId: string })[];
  version: 1;
  session: string | null;
  profiles: Profile[];
  /** Optional so demo data saved before member-created communities falls back to the seed set. */
  communities?: Community[];
  petitions: Petition[];
  signatures: PrivateSignature[];
  saves: Record<string, string[]>;
  /** Optional so demo data saved before volunteering existed still loads. */
  volunteers?: (Volunteer & { userId: string })[];
  reports: (Report & { userId: string })[];
  requests: PrivateRequest[];
  posts: Record<string, CommunityPost[]>;
  postReports?: (PostReport & { userId: string })[];
  /** Backing votes, one per member, community and petition. Optional for older saved demos. */
  votes?: { petitionId: string; communityId: string; userId: string; support: boolean }[];
  notifications: Record<string, Entry[]>;
}
export const STORAGE_KEY = 'lookaware.demo.v1';
/** The wording the AI tags and reviews. */
const textFields = ['title', 'summary', 'problem', 'action', 'recipient'] as const;
/**
 * Local stand-in for the server's random ripple code: stable per account and opaque in a link.
 * ponytail: a hash of the profile id is guessable; the hosted backend issues random codes.
 */
export function localRippleCode(profileId: string) {
  let h = 2166136261;
  for (const ch of profileId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const initial = (): LocalState => ({
  version: 1,
  session: null,
  profiles: seedProfiles(),
  communities: seedCommunities(),
  petitions: seedPetitions(),
  signatures: [],
  saves: { [demoIds.maya]: [petitionId(2)] },
  volunteers: [],
  reports: [],
  requests: [],
  posts: {},
  postReports: [],
  votes: seedVotes.map((v) => ({ ...v })),
  notifications: {},
});
export class LocalAdapter implements Adapter {
  private state: LocalState | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private failNext = false;
  constructor(
    private storage: Storage,
    private uuid: () => string,
    /** Absent in tests and when offline: word-matching rules stand in for the model. */
    private ai?: CivicAi,
  ) {}
  /** Make the next write fail once (or cancel that), to demonstrate optimistic rollback. */
  simulateFailure(on = true) {
    this.failNext = on;
  }
  get failing() {
    return this.failNext;
  }
  private async read() {
    if (!this.state) {
      const raw = await this.storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: LocalState = JSON.parse(raw);
        if (parsed.version !== 1)
          throw new Error('Saved demo uses an unsupported version. Reset the demo.');
        this.state = parsed;
      } else this.state = initial();
    }
    return this.state;
  }
  private async transaction<T>(fn: (s: LocalState) => T): Promise<T> {
    const operation = this.queue.then(async () => {
      const s = clone(await this.read());
      if (this.failNext) {
        this.failNext = false;
        throw new Error('Demo connection interrupted. Nothing was saved. Please try again.');
      }
      const result = fn(s);
      await this.storage.setItem(STORAGE_KEY, JSON.stringify(s));
      this.state = s;
      return result;
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
  /** Referrals joined to the signatures they credit. Withdrawn signatures drop out here. */
  private referrals(s: LocalState): Referral[] {
    return (s.referrals ?? []).flatMap((r) => {
      const signature = s.signatures.find((x) => x.id === r.signatureId);
      return signature
        ? [
            {
              petitionId: signature.petitionId,
              signerId: signature.userId,
              referrerId: r.referrerId,
            },
          ]
        : [];
    });
  }
  private snapshot(s: LocalState, now = Date.now()): Snapshot {
    const profile = s.profiles.find((p) => p.id === s.session) ?? null;
    const communities = s.communities ?? seedCommunities();
    const referrals = this.referrals(s);
    return clone({
      profile,
      drafts: (s.drafts ?? [])
        .filter((d) => d.userId === s.session)
        .map(({ userId: _private, ...d }) => d),
      petitions: s.petitions
        .filter(
          (p) =>
            p.status !== 'archived' &&
            ((p.status !== 'draft' && !p.hidden) || canManage(p, profile)),
        )
        .map((p) => ({
          ...p,
          viaShares: referrals.filter((r) => r.petitionId === p.id).length,
          // Velocity is a rolling window, not a lifetime tally, so Trending cannot decay into
          // "most signed ever". Mirrors the 7-day interval used by the SQL snapshot.
          recentSignatures:
            p.sampleVelocity +
            s.signatures.filter(
              (x) =>
                x.petitionId === p.id && now - Date.parse(x.signedAt ?? '') < VELOCITY_WINDOW_MS,
            ).length,
          deliveries: p.deliveries ?? [],
          backing: p.backing ?? [],
          volunteerCount:
            p.sampleVolunteers + (s.volunteers ?? []).filter((v) => v.petitionId === p.id).length,
          responses: p.responses.filter(
            (r) => r.verification === 'verified' || canManage(p, profile),
          ),
        })),
      communities: communities.map((c) => ({
        ...c,
        members: c.members + s.profiles.filter((p) => p.joined.includes(c.id)).length,
      })),
      saved: s.saves[s.session ?? ''] ?? [],
      ripple: profile
        ? { code: localRippleCode(profile.id), petitions: rippleOf(profile.id, referrals) }
        : null,
      // Only your own offer comes back here. Everyone else's is organizer-only, via volunteers().
      volunteering: (s.volunteers ?? [])
        .filter((v) => v.userId === s.session)
        .map((v) => ({ petitionId: v.petitionId, roles: v.roles, note: v.note })),
      signed: s.signatures.filter((x) => x.userId === s.session).map((x) => x.petitionId),
      backingVotes: (s.votes ?? [])
        .filter((v) => v.userId === s.session)
        .map(({ userId: _private, ...v }) => v),
      // The signing timestamp stays private: an exact time would let anyone correlate an
      // "anonymous" supporter with whoever was visibly active on the app at that moment.
      signatures: s.signatures.map(
        ({ userId: _private, signedAt: _at, ...publicFields }) => publicFields,
      ),
      reports: s.reports
        .filter((r) => r.userId === s.session)
        .map(({ userId: _private, ...r }) => r),
      notifications: s.notifications[s.session ?? ''] ?? [],
      customApprovals: s.requests
        .filter((r) => r.userId === s.session && r.status === 'approved')
        .map((r) => r.petitionId),
    });
  }
  /** The demo keeps photos inline with its other on-device data. */
  async uploadPhoto(jpegBase64: string) {
    stripJpegMetadata(fromBase64(jpegBase64));
    return `data:image/jpeg;base64,${jpegBase64}`;
  }
  async lookup(request: LookupRequest) {
    if (!this.ai?.lookup) throw new Error('Lookups run on the development server.');
    return this.ai.lookup(request);
  }
  async receipt(petitionId: string) {
    const s = await this.read();
    if (!s.session) throw new Error('Sign in to see your signature.');
    const receipt = (s.receipts ?? []).find(
      (r) => r.userId === s.session && r.petitionId === petitionId,
    );
    // Demo data saved before drawn signatures holds an encrypted record with no drawing to show.
    if (!receipt?.signature) return null;
    const { userId: _private, ...result } = receipt;
    return clone(result);
  }
  async load() {
    return this.snapshot(await this.read());
  }
  async signIn(account: string) {
    await this.transaction((s) => {
      if (!s.profiles.some((p) => p.id === account)) throw new Error('Choose a demo account.');
      s.session = account;
    });
  }
  async signOut() {
    await this.transaction((s) => {
      s.session = null;
    });
  }
  async deleteAccount() {
    throw new Error('The demo has no real accounts. Use Reset all local demo data instead.');
  }
  async reset() {
    const next = initial();
    for (const id of [...next.profiles.map((p) => p.id), 'guest'])
      await this.storage.setItem(`lookaware.draft.${id}`, '');
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
    this.state = next;
  }
  /** Organizer-only. A volunteer offered their name to the organizers, not to the public. */
  async volunteers(petitionId: string): Promise<Volunteer[]> {
    const s = await this.read();
    const p = s.petitions.find((p) => p.id === petitionId);
    if (!p || !canManage(p, s.profiles.find((u) => u.id === s.session) ?? null))
      throw new Error('Only organizers can see who offered to help.');
    return clone(
      (s.volunteers ?? [])
        .filter((v) => v.petitionId === petitionId)
        .map(({ userId: _private, ...v }) => v),
    );
  }
  /** True when the reader owns or moderates the community. */
  private moderates(s: LocalState, communityId: string) {
    const c = (s.communities ?? seedCommunities()).find((x) => x.id === communityId);
    return !!c && !!s.session && (c.ownerId === s.session || c.moderators.includes(s.session));
  }
  async communityPosts(id: string): Promise<CommunityPost[]> {
    const s = await this.read();
    const moderator = this.moderates(s, id);
    return clone(
      (s.posts[id] ?? [])
        // The organizer space is a private working room, not a quiet channel.
        .filter((post) => post.space !== 'organizers' || moderator),
    );
  }
  async communityReports(id: string): Promise<PostReport[]> {
    const s = await this.read();
    if (!this.moderates(s, id))
      throw new Error('Only this community owner and its moderators can review reports.');
    // The reporter's identity is stripped: reporting a neighbour should not name you to them.
    return clone(
      (s.postReports ?? [])
        .filter((r) => r.communityId === id)
        .map(({ userId: _private, ...r }) => r),
    );
  }
  async requests(id: string) {
    const s = await this.read();
    const p = s.petitions.find((p) => p.id === id);
    if (!p || !canManage(p, s.profiles.find((u) => u.id === s.session) ?? null))
      throw new Error('Only organizers can review eligibility requests.');
    return s.requests
      .filter((r) => r.petitionId === id)
      .map(({ userId: _private, ...r }) => clone(r));
  }
  /** Starter tags plus every tag the model has already used, so related petitions share tags. */
  private vocabulary(s: LocalState) {
    return [...new Set([...starterTags, ...s.petitions.flatMap((p) => p.tags ?? [])])];
  }
  /** The model's tags, or nothing when it cannot be reached (the ranking then reads the words). */
  private async tagsFor(p: PetitionText, s: LocalState) {
    return this.ai?.tags(p, this.vocabulary(s)).catch(() => undefined);
  }
  /**
   * AI work happens before the write transaction, because a model call can take seconds and
   * transactions are serialized. A report is reviewed by the model, falling back to the rules.
   */
  private async consult(c: Command): Promise<{ tags?: string[]; found?: ScreenCategory[] }> {
    const s = await this.read();
    const p = 'petitionId' in c ? s.petitions.find((x) => x.id === c.petitionId) : undefined;
    if (c.type === 'report' && p) {
      const found = await this.ai?.screen(p).catch(() => undefined);
      return { found: found ?? screenPetition(p) };
    }
    // Every petition is checked as it goes public and whenever its wording changes.
    const check = async (t: PetitionText) =>
      (await this.ai?.screen(t).catch(() => undefined)) ?? screenPetition(t);
    if (c.type === 'create' && draftSchema.safeParse(c.draft).success) {
      const [tags, found] = await Promise.all([
        this.tagsFor(c.draft, s),
        c.publish ? check(c.draft) : undefined,
      ]);
      return { tags, found };
    }
    if (c.type === 'publish' && p) return { found: await check(p) };
    if (c.type === 'edit' && p && textFields.some((f) => f in c.patch)) {
      const next = { ...p, ...c.patch };
      const [tags, found] = await Promise.all([this.tagsFor(next, s), check(next)]);
      return { tags, found };
    }
    return {};
  }
  /**
   * Tags petitions the model has not tagged yet: the seed, and any written while it was
   * unreachable. Returns how many were tagged, so the caller knows to refresh.
   */
  async backfillTags() {
    if (!this.ai) return 0;
    const s = await this.read();
    const [first, ...rest] = s.petitions.filter((p) => !p.tags?.length && p.status !== 'archived');
    // One probe first, so an unconfigured or offline model costs one request, not one per petition.
    const probe = first && (await this.tagsFor(first, s));
    if (!probe) return 0;
    const results = [
      [first, probe] as const,
      ...(await Promise.all(rest.map(async (p) => [p, await this.tagsFor(p, s)] as const))),
    ];
    const tagged = results.filter(([, tags]) => tags);
    if (!tagged.length) return 0;
    await this.transaction((t) => {
      for (const [before, tags] of tagged) {
        const p = t.petitions.find((x) => x.id === before.id);
        // Skip a petition reworded while the model was reading it; the next backfill retags it.
        if (p && tags && petitionBody(p) === petitionBody(before)) p.tags = tags;
      }
    });
    return tagged.length;
  }
  async execute(c: Command) {
    const ai = await this.consult(c);
    return this.transaction((s) => {
      const user = s.profiles.find((p) => p.id === s.session);
      if (!user) throw new Error('Sign in to continue.');
      const communities = (s.communities ??= seedCommunities());
      const entry = (body: string, kind: string, attributed = false): Entry => ({
        id: this.uuid(),
        body: postSchema.parse(body),
        author: user.name,
        date: new Date().toISOString(),
        kind,
        // Only set where the author's name is already public, so a person can remove their post.
        ...(attributed ? { authorId: user.id } : {}),
      });
      /**
       * Fan-out to the people an event actually concerns. Notifications are the only channel the
       * app has for telling anyone what happened after they participated, so every event that
       * changes a petition someone follows or manages writes one here.
       */
      const notify = (userIds: string[], body: string, kind: string) => {
        const at = new Date().toISOString();
        for (const id of new Set(userIds.filter((id) => s.profiles.some((p) => p.id === id))))
          s.notifications[id] = [
            { id: this.uuid(), body, author: 'Swipe4Change', date: at, kind },
            ...(s.notifications[id] ?? []),
          ].slice(0, 100);
      };
      /**
       * Everyone who asked to hear about a petition, minus the actor: signers, savers and
       * volunteers. Saving is following — there is no separate bookmark that stays silent.
       */
      const followers = (p: Petition) =>
        [
          ...s.signatures.filter((x) => x.petitionId === p.id).map((x) => x.userId),
          ...Object.entries(s.saves)
            .filter(([, ids]) => ids.includes(p.id))
            .map(([id]) => id),
          ...(s.volunteers ?? []).filter((v) => v.petitionId === p.id).map((v) => v.userId),
        ].filter((id) => id !== user.id);
      /** Owner and collaborators, minus the actor. */
      const managers = (p: Petition) =>
        [p.ownerId, ...p.collaborators].filter((id) => id !== user.id);
      if (c.type === 'profile') {
        Object.assign(user, profileSchema.parse(c));
        return;
      }
      if (c.type === 'saveDraft' || c.type === 'deleteDraft') {
        z.string().uuid().parse(c.id);
        const existing = (s.drafts ?? []).find((d) => d.id === c.id);
        if (existing && existing.userId !== user.id) throw new Error('This draft is private.');
        s.drafts = (s.drafts ?? []).filter((d) => d.id !== c.id);
        if (c.type === 'saveDraft') {
          if (
            JSON.stringify(c.draft).length > 30000 ||
            !Number.isInteger(c.step) ||
            c.step < 0 ||
            c.step > 3
          )
            throw new Error('Draft is too large or has an invalid step.');
          s.drafts.unshift({
            id: c.id,
            draft: c.draft,
            step: c.step,
            updatedAt: new Date().toISOString(),
            userId: user.id,
          });
        }
        return c.id;
      }
      if (c.type === 'onboard') {
        if (c.interests.length !== 0 && c.interests.length < 3)
          throw new Error('Select at least three interests or skip.');
        if (c.city.trim().length < 2 || c.city.length > 100)
          throw new Error('Enter a city and state.');
        user.interests = c.interests;
        user.city = c.city.trim();
        user.onboarded = true;
        return;
      }
      if (c.type === 'join') {
        if (!communities.some((x) => x.id === c.communityId))
          throw new Error('Community not found.');
        user.joined = user.joined.includes(c.communityId)
          ? user.joined.filter((id) => id !== c.communityId)
          : [...user.joined, c.communityId];
        if (user.joined.length >= 2 && !user.badges.includes('Community builder'))
          user.badges.push('Community builder');
        return;
      }
      if (c.type === 'createCommunity') {
        const input = communitySchema.parse(c);
        if (communities.some((x) => x.name.toLowerCase() === input.name.toLowerCase()))
          throw new Error('A community with that name already exists.');
        const id = this.uuid();
        communities.push({
          ...input,
          id,
          members: 0,
          sampleMembers: 0,
          ownerId: user.id,
          moderators: [],
        });
        if (!user.joined.includes(id)) user.joined.push(id);
        if (user.joined.length >= 2 && !user.badges.includes('Community builder'))
          user.badges.push('Community builder');
        return id;
      }
      if (c.type === 'moderator') {
        const community = communities.find((x) => x.id === c.communityId);
        if (!community || community.ownerId !== user.id)
          throw new Error('Only the community owner can change moderators.');
        if (c.profileId === user.id) throw new Error('You already moderate as the owner.');
        const member = s.profiles.find(
          (p) => p.id === c.profileId && p.joined.includes(c.communityId),
        );
        if (!member) throw new Error('Choose a current member of this community.');
        community.moderators = c.grant
          ? [...new Set([...community.moderators, c.profileId])]
          : community.moderators.filter((id) => id !== c.profileId);
        notify(
          [c.profileId],
          `You ${c.grant ? 'are now a moderator of' : 'are no longer a moderator of'} ${community.name}.`,
          'community',
        );
        return;
      }
      if (c.type === 'communityPost') {
        const community = communities.find((x) => x.id === c.communityId);
        if (!community) throw new Error('Community not found.');
        if (!user.joined.includes(c.communityId)) throw new Error('Join the community to post.');
        const v = communityPostSchema.parse(c);
        const moderator = community.ownerId === user.id || community.moderators.includes(user.id);
        if (!moderator && (v.space !== 'discussion' || moderatorOnlyKinds.includes(v.kind)))
          throw new Error(
            'Only this community owner and its moderators can post here. Try the public discussion.',
          );
        const post: CommunityPost = {
          ...entry(v.body, v.kind, true),
          communityId: c.communityId,
          space: v.space,
          channel: v.channel,
          ...(v.kind === 'event' ? { eventAt: v.eventAt, location: v.location ?? '' } : {}),
        };
        s.posts[c.communityId] = [...(s.posts[c.communityId] ?? []), post];
        return;
      }
      if (c.type === 'reportPost') {
        const post = (s.posts[c.communityId] ?? []).find((x) => x.id === c.postId);
        if (!post) throw new Error('That post is no longer here.');
        const reports = (s.postReports ??= []);
        if (reports.some((r) => r.postId === c.postId && r.userId === user.id))
          throw new Error('You already reported this post.');
        reports.unshift({
          id: this.uuid(),
          communityId: c.communityId,
          postId: c.postId,
          postBody: post.body,
          postAuthor: post.author,
          reason: reportReasonSchema.parse(c.reason),
          status: 'open',
          date: new Date().toISOString(),
          userId: user.id,
        });
        return;
      }
      if (c.type === 'resolvePostReport') {
        const community = communities.find((x) => x.id === c.communityId);
        if (
          !community ||
          (community.ownerId !== user.id && !community.moderators.includes(user.id))
        )
          throw new Error('Only this community owner and its moderators can review reports.');
        const report = (s.postReports ?? []).find(
          (r) => r.id === c.reportId && r.communityId === c.communityId,
        );
        if (!report) throw new Error('That report is no longer here.');
        if (report.status !== 'open') throw new Error('That report was already reviewed.');
        report.status = c.action;
        return;
      }
      if (c.type === 'removeEntry') {
        // Removal is a tombstone, never a silent delete: signers were notified about updates and
        // responses, and a thread that quietly loses posts misrepresents the conversation.
        const tombstone = (e: Entry, byAuthor: boolean) => {
          if (e.removed) throw new Error('This post was already removed.');
          e.body = byAuthor
            ? 'This post was removed by its author.'
            : 'This post was removed by a moderator.';
          e.removed = true;
          e.kind = 'removed';
        };
        if (c.scope === 'communityPost') {
          const community = communities.find((x) => x.id === c.communityId);
          const post = (s.posts[c.communityId ?? ''] ?? []).find((e) => e.id === c.entryId);
          if (!community || !post) throw new Error('Post not found.');
          const byAuthor = post.authorId === user.id;
          if (!byAuthor && community.ownerId !== user.id && !community.moderators.includes(user.id))
            throw new Error('Only the author, the community owner, or a moderator can remove it.');
          tombstone(post, byAuthor);
          if (!byAuthor && post.authorId)
            notify(
              [post.authorId],
              `A moderator removed your post in ${community.name}.`,
              'community',
            );
          return;
        }
        const target = s.petitions.find((p) => p.id === c.petitionId);
        if (!target) throw new Error('Petition not found.');
        const list =
          c.scope === 'discussion'
            ? target.discussion
            : c.scope === 'update'
              ? target.updates
              : target.responses;
        const post = list.find((e) => e.id === c.entryId);
        if (!post) throw new Error('Post not found.');
        const byAuthor = post.authorId === user.id;
        // Organizer updates and recorded responses speak for the petition, so only its managers
        // may retract them. A discussion post may also be removed by the person who wrote it.
        if (!(canManage(target, user) || (c.scope === 'discussion' && byAuthor)))
          throw new Error('You cannot remove this post.');
        tombstone(post, byAuthor);
        if (!byAuthor && post.authorId)
          notify(
            [post.authorId],
            `The organizer removed your post on “${target.title}”.`,
            'discussion',
          );
        return;
      }
      if (c.type === 'withdrawReport') {
        const index = s.reports.findIndex((r) => r.id === c.reportId && r.userId === user.id);
        if (index < 0) throw new Error('Report not found.');
        s.reports.splice(index, 1);
        return;
      }
      if (c.type === 'appeal') {
        const r = s.reports.find((r) => r.id === c.reportId && r.userId === user.id);
        if (!r) throw new Error('Report not found.');
        r.appeal = postSchema.parse(c.body);
        r.status = 'appealed';
        return;
      }
      /**
       * Applies the automatic check: flagged wording is held out of public view with the reason,
       * and wording that passes brings a held (or report-hidden) petition back.
       */
      const screened = (p: Petition) => {
        if (!ai.found) return;
        if (ai.found.length) {
          p.hidden = true;
          p.heldFor = ai.found;
          notify(
            managers(p),
            `“${p.title}” is not public yet: the automatic check flagged possible ${ai.found.map((k) => screenLabels[k]).join(', ')}. Edit the wording to fix it, or wait for a reviewer.`,
            'moderation',
          );
        } else if (p.hidden) {
          p.hidden = false;
          delete p.heldFor;
          notify(
            managers(p),
            `“${p.title}” passed the automatic check and is public.`,
            'moderation',
          );
        }
      };
      const verifiedToPublish = () => {
        if (!user.emailVerified)
          throw new Error('Verify your email before publishing. You can save a draft until then.');
      };
      if (c.type === 'create') {
        if (c.publish) verifiedToPublish();
        const d = draftSchema.parse(c.draft);
        if (!communities.some((x) => x.id === d.communityId))
          throw new Error('Choose a community.');
        const id = this.uuid();
        s.petitions.unshift({
          ...d,
          id,
          ownerId: user.id,
          creator: user.name,
          collaborators: [],
          status: c.publish ? 'active' : 'draft',
          deliveries: [],
          volunteerCount: 0,
          sampleVolunteers: 0,
          count: 0,
          sampleCount: 0,
          saves: 0,
          sampleVelocity: 0,
          recentSignatures: 0,
          createdAt: new Date().toISOString(),
          updates: [],
          edits: [],
          endorsements: [],
          backing: [],
          discussion: [],
          responses: [],
          viaShares: 0,
          ...(ai.tags ? { tags: ai.tags } : {}),
        });
        screened(s.petitions[0]);
        if (c.draftId)
          s.drafts = (s.drafts ?? []).filter((d) => d.id !== c.draftId || d.userId !== user.id);
        if (c.publish && !user.badges.includes('Change starter'))
          user.badges.push('Change starter');
        return id;
      }
      const p = s.petitions.find((p) => p.id === c.petitionId);
      if (!p || (p.hidden && !canManage(p, user))) throw new Error('Petition not found.');
      if (p.status === 'draft' && !canManage(p, user)) throw new Error('This draft is private.');
      // Archived petitions have left every view, so nothing further can be done to them.
      if (p.status === 'archived') throw new Error('This petition was archived by its organizer.');
      if (c.type === 'save') {
        const saved = s.saves[user.id] ?? [];
        const exists = saved.includes(p.id);
        s.saves[user.id] = exists ? saved.filter((id) => id !== p.id) : [...saved, p.id];
        p.saves += exists ? -1 : 1;
        return;
      }
      if (c.type === 'volunteer') {
        const { roles, note } = volunteerSchema.parse(c);
        if (p.status !== 'active')
          throw new Error('This petition is not accepting offers of help right now.');
        const all = (s.volunteers ??= []);
        const existing = all.find((v) => v.petitionId === p.id && v.userId === user.id);
        // No roles means "step back" — a volunteer withdraws without asking the organizer.
        if (!roles.length) {
          if (!existing) throw new Error('You have not offered to help with this petition.');
          s.volunteers = all.filter((v) => v !== existing);
          notify(managers(p), `${user.name} stepped back from volunteering.`, 'volunteer');
          return;
        }
        // Sorted so the two backends return identical arrays: Postgres array_agg(distinct …)
        // sorts, and role order carries no meaning.
        const unique = [...new Set(roles)].sort();
        if (existing) {
          existing.roles = unique;
          existing.note = note;
          existing.date = new Date().toISOString();
        } else {
          all.push({
            id: this.uuid(),
            petitionId: p.id,
            userId: user.id,
            name: user.name,
            roles: unique,
            note,
            date: new Date().toISOString(),
          });
        }
        notify(managers(p), `${user.name} offered to help with ${unique.join(', ')}.`, 'volunteer');
        return;
      }
      if (c.type === 'sign') {
        const error = signingError(p, this.snapshot(s), c.identity);
        if (error) throw new Error(error);
        const { disclosure, signature } = validateSubmission(p, c.submission);
        const signatureId = this.uuid();
        const signedAt = new Date().toISOString();
        const shownAs = publicName(user.name, c.identity);
        // A ripple link only credits someone who signed this petition themselves. Anything else —
        // an unknown code, your own link — is ignored rather than blocking the signature.
        const referrer = c.via
          ? s.profiles.find(
              (x) =>
                x.id !== user.id &&
                localRippleCode(x.id) === c.via &&
                s.signatures.some((sig) => sig.petitionId === p.id && sig.userId === x.id),
            )
          : undefined;
        s.receipts = [
          ...(s.receipts ?? []),
          { id: signatureId, petitionId: p.id, userId: user.id, disclosure, signature, signedAt },
        ];
        s.signatures.push({
          id: signatureId,
          petitionId: p.id,
          userId: user.id,
          signedAt,
          displayName: shownAs,
          identity: c.identity,
        });
        if (referrer) {
          (s.referrals ??= []).push({ signatureId, referrerId: referrer.id });
          const brought = this.referrals(s).filter(
            (r) => r.petitionId === p.id && r.referrerId === referrer.id,
          ).length;
          // Never who: a ripple is a count, so the referrer cannot map it back to a person.
          notify(
            [referrer.id],
            `Someone signed “${p.title}” through your link. ${brought} ${brought === 1 ? 'person has' : 'people have'} signed it because of you.`,
            'ripple',
          );
        }
        if (
          s.signatures.filter((x) => x.userId === user.id).length >= 5 &&
          !user.badges.includes('Showing up')
        )
          user.badges.push('Showing up');
        const before = p.count;
        p.count++;
        if (!user.badges.includes('First voice')) user.badges.push('First voice');
        notify(
          [user.id],
          `Your signature on “${p.title}” is confirmed. Your public identity is ${shownAs}.`,
          'signature',
        );
        // Organizers only ever learn the public identity the signer chose, never their real name.
        notify(
          managers(p),
          `${shownAs} signed “${p.title}”. ${p.count} of ${p.goal}.`,
          'signature',
        );
        const milestone = crossedMilestone(before, p.count, p.goal);
        if (milestone)
          notify(
            [...managers(p), ...followers(p), user.id],
            `“${p.title}” reached ${milestone}% of its signature goal — ${p.count} of ${p.goal} voices. This is signature progress, not a verified outcome.`,
            'milestone',
          );
        return;
      }
      if (c.type === 'withdraw') {
        const signature = s.signatures.find((x) => x.petitionId === p.id && x.userId === user.id);
        if (!signature) throw new Error('You have not signed this petition.');
        s.signatures = s.signatures.filter((x) => x !== signature);
        s.receipts = (s.receipts ?? []).filter((r) => r.id !== signature.id);
        s.referrals = (s.referrals ?? []).filter((r) => r.signatureId !== signature.id);
        // Never fall below the fictional seed baseline, which is not made of real signatures.
        p.count = Math.max(p.sampleCount, p.count - 1);
        notify(
          [user.id],
          `You withdrew your signature from “${p.title}”. It is no longer counted or shown publicly, and your drawn signature was deleted.`,
          'signature',
        );
        return;
      }
      if (c.type === 'discussion') {
        if (p.status !== 'active') throw new Error('Discussion is closed.');
        p.discussion.push(entry(c.body, c.kind, true));
        if (!user.badges.includes('Conversation starter')) user.badges.push('Conversation starter');
        notify(managers(p), `${user.name} posted a ${c.kind} on “${p.title}”.`, 'discussion');
        return;
      }
      if (c.type === 'report') {
        const found = ai.found ?? screenPetition(p);
        s.reports.push({
          id: this.uuid(),
          petitionId: p.id,
          userId: user.id,
          reason: postSchema.parse(c.reason),
          status: 'submitted',
          appeal: '',
          screening: found.length ? 'flagged' : 'clear',
        });
        if (!found.length) return 'clear';
        if (!p.hidden)
          notify(
            [p.ownerId, ...p.collaborators],
            `“${p.title}” is hidden while a person reviews it. After a report, the automatic review flagged possible ${found.map((k) => screenLabels[k]).join(', ')}.`,
            'moderation',
          );
        p.hidden = true;
        return 'flagged';
      }
      if (c.type === 'requestEligibility') {
        if (p.verification !== 'custom')
          throw new Error('Only custom rules accept organizer review.');
        if (
          s.requests.some(
            (r) => r.petitionId === p.id && r.userId === user.id && r.status !== 'declined',
          )
        )
          throw new Error('Your request is already pending or approved.');
        s.requests.push({
          id: this.uuid(),
          petitionId: p.id,
          userId: user.id,
          name: publicName(user.name, 'first_name_last_initial'),
          statement: postSchema.parse(c.statement),
          status: 'pending',
        });
        // Without this the organizer has no way to learn a request is waiting: eligibility
        // requests are only readable from the manager screen for that one petition.
        notify(
          managers(p),
          `${publicName(user.name, 'first_name_last_initial')} requested eligibility review on “${p.title}”. Review it in Manage.`,
          'eligibility',
        );
        return;
      }
      if (c.type === 'backVote') {
        const community = communities.find((x) => x.id === c.communityId);
        if (!community) throw new Error('Community not found.');
        if (!user.joined.includes(community.id))
          throw new Error('Only members of this community can vote on backing it.');
        if (p.status !== 'active' || p.hidden)
          throw new Error('This petition is not open for a community vote.');
        const backing = (p.backing ??= []);
        let tally = backing.find((b) => b.communityId === community.id);
        if (tally?.backedAt) throw new Error('This community already backs this petition.');
        const votes = (s.votes ??= []).filter(
          (v) => !(v.petitionId === p.id && v.communityId === community.id && v.userId === user.id),
        );
        votes.push({
          petitionId: p.id,
          communityId: community.id,
          userId: user.id,
          support: c.support,
        });
        s.votes = votes;
        const cast = votes.filter((v) => v.petitionId === p.id && v.communityId === community.id);
        if (!tally) backing.push((tally = { communityId: community.id, yes: 0, no: 0 }));
        tally.yes = cast.filter((v) => v.support).length;
        tally.no = cast.length - tally.yes;
        if (!backingReached(tally.yes, tally.no)) return;
        tally.backedAt = new Date().toISOString();
        p.endorsements.push({
          ...entry(
            `${community.name} members voted to back this (${tally.yes} yes · ${tally.no} no).`,
            'endorsement',
          ),
          author: community.name,
        });
        notify(managers(p), `${community.name} voted to back “${p.title}”.`, 'endorsement');
        return 'backed';
      }
      if (!canManage(p, user))
        throw new Error('Only the owner or an authorized collaborator can manage this petition.');
      if (c.type === 'update') {
        p.updates.unshift(entry(c.body, 'update', true));
        notify(followers(p), `New update on “${p.title}” from ${user.name}.`, 'update');
        return;
      }
      if (c.type === 'donationLink') {
        const url = donationUrlSchema.parse(c.url);
        if (url === (p.donationUrl ?? '')) throw new Error('Nothing changed.');
        // Where money goes is material, so every change is on the public record.
        p.edits.unshift(
          entry(
            url ? `Donation link set to ${url}.` : 'Donation link removed.',
            'material edit',
            true,
          ),
        );
        if (url) p.donationUrl = url;
        else delete p.donationUrl;
        return;
      }
      if (c.type === 'photo') {
        const photo = c.photo && photoSchema.parse(c.photo);
        if (!photo && !p.photo) throw new Error('Nothing changed.');
        if (photo && photo.url === p.photo?.url && photo.alt === p.photo.alt)
          throw new Error('Nothing changed.');
        // The picture shapes how people read the request, so changes are on the public record.
        p.edits.unshift(
          entry(
            !photo
              ? 'Photo removed.'
              : p.photo
                ? `Photo changed: “${photo.alt}”.`
                : `Photo added: “${photo.alt}”.`,
            'material edit',
            true,
          ),
        );
        if (photo) p.photo = photo;
        else delete p.photo;
        return;
      }
      if (c.type === 'publish') {
        if (p.status !== 'draft') throw new Error('Only drafts can be published.');
        verifiedToPublish();
        draftSchema.parse(p);
        p.status = 'active';
        screened(p);
        if (!user.badges.includes('Change starter')) user.badges.push('Change starter');
        return;
      }
      if (c.type === 'edit') {
        const patch = editPatchSchema.parse(c.patch);
        const next = draftSchema.parse({ ...p, ...patch });
        const changed = changedFields(p, patch);
        if (!changed.length) throw new Error('Nothing changed. Revise a field before publishing.');
        const changedRules = changed.filter((f) => (ruleFields as readonly string[]).includes(f));
        if (p.count > 0 && changedRules.length)
          throw new Error(
            'Signing rules are locked after the first signature. Create a new petition to change them.',
          );
        p.edits.unshift(
          entry(
            `${describeEdit(p, next, changed)}. ${changedRules.length ? 'Signing rules updated before any signatures. ' : ''}Reason: ${postSchema.parse(c.reason)}`,
            'material edit',
            true,
          ),
        );
        Object.assign(p, Object.fromEntries(changed.map((f) => [f, next[f]])));
        // New wording needs new tags. Without the model, drop the stale ones until a backfill.
        if (changed.some((f) => (textFields as readonly string[]).includes(f))) {
          if (ai.tags) p.tags = ai.tags;
          else delete p.tags;
          screened(p);
        }
        notify(
          followers(p),
          `“${p.title}” was revised by the organizer: ${changed.map((f) => fieldLabels[f]).join(', ')}. The previous wording is in its public history.`,
          'edit',
        );
        return;
      }
      if (c.type === 'deliver') {
        // Management permission is already enforced above for every command that reaches here.
        if (p.status === 'draft')
          throw new Error('Publish the petition before recording a delivery.');
        // Validate the form before the petition's state, so a bad note reports as a field error
        // rather than being masked by a signature-count message the organizer cannot act on yet.
        const { method, note } = deliverySchema.parse(c);
        if (p.count < 1)
          throw new Error('Collect at least one signature before delivering this petition.');
        // A snapshot, not a live view: the packet has to say what was actually sent. Names are
        // taken exactly as each signer chose to appear in public.
        p.deliveries.unshift({
          id: this.uuid(),
          petitionId: p.id,
          recipient: p.recipient,
          method,
          deliveredBy: user.name,
          deliveredAt: new Date().toISOString(),
          note,
          signatureCount: p.count,
          signatories: s.signatures.filter((x) => x.petitionId === p.id).map((x) => x.displayName),
        });
        notify(
          followers(p),
          `“${p.title}” was delivered to ${p.recipient} with ${p.count.toLocaleString()} signatures.`,
          'delivery',
        );
        return;
      }
      if (c.type === 'response') {
        // A response answers a specific hand-off when the organizer says which one.
        if (c.deliveryId && !p.deliveries.some((d) => d.id === c.deliveryId))
          throw new Error('That delivery is not on this petition.');
        p.responses.push({
          ...entry(c.body, 'response', true),
          organization: postSchema.parse(c.organization),
          verification: 'unverified',
          ...(c.deliveryId ? { deliveryId: c.deliveryId } : {}),
        });
        notify(
          followers(p),
          `An unverified response from ${postSchema.parse(c.organization)} was recorded on “${p.title}”. Swipe4Change has not verified the respondent.`,
          'response',
        );
        return;
      }
      if (c.type === 'close') {
        // Archiving hides a petition from everyone, so it must follow a public close rather than
        // silently removing something people already signed.
        if (c.status === 'archived') {
          if (p.ownerId !== user.id) throw new Error('Only the owner can archive a petition.');
          if (p.status === 'active')
            throw new Error('Close or mark this petition successful before archiving it.');
        } else if (p.status !== 'active') throw new Error('Only an active petition can be closed.');
        const audience = followers(p);
        p.status = c.status;
        p.edits.unshift(
          entry(
            `Organizer marked this petition ${c.status}. This is an organizer report, not independent verification.`,
            'status',
            true,
          ),
        );
        notify(
          audience,
          c.status === 'archived'
            ? `“${p.title}” was archived by its organizer and is no longer listed.`
            : `“${p.title}” was marked ${c.status} by its organizer, so it is no longer accepting signatures. This is the organizer's report, not independent verification.`,
          'status',
        );
        return;
      }
      if (c.type === 'collaborator') {
        if (p.ownerId !== user.id) throw new Error('Only the owner can add collaborators.');
        if (!Object.values(demoIds).includes(c.profileId) || c.profileId === user.id)
          throw new Error('Choose another demo account.');
        if (!p.collaborators.includes(c.profileId)) p.collaborators.push(c.profileId);
        return;
      }
      if (c.type === 'reviewEligibility') {
        const r = s.requests.find((r) => r.id === c.requestId && r.petitionId === p.id);
        if (!r || p.verification !== 'custom') throw new Error('Request not found.');
        r.status = c.approved ? 'approved' : 'declined';
        notify(
          [r.userId],
          c.approved
            ? `The organizer approved your eligibility to sign “${p.title}”. You can sign it now.`
            : `The organizer declined your eligibility request on “${p.title}”. You can submit a new statement.`,
          'eligibility',
        );
        return;
      }
    });
  }
}
