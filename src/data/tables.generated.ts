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
  }>;
  petition_collaborators: Table<{
    id: string;
    petition_id: string;
    user_id: string;
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
  petition_qualification: Table<{
    petition_id: string;
    details: Json | null;
    status: string;
    review_note: string;
    updated_at: string;
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
  }>;
  profiles: Table<{
    id: string;
    name: string;
    city: string;
    onboarded: boolean;
    created_at: string;
    bio: string;
    avatar: string;
    accent: string;
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
