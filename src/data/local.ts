import { Affidavit, affidavitSubmissionSchema } from '../domain/affidavit';
import { emptyQualification, qualificationSchema } from '../domain/qualification';
import { SignatureReceipt, validateSubmission } from '../domain/signature-record';
import { EncryptedVault, envelopeSchema } from '../domain/signatory';
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
  publicName,
  reportReasonSchema,
  signingError,
  communityPostSchema,
  volunteerSchema,
} from '../domain/rules';
import { profileSchema } from '../domain/personalization';
import { prepareResponseChecks } from '../domain/response-checks';
import { z } from 'zod';
import { demoIds, petitionId, seedCommunities, seedPetitions, seedProfiles } from './seed';
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
/**
 * Stored form of a community post. The two ledgers stay private: a poll shows counts, and a
 * proposal shows a tally, but neither exposes who chose what to the rest of the community.
 */
interface StoredPost extends CommunityPost {
  voters?: Record<string, string>;
  positions?: Record<string, 'support' | 'oppose'>;
  claimedById?: string;
}
interface LocalState {
  affidavits?: (Affidavit & { userId: string })[];
  receipts?: (SignatureReceipt & { userId: string })[];
  vaults?: Record<string, EncryptedVault>;
  drafts?: (SavedDraft & { userId: string })[];
  version: 1;
  session: string | null;
  profiles: Profile[];
  /** Optional so demo data saved before member-created communities falls back to the seed set. */
  communities?: Community[];
  petitions: Petition[];
  signatures: PrivateSignature[];
  saves: Record<string, string[]>;
  /** Optional so demo data saved before follow/volunteer existed still loads. */
  follows?: Record<string, string[]>;
  volunteers?: (Volunteer & { userId: string })[];
  reports: (Report & { userId: string })[];
  requests: PrivateRequest[];
  posts: Record<string, StoredPost[]>;
  postReports?: (PostReport & { userId: string })[];
  notifications: Record<string, Entry[]>;
}
export const STORAGE_KEY = 'lookaware.demo.v1';
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const initial = (): LocalState => ({
  version: 1,
  session: null,
  profiles: seedProfiles(),
  communities: seedCommunities(),
  petitions: seedPetitions(),
  signatures: [],
  saves: { [demoIds.maya]: [petitionId(2)] },
  follows: { [demoIds.maya]: [petitionId(1)] },
  volunteers: [],
  reports: [],
  requests: [],
  posts: {},
  postReports: [],
  notifications: {},
});
export class LocalAdapter implements Adapter {
  private state: LocalState | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private failNext = false;
  constructor(
    private storage: Storage,
    private uuid: () => string,
  ) {}
  simulateFailure() {
    this.failNext = true;
  }
  private async read() {
    if (!this.state) {
      const raw = await this.storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: LocalState = JSON.parse(raw);
        if (parsed.version !== 1)
          throw new Error('Saved demo uses an unsupported version. Reset the demo.');
        // Add only the new comparison to an untouched legacy flagship. Keep every saved petition,
        // response, edit and signature as the participant left it.
        const flagship = parsed.petitions.find((petition) => petition.id === petitionId(1));
        if (
          flagship &&
          !flagship.responseChecks &&
          flagship.action ===
            'Assess the Eastbridge campus-to-bus path and publish a pedestrian-lighting installation plan before the winter evening semester.' &&
          flagship.responses.some(
            (response) =>
              response.id === 'r1' && response.verification === 'verified' && !response.removed,
          )
        )
          flagship.responseChecks = seedPetitions()[0].responseChecks;
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
  private snapshot(s: LocalState, now = Date.now()): Snapshot {
    const profile = s.profiles.find((p) => p.id === s.session) ?? null;
    const communities = s.communities ?? seedCommunities();
    return clone({
      profile,
      drafts: (s.drafts ?? [])
        .filter((d) => d.userId === s.session)
        .map(({ userId: _private, ...d }) => d),
      petitions: s.petitions
        .filter((p) => p.status !== 'archived' && (p.status !== 'draft' || canManage(p, profile)))
        .map((p) => ({
          ...p,
          qualification: {
            ...(p.qualification ?? emptyQualification()),
            affidavitCount: (s.affidavits ?? []).filter((a) => a.petitionId === p.id).length,
            acceptedAffidavits: (s.affidavits ?? []).filter(
              (a) => a.petitionId === p.id && a.status === 'accepted',
            ).length,
          },
          recordedSignatures: (s.receipts ?? []).filter((r) => r.petitionId === p.id).length,
          acceptedSignatures: (s.receipts ?? []).filter(
            (r) => r.petitionId === p.id && r.status === 'accepted',
          ).length,
          // Velocity is a rolling window, not a lifetime tally, so Trending cannot decay into
          // "most signed ever". Mirrors the 7-day interval used by the SQL snapshot.
          recentSignatures:
            p.sampleVelocity +
            s.signatures.filter(
              (x) =>
                x.petitionId === p.id && now - Date.parse(x.signedAt ?? '') < VELOCITY_WINDOW_MS,
            ).length,
          deliveries: p.deliveries ?? [],
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
      following: s.follows?.[s.session ?? ''] ?? [],
      // Only your own offer comes back here. Everyone else's is organizer-only, via volunteers().
      volunteering: (s.volunteers ?? [])
        .filter((v) => v.userId === s.session)
        .map((v) => ({ petitionId: v.petitionId, roles: v.roles, note: v.note })),
      signed: s.signatures.filter((x) => x.userId === s.session).map((x) => x.petitionId),
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
  async affidavits(petitionId: string): Promise<Affidavit[]> {
    const s = await this.read();
    if (!s.session) throw new Error('Sign in to access your affidavits.');
    return clone(
      (s.affidavits ?? [])
        .filter((a) => a.petitionId === petitionId && a.userId === s.session)
        .map(({ userId: _private, ...a }) => a),
    );
  }
  async receipt(petitionId: string) {
    const s = await this.read();
    if (!s.session) throw new Error('Sign in to access your private receipt.');
    const receipt = (s.receipts ?? []).find(
      (r) => r.userId === s.session && r.petitionId === petitionId,
    );
    if (!receipt) return null;
    const { userId: _private, ...result } = receipt;
    return clone(result);
  }
  async vault() {
    const s = await this.read();
    if (!s.session) throw new Error('Sign in to access your private vault.');
    return clone(s.vaults?.[s.session] ?? null);
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
        .filter((post) => post.space !== 'organizers' || moderator)
        .map(({ voters, positions, claimedById: _claimed, ...post }) => ({
          ...post,
          ...(post.options ? { myVote: s.session ? voters?.[s.session] : undefined } : {}),
          ...(post.kind === 'proposal'
            ? { myPosition: s.session ? positions?.[s.session] : undefined }
            : {}),
        })),
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
  async execute(c: Command) {
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
       * Signers and explicit followers, minus the actor. Saving is a private bookmark and no
       * longer subscribes anyone: a reading list and a notification channel are different asks.
       */
      const followers = (p: Petition) =>
        [
          ...s.signatures.filter((x) => x.petitionId === p.id).map((x) => x.userId),
          ...Object.entries(s.follows ?? {})
            .filter(([, ids]) => ids.includes(p.id))
            .map(([id]) => id),
        ].filter((id) => id !== user.id);
      /** Owner and collaborators, minus the actor. */
      const managers = (p: Petition) =>
        [p.ownerId, ...p.collaborators].filter((id) => id !== user.id);
      if (c.type === 'saveVault') {
        s.vaults = { ...s.vaults, [user.id]: envelopeSchema.parse(c.envelope) };
        return;
      }
      if (c.type === 'deleteVault') {
        if (s.vaults) delete s.vaults[user.id];
        return;
      }
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
        const post: StoredPost = {
          ...entry(v.body, v.kind, true),
          communityId: c.communityId,
          space: v.space,
          channel: v.channel,
          ...(v.kind === 'event' ? { eventAt: v.eventAt, location: v.location ?? '' } : {}),
          ...(v.kind === 'task' ? { taskStatus: 'open' as const } : {}),
          ...(v.kind === 'poll'
            ? {
                options: v.options,
                votes: Object.fromEntries((v.options ?? []).map((o) => [o, 0])),
                voters: {},
              }
            : {}),
          ...(v.kind === 'proposal' ? { support: 0, oppose: 0, positions: {} } : {}),
          ...(v.kind === 'document' ? { url: v.url } : {}),
        };
        s.posts[c.communityId] = [...(s.posts[c.communityId] ?? []), post];
        return;
      }
      if (c.type === 'communityInteract') {
        if (!user.joined.includes(c.communityId))
          throw new Error('Join the community to take part.');
        const post = (s.posts[c.communityId] ?? []).find((x) => x.id === c.postId);
        if (!post) throw new Error('That post is no longer here.');
        if (post.removed) throw new Error('That post was removed.');
        if (c.action === 'vote') {
          if (!post.options?.length) throw new Error('That post is not a poll.');
          if (!c.option || !post.options.includes(c.option))
            throw new Error('Choose one of the listed options.');
          const voters = (post.voters ??= {});
          const previous = voters[user.id];
          if (previous === c.option) throw new Error('You already chose that option.');
          post.votes ??= {};
          if (previous) post.votes[previous] = Math.max(0, (post.votes[previous] ?? 0) - 1);
          post.votes[c.option] = (post.votes[c.option] ?? 0) + 1;
          voters[user.id] = c.option;
          return;
        }
        if (c.action === 'support' || c.action === 'oppose' || c.action === 'withdraw') {
          if (post.kind !== 'proposal') throw new Error('That post is not a proposal.');
          const positions = (post.positions ??= {});
          const previous = positions[user.id];
          const tally = (position: 'support' | 'oppose', delta: number) => {
            if (position === 'support') post.support = Math.max(0, (post.support ?? 0) + delta);
            else post.oppose = Math.max(0, (post.oppose ?? 0) + delta);
          };
          if (c.action === 'withdraw') {
            if (!previous) throw new Error('You have not taken a position on this proposal.');
            tally(previous, -1);
            delete positions[user.id];
            return;
          }
          if (previous === c.action) throw new Error('You already took that position.');
          if (previous) tally(previous, -1);
          tally(c.action, 1);
          positions[user.id] = c.action;
          return;
        }
        if (post.kind !== 'task') throw new Error('That post is not a task.');
        if (c.action === 'claim') {
          if (post.taskStatus !== 'open') throw new Error('Someone is already on this task.');
          post.taskStatus = 'claimed';
          post.claimedById = user.id;
          post.claimedName = user.name;
          return;
        }
        // Releasing and completing belong to whoever took the task on, or to a moderator who has
        // to unblock a board when a volunteer disappears.
        const mine = post.claimedById === user.id;
        const moderator = communities.some(
          (x) =>
            x.id === c.communityId && (x.ownerId === user.id || x.moderators.includes(user.id)),
        );
        if (!mine && !moderator) throw new Error('Only the person who claimed this can change it.');
        if (c.action === 'release') {
          if (post.taskStatus !== 'claimed') throw new Error('This task is not claimed.');
          post.taskStatus = 'open';
          delete post.claimedById;
          delete post.claimedName;
          return;
        }
        if (post.taskStatus === 'done') throw new Error('This task is already done.');
        post.taskStatus = 'done';
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
      if (c.type === 'create') {
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
          discussion: [],
          responses: [],
          responseChecks: [{ ask: d.action, status: 'not_reviewed', note: '' }],
        });
        if (c.draftId)
          s.drafts = (s.drafts ?? []).filter((d) => d.id !== c.draftId || d.userId !== user.id);
        if (c.publish && !user.badges.includes('Change starter'))
          user.badges.push('Change starter');
        return id;
      }
      const p = s.petitions.find((p) => p.id === c.petitionId);
      if (!p) throw new Error('Petition not found.');
      if (p.status === 'draft' && !canManage(p, user)) throw new Error('This draft is private.');
      // Archived petitions have left every view, so nothing further can be done to them.
      if (p.status === 'archived') throw new Error('This petition was archived by its organizer.');
      if (c.type === 'affidavit') {
        if (!canManage(p, user)) throw new Error('Organizer or collaborator permission required.');
        if (!p.qualification?.details)
          throw new Error('Configure the legal requirements before submitting an affidavit.');
        const a = affidavitSubmissionSchema.parse(c.submission);
        if (
          a.petitionId !== p.id ||
          a.declaration !== p.qualification.details.circulatorDeclaration
        )
          throw new Error('The required affidavit text changed. Reopen the form.');
        if (p.qualification.details.notarization === 'required' && !a.notarizationProvided)
          throw new Error('A notarized document reference is required for this petition.');
        if (!s.vaults?.[user.id]) throw new Error('Set up your private signature vault first.');
        if ((s.affidavits ?? []).some((item) => item.id === a.id))
          throw new Error('This affidavit was already submitted.');
        if (
          a.signatureIds.some(
            (id) => !(s.receipts ?? []).some((r) => r.id === id && r.petitionId === p.id),
          )
        )
          throw new Error('Select only signatures with private records for this petition.');
        s.affidavits = [
          ...(s.affidavits ?? []),
          {
            ...a,
            userId: user.id,
            status: 'pending',
            reviewNote: '',
            submittedAt: new Date().toISOString(),
          },
        ];
        return;
      }
      if (c.type === 'qualification') {
        if (!canManage(p, user)) throw new Error('Organizer permission required.');
        if ((s.receipts ?? []).some((r) => r.petitionId === p.id))
          throw new Error(
            'Legal requirements are locked after signatory records exist. Create a new petition for a new measure.',
          );
        const details = qualificationSchema.parse(c.details);
        const reason = postSchema.parse(c.reason);
        const previous = p.qualification?.details;
        p.qualification = { ...emptyQualification(), details, status: 'pending' };
        p.edits.push(
          entry(
            `Legal requirements submitted for review. ${reason}\nPrevious requirements: ${previous ? JSON.stringify(previous) : 'None supplied'}`,
            'legal requirements',
          ),
        );
        return;
      }
      if (c.type === 'save') {
        const saved = s.saves[user.id] ?? [];
        const exists = saved.includes(p.id);
        s.saves[user.id] = exists ? saved.filter((id) => id !== p.id) : [...saved, p.id];
        p.saves += exists ? -1 : 1;
        return;
      }
      if (c.type === 'follow') {
        const follows = (s.follows ??= {});
        const mine = follows[user.id] ?? [];
        follows[user.id] = mine.includes(p.id) ? mine.filter((id) => id !== p.id) : [...mine, p.id];
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
          // Volunteering is a commitment to the petition, so it subscribes you to its updates.
          const follows = (s.follows ??= {});
          const mine = follows[user.id] ?? [];
          if (!mine.includes(p.id)) follows[user.id] = [...mine, p.id];
        }
        notify(managers(p), `${user.name} offered to help with ${unique.join(', ')}.`, 'volunteer');
        return;
      }
      if (c.type === 'sign') {
        const error = signingError(p, this.snapshot(s), c.identity);
        if (error) throw new Error(error);
        if (!p.qualification?.details)
          throw new Error(
            'The organizer must configure all four legal requirements before signatures can be recorded.',
          );
        const submission = validateSubmission(p, c.submission);
        if (!s.vaults?.[user.id])
          throw new Error('Set up your private signature vault in Profile first.');
        const signatureId = this.uuid();
        const shownAs = publicName(user.name, c.identity);
        s.receipts = [
          ...(s.receipts ?? []),
          {
            ...submission,
            id: signatureId,
            userId: user.id,
            petitionId: p.id,
            submittedAt: new Date().toISOString(),
            status: 'pending',
            reviewNote: '',
          },
        ];
        s.signatures.push({
          id: signatureId,
          petitionId: p.id,
          userId: user.id,
          signedAt: new Date().toISOString(),
          displayName: shownAs,
          identity: c.identity,
        });
        if (
          s.signatures.filter((x) => x.userId === user.id).length >= 5 &&
          !user.badges.includes('Showing up')
        )
          user.badges.push('Showing up');
        const before = p.count;
        p.count++;
        if (!user.badges.includes('First voice')) user.badges.push('First voice');
        // Signing subscribes you to the petition: nobody signs something and then wants silence.
        const signerFollows = (s.follows ??= {});
        const followed = signerFollows[user.id] ?? [];
        if (!followed.includes(p.id)) signerFollows[user.id] = [...followed, p.id];
        notify(
          [user.id],
          `Your signature on “${p.title}” was recorded for review. Your public identity is ${shownAs}.`,
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
        if ((s.affidavits ?? []).some((a) => a.signatureIds.includes(signature.id)))
          throw new Error(
            'This signature is already part of a submitted circulator affidavit and cannot be withdrawn here. Contact the organizer.',
          );
        s.signatures = s.signatures.filter((x) => x !== signature);
        s.receipts = (s.receipts ?? []).filter((r) => r.id !== signature.id);
        // Never fall below the fictional seed baseline, which is not made of real signatures.
        p.count = Math.max(p.sampleCount, p.count - 1);
        notify(
          [user.id],
          `You withdrew your signature from “${p.title}”. It is no longer counted or shown publicly, and your private record was deleted.`,
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
        s.reports.push({
          id: this.uuid(),
          petitionId: p.id,
          userId: user.id,
          reason: postSchema.parse(c.reason),
          status: 'submitted',
          appeal: '',
        });
        return;
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
      if (c.type === 'endorse') {
        const community = communities.find((x) => x.id === c.communityId && x.ownerId === user.id);
        if (!community) throw new Error('Only a community owner may endorse on its behalf.');
        if (p.endorsements.some((e) => e.author === community.name))
          throw new Error('This community has already endorsed the petition.');
        p.endorsements.push({
          ...entry(`${community.name} endorses this requested action.`, 'endorsement'),
          author: community.name,
        });
        notify(managers(p), `${community.name} endorsed “${p.title}”.`, 'endorsement');
        return;
      }
      if (!canManage(p, user))
        throw new Error('Only the owner or an authorized collaborator can manage this petition.');
      if (c.type === 'update') {
        p.updates.unshift(entry(c.body, 'update', true));
        notify(followers(p), `New update on “${p.title}” from ${user.name}.`, 'update');
        return;
      }
      if (c.type === 'publish') {
        if (p.status !== 'draft') throw new Error('Only drafts can be published.');
        draftSchema.parse(p);
        p.status = 'active';
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
        if (changed.includes('action')) {
          const previousChecks = (p.responseChecks ?? []).map(
            (check) => `${check.ask} (${check.status})`,
          );
          p.responseChecks = [{ ask: p.action.slice(0, 240), status: 'not_reviewed', note: '' }];
          p.edits.unshift(
            entry(
              `Response comparison reset because the requested action changed. Previous: ${previousChecks.join('; ') || 'not configured'}.`,
              'response comparison',
              true,
            ),
          );
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
      if (c.type === 'responseChecks') {
        const previous = p.responseChecks ?? [];
        p.responseChecks = prepareResponseChecks(p, c.checks, user.name, new Date().toISOString());
        p.edits.unshift(
          entry(
            `Organizer revised the request-to-response comparison. Previous checks: ${previous.length ? previous.map((check) => `${check.ask} (${check.status})`).join('; ') : 'none recorded'}. This is the organizer's reading of a response, not proof that work was completed.`,
            'response comparison',
            true,
          ),
        );
        notify(followers(p), `The response comparison on “${p.title}” was updated.`, 'edit');
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
