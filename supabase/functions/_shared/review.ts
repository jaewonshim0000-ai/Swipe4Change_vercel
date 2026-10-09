import type Anthropic from '@anthropic-ai/sdk';
import { screenWithClaude, tagWithClaude } from './civic-ai.ts';
import {
  PetitionText,
  ScreenCategory,
  petitionBody,
  screenText,
  starterTags,
} from './civic-rules.ts';

/** What public.ai_review_queue() returns. */
export interface ReviewQueue {
  /** Petitions with reports awaiting review, each reviewed once for all of its reports. */
  reports: { petitionId: string; petition: PetitionText }[];
  /** Petitions without tags. `seen` guards against writing tags for wording that has changed. */
  petitions: { id: string; seen: string; petition: PetitionText }[];
  /** Tags already in use, so the model reuses them. */
  vocabulary: string[];
}
export interface ReviewStore {
  queue(): Promise<ReviewQueue>;
  screened(petitionId: string, categories: ScreenCategory[]): Promise<void>;
  tagged(petitionId: string, tags: string[], seen: string): Promise<void>;
  /** Newly published or reworded petitions waiting for their check (public.ai_publish_queue). */
  publishQueue(): Promise<{ id: string; seen: string; petition: PetitionText }[]>;
  /** Records a publication check for the wording that was read (public.ai_apply_publish_screening). */
  checked(petitionId: string, categories: ScreenCategory[], seen: string): Promise<void>;
}

/**
 * One pass over the AI queue. A report the model cannot review falls back to the keyword rules, so
 * a reporter never waits on an outage. A petition the model cannot tag stays untagged for the next
 * pass; the app ranks it from its words meanwhile. `claude` is null when no API key is configured.
 */
export async function runReview(
  store: ReviewStore,
  claude: Anthropic | null,
  { tags = true }: { tags?: boolean } = {},
) {
  // The model reads the wording; if it cannot, the keyword rules decide so nobody waits on an outage.
  const check = async (p: PetitionText) => {
    try {
      if (!claude) throw new Error('ANTHROPIC_API_KEY is not set.');
      return await screenWithClaude(claude, p);
    } catch (error) {
      console.warn('AI screening unavailable, using the fallback rules:', error);
      return screenText(petitionBody(p));
    }
  };
  // New petitions first: their organizers are waiting to go public.
  let checked = 0;
  for (const p of await store.publishQueue()) {
    await store.checked(p.id, await check(p.petition), p.seen);
    checked++;
  }
  const { reports, petitions, vocabulary } = await store.queue();
  const known = new Set<string>([...starterTags, ...vocabulary]);
  let screened = 0;
  let tagged = 0;
  for (const r of reports) {
    await store.screened(r.petitionId, await check(r.petition));
    screened++;
  }
  if (claude && tags)
    for (const p of petitions) {
      try {
        const tags = await tagWithClaude(claude, p.petition, [...known]);
        tags.forEach((t) => known.add(t));
        await store.tagged(p.id, tags, p.seen);
        tagged++;
      } catch (error) {
        console.warn('AI tagging failed; will retry on the next pass:', error);
      }
    }
  return { checked, screened, tagged };
}
