import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { screenWithClaude, tagWithClaude } from '../../supabase/functions/_shared/civic-ai';

const text = z.string().max(5000);
const petition = z.object({
  title: text,
  summary: text,
  problem: text,
  action: text,
  recipient: text,
});
const Body = z.discriminatedUnion('task', [
  z.object({
    task: z.literal('tags'),
    petition,
    vocabulary: z.array(z.string().max(40)).max(300),
  }),
  z.object({ task: z.literal('screen'), petition }),
]);

let client: Anthropic | null = null;

/**
 * The local demo's AI endpoint. The Expo dev server runs it, so ANTHROPIC_API_KEY (from .env)
 * stays on your machine and out of the app bundle. Hosted deployments use the ai-review Edge
 * Function instead, so this refuses to run in a production build.
 * ponytail: no auth or rate limit, which is why it is development-only.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') return new Response(null, { status: 404 });
  if (!process.env.ANTHROPIC_API_KEY)
    return Response.json(
      { error: 'Add ANTHROPIC_API_KEY to .env and restart to enable AI review.' },
      { status: 503 },
    );
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: 'Invalid request.' }, { status: 400 });
  client ??= new Anthropic({ timeout: 25000, maxRetries: 1 });
  try {
    return body.data.task === 'tags'
      ? Response.json({
          tags: await tagWithClaude(client, body.data.petition, body.data.vocabulary),
        })
      : Response.json({ categories: await screenWithClaude(client, body.data.petition) });
  } catch (error) {
    console.warn('AI review failed:', error);
    if (error instanceof Anthropic.AuthenticationError)
      return Response.json({ error: 'The Anthropic API key was rejected.' }, { status: 503 });
    if (error instanceof Anthropic.RateLimitError)
      return Response.json({ error: 'The AI model is busy. Try again.' }, { status: 429 });
    return Response.json({ error: 'The AI model could not review this.' }, { status: 502 });
  }
}
