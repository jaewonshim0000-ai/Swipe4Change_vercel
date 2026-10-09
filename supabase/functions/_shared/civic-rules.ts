/**
 * Shared by the app, the local demo's API route and the ai-review Edge Function, so it imports
 * nothing. Relative imports of this file keep the `.ts` extension because Deno requires it.
 */

/** Petition topics. The app's model re-exports these; the AI writer picks one of them. */
export const petitionTopics = [
  'Safer streets',
  'Environment',
  'Education',
  'Public spaces',
  'Accessibility',
] as const;

/** The public text of a petition: the only thing ever sent to the AI model. */
export interface PetitionText {
  title: string;
  summary: string;
  problem: string;
  action: string;
  recipient: string;
}

/**
 * Tags the model is steered toward, so related petitions share tags instead of near-synonyms.
 * It may add a new tag when none of these fit; new tags then join the vocabulary for later
 * petitions. src/domain/tags.ts keeps a word-matching rule per starter tag as the offline fallback.
 */
export const starterTags = [
  'lighting',
  'crossings',
  'cycling',
  'transit',
  'traffic',
  'students',
  'schools',
  'campus',
  'families',
  'trees',
  'gardens',
  'parks',
  'recreation',
  'libraries',
  'study',
  'evenings',
  'water',
  'waste',
  'mobility',
  'sensory',
  'maintenance',
  'seniors',
  'food',
  'health',
  'housing',
] as const;

/** Lowercase hyphenated slugs, deduplicated, at most eight. Anything else is dropped. */
export function normalizeTags(tags: readonly string[]): string[] {
  const slugs = tags
    .map((t) =>
      t
        .toLowerCase()
        .replace(/^#/, '')
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9-]/g, ''),
    )
    .filter((t) => t.length >= 2 && t.length <= 40);
  return [...new Set(slugs)].slice(0, 8);
}

// Alphabetical, the order every review result is reported in.
export const screenCategories = ['harassment', 'hate', 'nonsense', 'spam', 'threats'] as const;
export type ScreenCategory = (typeof screenCategories)[number];

/**
 * Offline fallback for the AI review, used only when the model cannot be reached. Keyword rules
 * catch obvious spam, threats, insults and hateful language and miss anything subtler. Text is
 * lowercased before matching.
 */
const B = '(^|[^a-z])';
const E = '([^a-z]|$)';
export const screenRules: readonly { category: ScreenCategory; pattern: string }[] = [
  // Gibberish, placeholder text and test posts. Repeated punctuation ("Fix it!!!") is fine.
  {
    category: 'nonsense',
    pattern: '([a-z])\\1{5,}|asdf|qwert|zxcv|hjkl|sdfg|dfgh|uiop|lorem ipsum',
  },
  {
    category: 'nonsense',
    pattern: `${B}(this is (just )?a test|test (petition|post)|testing 123|please ignore|ignore this)${E}`,
  },
  {
    category: 'spam',
    pattern: `${B}(buy now|click here|free money|act now|limited time offer|work from home|crypto giveaway|bitcoin|promo code|discount code|casino|dm me|followers for sale)${E}`,
  },
  {
    category: 'threats',
    pattern: `${B}(i will|we will|i.?m going to|we.?re going to|gonna) (kill|shoot|stab|hurt|beat up) (you|him|her|them|everyone|anyone)${E}`,
  },
  {
    category: 'threats',
    pattern: `${B}(kill yourself|kys|(you|he|she|they) (should|deserve to) die|hope (you|he|she|they) die)${E}`,
  },
  {
    category: 'harassment',
    pattern: `${B}(fuck(ing|er|ers|ed)?|shit(ty)?|bitch(es)?|asshole|bastards?|dickhead|cunt|motherfucker|stfu|idiots?|morons?|retard(s|ed)?|losers?)${E}`,
  },
  {
    category: 'hate',
    pattern: `${B}(immigrants|refugees|muslims|jews|christians|gays|lesbians|trans people|black people|white people|asians|latinos|mexicans|women|men) (are|is) (all )?(inferior|evil|disgusting|subhuman|animals|vermin|parasites|criminals)${E}`,
  },
  {
    category: 'hate',
    pattern: `${B}(go back to (your|their) (own )?country|subhuman|ethnic cleansing)${E}`,
  },
];

/** Categories found in any text, sorted and unique. Empty means nothing was found. */
export function screenText(text: string): ScreenCategory[] {
  const lower = text.toLowerCase();
  return [
    ...new Set(screenRules.filter((r) => new RegExp(r.pattern).test(lower)).map((r) => r.category)),
  ].sort();
}

export const petitionBody = (p: PetitionText) =>
  [p.title, p.summary, p.problem, p.action, p.recipient].join('\n');
