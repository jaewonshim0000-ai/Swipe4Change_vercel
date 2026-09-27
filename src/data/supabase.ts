import { createClient } from '@supabase/supabase-js';
import { Adapter, Command } from '../domain/model';
import { Database } from './database.types';
/** Clerk's Supabase third-party integration validates tokens; no service credential enters the client. */
export function createSupabaseAdapter(getToken: () => Promise<string | null>): Adapter {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error('Set the public Supabase URL and anonymous key before selecting Supabase.');
  const db = createClient<Database>(url, key, {
    accessToken: getToken,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return {
    async receipt(petition_id: string) {
      const { data, error } = await db.rpc('signature_receipt', { petition_id });
      if (error) throw new Error(error.message);
      return data;
    },
    async load() {
      const { data, error } = await db.rpc('lookaware_snapshot', {});
      if (error) throw new Error(error.message);
      if (!data) throw new Error('No data returned.');
      return {
        ...data,
        notifications: data.notifications.map((entry) => ({
          ...entry,
          // Existing deployments still return the original system author name.
          author: entry.author === 'LookAware' ? 'Swipe4Change' : entry.author,
        })),
      };
    },
    async execute(command: Command) {
      const { data, error } = await db.rpc('lookaware_command', { command });
      if (error) throw new Error(error.message);
      return data ?? undefined;
    },
    async requests(petition_id: string) {
      const { data, error } = await db.rpc('lookaware_requests', { petition_id });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async volunteers(petition_id: string) {
      const { data, error } = await db.rpc('lookaware_volunteers', { petition_id });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async communityPosts(community_id: string) {
      const { data, error } = await db.rpc('lookaware_community_posts', { community_id });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async communityReports(community_id: string) {
      const { data, error } = await db.rpc('lookaware_community_reports', { community_id });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async signIn() {
      throw new Error('Use Clerk to sign in.');
    },
    async signOut() {
      throw new Error('Use Clerk to sign out.');
    },
    async reset() {
      throw new Error('Reset is available only in the local demo.');
    },
  };
}
