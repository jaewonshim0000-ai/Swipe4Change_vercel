import type { SignatureReceipt, SignatureSubmission } from './signature-record';
import type { LookupRequest, LookupResponse } from '../../supabase/functions/_shared/lookup';
import { petitionTopics } from '../../supabase/functions/_shared/civic-rules';
import type { ScreenCategory } from '../../supabase/functions/_shared/civic-rules';
export const topics = petitionTopics;
export type Topic = (typeof topics)[number];
export const verificationModes = ['account', 'email', 'community', 'location', 'custom'] as const;
export type Verification = (typeof verificationModes)[number];
export const identityModes = ['full_name', 'first_name_last_initial', 'anonymous'] as const;
export type Identity = (typeof identityModes)[number];
export type Status = 'draft' | 'active' | 'closed' | 'successful' | 'archived';
export const identityLabels: Record<Identity, string> = {
  full_name: 'Full name',
  first_name_last_initial: 'First name + last initial',
  anonymous: 'Anonymous',
};
export const verificationLabels: Record<Verification, string> = {
  account: 'Account required',
  email: 'Verified email required',
  community: 'Community members',
  location: 'Location approval required',
  custom: 'Manager-reviewed eligibility',
};
export const volunteerRoles = ['outreach', 'design', 'research', 'canvassing'] as const;
export type VolunteerRole = (typeof volunteerRoles)[number];
export const volunteerRoleLabels: Record<VolunteerRole, string> = {
  outreach: 'Outreach',
  design: 'Design and media',
  research: 'Research',
  canvassing: 'Canvassing',
};
/**
 * An offer of help, visible to the petition's organizers by the name on the volunteer's profile.
 * Volunteering is a deliberate introduction, so unlike a signature it is never anonymous — the UI
 * says so before the offer is made. Contact details are never collected or shown.
 */
export interface Volunteer {
  id: string;
  petitionId: string;
  name: string;
  roles: VolunteerRole[];
  note: string;
  date: string;
}
export interface Profile {
  id: string;
  name: string;
  city: string;
  interests: Topic[];
  joined: string[];
  onboarded: boolean;
  emailVerified: boolean;
  locationApproved: boolean;
  badges: string[];
  bio?: string;
  useSigningHistory?: boolean;
}
export interface Community {
  id: string;
  name: string;
  description: string;
  city: string;
  topic: Topic;
  members: number;
  /** Fictional seed headcount included in `members`. Zero for communities people actually create. */
  sampleMembers: number;
  ownerId: string;
  /** Members the owner has granted post-removal rights. The owner is always implicitly included. */
  moderators: string[];
}
export interface Entry {
  id: string;
  body: string;
  author: string;
  date: string;
  kind: string;
  /**
   * Author profile id, present on entries a person can later remove. Only set where the author's
   * name is already public (discussion, community posts, organizer updates and responses); never
   * on notifications, endorsements or anything projected from a signature.
   */
  authorId?: string;
  removed?: boolean;
}
export interface Response extends Entry {
  verification: 'unverified' | 'pending' | 'verified';
  organization: string;
  /** The delivery this answers, when the organizer recorded one. */
  deliveryId?: string;
}
export const deliveryMethods = ['email', 'portal', 'in_person', 'mail'] as const;
export type DeliveryMethod = (typeof deliveryMethods)[number];
export const deliveryMethodLabels: Record<DeliveryMethod, string> = {
  email: 'Email',
  portal: 'Online portal or form',
  in_person: 'In person or at a meeting',
  mail: 'Posted mail',
};
/**
 * A record that the petition actually left the app and reached the office it names.
 *
 * A petition nobody sends is a well-designed dead end, so delivery is a first-class event rather
 * than something an organizer mentions in an update. The counts and names are a SNAPSHOT taken at
 * the moment of delivery: the packet has to say what was actually sent, not what the petition has
 * grown into since. Signatories are stored exactly as each signer chose to appear in public.
 */
