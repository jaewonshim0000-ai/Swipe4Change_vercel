// Supabase Edge Function (Deno). Deploy: supabase functions deploy ai-review --no-verify-jwt
// Secret:  supabase secrets set ANTHROPIC_API_KEY=...
//
// It takes no input: it reviews whatever the database has queued (reported petitions, untagged
// petitions) and writes results through service-role-only functions. Callers can make it run
// sooner, never change what it decides, so it needs no user token (Clerk tokens are not Supabase
// JWTs, hence --no-verify-jwt).
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { runReview } from '../_shared/review.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});
const key = Deno.env.get('ANTHROPIC_API_KEY');
const claude = key ? new Anthropic({ apiKey: key, timeout: 25000, maxRetries: 1 }) : null;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const result = await runReview(
      {
        queue: () => call('ai_review_queue'),
        screened: (target, hits) => call('ai_apply_screening', { target, hits }),
        tagged: (target, tags, seen) => call('ai_apply_tags', { target, tags, seen }),
      },
      claude,
    );
    return Response.json(result, { headers: cors });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Review failed.' }, { status: 500, headers: cors });
  }
});
