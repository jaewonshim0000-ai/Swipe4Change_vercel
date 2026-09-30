import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  PetitionText,
  ScreenCategory,
  normalizeTags,
  screenCategories,
} from '../../supabase/functions/_shared/civic-rules';

/** The AI jobs the local demo asks the dev server for. Hosted mode runs them in an Edge Function. */
export interface CivicAi {
  tags(petition: PetitionText, vocabulary: string[]): Promise<string[]>;
  screen(petition: PetitionText): Promise<ScreenCategory[]>;
}

// Web calls its own origin; a phone reaches the dev server it loaded the app from.
function endpoint() {
  if (Platform.OS === 'web') return '/api/ai';
  const host = Constants.expoConfig?.hostUri;
  if (!host) throw new Error('AI review runs on the development server.');
  return `http://${host}/api/ai`;
}

async function post(body: object): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(endpoint(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`AI review is unavailable (${response.status}).`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Only the public wording leaves the device, never counts, signers or discussion.
const textOf = ({ title, summary, problem, action, recipient }: PetitionText): PetitionText => ({
  title,
  summary,
  problem,
  action,
  recipient,
});

export const demoAi: CivicAi = {
  async tags(petition, vocabulary) {
    const result = (await post({ task: 'tags', petition: textOf(petition), vocabulary })) as {
      tags?: unknown;
    };
    const tags = Array.isArray(result.tags) ? normalizeTags(result.tags.map(String)) : [];
    if (!tags.length) throw new Error('No tags returned.');
    return tags;
  },
  async screen(petition) {
    const result = (await post({ task: 'screen', petition: textOf(petition) })) as {
      categories?: unknown;
    };
    if (!Array.isArray(result.categories)) throw new Error('No review returned.');
    return screenCategories.filter((c) => (result.categories as unknown[]).includes(c));
  },
};