export interface Delivery {
  id: string;
  petitionId: string;
  recipient: string;
  method: DeliveryMethod;
  deliveredBy: string;
  deliveredAt: string;
  note: string;
  signatureCount: number;
  signatories: string[];
}
export interface Source {
  label: string;
  url: string;
}
export interface Petition {
  id: string;
  ownerId: string;
  creator: string;
  collaborators: string[];
  title: string;
  summary: string;
  problem: string;
  action: string;
  recipient: string;
  topic: Topic;
  city: string;
  communityId: string;
  goal: number;
  deadline: string;
  evidence: Source[];
  verification: Verification;
  identities: Identity[];
  customRule: string;
  status: Status;
  count: number;
  sampleCount: number;
  /** Real signatures that arrived through a supporter's share link. Public aggregate only. */
  viaShares: number;
  saves: number;
  /** Public aggregate. Who volunteered is visible only to the petition's organizers. */
  volunteerCount: number;
  /** Fictional seed headcount included in `volunteerCount`. Zero for petitions people create. */
  sampleVolunteers: number;
  /** Fictional seed baseline for demo velocity. Real signatures are counted in a rolling window. */
  sampleVelocity: number;
  /** Derived: sampleVelocity plus real signatures inside the trailing window. Never stored raw. */
  recentSignatures: number;
  createdAt: string;
  /**
   * The organizer's own fundraising page, opened outside the app. Swipe4Change never processes,
   * holds or verifies money. Absent when the organizer has not added one.
   */
  donationUrl?: string;
  /** The organizer's photo of the problem, stripped of location metadata. Absent: topic image. */
  photo?: PetitionPhoto;
  /**
   * Set while the automatic check holds a new or reworded petition out of public view; only its
   * organizers receive it, so they can see why and fix the wording.
   */
  heldFor?: ScreenCategory[];
  /** Hosted only: the server has not finished checking this petition's wording yet. */
  checking?: boolean;
  /**
   * Set when the AI review of a report flagged the petition. It is then out of public view until
   * a trusted reviewer decides; only its organizers still receive it, so they can see why.
   */
  hidden?: boolean;
  /**
   * Hidden hashtags an AI model generated from the petition's wording. Never shown in the app;
   * the For You ranking reads them. Absent until the model has tagged it, and cleared whenever the
   * wording changes; meanwhile the ranking derives tags from the words (src/domain/tags.ts).
   */
  tags?: string[];
  /** Recorded hand-offs to the recipient, newest first. */
  deliveries: Delivery[];
  updates: Entry[];
  edits: Entry[];
  endorsements: Entry[];
  discussion: Entry[];
  responses: Response[];
}
export interface PublicSignature {
  id: string;
  petitionId: string;
  displayName: string;
  identity: Identity;
}
/**
 * A community is three zones with different authority, not one chat log:
 *   discussion    — members post, anyone can read
 *   announcements — moderators post in the community's voice, anyone can read
 *   organizers    — a private working room; only moderators can read or post
 */
export const communitySpaces = ['discussion', 'announcements', 'organizers'] as const;
export type CommunitySpace = (typeof communitySpaces)[number];
export const spaceLabels: Record<CommunitySpace, string> = {
  discussion: 'Public discussion',
  announcements: 'Announcements',
  organizers: 'Organizer space',
};
export const postKinds = ['question', 'idea', 'experience', 'announcement', 'event'] as const;
export type PostKind = (typeof postKinds)[number];
export const postKindLabels: Record<PostKind, string> = {
  question: 'Question',
  idea: 'Idea',
  experience: 'Experience',
  announcement: 'Announcement',
  event: 'Event',
};
/** Kinds only a moderator may post, because they speak for the community rather than a member. */
export const moderatorOnlyKinds: PostKind[] = ['announcement'];
/**
 * One record behind every community surface. The events list is event posts sorted by date and a
 * channel is a filter, rather than separate subsystems.
 */
