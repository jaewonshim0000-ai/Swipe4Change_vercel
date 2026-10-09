import {
  PetitionText,
  ScreenCategory,
  petitionBody,
  screenText,
} from '../../supabase/functions/_shared/civic-rules';

/**
 * Reports are reviewed by an AI model (supabase/functions/_shared/civic-ai.ts). It reads the
 * petition, never the reporter's reason, so reporting a clean petition (however often) cannot hide
 * it. These keyword rules are the fallback when the model cannot be reached.
 */
export { screenRules, screenText } from '../../supabase/functions/_shared/civic-rules';
export type { ScreenCategory } from '../../supabase/functions/_shared/civic-rules';

export const screenLabels: Record<ScreenCategory, string> = {
  spam: 'spam',
  threats: 'threats',
  harassment: 'insults or profanity',
  hate: 'hateful language',
  nonsense: 'text that is not a real request',
};

/** The rule-based fallback over everything a reader sees on the petition. */
export const screenPetition = (p: PetitionText) => screenText(petitionBody(p));
