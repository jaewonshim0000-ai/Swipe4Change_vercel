import { Affidavit, affidavitSubmissionSchema } from '../domain/affidavit';
import { emptyQualification, qualificationSchema } from '../domain/qualification';
import { SignatureReceipt, validateSubmission } from '../domain/signature-record';
import { EncryptedVault, envelopeSchema } from '../domain/signatory';
import {
  Adapter,
  Command,
  EligibilityRequest,
  Entry,
  Petition,
  Profile,
  PublicSignature,
  Report,
  Snapshot,
  SavedDraft,
} from '../domain/model';
import { canManage, draftSchema, postSchema, publicName, signingError } from '../domain/rules';
import { profileSchema } from '../domain/personalization';
import { z } from 'zod';
import { communities, demoIds, seedPetitions, seedProfiles } from './seed';
export interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
interface PrivateSignature extends PublicSignature {
  userId: string;
}
interface PrivateRequest extends EligibilityRequest {
  userId: string;
}
interface LocalState {
  affidavits?: (Affidavit & { userId: string })[];
  receipts?: (SignatureReceipt & { userId: string })[];
  vaults?: Record<string, EncryptedVault>;
  drafts?: (SavedDraft & { userId: string })[];
  version: 1;
  session: string | null;
  profiles: Profile[];
  petitions: Petition[];
  signatures: PrivateSignature[];
  saves: Record<string, string[]>;
  reports: (Report & { userId: string })[];
  requests: PrivateRequest[];
  posts: Record<string, Entry[]>;
  notifications: Record<string, Entry[]>;
}
export const STORAGE_KEY = 'lookaware.demo.v1';
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const initial = (): LocalState => ({
  version: 1,
  session: null,
  profiles: seedProfiles(),
  petitions: seedPetitions(),
  signatures: [],
  saves: {},
  reports: [],
  requests: [],
  posts: {},
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
  private snapshot(s: LocalState): Snapshot {
    const profile = s.profiles.find((p) => p.id === s.session) ?? null;
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
          responses: p.responses.filter(
            (r) => r.verification === 'verified' || canManage(p, profile),
          ),
        })),
      communities: communities.map((c) => ({
        ...c,
        members: c.members + s.profiles.filter((p) => p.joined.includes(c.id)).length,
      })),
      saved: s.saves[s.session ?? ''] ?? [],
      signed: s.signatures.filter((x) => x.userId === s.session).map((x) => x.petitionId),
      signatures: s.signatures.map(({ userId: _private, ...publicFields }) => publicFields),
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
  async communityPosts(id: string) {
    return clone((await this.read()).posts[id] ?? []);
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
      const entry = (body: string, kind: string): Entry => ({
        id: this.uuid(),
        body: postSchema.parse(body),
        author: user.name,
        date: new Date().toISOString(),
        kind,
      });
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
      if (c.type === 'communityPost') {
        if (!user.joined.includes(c.communityId)) throw new Error('Join the community to post.');
        s.posts[c.communityId] = [...(s.posts[c.communityId] ?? []), entry(c.body, c.kind)];
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
          count: 0,
          sampleCount: 0,
          saves: 0,
          recentSignatures: 0,
          createdAt: new Date().toISOString(),
          updates: [],
          edits: [],
          endorsements: [],
          discussion: [],
          responses: [],
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
          displayName: publicName(user.name, c.identity),
          identity: c.identity,
        });
        if (
          s.signatures.filter((x) => x.userId === user.id).length >= 5 &&
          !user.badges.includes('Showing up')
        )
          user.badges.push('Showing up');
        p.count++;
        p.recentSignatures++;
        if (!user.badges.includes('First voice')) user.badges.push('First voice');
        s.notifications[user.id] = [
          entry(
            `Your signature on “${p.title}” was recorded for review. Your public identity is ${publicName(user.name, c.identity)}.`,
            'signature',
          ),
          ...(s.notifications[user.id] ?? []),
        ];
        return;
      }
      if (c.type === 'discussion') {
        if (p.status !== 'active') throw new Error('Discussion is closed.');
        p.discussion.push(entry(c.body, c.kind));
        if (!user.badges.includes('Conversation starter')) user.badges.push('Conversation starter');
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
        return;
      }
      if (!canManage(p, user))
        throw new Error('Only the owner or an authorized collaborator can manage this petition.');
      if (c.type === 'update') {
        p.updates.unshift(entry(c.body, 'update'));
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
        const next = draftSchema.parse({
          ...p,
          title: c.title,
          action: c.action,
          verification: c.verification,
          identities: c.identities,
          customRule: c.customRule ?? p.customRule,
        });
        const changedRules =
          p.verification !== c.verification ||
          p.customRule !== (c.customRule ?? p.customRule) ||
          JSON.stringify(p.identities) !== JSON.stringify(c.identities);
        if (p.count > 0 && changedRules)
          throw new Error(
            'Signing rules are locked after the first signature. Create a new petition to change them.',
          );
        p.edits.unshift(
          entry(
            `Title: “${p.title}” → “${c.title}”. Action: “${p.action}” → “${c.action}”. ${changedRules ? 'Signing rules updated before any signatures. ' : ''}Reason: ${postSchema.parse(c.reason)}`,
            'material edit',
          ),
        );
        Object.assign(p, {
          title: next.title,
          action: next.action,
          verification: next.verification,
          identities: next.identities,
          customRule: next.customRule,
        });
        return;
      }
      if (c.type === 'response') {
        p.responses.push({
          ...entry(c.body, 'response'),
          organization: postSchema.parse(c.organization),
          verification: 'unverified',
        });
        return;
      }
      if (c.type === 'close') {
        if (p.status !== 'active') throw new Error('Only an active petition can be closed.');
        p.status = c.status;
        p.edits.unshift(
          entry(
            `Organizer marked this petition ${c.status}. This is an organizer report, not independent verification.`,
            'status',
          ),
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
        return;
      }
    });
  }
}