export interface CommunityPost extends Entry {
  communityId: string;
  space: CommunitySpace;
  /** Topic channel inside a space. Empty string means the space's general channel. */
  channel: string;
  /** Event posts only. */
  eventAt?: string;
  location?: string;
}
/**
 * A moderation report on a community post. The reporter is deliberately not identified to
 * moderators: naming them turns reporting into a confrontation between neighbours.
 */
export interface PostReport {
  id: string;
  communityId: string;
  postId: string;
  postBody: string;
  postAuthor: string;
  reason: string;
  status: 'open' | 'actioned' | 'dismissed';
  date: string;
}
export interface Report {
  id: string;
  petitionId: string;
  reason: string;
  status: 'submitted' | 'reviewed' | 'appealed';
  appeal: string;
  /** The AI review of the reported petition. `pending` until it has run; then a person decides. */
  screening?: 'pending' | 'clear' | 'flagged';
}
/**
 * Your ripple: the people who signed through your share link, and everyone they brought in after
 * them. Only counts ever leave the server — never who signed through whom.
 */
export interface Ripple {
  /** Opaque code carried in your share links. It identifies you to the server, not to readers. */
  code: string;
  petitions: { petitionId: string; direct: number; further: number }[];
}
export interface Snapshot {
  drafts?: SavedDraft[];
  profile: Profile | null;
  petitions: Petition[];
  communities: Community[];
  /** Saving is following: saved petitions send their updates to this account. */
  saved: string[];
  /** Present only for a signed-in account. */
  ripple: Ripple | null;
  /** This account's own offers of help. Other people's offers are organizer-only. */
  volunteering: { petitionId: string; roles: VolunteerRole[]; note: string }[];
  signed: string[];
  signatures: PublicSignature[];
  reports: Report[];
  notifications: Entry[];
  customApprovals: string[];
}
export type Draft = Pick<
  Petition,
  | 'title'
  | 'summary'
  | 'problem'
  | 'action'
  | 'recipient'
  | 'topic'
  | 'city'
  | 'communityId'
  | 'goal'
  | 'deadline'
  | 'evidence'
  | 'verification'
  | 'identities'
  | 'customRule'
>;
/**
 * Fields an organizer may revise after publishing. `topic` and `communityId` are deliberately
 * absent: they define the audience a petition was signed into, so changing them would retarget
 * existing signatures. The rule fields below additionally lock once a signature exists.
 */
