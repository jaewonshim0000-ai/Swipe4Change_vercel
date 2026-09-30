import { createClient } from '@supabase/supabase-js';
import { Adapter, Command } from '../domain/model';
import { Database } from './database.types';
import { getBackendConfig } from './config';
/** Clerk's Supabase third-party integration validates tokens; no service credential enters the client. */
export function createSupabaseAdapter(getToken: () => Promise<string | null>): Adapter {
  const config = getBackendConfig();
  if (config.backend !== 'supabase')
    throw new Error('Select the Supabase backend before connecting.');
  const db = createClient<Database>(config.url, config.publicKey, {
    accessToken: getToken,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // Runs the AI review queue (report screening, hidden tags) in the ai-review Edge Function.
  const review = async () => {
    const { error } = await db.functions.invoke('ai-review');
    if (error) throw error;
  };
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
      if (command.type === 'report' && data) {
        // Wait for the review so the reporter hears the outcome. If it cannot run, the report
        // stays pending for a person, which the app says.
        await review().catch(() => undefined);
        const row = await db.from('reports').select('screening').eq('id', data).single();
        return row.data?.screening ?? 'pending';
      }
      // New or reworded petitions need tags; nobody waits on that.
      if (['create', 'edit', 'publish'].includes(command.type))
        void review().catch(() => undefined);
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
