// Generated from the migration with npm run types:db. Do not edit by hand.
import type { Json } from './database.types';
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
export type Tables = {
  badges: Table<{
    id: string;
    name: string;
    description: string;
    created_at: string;
  }>;
  communities: Table<{
    id: string;
    owner_id: string;
    name: string;
    description: string;
    city: string;
    topic: string;
    sample_members: number;
    archived: boolean;
    created_at: string;
  }>;
  community_backing_votes: Table<{
    petition_id: string;
    community_id: string;
    user_id: string;
    support: boolean;
    created_at: string;
    updated_at: string;
  }>;
  community_members: Table<{
    id: string;
    community_id: string;
    user_id: string;
    role: string;
    active: boolean;
    created_at: string;
  }>;
  discussion_posts: Table<{
    id: string;
    petition_id: string | null;
    community_id: string | null;
    author_id: string;
    kind: string;
    body: string;
    archived: boolean;
    created_at: string;
    removed: boolean;
    space: string;
    channel: string;
    event_at: string | null;
    location: string;
  }>;
  notifications: Table<{
    id: string;
    user_id: string;
    body: string;
    kind: string;
    created_at: string;
  }>;
  official_responses: Table<{
    id: string;
    petition_id: string;
    author_id: string;
    body: string;
    organization: string;
    verification: string;
    created_at: string;
    removed: boolean;
    delivery_id: string | null;
  }>;
  petition_collaborators: Table<{
    id: string;
    petition_id: string;
    user_id: string;
    created_at: string;
  }>;
  petition_deliveries: Table<{
    id: string;
    petition_id: string;
    delivered_by: string;
    recipient: string;
    method: string;
    note: string;
    signature_count: number;
    signatories: Json;
    created_at: string;
  }>;
  petition_drafts: Table<{
    id: string;
    user_id: string;
    draft: Json;
    step: number;
    updated_at: string;
  }>;
  petition_edits: Table<{
    id: string;
    petition_id: string;
    author_id: string;
    body: string;
    previous_content: Json;
    created_at: string;
  }>;
  petition_endorsements: Table<{
    id: string;
    petition_id: string;
    community_id: string;
    body: string;
    created_at: string;
  }>;
  petition_saves: Table<{
    id: string;
    petition_id: string;
    user_id: string;
    created_at: string;
  }>;
  petition_sources: Table<{
    id: string;
    petition_id: string;
    label: string;
    url: string;
    created_at: string;
  }>;
  petition_updates: Table<{
    id: string;
    petition_id: string;
    author_id: string;
    body: string;
    created_at: string;
    removed: boolean;
  }>;
  petition_volunteers: Table<{
    id: string;
    petition_id: string;
    user_id: string;
    roles: string;
    note: string;
    created_at: string;
  }>;
  petitions: Table<{
    id: string;
    owner_id: string;
    community_id: string;
    content: Json;
    status: string;
    sample_count: number;
    sample_saves: number;
    sample_velocity: number;
    created_at: string;
    updated_at: string;
    sample_volunteers: number;
    hidden: boolean;
    ai_tags: string | null;
    screening: string;
    held_for: string | null;
  }>;
  post_reports: Table<{
    id: string;
    community_id: string;
    post_id: string;
    user_id: string;
    reason: string;
    status: string;
    created_at: string;
  }>;
  profiles: Table<{
    id: string;
    name: string;
    city: string;
    onboarded: boolean;
    created_at: string;
    bio: string;
    use_signing_history: boolean;
  }>;
  reports: Table<{
    id: string;
    petition_id: string;
    user_id: string;
    reason: string;
    status: string;
    appeal: string;
    created_at: string;
    screening: string;
  }>;
  signatures: Table<{
    id: string;
    petition_id: string;
    user_id: string;
    identity_mode: string;
    display_name: string;
    created_at: string;
  }>;
  topics: Table<{
    id: string;
    name: string;
    created_at: string;
  }>;
  user_badges: Table<{
    id: string;
    user_id: string;
    badge_id: string;
    created_at: string;
  }>;
  user_interests: Table<{
    id: string;
    user_id: string;
    topic_id: string;
    created_at: string;
  }>;
};
