import type { Affidavit, AffidavitSubmission } from './affidavit';
import type { Qualification, QualificationDetails } from './qualification';
import type { SignatureReceipt, SignatureSubmission } from './signature-record';
import type { EncryptedVault } from './signatory';
export const topics = [
  'Safer streets',
  'Environment',
  'Education',
  'Public spaces',
  'Accessibility',
] as const;
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
  avatar?: string;
  accent?: string;
  useSigningHistory?: boolean;
}
export interface Community {
  id: string;
  name: string;
  description: string;
  city: string;
  topic: Topic;
  members: number;
  ownerId: string;
}
export interface Entry {
  id: string;
  body: string;
  author: string;
  date: string;
  kind: string;
}
export interface Response extends Entry {
  verification: 'unverified' | 'pending' | 'verified';
  organization: string;
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
  qualification?: Qualification;
  recordedSignatures?: number;
  acceptedSignatures?: number;
  saves: number;
  recentSignatures: number;
  createdAt: string;
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
export interface Report {
  id: string;
  petitionId: string;
  reason: string;
  status: 'submitted' | 'reviewed' | 'appealed';
  appeal: string;
}
export interface Snapshot {
  drafts?: SavedDraft[];
  profile: Profile | null;
  petitions: Petition[];
  communities: Community[];
  saved: string[];
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
export type Command =
  | { type: 'affidavit'; petitionId: string; submission: AffidavitSubmission }
  | { type: 'qualification'; petitionId: string; details: QualificationDetails; reason: string }
  | { type: 'saveVault'; envelope: EncryptedVault }
  | { type: 'deleteVault' }
  | {
      type: 'profile';
      name: string;
      bio: string;
      avatar: string;
      accent: string;
      useSigningHistory: boolean;
    }
  | { type: 'saveDraft'; id: string; draft: Draft; step: number }
  | { type: 'deleteDraft'; id: string }
  | { type: 'onboard'; interests: Topic[]; city: string }
  | { type: 'save'; petitionId: string }
  | { type: 'join'; communityId: string }
  | { type: 'create'; draft: Draft; publish: boolean; draftId?: string }
  | { type: 'publish'; petitionId: string }
  | { type: 'sign'; petitionId: string; identity: Identity; submission?: SignatureSubmission }
  | { type: 'update'; petitionId: string; body: string }
  | {
      type: 'edit';
      petitionId: string;
      title: string;
      action: string;
      reason: string;
      verification: Verification;
      identities: Identity[];
      customRule?: string;
    }
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
      kind: 'question' | 'idea' | 'experience';
    }
  | { type: 'endorse'; petitionId: string; communityId: string }
  | { type: 'report'; petitionId: string; reason: string }
  | { type: 'appeal'; reportId: string; body: string }
  | { type: 'response'; petitionId: string; body: string; organization: string }
  | { type: 'close'; petitionId: string; status: 'closed' | 'successful' }
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
export interface Adapter {
  affidavits(petitionId: string): Promise<Affidavit[]>;
  receipt(petitionId: string): Promise<SignatureReceipt | null>;
  vault(): Promise<EncryptedVault | null>;
  load(): Promise<Snapshot>;
  execute(command: Command): Promise<string | void>;
  signIn(account: string): Promise<void>;
  signOut(): Promise<void>;
  reset(): Promise<void>;
  requests(petitionId: string): Promise<EligibilityRequest[]>;
  communityPosts(communityId: string): Promise<Entry[]>;
}
