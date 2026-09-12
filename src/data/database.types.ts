import type { Affidavit } from '../domain/affidavit';
import type { SignatureReceipt } from '../domain/signature-record';
import type { EncryptedVault } from '../domain/signatory';
/** Client RPC contract. Public payloads never include Clerk subjects or verification evidence. */
import type { Tables } from './tables.generated';
import type { Command, EligibilityRequest, Entry, Snapshot } from '../domain/model';
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export interface Database {
  public: {
    Tables: Tables;
    Views: Record<string, never>;
    Functions: {
      circulator_affidavits: { Args: { petition_id: string }; Returns: Affidavit[] };
      signature_receipt: { Args: { petition_id: string }; Returns: SignatureReceipt | null };
      signature_vault: { Args: Record<string, never>; Returns: EncryptedVault | null };
      lookaware_snapshot: { Args: Record<string, never>; Returns: Snapshot };
      lookaware_command: { Args: { command: Command }; Returns: string | null };
      lookaware_requests: { Args: { petition_id: string }; Returns: EligibilityRequest[] };
      lookaware_community_posts: { Args: { community_id: string }; Returns: Entry[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
