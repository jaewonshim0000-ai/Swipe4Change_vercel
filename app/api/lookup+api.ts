import Anthropic from '@anthropic-ai/sdk';
import { parseLookup, runLookup } from '../../supabase/functions/_shared/lookup';

let client: Anthropic | null = null;

/**
 * The local demo's civic lookups: elected officials for a place, and the AI recipient finder.
 * Keys (OPENSTATES_API_KEY, ANTHROPIC_API_KEY) are read from .env here and never reach the app
 * bundle. Hosted deployments use the civic-lookup Edge Function, so this refuses production.
 * ponytail: no auth or rate limit, which is why it is development-only.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') return new Response(null, { status: 404 });
  const lookup = parseLookup(await request.json().catch(() => null));
  if (!lookup) return Response.json({ error: 'Invalid request.' }, { status: 400 });
  if (process.env.ANTHROPIC_API_KEY) client ??= new Anthropic({ timeout: 90000, maxRetries: 1 });
  if (lookup.task !== 'officials' && !client)
    return Response.json(
      { error: 'Add ANTHROPIC_API_KEY to .env and restart to use the AI helpers.' },
      { status: 503 },
    );
  try {
    return Response.json(
      await runLookup(lookup, { claude: client, openStatesKey: process.env.OPENSTATES_API_KEY }),
    );
  } catch (error) {
    console.warn('Lookup failed:', error);
    if (error instanceof Anthropic.AuthenticationError)
      return Response.json({ error: 'The Anthropic API key was rejected.' }, { status: 503 });
    if (error instanceof Anthropic.RateLimitError)
      return Response.json({ error: 'The AI model is busy. Try again.' }, { status: 429 });
    return Response.json(
      { error: error instanceof Error ? error.message : 'The lookup failed.' },
      { status: 502 },
    );
  }
}
