// Supabase Edge Function (Deno). Deploy: supabase functions deploy civic-lookup --no-verify-jwt
// Secrets: supabase secrets set ANTHROPIC_API_KEY=... OPENSTATES_API_KEY=...
//
// Elected officials for a place, and the AI helpers (recipient finder, petition writer). Clerk
// tokens are not Supabase JWTs (hence --no-verify-jwt), so each AI request proves who is asking by calling claim_civic_lookup
// with the caller's own token: the database checks the Clerk session and allows 20 an hour.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { parseLookup, runLookup } from '../_shared/lookup.ts';

const key = Deno.env.get('ANTHROPIC_API_KEY');
const claude = key ? new Anthropic({ apiKey: key, timeout: 90000, maxRetries: 1 }) : null;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const fail = (error: string, status: number) => Response.json({ error }, { status, headers: cors });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const lookup = parseLookup(await request.json().catch(() => null));
  if (!lookup) return fail('Invalid request.', 400);
  // The AI helpers cost money per call; officials lookups do not.
  if (lookup.task !== 'officials') {
    const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false },
    });
    const { error } = await caller.rpc('claim_civic_lookup');
    if (error) return fail(error.message, 429);
  }
  try {
    return Response.json(
      await runLookup(lookup, { claude, openStatesKey: Deno.env.get('OPENSTATES_API_KEY') }),
      { headers: cors },
    );
  } catch (error) {
    console.error(error);
    return fail(error instanceof Error ? error.message : 'The lookup failed.', 502);
  }
});