export const editableFields = [
  'title',
  'summary',
  'problem',
  'action',
  'recipient',
  'city',
  'goal',
  'deadline',
  'evidence',
  'verification',
  'identities',
  'customRule',
] as const satisfies readonly (keyof Draft)[];
export const ruleFields = ['verification', 'identities', 'customRule'] as const;
export type EditableField = (typeof editableFields)[number];
export type EditPatch = Partial<Pick<Draft, EditableField>>;
export const fieldLabels: Record<EditableField, string> = {
  title: 'Title',
  summary: 'Summary',
  problem: 'Problem',
  action: 'Requested action',
  recipient: 'Recipient',
  city: 'Location',
  goal: 'Signature goal',
  deadline: 'Deadline',
  evidence: 'Sources',
  verification: 'Verification requirement',
  identities: 'Allowed public identities',
  customRule: 'Custom eligibility rule',
};
export type Command =
  | { type: 'profile'; name: string; bio: string; useSigningHistory: boolean }
  | { type: 'saveDraft'; id: string; draft: Draft; step: number }
  | { type: 'deleteDraft'; id: string }
  | { type: 'onboard'; interests: Topic[]; city: string }
  | { type: 'save'; petitionId: string }
  | { type: 'volunteer'; petitionId: string; roles: VolunteerRole[]; note: string }
  | { type: 'join'; communityId: string }
  | { type: 'create'; draft: Draft; publish: boolean; draftId?: string }
  | { type: 'publish'; petitionId: string }
  | {
      type: 'sign';
      petitionId: string;
      identity: Identity;
      submission: SignatureSubmission;
      /** Ripple code from the share link this signer arrived through, if any. */
      via?: string;
    }
  | { type: 'withdraw'; petitionId: string }
  | { type: 'update'; petitionId: string; body: string }
  | { type: 'edit'; petitionId: string; patch: EditPatch; reason: string }
  | {
      type: 'createCommunity';
      name: string;
      description: string;
      city: string;
      topic: Topic;
    }
  | { type: 'moderator'; communityId: string; profileId: string; grant: boolean }
  | {
      type: 'removeEntry';
      scope: 'discussion' | 'update' | 'response' | 'communityPost';
      entryId: string;
      petitionId?: string;
      communityId?: string;
    }
  | { type: 'withdrawReport'; reportId: string }
  | {
      type: 'discussion';
      petitionId: string;
      body: string;
      kind: 'question' | 'idea' | 'experience';
    }
  | {
      type: 'communityPost';
      communityId: string;
      body: string;
      kind: PostKind;
      space: CommunitySpace;
      channel: string;
      eventAt?: string;
      location?: string;
    }
  | { type: 'reportPost'; communityId: string; postId: string; reason: string }
  | {
      type: 'resolvePostReport';
      communityId: string;
      reportId: string;
      action: 'actioned' | 'dismissed';
    }
  | { type: 'endorse'; petitionId: string; communityId: string }
  | { type: 'report'; petitionId: string; reason: string }
  /** An empty url removes the link. */
  | { type: 'donationLink'; petitionId: string; url: string }
  /** Sets, replaces or (with null) removes the petition's photo; every change is public history. */
  | { type: 'photo'; petitionId: string; photo: PetitionPhoto | null }
  | { type: 'appeal'; reportId: string; body: string }
  | { type: 'deliver'; petitionId: string; method: DeliveryMethod; note: string }
  | {
      type: 'response';
      petitionId: string;
      body: string;
      organization: string;
      deliveryId?: string;
    }
  | { type: 'close'; petitionId: string; status: 'closed' | 'successful' | 'archived' }
  | { type: 'collaborator'; petitionId: string; profileId: string }
  | { type: 'requestEligibility'; petitionId: string; statement: string }
  | { type: 'reviewEligibility'; petitionId: string; requestId: string; approved: boolean };
export interface EligibilityRequest {
  id: string;
  petitionId: string;
  name: string;
  statement: string;
  status: 'pending' | 'approved' | 'declined';
}
export interface SavedDraft {
  id: string;
  draft: Draft;
  step: number;
  updatedAt: string;
}
/** A petition photo: where it is stored, and the description screen readers announce. */
export interface PetitionPhoto {
  url: string;
  alt: string;
}
export interface Adapter {
  /** Stores a metadata-free JPEG and returns the URL to save with the photo command. */
  uploadPhoto(jpegBase64: string): Promise<string>;
  /** Elected officials for a place, or the AI recipient finder; both run on a server. */
  lookup(request: LookupRequest): Promise<LookupResponse>;
  receipt(petitionId: string): Promise<SignatureReceipt | null>;
  load(): Promise<Snapshot>;
  execute(command: Command): Promise<string | void>;
  signIn(account: string): Promise<void>;
  signOut(): Promise<void>;
  reset(): Promise<void>;
  /** Live accounts only: removes personal records and photos; public writing stays unattributed. */
  deleteAccount(): Promise<void>;
  requests(petitionId: string): Promise<EligibilityRequest[]>;
  volunteers(petitionId: string): Promise<Volunteer[]>;
  communityPosts(communityId: string): Promise<CommunityPost[]>;
  /** Moderator-only queue of reported posts in one community. */
  communityReports(communityId: string): Promise<PostReport[]>;
}
