import { Draft } from './model';

/**
 * A deterministic readability and clarity check for petition text.
 *
 * Civic documents are famously hard to read, and an unreadable petition excludes the neighbours it
 * claims to speak for. Everything here is a pure function over the author's own words: it never
 * rewrites, never invents a fact, and never blocks publishing. It reports, the author decides.
 *
 * The heuristics are deliberately simple and well understood rather than clever. A syllable
 * estimator and a be-verb/participle scan will both be wrong on some sentences; the cost of that
 * is one ignorable suggestion, and the benefit is a check that runs offline with no model and can
 * be read and argued with by the student maintaining it.
 */

/** Vowel-group estimate with the usual silent-e correction. Good enough for a grade level. */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '')
    .match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => /[a-z]/i.test(s));
}

export function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
}

/** Flesch–Kincaid grade level. Returns 0 for text too short to judge. */
export function gradeLevel(text: string): number {
  const sentences = sentencesOf(text);
  const words = wordsOf(text);
  if (sentences.length === 0 || words.length < 10) return 0;
  const beats = words.reduce((total, w) => total + syllables(w), 0);
  const grade = 0.39 * (words.length / sentences.length) + 11.8 * (beats / words.length) - 15.59;
  return Math.max(1, Math.round(grade * 10) / 10);
}

/**
 * Irregular past participles that a `-ed` test misses. Not exhaustive, and does not need to be —
 * a missed passive clause costs nothing, while a false positive costs the author a moment.
 */
const participles =
  'done|made|given|taken|seen|held|built|put|sent|told|shown|kept|left|found|brought|written|begun|chosen|driven|known|paid|set|spent|understood';
const passivePattern = new RegExp(
  `\\b(?:is|are|was|were|be|been|being)\\s+(?:\\w+ed|${participles})\\b`,
  'gi',
);

/** Clauses that hide who is meant to act. "Lighting will be improved" — by whom? */
export function passiveClauses(text: string): string[] {
  return [...new Set(text.match(passivePattern) ?? [])].map((m) => m.trim());
}

/** Words that sound like a request but name no action anyone could carry out or refuse. */
const vagueTerms = [
  'improve',
  'enhance',
  'address the issue',
  'raise awareness',
  'look into',
  'do something',
  'take action',
  'as soon as possible',
  'better',
  'promote',
  'consider',
  'explore options',
  'prioritize',
];

export function vagueTermsIn(text: string): string[] {
  const lower = text.toLowerCase();
  return vagueTerms.filter((term) => new RegExp(`\\b${term}\\b`).test(lower));
}

/** A request an office can schedule usually carries a number, a count, or a date. */
export function hasMeasurableDetail(text: string): boolean {
  return /\d/.test(text) || /\b(each|every|per|weekly|monthly|daily|annually)\b/i.test(text);
}

export type ClarityIssue = {
  /** Stable key so the UI can test one suggestion without matching on prose. */
  id: string;
  severity: 'warn' | 'tip';
  field: 'action' | 'problem' | 'summary' | 'title' | 'overall';
  message: string;
  sample?: string;
};

/** The reading level a public civic document should aim for. */
export const TARGET_GRADE = 9;
const LONG_SENTENCE_WORDS = 28;

export function plainLanguage(d: Partial<Draft>): {
  grade: number;
  words: number;
  longSentences: string[];
  issues: ClarityIssue[];
} {
  const action = d.action?.trim() ?? '';
  const problem = d.problem?.trim() ?? '';
  const summary = d.summary?.trim() ?? '';
  const body = [problem, action].filter(Boolean).join(' ');
  const grade = gradeLevel(body);
  const longSentences = sentencesOf(body).filter((s) => wordsOf(s).length > LONG_SENTENCE_WORDS);
  const issues: ClarityIssue[] = [];

  if (grade > TARGET_GRADE)
    issues.push({
      id: 'grade',
      severity: 'warn',
      field: 'overall',
      message: `This reads at about a grade ${grade} level. Aim for grade ${TARGET_GRADE} or below so every neighbour can read it. Shorter sentences and plainer words both help.`,
    });

  for (const sentence of longSentences.slice(0, 2))
    issues.push({
      id: 'long-sentence',
      severity: 'tip',
      field: 'overall',
      message: `One sentence runs to ${wordsOf(sentence).length} words. Splitting it in two usually makes the ask clearer.`,
      sample: sentence.slice(0, 90),
    });

  const passive = passiveClauses(body);
  if (passive.length)
    issues.push({
      id: 'passive',
      severity: 'tip',
      field: 'overall',
      message:
        'Some sentences do not say who acts. Naming the office that should do the thing makes the request harder to deflect.',
      sample: passive.slice(0, 3).join(' · '),
    });

  const vague = vagueTermsIn(action);
  if (vague.length)
    issues.push({
      id: 'vague-action',
      severity: 'warn',
      field: 'action',
      message: `“${vague[0]}” does not describe something an office can schedule. Say what should change, where, and by when.`,
      sample: vague.join(' · '),
    });

  if (action.length >= 10 && !hasMeasurableDetail(action))
    issues.push({
      id: 'unmeasurable',
      severity: 'warn',
      field: 'action',
      message:
        'Your requested action has no number or date in it. “Install three lights on the Eastbridge path by March” can be answered; “make the path safer” cannot.',
    });

  if (summary && wordsOf(summary).length > 35)
    issues.push({
      id: 'long-summary',
      severity: 'tip',
      field: 'summary',
      message:
        'The summary is what people read on a card. One sentence under 35 words carries best.',
    });

  if (d.title && wordsOf(d.title).length > 12)
    issues.push({
      id: 'long-title',
      severity: 'tip',
      field: 'title',
      message: 'Titles over about a dozen words get cut off on a phone card.',
    });

  return { grade, words: wordsOf(body).length, longSentences, issues };
}
