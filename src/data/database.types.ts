import type { SignatureReceipt } from '../domain/signature-record';
/** Client RPC contract. Public payloads never include Clerk subjects or verification evidence. */
import type { Tables } from './tables.generated';
import type {
  Command,
  CommunityPost,
  EligibilityRequest,
  PostReport,
  Snapshot,
  Volunteer,
} from '../domain/model';
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export interface Database {
  public: {
    Tables: Tables;
    Views: Record<string, never>;
    Functions: {
      signature_receipt: { Args: { petition_id: string }; Returns: SignatureReceipt | null };
      lookaware_snapshot: { Args: Record<string, never>; Returns: Snapshot };
      lookaware_command: { Args: { command: Command }; Returns: string | null };
      lookaware_requests: { Args: { petition_id: string }; Returns: EligibilityRequest[] };
      lookaware_volunteers: { Args: { petition_id: string }; Returns: Volunteer[] };
      lookaware_community_posts: { Args: { community_id: string }; Returns: CommunityPost[] };
      lookaware_community_reports: { Args: { community_id: string }; Returns: PostReport[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
