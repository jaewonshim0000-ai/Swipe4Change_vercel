import type Anthropic from '@anthropic-ai/sdk';
import {
  DraftSuggestion,
  draftWithClaude,
  findRecipientWithClaude,
  RecipientQuestion,
  RecipientSuggestion,
} from './civic-ai.ts';
import { OfficialsResult, officialsAt } from './officials.ts';

/**
 * The civic lookups the app asks a server for. Shared by the local demo's API route
 * (app/api/lookup+api.ts) and the civic-lookup Edge Function, so both validate the same way.
 */
export type LookupRequest =
  | { task: 'officials'; lat: number; lon: number }
  | { task: 'recipient'; lat?: number; lon?: number; question: RecipientQuestion }
  | { task: 'draft'; description: string; city: string };

export type LookupResponse =
  | OfficialsResult
  | { suggestion: RecipientSuggestion | null; officials: OfficialsResult['officials'] }
  | { draft: DraftSuggestion | null };

const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
const coord = (v: unknown, limit: number) =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= limit;

/** Rejects anything that is not exactly a lookup request, before any outside service is called. */
export function parseLookup(body: unknown): LookupRequest | null {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== 'object') return null;
  const located = coord(b.lat, 90) && coord(b.lon, 180);
  if (b.task === 'officials')
    return located ? { task: 'officials', lat: b.lat as number, lon: b.lon as number } : null;
  if (b.task === 'draft')
    return text(b.description, 3000) &&
      (b.description as string).trim().length >= 15 &&
      text(b.city ?? '', 100)
      ? { task: 'draft', description: b.description as string, city: (b.city as string) ?? '' }
      : null;
  const q = b.question as Record<string, unknown> | undefined;
  if (
    b.task !== 'recipient' ||
    !q ||
    !text(q.title, 200) ||
    !text(q.problem, 5000) ||
    !text(q.action, 1000) ||
    !text(q.city, 100) ||
    `${q.problem}${q.action}`.trim().length < 10
  )
    return null;
  const question = {
    title: q.title as string,
    problem: q.problem as string,
    action: q.action as string,
    city: q.city as string,
  };
  return located
    ? { task: 'recipient', lat: b.lat as number, lon: b.lon as number, question }
    : { task: 'recipient', question };
}

export async function runLookup(
  request: LookupRequest,
  env: { claude: Anthropic | null; openStatesKey?: string },
): Promise<LookupResponse> {
  if (request.task === 'officials') return officialsAt(request.lat, request.lon, env.openStatesKey);
  if (!env.claude) throw new Error('Add ANTHROPIC_API_KEY to enable the AI helpers.');
  if (request.task === 'draft')
    return { draft: await draftWithClaude(env.claude, request.description, request.city) };
  // The finder still works for a place with no district lookup (e.g. a fictional sample city).
  const officials =
    request.lat !== undefined && request.lon !== undefined
      ? ((await officialsAt(request.lat, request.lon, env.openStatesKey).catch(() => null))
          ?.officials ?? [])
      : [];
  return {
    suggestion: await findRecipientWithClaude(env.claude, request.question, officials),
    officials,
  };
}
